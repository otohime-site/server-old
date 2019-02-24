const { Pool } = require('pg');
const express = require('express');
const asyncHandler = require('express-async-handler');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const { param, body, validationResult } = require('express-validator/check');
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

const requireUser = throwWhenNoUser => (asyncHandler(async (req, res, next) => {
  const { userId } = req.session;
  req.user = undefined;
  if (userId) {
    const queryResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
    [req.user] = queryResult.rows;
  }
  if (throwWhenNoUser && !req.user) {
    error(403, 'user');
  }
  next();
}));

const requireNicknameAccess = asyncHandler(async (req, res, next) => {
  const { nickname } = req.params;
  const { user } = req;
  if (nickname === 'me') {
    error(422, 'validation');
  }
  const queryResult = await pool.query('SELECT id, nickname, user_id FROM laundry_players WHERE nickname = $1 AND user_id = $2;', [nickname, user.id]);
  if (queryResult.rows.length === 0) {
    error(404, 'not_exists');
  }
  [req.player] = queryResult.rows;
  next();
});

const requireNicknamePublic = asyncHandler(async (req, res, next) => {
  const { user } = req;
  const { nickname } = req.params;
  const queryResult = await pool.query('SELECT * FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length === 0) {
    error(404, 'not_found');
  }
  const [player] = queryResult.rows;
  if (player.privacy === 'private' && (!user || player.user_id !== user.id)) {
    error(403, 'private');
  }
  req.player = player;
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
router.get('/connect/facebook', passport.authenticate('facebook'));
router.get('/connect/facebook/callback', passport.authenticate('facebook', { session: false }), asyncHandler(async (req, res) => {
  const { connected } = req.user;
  req.session.userId = await createOrUpdateUser(connected);
  res.redirect('/');
}));
router.get('/logout', (req, res) => {
  delete req.session.userId;
  res.redirect('/');
});
router.get('/mai/me', requireUser(true), asyncHandler(async (req, res) => {
  const { user } = req;
  const queryResult = await pool.query('SELECT * FROM laundry_players WHERE user_id = $1;', [user.id]);
  res.send(JSON.stringify(queryResult.rows));
}));
router.get('/mai/songs', asyncHandler(async (req, res) => {
  const queryResult = await pool.query('SELECT * FROM laundry_songs ORDER BY seq ASC;');
  res.send(JSON.stringify(queryResult.rows));
}));
router.get('/mai/:nickname', requireUser(false), requireNicknamePublic, asyncHandler(async (req, res) => {
  const { player } = req;

  const recordResult = await pool.query('SELECT * FROM laundry_records_recent WHERE player_id = $1;', [player.id]);
  if (recordResult.rows.length > 0) {
    [player.record] = recordResult.rows;
  }
  const scoreResult = await pool.query('SELECT song_id, difficulty, score, raw_score, flag FROM laundry_scores_recent WHERE player_id = $1;', [player.id]);
  if (scoreResult.rows.length > 0) {
    player.scores = scoreResult.rows;
  }
  res.send(JSON.stringify(player));
}));
router.get('/mai/:nickname/timeline', requireUser(false), requireNicknamePublic, asyncHandler(async (req, res) => {
  const { player } = req;

  const timelineResult = await pool.query(`
    WITH periods AS (
    SELECT DISTINCT period FROM laundry_records WHERE player_id = $1 UNION
    SELECT DISTINCT period FROM laundry_scores WHERE player_id = $1),
    bounds AS (SELECT DISTINCT upper(period) AS period FROM periods WHERE upper_inf(period) = false UNION
    SELECT DISTINCT lower(period) AS period FROM periods ORDER BY period desc)
    SELECT to_json(period) as period FROM bounds;
  `, [player.id]);
  res.send(JSON.stringify(timelineResult.rows.map(val => val.period)));
}));
router.get('/mai/:nickname/timeline/:time', requireUser(false), requireNicknamePublic, [
  param('time').isISO8601(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    error(422, 'validation');
  }
  const { player } = req;
  const { time } = req.params;

  const recordResult = await pool.query(`
    SELECT *, 'before' AS from FROM laundry_records WHERE player_id = $1 AND period -|- tstzrange($2, 'infinity') UNION
    SELECT *, 'after' AS from FROM laundry_records WHERE player_id = $1 AND period -|- tstzrange('-infinity', $2);
  `, [player.id, time]);
  const scoreResult = await pool.query(`
    SELECT *, 'before' AS from FROM laundry_scores WHERE player_id = $1 AND score > 0 AND period -|- tstzrange($2, 'infinity') UNION
    SELECT *, 'after' AS from FROM laundry_scores WHERE player_id = $1 AND score > 0 AND period -|- tstzrange('-infinity', $2);
  `, [player.id, time]);
  res.send(JSON.stringify({
    records: recordResult.rows,
    scores: scoreResult.rows,
  }));
}));
router.post('/mai/new', express.json(), requireUser(true), [
  body('nickname').matches(/^[0-9a-z\-_]+$/),
  body('privacy').matches(/^(public|anonymous|private)$/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { nickname, privacy } = data;
  const { user } = req;
  if (nickname === 'me') {
    error(422, 'validation');
  }
  const queryResult = await pool.query('SELECT id FROM laundry_players WHERE nickname = $1;', [nickname]);
  if (queryResult.rows.length > 0) {
    error(400, 'exists');
    return;
  }
  await pool.query('INSERT INTO laundry_players (nickname, user_id, privacy) VALUES ($1, $2, $3);', [nickname, user.id, privacy]);
  res.send(JSON.stringify({}));
}));

router.post('/mai/:nickname/update', express.json(), requireUser(true), requireNicknameAccess, [
  body('nickname').matches(/[0-9a-z\-_]/),
  body('privacy').matches(/^(public|anonymous|private)$/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { player } = req;
  let newNickname = player.nickname;
  if (data.nickname !== player.nickname) {
    const existsResult = await pool.query('SELECT id FROM laundry_players WHERE nickname = $1;', [data.nickname]);
    if (existsResult.rows.length > 0) {
      error(400, 'exists');
    }
    newNickname = data.nickname;
  }
  await pool.query('UPDATE laundry_players SET nickname = $1, privacy = $2 WHERE id = $3;', [newNickname, data.privacy, player.id]);
  res.send(JSON.stringify({}));
}));

router.post('/mai/:nickname/delete', express.json(), requireUser(true), requireNicknameAccess, [
  body('confirm_nickname').matches(/[0-9a-z\-_]/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { player } = req;
  if (player.nickname !== data.confirm_nickname) {
    error(422, 'validation');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM laundry_scores_recent WHERE player_id = $1', [player.id]);
    await client.query('DELETE FROM laundry_scores_history WHERE player_id = $1', [player.id]);
    await client.query('DELETE FROM laundry_records_recent WHERE player_id = $1', [player.id]);
    await client.query('DELETE FROM laundry_records_history WHERE player_id = $1', [player.id]);
    await client.query('DELETE FROM laundry_players WHERE id = $1', [player.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.send(JSON.stringify({}));
}));

router.post('/mai/:nickname', express.json({ limit: '2mb' }), requireUser(true), requireNicknameAccess, [
  body('cardName').isString(),
  body('rating').isFloat({ min: 0, max: 20 }),
  body('maxRating').isFloat({ min: 0, max: 20 }),
  body('icon').isString(),
  body('title').isString(),
  body('class').isString(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped()); // eslint-disable-line no-console
    error(422, 'validation');
  }
  const data = matchedData(req);
  const { player } = req;
  // Validate data, and make sure the scores are non-decreasing.
  const scoreQueryResult = await pool.query('SELECT song_id, difficulty, score FROM laundry_scores_recent WHERE player_id = $1;', [player.id]);
  const oldScoreMap = new Map();
  for (let i = 0; i < scoreQueryResult.rows.length; i += 1) {
    const score = scoreQueryResult.rows[i];
    oldScoreMap.set(`${score.song_id}.${score.difficulty}`, score);
  }

  const { scores } = req.body;
  if (!Array.isArray(scores)) {
    error(422, 'validation');
  }
  for (let i = 0; i < scores.length; i += 1) {
    const score = scores[i];
    if (!Number.isInteger(score.songId) || score.songId < 0) {
      error(422, 'validation');
    }
    if (!score.category || !score.songName) {
      error(422, 'validation');
    }
    if (!Number.isInteger(score.difficulty) ||
        score.difficulty < 0 || score.difficulty > 5) {
      error(422, 'validation');
    }
    if (!Number.isFinite(score.score) || score.score < 0 || score.score > 104) {
      error(422, 'validation');
    }
    if (!Number.isInteger(score.rawScore) || score.rawScore < 0) {
      error(422, 'validation');
    }
    const oldScoreData = oldScoreMap.get(`${score.songId}.${score.difficulty}`);
    const oldScore = (oldScoreData) ? parseFloat(oldScoreData.score) : 0;
    if (score.score < oldScore) {
      error(422, 'validation');
    }
    oldScoreMap.delete(`${score.songId}.${score.difficulty}`);
    if (score.flag) {
      const flags = score.flag.split('|');
      for (let j = 0; j < flags.length; j += 1) {
        if (flags[j].search(/^(fc_silver|fc_gold|ap|ap_plus|100)$/) === -1) {
          error(422, 'validation');
        }
      }
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO laundry_records_recent
      (player_id, card_name, rating, max_rating, icon, title, class) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(player_id) DO UPDATE SET card_name = $2, rating = $3, max_rating = $4, icon = $5, title = $6, class = $7;`,
      [player.id, data.cardName, data.rating, data.maxRating, data.icon, data.title, data.class],
    );

    const promises = [];
    for (let i = 0; i < scores.length; i += 1) {
      const score = scores[i];
      if (score.difficulty === 0) {
        // Only update the song sequence, insert the category and song name.
        const songQuery = {
          name: 'insert-songs',
          text: `INSERT INTO laundry_songs
          (id, seq, category, name, active) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(id) DO UPDATE SET seq = $2, active = $5;`,
          values: [score.songId, i, score.category, score.songName, true],
        };
        promises.push(client.query(songQuery));
      }
      const query = {
        name: 'insert-scores-recent',
        text: `INSERT INTO laundry_scores_recent
        (player_id, song_id, difficulty, score, raw_score, flag) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(player_id, song_id, difficulty) DO UPDATE SET score = $4, raw_score = $5, flag = $6;`,
        values: [player.id, score.songId, score.difficulty,
          score.score, score.rawScore, score.flag],
      };
      promises.push(client.query(query));
    }
    // Clear up deleted songs if possible.
    oldScoreMap.forEach((score) => {
      const query = {
        name: 'delete-scores-recent',
        text: 'DELETE FROM laundry_scores_recent WHERE player_id = $1 AND song_id = $2 AND difficulty = $3;',
        values: [player.id, score.song_id, score.difficulty],
      };
      promises.push(client.query(query));
    });
    await Promise.all(promises);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
