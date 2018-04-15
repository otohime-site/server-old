'use strict';

function getAttributes(DataTypes) {
  return {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
  category: DataTypes.STRING,
  songName: DataTypes.STRING,
  difficulty: DataTypes.STRING,
  score: DataTypes.REAL,
  flag: DataTypes.STRING,
  };
}
var defaultConfig = {timestamps: false};
var makeAssociation = function(obj) {
  obj.associate = function(models) {
    obj.belongsTo(models.laundryPlayer);
  };
};

module.exports = (sequelize, DataTypes) => {
  var LaundryScore = sequelize.define('laundryScore', getAttributes(DataTypes), defaultConfig);
  makeAssociation(LaundryScore);
  var LaundryScoreRecent = sequelize.define('laundryScoreRecent',
      getAttributes(DataTypes), Object.assign({
        indexes: [{ unique: true, fields: ['category', 'songName', 'laundryPlayerId'] }]}, defaultConfig));
  makeAssociation(LaundryScoreRecent);
  var LaundryScoreHistory = sequelize.define('laundryScoreHistory', getAttributes(DataTypes), defaultConfig);
  makeAssociation(LaundryScoreHistory);
  return [LaundryScore, LaundryScoreRecent, LaundryScoreHistory];
};

