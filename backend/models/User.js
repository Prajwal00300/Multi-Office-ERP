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
    type: DataTypes.ENUM(
      'SUPER_ADMIN', 
      'CEO',
      'ADMIN', 
      'WEIGHBRIDGE_CONTROLLER', 
      'OPERATIONS_BILLING', 
      'PAYMENT_COLLECTOR',
      'USER'
    ),
    allowNull: false,
    defaultValue: 'USER',
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
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
