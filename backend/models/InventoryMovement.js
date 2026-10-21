const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Product = require('./Product');
const User = require('./User');

const InventoryMovement = sequelize.define('InventoryMovement', {
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
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  movementType: {
    type: DataTypes.ENUM('IN', 'OUT'),
    allowNull: false,
    comment: 'IN for goods received, OUT for bills finalized'
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    comment: 'Quantity in Tons (positive magnitude)'
  },
  referenceType: {
    type: DataTypes.ENUM('GOODS_RECEIPT', 'BILL', 'MANUAL'),
    allowNull: false,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  purchaseItemId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  performedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  tableName: 'inventory_movements',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['productId']
    },
    {
      unique: false,
      fields: ['referenceType', 'referenceId']
    },
    {
      unique: false,
      fields: ['movementType']
    }
  ]
});

// Associations
Organization.hasMany(InventoryMovement, { foreignKey: 'organizationId' });
InventoryMovement.belongsTo(Organization, { foreignKey: 'organizationId' });

Product.hasMany(InventoryMovement, { foreignKey: 'productId' });
InventoryMovement.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(InventoryMovement, { foreignKey: 'performedBy', as: 'inventoryMovements' });
InventoryMovement.belongsTo(User, { foreignKey: 'performedBy', as: 'performer' });

module.exports = InventoryMovement;
