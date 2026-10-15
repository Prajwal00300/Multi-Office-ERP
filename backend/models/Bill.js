const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
const Estimate = require('./Estimate');
const User = require('./User');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  billNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
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
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  estimateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'estimates',
      key: 'id'
    }
  },
  billDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  productSubtotal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Subtotal of product items before GST and transport cost'
  },
  gstPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Manually entered GST percentage (e.g. 5, 12, 18)'
  },
  gstAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Authoritative backend calculated GST amount'
  },
  transportCost: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Manually entered transportation cost'
  },
  finalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Product Subtotal + GST Amount + Transport Cost'
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'FINALIZED', 'OVERRIDDEN'),
    allowNull: false,
    defaultValue: 'DRAFT',
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  finalizedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  finalizedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  lastOverriddenBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  lastOverriddenAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  tableName: 'bills',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['billNumber']
    },
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['customerId']
    },
    {
      unique: false,
      fields: ['estimateId']
    },
    {
      unique: false,
      fields: ['status']
    },
    {
      unique: false,
      fields: ['billDate']
    }
  ]
});

// Associations
Organization.hasMany(Bill, { foreignKey: 'organizationId' });
Bill.belongsTo(Organization, { foreignKey: 'organizationId' });

Customer.hasMany(Bill, { foreignKey: 'customerId' });
Bill.belongsTo(Customer, { foreignKey: 'customerId' });

Estimate.hasMany(Bill, { foreignKey: 'estimateId' });
Bill.belongsTo(Estimate, { foreignKey: 'estimateId' });

User.hasMany(Bill, { foreignKey: 'createdBy', as: 'createdBills' });
Bill.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Bill, { foreignKey: 'finalizedBy', as: 'finalizedBills' });
Bill.belongsTo(User, { foreignKey: 'finalizedBy', as: 'finalizer' });

User.hasMany(Bill, { foreignKey: 'lastOverriddenBy', as: 'overriddenBills' });
Bill.belongsTo(User, { foreignKey: 'lastOverriddenBy', as: 'overrider' });

module.exports = Bill;
