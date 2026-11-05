const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
const User = require('./User');

const PurchaseEstimate = sequelize.define('PurchaseEstimate', {
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
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  partyName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Vendor / Supplier / Party name'
  },
  estimateDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  basic: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Header field: Basic'
  },
  terms: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Header field: Terms'
  },
  vehicle: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Header field: Vehicle'
  },
  transport: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bottom field: Transport'
  },
  broker: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bottom field: Broker'
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
    comment: 'Bottom field: Exp Before Tax'
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
    comment: 'Bottom field: Exp After Tax'
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
    comment: 'Bottom field: Others'
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
  tableName: 'purchase_estimates',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['estimateNumber']
    },
    {
      unique: false,
      fields: ['status']
    }
  ]
});

// Associations
Organization.hasMany(PurchaseEstimate, { foreignKey: 'organizationId' });
PurchaseEstimate.belongsTo(Organization, { foreignKey: 'organizationId' });

Customer.hasMany(PurchaseEstimate, { foreignKey: 'customerId' });
PurchaseEstimate.belongsTo(Customer, { foreignKey: 'customerId' });

User.hasMany(PurchaseEstimate, { foreignKey: 'createdBy', as: 'purchaseEstimatesCreated' });
PurchaseEstimate.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(PurchaseEstimate, { foreignKey: 'lockedBy', as: 'purchaseEstimatesLocked' });
PurchaseEstimate.belongsTo(User, { foreignKey: 'lockedBy', as: 'locker' });

User.hasMany(PurchaseEstimate, { foreignKey: 'lastOverriddenBy', as: 'purchaseEstimatesOverridden' });
PurchaseEstimate.belongsTo(User, { foreignKey: 'lastOverriddenBy', as: 'overrider' });

module.exports = PurchaseEstimate;
