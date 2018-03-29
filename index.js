const models = require('./models');
const express = require('express');
const uuidv4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const asyncMiddleware = require('./utils').asyncMiddleware;
var app = express();

app.use(express.urlencoded());
app.get('/users', asyncMiddleware(async (req, res) => { 
  var users = await models.user.findAll();
  res.send(JSON.stringify(users));
}));
app.post('/users/new', asyncMiddleware(async (req, res) => {
  var rawToken = uuidv4();
  var token = await bcrypt.hash(rawToken, 10);
  var user = await models.user.create({token: token});
  res.send(JSON.stringify({id: user.id, token: rawToken}));
}));

app.use(function(err, req, res, next) {
  console.log(err);
  res.status(500).send(JSON.stringify({"err": true}));
});

app.listen(8585);
