const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
const Bill = require('./Bill');
const Estimate = require('./Estimate');
const WeighingRecord = require('./WeighingRecord');
const User = require('./User');

const GatePass = sequelize.define('GatePass', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  gatePassNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Format: GP-YYYYMM-XXXX'
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  transactionType: {
    type: DataTypes.ENUM('BILL', 'ESTIMATE'),
    allowNull: false,
    comment: 'Source transaction type: BILL or ESTIMATE'
  },
  billId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bills',
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
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  vehicleNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  weighingRecordId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'weighing_records',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM(
      'DRAFT',
      'PENDING_WEIGHING',
      'WEIGHT_REVIEW_REQUIRED',
      'READY_FOR_DISPATCH',
      'ISSUED',
      'REWEIGHING_REQUIRED',
      'DISPATCHED',
      'CANCELLED'
    ),
    allowNull: false,
    defaultValue: 'READY_FOR_DISPATCH'
  },
  validityStart: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Start timestamp for 10-minute validity calculation (transaction or reweigh time)'
  },
  validityExpiry: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Expiry timestamp: validityStart + validityMinutes'
  },
  validityMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    comment: 'Configurable validity duration in minutes (production default: 10)'
  },
  issuedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  issuedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  dispatchedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when vehicle crossed gate'
  },
  dispatchedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Gate operator who confirmed physical crossing'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  cancelledBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'gate_passes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['gatePassNumber']
    },
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['billId']
    },
    {
      unique: false,
      fields: ['estimateId']
    },
    {
      unique: false,
      fields: ['customerId']
    },
    {
      unique: false,
      fields: ['vehicleNumber']
    },
    {
      unique: false,
      fields: ['status']
    },
    {
      unique: false,
      fields: ['validityExpiry']
    }
  ]
});

// Associations
Organization.hasMany(GatePass, { foreignKey: 'organizationId' });
GatePass.belongsTo(Organization, { foreignKey: 'organizationId' });

Customer.hasMany(GatePass, { foreignKey: 'customerId' });
GatePass.belongsTo(Customer, { foreignKey: 'customerId' });

Bill.hasMany(GatePass, { foreignKey: 'billId', as: 'gatePasses' });
GatePass.belongsTo(Bill, { foreignKey: 'billId' });

Estimate.hasMany(GatePass, { foreignKey: 'estimateId', as: 'gatePasses' });
GatePass.belongsTo(Estimate, { foreignKey: 'estimateId' });

WeighingRecord.hasMany(GatePass, { foreignKey: 'weighingRecordId', as: 'gatePasses' });
GatePass.belongsTo(WeighingRecord, { foreignKey: 'weighingRecordId', as: 'weighingRecord' });

User.hasMany(GatePass, { foreignKey: 'createdBy', as: 'createdGatePasses' });
GatePass.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(GatePass, { foreignKey: 'issuedBy', as: 'issuedGatePasses' });
GatePass.belongsTo(User, { foreignKey: 'issuedBy', as: 'issuer' });

User.hasMany(GatePass, { foreignKey: 'dispatchedBy', as: 'dispatchedGatePasses' });
GatePass.belongsTo(User, { foreignKey: 'dispatchedBy', as: 'dispatcher' });

User.hasMany(GatePass, { foreignKey: 'cancelledBy', as: 'cancelledGatePasses' });
GatePass.belongsTo(User, { foreignKey: 'cancelledBy', as: 'canceller' });

module.exports = GatePass;
