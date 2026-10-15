const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Purchase = require('./Purchase');
const User = require('./User');

const PurchaseAudit = sequelize.define('PurchaseAudit', {
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
  purchaseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'PURCHASE_CREATED, PURCHASE_UPDATED, PURCHASE_SUBMITTED, PURCHASE_APPROVED, PURCHASE_REJECTED, PURCHASE_AUTHORIZED_MODIFICATION'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Audit reason or rejection explanation'
  },
  previousValues: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  newValues: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'purchase_audits',
  timestamps: true,
  indexes: [
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
      fields: ['userId']
    }
  ]
});

// Associations
Purchase.hasMany(PurchaseAudit, { foreignKey: 'purchaseId', as: 'audits', onDelete: 'CASCADE' });
PurchaseAudit.belongsTo(Purchase, { foreignKey: 'purchaseId' });

User.hasMany(PurchaseAudit, { foreignKey: 'userId', as: 'purchaseAudits' });
PurchaseAudit.belongsTo(User, { foreignKey: 'userId', as: 'performer' });

module.exports = PurchaseAudit;
