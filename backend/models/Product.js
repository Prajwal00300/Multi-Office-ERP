const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'General'
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '-'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Ton',
    validate: {
      notEmpty: true,
    }
  },
  price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
    comment: 'Product price / rate (default per Ton)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  specifications: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['category']
    },
    {
      unique: false,
      fields: ['name']
    },
    {
      unique: false,
      fields: ['organizationId', 'name', 'category', 'size']
    }
  ]
});

// Associations
Organization.hasMany(Product, { foreignKey: 'organizationId' });
Product.belongsTo(Organization, { foreignKey: 'organizationId' });

module.exports = Product;
