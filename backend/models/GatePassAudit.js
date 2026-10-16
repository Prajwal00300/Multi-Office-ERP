const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const GatePass = require('./GatePass');
const User = require('./User');

const GatePassAudit = sequelize.define('GatePassAudit', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  gatePassId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'gate_passes',
      key: 'id'
    },
    onDelete: 'CASCADE'
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
    comment: 'Action performed: CREATED, ISSUED, DISCREPANCY_APPROVED, REWEIGH_REQUESTED, DISPATCH_CONFIRMED, CANCELLED'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  previousValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON snapshot of previous values before change'
  },
  newValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON snapshot of new values after change'
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'gate_pass_audits',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['gatePassId']
    },
    {
      unique: false,
      fields: ['userId']
    },
    {
      unique: false,
      fields: ['action']
    }
  ]
});

// Associations
GatePass.hasMany(GatePassAudit, { foreignKey: 'gatePassId', as: 'audits', onDelete: 'CASCADE' });
GatePassAudit.belongsTo(GatePass, { foreignKey: 'gatePassId' });

User.hasMany(GatePassAudit, { foreignKey: 'userId', as: 'performedGatePassAudits' });
GatePassAudit.belongsTo(User, { foreignKey: 'userId', as: 'performer' });

module.exports = GatePassAudit;
