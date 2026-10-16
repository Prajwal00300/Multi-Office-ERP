const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
const Bill = require('./Bill');
const Estimate = require('./Estimate');
const User = require('./User');

const WeighingRecord = sequelize.define('WeighingRecord', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  weighingNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Format: WB-YYYYMM-XXXX'
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
    comment: 'Vehicle Registration Number'
  },
  driverName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  driverPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tareWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Weight of empty vehicle (Kg/Ton)'
  },
  grossWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Weight of loaded vehicle (Kg/Ton)'
  },
  netWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Gross Weight - Tare Weight'
  },
  expectedWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
    comment: 'Expected goods weight from Bill or Estimate (null if unavailable)'
  },
  weightDifference: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
    comment: 'Actual Net Weight - Expected Weight'
  },
  weightUnit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Kg',
    comment: 'Unit of measurement for weighbridge reading (Kg or Ton)'
  },
  weightSource: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Manual Entry',
    comment: 'Source of weight measurement: Manual Entry or Future API/Device'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'DISCREPANCY_FLAGGED', 'APPROVED', 'SUPERSEDED'),
    allowNull: false,
    defaultValue: 'VERIFIED'
  },
  discrepancyReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Automated description of detected weight difference or missing expected weight'
  },
  discrepancyApprovedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  discrepancyApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  discrepancyApprovalReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mandatory reason given by Admin/CEO approving the discrepancy'
  },
  isReweigh: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if this is a reweighing of a previous reading'
  },
  previousRecordId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'weighing_records',
      key: 'id'
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  recordedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  weighedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'weighing_records',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['weighingNumber']
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
      fields: ['weighedAt']
    }
  ]
});

// Associations
Organization.hasMany(WeighingRecord, { foreignKey: 'organizationId' });
WeighingRecord.belongsTo(Organization, { foreignKey: 'organizationId' });

Customer.hasMany(WeighingRecord, { foreignKey: 'customerId' });
WeighingRecord.belongsTo(Customer, { foreignKey: 'customerId' });

Bill.hasMany(WeighingRecord, { foreignKey: 'billId', as: 'weighingRecords' });
WeighingRecord.belongsTo(Bill, { foreignKey: 'billId' });

Estimate.hasMany(WeighingRecord, { foreignKey: 'estimateId', as: 'weighingRecords' });
WeighingRecord.belongsTo(Estimate, { foreignKey: 'estimateId' });

User.hasMany(WeighingRecord, { foreignKey: 'recordedBy', as: 'recordedWeighings' });
WeighingRecord.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

User.hasMany(WeighingRecord, { foreignKey: 'discrepancyApprovedBy', as: 'approvedWeighings' });
WeighingRecord.belongsTo(User, { foreignKey: 'discrepancyApprovedBy', as: 'discrepancyApprover' });

WeighingRecord.belongsTo(WeighingRecord, { foreignKey: 'previousRecordId', as: 'previousRecord' });

module.exports = WeighingRecord;
