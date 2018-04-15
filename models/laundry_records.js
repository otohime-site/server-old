'use strict';

function getAttributes(DataTypes) {
  return {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    cardName: DataTypes.STRING,
    rating: DataTypes.REAL,
    maxRating: DataTypes.REAL,
    icon: DataTypes.STRING,
    title: DataTypes.STRING,
    class: DataTypes.STRING,
    period: DataTypes.RANGE(DataTypes.DATE)
  };
}
var defaultConfig = {timestamps: false};
var makeAssociation = function(obj) {
  obj.associate = function(models) {
    obj.belongsTo(models.laundryPlayer);
  };
};

module.exports = (sequelize, DataTypes) => {
  var LaundryRecord = sequelize.define('laundryRecord', getAttributes(DataTypes), defaultConfig);
  makeAssociation(LaundryRecord);
  var LaundryRecordRecent = sequelize.define('laundryRecordRecent',
      getAttributes(DataTypes), Object.assign({
        indexes: [{ unique: true, fields: ['laundryPlayerId'] }]}, defaultConfig));
  makeAssociation(LaundryRecordRecent);
  var LaundryRecordHistory = sequelize.define('laundryRecordHistory', getAttributes(DataTypes), defaultConfig);
  makeAssociation(LaundryRecordHistory);
  return [LaundryRecord, LaundryRecordRecent, LaundryRecordHistory];
};
