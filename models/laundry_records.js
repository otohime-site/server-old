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
var defaultConfig = {underscored: true, timestamps: false, freezeTableName: true};
var makeAssociation = function(obj) {
  obj.associate = function(models) {
    obj.belongsTo(models.laundry_player, { foreignKey: 'player_id' });
  };
};

module.exports = (sequelize, DataTypes) => {
  var laundry_record = sequelize.define('laundry_record',
    getAttributes(DataTypes), Object.assign({ tableName: 'laundry_records' }, defaultConfig));
  makeAssociation(laundry_record);
  var laundry_record_recent = sequelize.define('laundry_record_recent',
      getAttributes(DataTypes), Object.assign({
        tableName: 'laundry_records_recent',
        indexes: [{ unique: true, fields: ['player_id'] }]}, defaultConfig));
  makeAssociation(laundry_record_recent);
  var laundry_record_history = sequelize.define('laundry_record_history',
      getAttributes(DataTypes), Object.assign({ tableName: 'laundry_records_history' }, defaultConfig));
  makeAssociation(laundry_record_history);
  return [laundry_record, laundry_record_recent, laundry_record_history];
};
