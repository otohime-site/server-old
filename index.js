const { Pool } = require('pg');
const express = require('express');
const uuidv4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const asyncHandler = require('express-async-handler');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');
const error = require('./utils').appThrow;

const app = express();
app.use(session({
  store: new RedisStore({ host: 'redis' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
}));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const requireUser = asyncHandler(async (req, res, next) => {
  const userId = req.body.id;
  const token = req.body.token;
  const queryResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
  if (queryResult.rows.length != 1) {
    error(403, 'user');
    return;
  }
  const user = queryResult.rows[0];
  if (!await bcrypt.compare(token, queryResult.rows[0].token)) {
    error(403, 'user');
    return;
  }
  req.user = user;
  next();
});
const router = express.Router();
router.get('/users', asyncHandler(async (req, res) => {
  const queryResult = await pool.query('SELECT * FROM users;');
  res.send(JSON.stringify(queryResult.rows));
}));
router.post('/users/new', asyncHandler(async (req, res) => {
  const rawToken = uuidv4();
  const token = await bcrypt.hash(rawToken, 10);
  const queryResult = await pool.query('INSERT INTO users (token) VALUES ($1) RETURNING id;', [token]);
  res.send(JSON.stringify({ id: queryResult.rows[0].id, token: rawToken }));
}));
router.get('/mai/:nickname', asyncHandler(async (req, res) => {
  const nickname = req.params.nickname;
  const queryResult = await pool.query('SELECT * FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length == 0) {
    error(404, 'not_found');
  }
  const player = queryResult.rows[0];
  const recordResult = await pool.query('SELECT * FROM laundry_records_recent WHERE player_id = $1;', [player.id]);
  if (recordResult.rows.length > 0) {
    player.record = recordResult.rows[0];
  }
  const scoreResult = await pool.query('SELECT * FROM laundry_scores_recent WHERE player_id = $1;', [player.id]);
  if (scoreResult.rows.length > 0) {
    player.scores = scoreResult.rows;
  }
  res.send(JSON.stringify(player));
}));
router.post('/mai/new', express.json({ limit: '50kb' }), requireUser, [
  check('nickname').matches(/[0-9a-z\-\_]/),
  check('privacy').matches(/^(public|anonymous|private)$/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped());
    error(422, 'validation');
  }
  const data = matchedData(req);
  const nickname = data.nickname;
  const privacy = data.privacy;
  const user = req.user;
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
    console.log(errors.mapped());
    error(422, 'validation');
  }
  const data = matchedData(req);
  const nickname = req.params.nickname;
  const user = req.user;
  const queryResult = await pool.query('SELECT id, user_id FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length == 0) {
    error(404, 'not_exists');
    return;
  }
  const player = queryResult.rows[0];
  if (player.user_id != user.id) {
    error(403, 'forbidden');
    return;
  }
  await pool.query(
    `INSERT INTO laundry_records_recent
                   (player_id, card_name, rating, max_rating, icon, title, class) VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT(player_id) DO UPDATE SET card_name = $2, rating = $3, max_rating = $4, icon = $5, title = $6, class = $7;`,
    [player.id, data.cardName, data.rating, data.maxRating, data.icon, data.title, data.class],
  );

  const scores = req.body.scores;
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    if (!score.flag) { score.flag = ''; }
    const query = {
      name: 'insert-scores-recent',
      text: `INSERT INTO laundry_scores_recent
                     (player_id, seq, category, song_name, difficulty, score, flag) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(category, song_name, difficulty, player_id) DO UPDATE SET seq = $2, category = $3, song_name = $4, difficulty = $5, score = $6, flag = $7;`,
      values: [player.id, i, score.category, score.songName, score.difficulty, score.score, score.flag],
    };
    await pool.query(query);
  }
  res.send(JSON.stringify({}));
}));
app.use('/api', router);
app.use((err, req, res, next) => {
  if (!err.exposed) {
    console.log(err);
    res.status(500).send(JSON.stringify({ err: 'internal' }));
  } else {
    res.status(err.status).send(JSON.stringify({ err: err.message }));
  }
});

app.listen(8585);
