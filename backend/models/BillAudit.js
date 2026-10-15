const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('./Bill');
const User = require('./User');

const BillAudit = sequelize.define('BillAudit', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  billId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bills',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  billNumber: {
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
    comment: 'CREATE_DRAFT, UPDATE_DRAFT, FINALIZE, OVERRIDE'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mandatory reason explaining authorized override or change'
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
  tableName: 'bill_audits',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['billId']
    },
    {
      unique: false,
      fields: ['billNumber']
    },
    {
      unique: false,
      fields: ['userId']
    }
  ]
});

// Associations
Bill.hasMany(BillAudit, { foreignKey: 'billId', as: 'audits', onDelete: 'CASCADE' });
BillAudit.belongsTo(Bill, { foreignKey: 'billId' });

User.hasMany(BillAudit, { foreignKey: 'userId', as: 'billAudits' });
BillAudit.belongsTo(User, { foreignKey: 'userId', as: 'performer' });

module.exports = BillAudit;
