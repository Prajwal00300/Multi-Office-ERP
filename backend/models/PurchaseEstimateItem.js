const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const PurchaseEstimate = require('./PurchaseEstimate');
const Product = require('./Product');

const PurchaseEstimateItem = sequelize.define('PurchaseEstimateItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  purchaseEstimateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_estimates',
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
    comment: 'Description Goods'
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
    comment: 'Btls / Pcs'
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
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
    comment: 'Rate'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  }
}, {
  tableName: 'purchase_estimate_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['purchaseEstimateId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
PurchaseEstimate.hasMany(PurchaseEstimateItem, { foreignKey: 'purchaseEstimateId', as: 'items', onDelete: 'CASCADE' });
PurchaseEstimateItem.belongsTo(PurchaseEstimate, { foreignKey: 'purchaseEstimateId' });

Product.hasMany(PurchaseEstimateItem, { foreignKey: 'productId' });
PurchaseEstimateItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = PurchaseEstimateItem;
