const models = require('./models');
const express = require('express');
const uuidv4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const asyncHandler = require('express-async-handler');
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
  var player = await models.laundryPlayer.findOne({where: {'nickname': nickname}});
}));
app.post('/mai/', bodyParser, requireUser, asyncHandler(async (req, res) => {
  var nickname = req.body.nickname;
  var privacy = req.body.privacy;
  var user = req.user;
  var player = await models.laundryPlayer.findOne({where: {'nickname': nickname}});
  if (player) {
    error(400, "exists");
    return;
  }
  var newPlayer = await models.laundryPlayer.create({'nickname': nickname, 'userId': user.id, 'privacy': privacy});
  res.send(JSON.stringify({}));
}));

app.post('/mai/:nickname', bodyParser, requireUser, asyncHandler(async (req, res) => {
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
}));

app.use(function(err, req, res, next) {
  if (!err.exposed) {
    console.log(err);
    res.status(500).send(JSON.stringify({"err": true}));
  } else {
    res.status(err.status).send(JSON.stringify({"err": err.message}));
  }
});

app.listen(8585);
