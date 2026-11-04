const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
const User = require('./User');

const Estimate = sequelize.define('Estimate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  estimateNumber: {
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
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  estimateDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  basic: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) header field: Basic'
  },
  terms: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) header field: Terms'
  },
  vehicle: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) header field: Vehicle'
  },
  transport: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) bottom field: Transport'
  },
  broker: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Estimate (K) bottom field: Broker'
  },
  totalQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Subtotal of product line item amounts'
  },
  expBeforeTax: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) bottom field: Exp Before Tax'
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Vat/Cst tax rate %'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total VAT amount'
  },
  surchargeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Sur @ rate %'
  },
  expAfterTax: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) bottom field: Exp After Tax'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Due date'
  },
  shortageQty: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Shortage quantity'
  },
  shortageAmt: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Shortage amount'
  },
  others: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Client Estimate (K) bottom field: Others'
  },
  grandTotal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'GENERATED', 'OVERRIDDEN'),
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
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lockedBy: {
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
  tableName: 'estimates',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['organizationId', 'estimateNumber']
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
      fields: ['status']
    },
    {
      unique: false,
      fields: ['estimateDate']
    }
  ]
});

// Associations
Organization.hasMany(Estimate, { foreignKey: 'organizationId' });
Estimate.belongsTo(Organization, { foreignKey: 'organizationId' });

Customer.hasMany(Estimate, { foreignKey: 'customerId' });
Estimate.belongsTo(Customer, { foreignKey: 'customerId' });

User.hasMany(Estimate, { foreignKey: 'createdBy', as: 'creator' });
Estimate.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Estimate, { foreignKey: 'lockedBy', as: 'locker' });
Estimate.belongsTo(User, { foreignKey: 'lockedBy', as: 'locker' });

User.hasMany(Estimate, { foreignKey: 'lastOverriddenBy', as: 'overrider' });
Estimate.belongsTo(User, { foreignKey: 'lastOverriddenBy', as: 'overrider' });

module.exports = Estimate;
