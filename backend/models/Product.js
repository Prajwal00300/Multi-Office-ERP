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
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Ton',
    validate: {
      notEmpty: true,
    }
  },
  difference: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Product rate difference per Ton (can be positive, zero, or negative)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  specifications: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  currentStock: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Current physical inventory stock in Tons for this office'
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
      fields: ['name']
    },
    {
      unique: false,
      fields: ['organizationId', 'name']
    }
  ]
});

// Associations
Organization.hasMany(Product, { foreignKey: 'organizationId' });
Product.belongsTo(Organization, { foreignKey: 'organizationId' });

module.exports = Product;
