require('ts-node').register({ project: 'tsconfig.migration.json' });
require('./node_modules/node-pg-migrate/bin/node-pg-migrate');
