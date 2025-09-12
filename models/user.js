const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const express = require('express');
const router = express.Router();

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    no_telp: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("admin", "user"), allowNull: false, defaultValue: "user" },
    status: { type: DataTypes.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" },
    photo: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "user",
    timestamps: true,
  }
);

module.exports = User;
