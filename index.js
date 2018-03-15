const models = require('./models');

models.user.findAll().then(users => { console.log(users) });
models.laundry_records.findAll().then(lrs => { console.log(lrs) });

