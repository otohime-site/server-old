const { Pool } = require('pg');
const express = require('express');
const asyncHandler = require('express-async-handler');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const { check, validationResult } = require('express-validator/check');
const { matchedData } = require('express-validator/filter');
const error = require('./utils').appThrow;

const app = express();
app.set('trust proxy', 1);
app.use(session({
  store: new RedisStore({ host: 'redis' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
}));
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: `${process.env.FRONTEND}/api/connect/facebook/callback`,
}, (accessToken, refreshToken, profile, done) => {
  const connected = `fb:${profile.id}`;
  done(null, { connected });
}));
app.use(passport.initialize());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const requireUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.session;
  if (!userId) {
    error(403, 'user');
    return;
  }
  const queryResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
  if (queryResult.rows.length !== 1) {
    error(403, 'user');
    return;
  }
  [req.user] = queryResult.rows;
  next();
});
const createOrUpdateUser = async (connected) => {
  const queryResult = await pool.query(`
    INSERT INTO users (connected, logged_in_at) VALUES ($1, current_timestamp)
    ON CONFLICT (connected) DO UPDATE SET logged_in_at = current_timestamp
    RETURNING id;`, [connected]);
  return queryResult.rows[0].id;
};
const router = express.Router();
router.get('/users', asyncHandler(async (req, res) => {
  const queryResult = await pool.query('SELECT * FROM users;');
  res.send(JSON.stringify(queryResult.rows));
}));
router.get('/connect/facebook', passport.authenticate('facebook'));
router.get('/connect/facebook/callback', passport.authenticate('facebook', { session: false }), asyncHandler(async (req, res) => {
  const { connected } = req.user;
  req.session.userId = await createOrUpdateUser(connected);
  res.redirect('/');
}));
router.get('/mai/:nickname', asyncHandler(async (req, res) => {
  const { nickname } = req.params;
  const queryResult = await pool.query('SELECT * FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length === 0) {
    error(404, 'not_found');
  }
  const player = queryResult.rows[0];
  const recordResult = await pool.query('SELECT * FROM laundry_records_recent WHERE player_id = $1;', [player.id]);
  if (recordResult.rows.length > 0) {
    [player.record] = recordResult.rows;
  }
  const scoreResult = await pool.query('SELECT * FROM laundry_scores_recent WHERE player_id = $1;', [player.id]);
  if (scoreResult.rows.length > 0) {
    player.scores = scoreResult.rows;
  }
  res.send(JSON.stringify(player));
}));
router.post('/mai/new', express.json({ limit: '50kb' }), requireUser, [
  check('nickname').matches(/[0-9a-z\-_]/),
  check('privacy').matches(/^(public|anonymous|private)$/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { nickname, privacy } = data;
  const { user } = req;
  const queryResult = await pool.query('SELECT id FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length > 0) {
    error(400, 'exists');
    return;
  }
  await pool.query('INSERT INTO laundry_players (nickname, user_id, privacy) VALUES ($1, $2, $3);', [nickname, user.id, privacy]);
  res.send(JSON.stringify({}));
}));

router.post('/mai/:nickname', express.json({ limit: '2mb' }), requireUser, [
  check('cardName').isString(),
  check('rating').isFloat({ min: 0, max: 20 }),
  check('maxRating').isFloat({ min: 0, max: 20 }),
  check('icon').isString(),
  check('title').isString(),
  check('class').isString(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { nickname } = req.params;
  const { user } = req;
  const queryResult = await pool.query('SELECT id, user_id FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length === 0) {
    error(404, 'not_exists');
    return;
  }
  const player = queryResult.rows[0];
  if (player.user_id !== user.id) {
    error(403, 'forbidden');
    return;
  }
  await pool.query(
    `INSERT INTO laundry_records_recent
                   (player_id, card_name, rating, max_rating, icon, title, class) VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT(player_id) DO UPDATE SET card_name = $2, rating = $3, max_rating = $4, icon = $5, title = $6, class = $7;`,
    [player.id, data.cardName, data.rating, data.maxRating, data.icon, data.title, data.class],
  );

  const { scores } = req.body;
  const promises = [];
  for (let i = 0; i < scores.length; i += 1) {
    const score = scores[i];
    if (!score.flag) { score.flag = ''; }
    const query = {
      name: 'insert-scores-recent',
      text: `INSERT INTO laundry_scores_recent
                     (player_id, seq, category, song_name, difficulty, score, flag) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(category, song_name, difficulty, player_id) DO UPDATE SET seq = $2, category = $3,
      song_name = $4, difficulty = $5, score = $6, flag = $7;`,
      values: [player.id, i, score.category, score.songName, score.difficulty,
        score.score, score.flag],
    };
    promises.push(pool.query(query));
  }
  await Promise.all(promises);
  res.send(JSON.stringify({}));
}));
app.use('/api', router);
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (!err.exposed) {
    console.log(err); // eslint-disable-line no-console
    res.status(500).send(JSON.stringify({ err: 'internal' }));
  } else {
    res.status(err.status).send(JSON.stringify({ err: err.message }));
  }
});

app.listen(8585);
