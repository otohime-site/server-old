import express from 'express'
import cors from 'cors'
import asyncHandler from 'express-async-handler'
import { param, body, validationResult, matchedData } from 'express-validator'
import { error, requireUser } from '../utils'
import pool from '../db'

const VALID_LEVELS = [
  '1', '2', '3', '4', '5', '6',
  '7', '7+', '8', '8+', '9', '9+',
  '10', '10+', '11', '11+', '12', '12+',
  '13', '13+', '14']

const LAUNDRY_CORS = {
  origin: ['https://maimaidx.jp'],
  allowedHeaders: 'Content-Type',
  credentials: true
}

const requireNicknameAccess = asyncHandler(async (req, res, next) => {
  const { nickname } = req.params
  const { user } = req
  if (nickname === 'me') {
    error(422, 'validation')
  }
  const queryResult = await pool.query('SELECT id, nickname, user_id FROM laundry_dx_players WHERE nickname = $1 AND user_id = $2;', [nickname, user.id])
  if (queryResult.rows.length === 0) {
    error(404, 'not_exists')
  }
  [req.player] = queryResult.rows
  next()
})

const requireNicknamePublic = asyncHandler(async (req, res, next) => {
  const { user } = req
  const { nickname } = req.params
  const queryResult = await pool.query('SELECT * FROM laundry_dx_players WHERE nickname = $1;', [nickname])
  if (queryResult.rows.length === 0) {
    error(404, 'not_found')
  }
  const [player] = queryResult.rows
  if (player.privacy === 'private' && (!user || player.user_id !== user.id)) {
    error(403, 'private')
  }
  req.player = player
  next()
})

const router = express.Router()

router.get('/me', cors(LAUNDRY_CORS), requireUser(true), asyncHandler(async (req, res) => {
  const { user } = req
  const queryResult = await pool.query('SELECT * FROM laundry_dx_players WHERE user_id = $1;', [user.id])
  res.send(JSON.stringify(queryResult.rows))
}))
router.get('/songs', asyncHandler(async (req, res) => {
  const queryResult = await pool.query('SELECT * FROM laundry_dx_songs ORDER BY seq ASC;')
  res.send(JSON.stringify(queryResult.rows))
}))
router.get('/:nickname', requireUser(false), requireNicknamePublic, asyncHandler(async (req, res) => {
  const { player } = req

  const recordResult = await pool.query('SELECT * FROM laundry_dx_records_recent WHERE player_id = $1;', [player.id])
  if (recordResult.rows.length > 0) {
    [player.record] = recordResult.rows
  }
  const scoreResult = await pool.query('SELECT song_id, difficulty, score, flag FROM laundry_dx_scores_recent WHERE player_id = $1;', [player.id])
  if (scoreResult.rows.length > 0) {
    player.scores = scoreResult.rows
  }
  res.send(JSON.stringify(player))
}))
router.get('/:nickname/timeline', requireUser(false), requireNicknamePublic, asyncHandler(async (req, res) => {
  const { player } = req

  const timelineResult = await pool.query(`
    WITH periods AS (
    SELECT DISTINCT period FROM laundry_dx_records_history WHERE player_id = $1 UNION
    SELECT DISTINCT period FROM laundry_dx_records_recent WHERE player_id = $1 UNION
    SELECT DISTINCT period FROM laundry_dx_scores_recent WHERE player_id = $1 UNION
    SELECT DISTINCT period FROM laundry_dx_scores_history WHERE player_id = $1),
    bounds AS (SELECT DISTINCT upper(period) AS period FROM periods WHERE upper_inf(period) = false UNION
    SELECT DISTINCT lower(period) AS period FROM periods ORDER BY period desc)
    SELECT to_json(period) as period FROM bounds;
  `, [player.id])
  res.send(JSON.stringify(timelineResult.rows.map(val => val.period)))
}))
router.get('/:nickname/timeline/:time', requireUser(false), requireNicknamePublic, [
  param('time').isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    error(422, 'validation')
  }
  const { player } = req
  const { time } = req.params

  const recordResult = await pool.query(`
    SELECT *, 'before' AS from FROM laundry_dx_records_history WHERE player_id = $1 AND period -|- tstzrange($2, 'infinity') UNION
    SELECT *, 'after' AS from FROM laundry_dx_records_recent WHERE player_id = $1 AND period -|- tstzrange('-infinity', $2) UNION
    SELECT *, 'after' AS from FROM laundry_dx_records_history WHERE player_id = $1 AND period -|- tstzrange('-infinity', $2);
  `, [player.id, time])
  const scoreResult = await pool.query(`
    SELECT *, 'before' AS from FROM laundry_dx_scores_history WHERE player_id = $1 AND score > 0 AND period -|- tstzrange($2, 'infinity') UNION
    SELECT *, 'after' AS from FROM laundry_dx_scores_recent WHERE player_id = $1 AND score > 0 AND period -|- tstzrange('-infinity', $2) UNION
    SELECT *, 'after' AS from FROM laundry_dx_scores_history WHERE player_id = $1 AND score > 0 AND period -|- tstzrange('-infinity', $2);
  `, [player.id, time])
  res.send(JSON.stringify({
    records: recordResult.rows,
    scores: scoreResult.rows
  }))
}))
router.post('/new', express.json(), requireUser(true), [
  body('nickname').matches(/^[0-9a-z\-_]+$/),
  body('privacy').matches(/^(public|anonymous|private)$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(errors.mapped()) // eslint-disable-line no-console
    error(422, 'validation')
  }
  const data = matchedData(req)
  const { nickname, privacy } = data
  const { user } = req
  if (nickname === 'me') {
    error(422, 'validation')
  }
  const queryResult = await pool.query('SELECT id FROM laundry_dx_players WHERE nickname = $1;', [nickname])
  if (queryResult.rows.length > 0) {
    error(400, 'exists')
    return
  }
  await pool.query('INSERT INTO laundry_dx_players (nickname, user_id, privacy) VALUES ($1, $2, $3);', [nickname, user.id, privacy])
  res.send(JSON.stringify({}))
}))

