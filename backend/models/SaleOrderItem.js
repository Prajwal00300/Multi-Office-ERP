const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SaleOrder = require('./SaleOrder');
const Product = require('./Product');

const SaleOrderItem = sequelize.define('SaleOrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  saleOrderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sale_orders',
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
    comment: 'Product name snapshotted at time of order'
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
    comment: 'Ordered quantity in Tons'
  },
  processedQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Cumulative processed/fulfilled quantity via sale estimate vouchers in Tons'
  },
  carbonType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Low Carbon',
    comment: 'Low Carbon or High Carbon'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Ton'
  },
  rate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Sale rate per unit'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity * Rate'
  }
}, {
  tableName: 'sale_order_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['saleOrderId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
SaleOrder.hasMany(SaleOrderItem, { foreignKey: 'saleOrderId', as: 'items', onDelete: 'CASCADE' });
SaleOrderItem.belongsTo(SaleOrder, { foreignKey: 'saleOrderId' });
Product.hasMany(SaleOrderItem, { foreignKey: 'productId' });
SaleOrderItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = SaleOrderItem;
