'use strict';
module.exports = (sequelize, DataTypes) => {
  var User = sequelize.define('user', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: DataTypes.STRING,
    password: DataTypes.STRING
  }, { underscored: true });
  User.associate = function(models) {
    // associations can be defined here
  };
  return User;
};