router.post('/:nickname/update', express.json(), requireUser(true), requireNicknameAccess, [
  body('nickname').matches(/[0-9a-z\-_]/),
  body('privacy').matches(/^(public|anonymous|private)$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(errors.mapped()) // eslint-disable-line no-console
    error(422, 'validation')
  }
  const data = matchedData(req)
  const { player } = req
  let newNickname = player.nickname
  if (data.nickname !== player.nickname) {
    const existsResult = await pool.query('SELECT id FROM laundry_dx_players WHERE nickname = $1;', [data.nickname])
    if (existsResult.rows.length > 0) {
      error(400, 'exists')
    }
    newNickname = data.nickname
  }
  await pool.query('UPDATE laundry_dx_players SET nickname = $1, privacy = $2 WHERE id = $3;', [newNickname, data.privacy, player.id])
  res.send(JSON.stringify({}))
}))

router.post('/:nickname/delete', express.json(), requireUser(true), requireNicknameAccess, [
  body('confirm_nickname').matches(/[0-9a-z\-_]/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(errors.mapped()) // eslint-disable-line no-console
    error(422, 'validation')
  }
  const data = matchedData(req)
  const { player } = req
  if (player.nickname !== data.confirm_nickname) {
    error(422, 'validation')
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM laundry_dx_scores_recent WHERE player_id = $1', [player.id])
    await client.query('DELETE FROM laundry_dx_scores_history WHERE player_id = $1', [player.id])
    await client.query('DELETE FROM laundry_dx_records_recent WHERE player_id = $1', [player.id])
    await client.query('DELETE FROM laundry_dx_records_history WHERE player_id = $1', [player.id])
    await client.query('DELETE FROM laundry_dx_players WHERE id = $1', [player.id])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  res.send(JSON.stringify({}))
}))

