exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('laundry_songs', {
    active: { type: "boolean", notNull: true, default: true },
    english_name: { type: "varchar", notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('laundry_songs', ['active', 'english_name']);
};
