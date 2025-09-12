const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const sequelize = require('../config/database');
const db = {};


fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

const Notification = require('./notification');
db.Notification = Notification;
// Jika ingin relasi ke User:
db.User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(db.User, { foreignKey: 'user_id' });



db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;