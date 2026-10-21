const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const GoodsReceipt = require('./GoodsReceipt');
const PurchaseItem = require('./PurchaseItem');
const Product = require('./Product');

const GoodsReceiptItem = sequelize.define('GoodsReceiptItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  goodsReceiptId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'goods_receipts',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  purchaseItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_items',
      key: 'id'
    }
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
  },
  carbonType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Low Carbon',
  },
  quantityReceived: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity received in this specific receipt in Tons'
  }
}, {
  tableName: 'goods_receipt_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['goodsReceiptId']
    },
    {
      unique: false,
      fields: ['purchaseItemId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
GoodsReceipt.hasMany(GoodsReceiptItem, { foreignKey: 'goodsReceiptId', as: 'items', onDelete: 'CASCADE' });
GoodsReceiptItem.belongsTo(GoodsReceipt, { foreignKey: 'goodsReceiptId' });

PurchaseItem.hasMany(GoodsReceiptItem, { foreignKey: 'purchaseItemId', as: 'receiptItems' });
GoodsReceiptItem.belongsTo(PurchaseItem, { foreignKey: 'purchaseItemId', as: 'purchaseItem' });

Product.hasMany(GoodsReceiptItem, { foreignKey: 'productId' });
GoodsReceiptItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = GoodsReceiptItem;
