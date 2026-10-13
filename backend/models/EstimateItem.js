const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Estimate = require('./Estimate');
const Product = require('./Product');

const EstimateItem = sequelize.define('EstimateItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  estimateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'estimates',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  productNameSnapshot: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Client Estimate (K) column: Description Goods'
  },
  productCategorySnapshot: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  productSizeSnapshot: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  productSpecificationsSnapshot: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  btls: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) column: Btls (preserved without unconfirmed multipliers)'
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) column: Quantity'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Kg'
  },
  negotiatedRate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) column: Rate (entered per estimate, never stored in Product Master)'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) column: Amount (authoritative backend calculated value)'
  }
}, {
  tableName: 'estimate_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['estimateId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
Estimate.hasMany(EstimateItem, { foreignKey: 'estimateId', as: 'items', onDelete: 'CASCADE' });
EstimateItem.belongsTo(Estimate, { foreignKey: 'estimateId' });

Product.hasMany(EstimateItem, { foreignKey: 'productId' });
EstimateItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = EstimateItem;
