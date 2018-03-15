'use strict';

function getAttributes(DataTypes) {
  return {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    card_name: DataTypes.STRING,
    rating: DataTypes.REAL,
    max_rating: DataTypes.REAL,
    icon: DataTypes.STRING,
    title: DataTypes.STRING,
    period: DataTypes.RANGE(DataTypes.DATE)
  };
}

module.exports = (sequelize, DataTypes) => {
  var laundry_records = sequelize.define('laundry_records',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records' });
  laundry_records.associate = function(models) {
    // associations can be defined here
  };
  var laundry_records_recent = sequelize.define('laundry_records_recent',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records_recent' });
  laundry_records_recent.associate = function(models) {
    // associations can be defined here
  };
  var laundry_records_history = sequelize.define('laundry_records_history',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records_history' });
  laundry_records_history.associate = function(models) {
    // associations can be defined here
  };
  return [laundry_records, laundry_records_recent, laundry_records_history];
};
