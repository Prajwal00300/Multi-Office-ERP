const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Estimate = require('./Estimate');
const EstimateItem = require('./EstimateItem');
const SaleOrder = require('./SaleOrder');
const SaleOrderItem = require('./SaleOrderItem');

const SaleOrderAllocation = sequelize.define('SaleOrderAllocation', {
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
  estimateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'estimates',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  estimateItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'estimate_items',
      key: 'id'
    },
    onDelete: 'CASCADE'
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
  saleOrderItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sale_order_items',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  allocatedQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Quantity in Tons fulfilled from this SaleOrderItem by this Estimate'
  }
}, {
  tableName: 'sale_order_allocations',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['estimateId']
    },
    {
      unique: false,
      fields: ['estimateItemId']
    },
    {
      unique: false,
      fields: ['saleOrderId']
    },
    {
      unique: false,
      fields: ['saleOrderItemId']
    }
  ]
});

// Associations
Estimate.hasMany(SaleOrderAllocation, { foreignKey: 'estimateId', as: 'soAllocations', onDelete: 'CASCADE' });
SaleOrderAllocation.belongsTo(Estimate, { foreignKey: 'estimateId' });

EstimateItem.hasMany(SaleOrderAllocation, { foreignKey: 'estimateItemId', as: 'soAllocations', onDelete: 'CASCADE' });
SaleOrderAllocation.belongsTo(EstimateItem, { foreignKey: 'estimateItemId' });

SaleOrder.hasMany(SaleOrderAllocation, { foreignKey: 'saleOrderId', as: 'allocations', onDelete: 'CASCADE' });
SaleOrderAllocation.belongsTo(SaleOrder, { foreignKey: 'saleOrderId' });

SaleOrderItem.hasMany(SaleOrderAllocation, { foreignKey: 'saleOrderItemId', as: 'allocations', onDelete: 'CASCADE' });
SaleOrderAllocation.belongsTo(SaleOrderItem, { foreignKey: 'saleOrderItemId' });

module.exports = SaleOrderAllocation;