router.options('/:nickname', cors(LAUNDRY_CORS))
router.post('/:nickname', cors(LAUNDRY_CORS), express.json({ limit: '5mb' }), requireUser(true), requireNicknameAccess, [
  body('cardName').isString(),
  body('rating').isInt({ min: 0, max: 100000 }),
  body('maxRating').isInt({ min: 0, max: 100000 }),
  body('title').isString(),
  body('class').isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(errors.mapped()) // eslint-disable-line no-console
    error(422, 'validation')
  }
  const data = matchedData(req)
  const { player } = req
  // Validate data, and make sure the scores are non-decreasing.
  const scoreQueryResult = await pool.query(
    `SELECT song_id, difficulty, score, laundry_dx_songs.category as category, laundry_dx_songs.name as name
     FROM laundry_dx_scores_recent
     JOIN laundry_dx_songs ON laundry_dx_scores_recent.song_id = laundry_dx_songs.id
     WHERE player_id = $1;`,
    [player.id]
  )
  const oldScoreMap = new Map()
  for (let i = 0; i < scoreQueryResult.rows.length; i += 1) {
    const score = scoreQueryResult.rows[i]
    oldScoreMap.set(`${score.category}.${score.name}.${score.difficulty}`, score)
  }

  console.log(oldScoreMap)
  const { scores } = req.body
  if (!Array.isArray(scores)) {
    error(422, 'validation')
  }
  for (let i = 0; i < scores.length; i += 1) {
    const score: {
      internalSongId: string
      category: string
      songName: string
      difficulty: number
      level: string
      score: number
      flag: string
    } = scores[i]
    // Song ID will be a 172 characters
    // first 128 as hex
    // last 44 as base64
    if (score.internalSongId.length !== 172
        || score.internalSongId.search(/^[0-9a-z]{128}[0-9A-Za-z\+\/]{43}=$/) !== 0) {
      error(422, 'validation')
    }
    if (!score.category || !score.songName) {
      error(422, 'validation')
    }
    if (!Number.isInteger(score.difficulty)
        || score.difficulty < 0 || score.difficulty > 5) {
      error(422, 'validation')
    }
    if (!score.level || !VALID_LEVELS.includes(score.level)) {
      error(422, 'validation')
    }
    if (!Number.isFinite(score.score) || score.score < 0 || score.score > 101) {
      error(422, 'validation')
    }
    const oldScoreData = oldScoreMap.get(`${score.category}.${score.songName}.${score.difficulty}`)
    const oldScore = (oldScoreData) ? parseFloat(oldScoreData.score) : 0
    if (score.score < oldScore) {
      error(422, 'validation')
    }
    oldScoreMap.delete(`${score.category}.${score.songName}.${score.difficulty}`)
    if (score.flag) {
      const flags = score.flag.split('|')
      for (let j = 0; j < flags.length; j += 1) {
        if (flags[j].search(/^(fc|fcp|ap|app|fs|fsp|fsd|fsdp)$/) === -1) {
          error(422, 'validation')
        }
      }
    }
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO laundry_dx_records_recent
      (player_id, card_name, rating, max_rating, title, class) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(player_id) DO UPDATE SET card_name = $2, rating = $3, max_rating = $4, title = $5, class = $6;`,
      [player.id, data.cardName, data.rating, data.maxRating, data.title, data.class]
    )

    const promises = []
    for (let i = 0; i < scores.length; i += 1) {
      const score = scores[i]
      if (score.difficulty === 0) {
        // Only update the song sequence and level, insert the category and song name.
        const songQuery = {
          name: 'insert-songs',
          text: `INSERT INTO laundry_dx_songs
          (seq, category, name, deluxe, active) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(category, name, deluxe) DO UPDATE SET seq = $1, active = $5;`,
          values: [i, score.category, score.songName, !!score.deluxe, true]
        }
        await client.query(songQuery)
      }
      const songLevelQuery = {
        name: 'update-songs-level',
        text: `UPDATE laundry_dx_songs SET levels[$1] = $2 WHERE category = $3 AND name = $4 AND deluxe = $5 RETURNING id;`,
        values: [score.difficulty, score.level, score.category, score.songName, !!score.deluxe]
      }
      const queryResult = await client.query(songLevelQuery)
      const songId = queryResult.rows[0].id

      const query = {
        name: 'insert-scores-recent',
        text: `INSERT INTO laundry_dx_scores_recent
        (player_id, song_id, difficulty, score, flag) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(player_id, song_id, difficulty) DO UPDATE SET score = $4, flag = $5;`,
        values: [player.id, songId, score.difficulty,
          score.score, score.flag]
      }
      promises.push(client.query(query))
    }
    // Clear up deleted songs if possible.
    console.log(oldScoreMap)
    oldScoreMap.forEach((score) => {
      const query = {
        name: 'delete-scores-recent',
        text: 'DELETE FROM laundry_dx_scores_recent WHERE player_id = $1 AND song_id = $2 AND difficulty = $3;',
        values: [player.id, score.song_id, score.difficulty]
      }
      promises.push(client.query(query))
    })
    await Promise.all(promises)
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  res.send(JSON.stringify({}))
}))

export default router
