exports.appThrow = (status, message) => {
  /* Koa-style error throwing. */
  const err = new Error(message);
  err.status = status;
  err.exposed = true;
  throw err;
};
