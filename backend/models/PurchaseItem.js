const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Purchase = require('./Purchase');
const Product = require('./Product');

const PurchaseItem = sequelize.define('PurchaseItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  purchaseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchases',
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
    comment: 'Product name snapshotted at time of purchase'
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
  rate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Negotiated purchase rate per unit (belongs to purchase transaction, not Product Master)'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity * Rate'
  }
}, {
  tableName: 'purchase_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['purchaseId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchaseId', as: 'items', onDelete: 'CASCADE' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId' });

Product.hasMany(PurchaseItem, { foreignKey: 'productId' });
PurchaseItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = PurchaseItem;
