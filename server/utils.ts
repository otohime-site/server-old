import asyncHandler from 'express-async-handler'
import pool from './db'

class ServerError extends Error {
  status?: number
  exposed?: boolean
}

export const error = (status: number, message: string) => {
  /* Koa-style error throwing. */
  const err = new ServerError(message)
  err.status = status
  err.exposed = true
  throw err
}

export const requireUser = (throwWhenNoUser: boolean) => (asyncHandler(async (req, res, next) => {
  const { userId } = req.session || { userId: undefined }
  req.user = undefined
  if (userId) {
    const queryResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
    [req.user] = queryResult.rows
  }
  if (throwWhenNoUser && !req.user) {
    exports.error(403, 'user')
  }
  next()
}))
