const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const PurchaseEstimate = require('./PurchaseEstimate');
const PurchaseEstimateItem = require('./PurchaseEstimateItem');
const Purchase = require('./Purchase');
const PurchaseItem = require('./PurchaseItem');

const PurchaseEstimateAllocation = sequelize.define('PurchaseEstimateAllocation', {
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
  purchaseEstimateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_estimates',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  purchaseEstimateItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_estimate_items',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  purchaseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchases',
      key: 'id'
    }
  },
  purchaseItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchase_items',
      key: 'id'
    }
  },
  allocatedQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
  }
}, {
  tableName: 'purchase_estimate_po_allocations',
  timestamps: true,
  indexes: [
    { unique: false, fields: ['organizationId'] },
    { unique: false, fields: ['purchaseEstimateId'] },
    { unique: false, fields: ['purchaseEstimateItemId'] },
    { unique: false, fields: ['purchaseId'] },
    { unique: false, fields: ['purchaseItemId'] }
  ]
});

// Associations
PurchaseEstimate.hasMany(PurchaseEstimateAllocation, {
  foreignKey: 'purchaseEstimateId',
  as: 'poAllocations',
  onDelete: 'CASCADE'
});
PurchaseEstimateAllocation.belongsTo(PurchaseEstimate, {
  foreignKey: 'purchaseEstimateId',
  as: 'purchaseEstimate'
});

PurchaseEstimateItem.hasMany(PurchaseEstimateAllocation, {
  foreignKey: 'purchaseEstimateItemId',
  as: 'poAllocations',
  onDelete: 'CASCADE'
});
PurchaseEstimateAllocation.belongsTo(PurchaseEstimateItem, {
  foreignKey: 'purchaseEstimateItemId',
  as: 'purchaseEstimateItem'
});

Purchase.hasMany(PurchaseEstimateAllocation, {
  foreignKey: 'purchaseId',
  as: 'estimateAllocations'
});
PurchaseEstimateAllocation.belongsTo(Purchase, {
  foreignKey: 'purchaseId',
  as: 'purchase'
});

PurchaseItem.hasMany(PurchaseEstimateAllocation, {
  foreignKey: 'purchaseItemId',
  as: 'estimateAllocations'
});
PurchaseEstimateAllocation.belongsTo(PurchaseItem, {
  foreignKey: 'purchaseItemId',
  as: 'purchaseItem'
});

module.exports = PurchaseEstimateAllocation;
