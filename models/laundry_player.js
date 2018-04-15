module.exports = (sequelize, DataTypes) => {
  var LaundryPlayer = sequelize.define('laundryPlayer', {
    nickname: DataTypes.STRING,
    privacy: DataTypes.STRING,

  });
  LaundryPlayer.associate = function(models) {
    LaundryPlayer.belongsTo(models.user);
    LaundryPlayer.hasMany(models.laundryRecord);
    LaundryPlayer.hasOne(models.laundryRecordRecent);
    LaundryPlayer.hasMany(models.laundryScore);
  };
  return LaundryPlayer;
};
