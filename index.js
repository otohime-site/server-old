const Sequelize = require('sequelize');
const models = require('./models');

const sequelize = new Sequelize('semiquaver', 'semiquaver', 'smq.moe', {host: 'db', dialect: 'postgres'});
models.user.findAll().then(users => { console.log(users) });

