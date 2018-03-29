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
  var laundry_record = sequelize.define('laundry_record',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records' });
  laundry_record.associate = function(models) {
    laundry_record.belongsTo(models.laundry_player, { foreignKey: 'player_id' });
  };
  var laundry_record_recent = sequelize.define('laundry_record_recent',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records_recent',
        indexes: [{ unique: true, fields: ['player_id'] }]});
  laundry_record_recent.associate = function(models) {
    laundry_record_recent.belongsTo(models.laundry_player, { foreignKey: 'player_id' });
  };
  var laundry_record_history = sequelize.define('laundry_record_history',
      getAttributes(DataTypes), { underscored: true, timestamps: false, freezeTableName: true, tableName: 'laundry_records_history' });
  laundry_record_history.associate = function(models) {
    // associations can be defined here
    laundry_record_history.belongsTo(models.laundry_player, { foreignKey: 'player_id' });
  };
  return [laundry_record, laundry_record_recent, laundry_record_history];
};
