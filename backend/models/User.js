const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('USER', 'SUPER_ADMIN'),
    allowNull: false,
    defaultValue: 'USER',
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  }
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
