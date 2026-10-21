const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const User = require('./User');
const Purchase = require('./Purchase');

const GoodsReceipt = sequelize.define('GoodsReceipt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  receiptNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    }
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
  purchaseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Referenced Purchase Order ID'
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  receiptDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  receivedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Prevents duplicate submissions of the same receipt'
  }
}, {
  tableName: 'goods_receipts',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['receiptNumber']
    },
    {
      unique: false,
      fields: ['purchaseId']
    },
    {
      unique: false,
      fields: ['purchaseNumber']
    },
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['receiptDate']
    }
  ]
});

// Associations
Purchase.hasMany(GoodsReceipt, { foreignKey: 'purchaseId', as: 'receipts', onDelete: 'CASCADE' });
GoodsReceipt.belongsTo(Purchase, { foreignKey: 'purchaseId' });

Organization.hasMany(GoodsReceipt, { foreignKey: 'organizationId' });
GoodsReceipt.belongsTo(Organization, { foreignKey: 'organizationId' });

User.hasMany(GoodsReceipt, { foreignKey: 'receivedBy', as: 'receivedGoods' });
GoodsReceipt.belongsTo(User, { foreignKey: 'receivedBy', as: 'receiver' });

module.exports = GoodsReceipt;
