const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  ceoId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Owning CEO user ID'
  }
}, {
  tableName: 'organizations',
  timestamps: true, // Automatically manages createdAt and updatedAt
  indexes: [
    {
      fields: ['ceoId']
    }
  ]
});

// Associations
const User = require('./User');
Organization.belongsTo(User, { foreignKey: 'ceoId', as: 'ceo' });
User.hasMany(Organization, { foreignKey: 'ceoId', as: 'offices' });

Organization.hasMany(User, { foreignKey: 'organizationId', as: 'employees' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'office' });

module.exports = Organization;
