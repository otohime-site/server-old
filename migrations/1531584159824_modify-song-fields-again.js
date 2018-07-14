exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('laundry_songs', {
    japan_only: { type: 'boolean', notNull: true, default: false },
    version: { type: 'real', notNull: false },
  });
  pgm.dropColumns('laundry_songs', ['full_raw_score']);
};

exports.down = (pgm) => {
  pgm.dropColumns('laundry_songs', ['japan_only', 'version']);
  pgm.addColumns('laundry_songs', {
    full_raw_score: { type: 'INTEGER[]', notNull: false },
  });
};
