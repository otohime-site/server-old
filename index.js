const models = require('./models');
const express = require('express');
const uuidv4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const asyncHandler = require('express-async-handler');
const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');
const error = require('./utils').appThrow;
const bodyParser = express.urlencoded({extended: true});
var app = express();

var requireUser = asyncHandler(async (req, res, next) => {
  var userId = req.body.id;
  var token = req.body.token;
  var user = await models.user.findOne({where: {'id': userId}});
  if (!user) {
    error(403, "user");
    return;
  }
  if (!await bcrypt.compare(token, user.token)) {
    error(403, "user");
    return;
  }
  req.user = user;
  next();
});
app.get('/users', asyncHandler(async (req, res) => {
  var users = await models.user.findAll();
  res.send(JSON.stringify(users));
}));
app.post('/users/new', asyncHandler(async (req, res) => {
  var rawToken = uuidv4();
  var token = await bcrypt.hash(rawToken, 10);
  var user = await models.user.create({token: token});
  res.send(JSON.stringify({id: user.id, token: rawToken}));
}));
app.get('/mai/:nickname', asyncHandler(async (req, res) => {
  var nickname = req.params.nickname;
  var player = await models.laundryPlayer.findOne({
    where: {'nickname': nickname},
    include: [
      {model: models.laundryRecordRecent},
      {model: models.laundryScoreRecent}
    ]
  });
  if (!player) {
    error(404, "not_found");
  }
  res.send(JSON.stringify(player));
}));
app.post('/mai/', bodyParser, requireUser, [
  check('nickname').matches(/[0-9a-z\-\_]/),
  check('privacy').matches(/^(public|anonymous|private)$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped());
    error(422, "validation");
  }
  var data = matchedData(req);
  var nickname = data.nickname;
  var privacy = data.privacy;
  var user = req.user;
  var player = await models.laundryPlayer.findOne({where: {'nickname': nickname}});
  if (player) {
    error(400, "exists");
    return;
  }
  var newPlayer = await models.laundryPlayer.create({'nickname': nickname, 'userId': user.id, 'privacy': privacy});
  res.send(JSON.stringify({}));
}));

app.post('/mai/:nickname', bodyParser, requireUser, [
  check('cardName').isString(),
  check('rating').isFloat({min: 0, max: 20}),
  check('maxRating').isFloat({min: 0, max: 20}),
  check('icon').isString(),
  check('title').isString(),
  check('class').isString(),
  check('scores.*.category').isString(),
  check('scores.*.songName').isString(),
  check('scores.*.difficulty').isInt({min: 1, max: 6}),
  check('scores.*.score').isFloat({min: 0, max: 104}),
  check('scores.*.flag').isString().custom((value) => {
    var values = value.split('|');
    values.forEach((val) => {
      if (!val.match(/^(fc_silver|fc_gold|ap|100)$/)) {
        throw new Error('Wrong Flag');
      }
    });
  });
  ], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.mapped());
    error(422, "validation");
  }
  var data = matchedData(req);
  var nickname = req.params.nickname;
  var user = req.user;
  var player = await models.laundryPlayer.findOne({where: {'nickname': nickname}});
  if (!player) {
    error(404, "not_exists");
    return;
  }
  if (player.userId != user.id) {
    error(403, "forbidden");
    return;
  }
  var scores = data.scores;
  delete data.scores;
  var newRecord = await models.laundryRecordRecent.upsert(Object.assign(data, {
    'laundryPlayerId': player.id
  }));
  for (var i = 0; i < scores.length; i++) {
    var score = scores[i];
    await models.laundryScoreRecent.upsert(Object.assign(score, {
    'seq': i,
    'laundryPlayerId': player.id
    }));
  }
}));

app.use(function(err, req, res, next) {
  if (!err.exposed) {
    console.log(err);
    res.status(500).send(JSON.stringify({"err": "internal"}));
  } else {
    res.status(err.status).send(JSON.stringify({"err": err.message}));
  }
});

app.listen(8585);
