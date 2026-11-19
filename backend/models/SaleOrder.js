const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const User = require('./User');
const Customer = require('./Customer');

const SaleOrder = sequelize.define('SaleOrder', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Customer or buyer party name'
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  orderDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Summary or description of the sale order'
  },
  totalQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total ordered quantity in Tons'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total sale order value'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Pending',
    comment: 'Pending, Partially Processed, Fully Processed, CANCELLED'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'sale_orders',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['organizationId', 'orderNumber']
    },
    {
      unique: false,
      fields: ['customerId']
    },
    {
      unique: false,
      fields: ['orderDate']
    },
    {
      unique: false,
      fields: ['status']
    }
  ]
});

// Associations
SaleOrder.belongsTo(Organization, { foreignKey: 'organizationId' });
SaleOrder.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
SaleOrder.belongsTo(Customer, { foreignKey: 'customerId' });

module.exports = SaleOrder;
