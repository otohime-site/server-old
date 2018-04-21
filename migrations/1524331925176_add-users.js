exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      notNull: true,
      primaryKey: true,
    },
    email: {
      allowNull: true,
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
      type: "timestamptz"
    },
    updated_at: {
      notNull: true,
      type: "timestamptz"
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};
