exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      notNull: true,
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    email: {
      notNull: false,
      type: "varchar(100)",
      unique: true
    },
    validated: {
      notNull: true,
      type: "boolean",
      default: "false"
    },
    token: {
      notNull: true,
      type: "varchar(60)" 
    },
    created_at: {
      notNull: true,
      type: "timestamptz",
      default: pgm.func("current_timestamp")
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};
