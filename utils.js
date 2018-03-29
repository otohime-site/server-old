exports.asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

exports.userRequired = (req, res, next) => {
  const models = require('./models');
};
