/* eslint-disable import/prefer-default-export */
const asyncHandler = require('express-async-handler');
const pool = require('./db');

exports.error = (status, message) => {
  /* Koa-style error throwing. */
  const err = new Error(message);
  err.status = status;
  err.exposed = true;
  throw err;
};

exports.requireUser = throwWhenNoUser => (asyncHandler(async (req, res, next) => {
  const { userId } = req.session;
  req.user = undefined;
  if (userId) {
    const queryResult = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
    [req.user] = queryResult.rows;
  }
  if (throwWhenNoUser && !req.user) {
    exports.error(403, 'user');
  }
  next();
}));
