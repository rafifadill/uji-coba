const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const express = require('express');
const router = express.Router();

const Notification = sequelize.define('Notification', {
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // null = notifikasi global/admin
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING, // contoh: 'order', 'payment', 'info'
    allowNull: false,
    defaultValue: 'info'
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;