const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('./Bill');
const Product = require('./Product');

const BillItem = sequelize.define('BillItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  billId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bills',
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
    comment: 'Description Goods (snapshotted at bill creation)'
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
    comment: 'Bundles (preserved as independent field)'
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
    comment: 'Negotiated rate per bill item (never stored in Product Master)'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity * Rate (authoritative backend calculated value)'
  }
}, {
  tableName: 'bill_items',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['billId']
    },
    {
      unique: false,
      fields: ['productId']
    }
  ]
});

// Associations
Bill.hasMany(BillItem, { foreignKey: 'billId', as: 'items', onDelete: 'CASCADE' });
BillItem.belongsTo(Bill, { foreignKey: 'billId' });

Product.hasMany(BillItem, { foreignKey: 'productId' });
BillItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = BillItem;
