exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    connected: {
      notNull: true,
      type: 'varchar(50)',
      unique: true,
    },
    created_at: {
      notNull: true,
      type: 'timestamptz',
      default: pgm.func('current_timestamp'),
    },
    logged_in_at: {
      notNull: true,
      type: 'timestamptz',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
