import express from 'express'
import asyncHandler from 'express-async-handler'
import passport from 'passport'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import session from 'express-session'
import connectRedis from 'connect-redis'
import laundryRouter from './laundry/router'
import laundryDXRouter from './laundry_dx/router'
import pool from './db'

const RedisStore = connectRedis(session)

const app = express()
app.set('trust proxy', 1)
app.use(session({
  store: new RedisStore({ host: 'redis' }),
  secret: process.env.SESSION_SECRET || '',
  resave: false
}))
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID || '',
  clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  callbackURL: `${process.env.FRONTEND}/api/connect/facebook/callback`
}, (accessToken, refreshToken, profile, done) => {
  const connected = `fb:${profile.id}`
  done(null, { connected })
}))
app.use(passport.initialize())

const createOrUpdateUser = async (connected: string) => {
  const queryResult = await pool.query(`
    INSERT INTO users (connected, logged_in_at) VALUES ($1, current_timestamp)
    ON CONFLICT (connected) DO UPDATE SET logged_in_at = current_timestamp
    RETURNING id;`, [connected])
  return queryResult.rows[0].id
}
const router = express.Router()
router.get('/connect/facebook', passport.authenticate('facebook'))
router.get('/connect/facebook/callback', passport.authenticate('facebook', { session: false }), asyncHandler(async (req, res) => {
  const { connected } = req.user
  if (req.session) {
    req.session.userId = await createOrUpdateUser(connected)
  }
  res.redirect('/')
}))
router.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.userId
  }
  res.redirect('/')
})
router.use('/mai', laundryRouter)
router.use('/mdx', laundryDXRouter)

app.use('/api', router)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err.exposed) {
    console.log(err) // eslint-disable-line no-console
    res.status(500).send(JSON.stringify({ err: 'internal' }))
  } else {
    res.status(err.status).send(JSON.stringify({ err: err.message }))
  }
})

app.listen(8585)
