const models = require('./models');

async function go() {
  var users = await models.user.findAll();
  console.log(users);
}

go();
