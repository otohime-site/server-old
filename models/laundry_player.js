module.exports = (sequelize, DataTypes) => {
  var laundry_player = sequelize.define('laundry_player', {
    nickname: DataTypes.STRING,
    privacy: DataTypes.STRING,

  }, { underscored: true });
  laundry_player.associate = function(models) {
    laundry_player.belongsTo(models.user);
  };
  return laundry_player;
};
