'use strict';
module.exports = (sequelize, DataTypes) => {
  var laundry_records = sequelize.define('laundry_records', {}, {});
  laundry_records.associate = function(models) {
    // associations can be defined here
  };
  return laundry_records;
};