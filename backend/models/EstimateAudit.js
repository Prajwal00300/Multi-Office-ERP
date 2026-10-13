const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Estimate = require('./Estimate');
const User = require('./User');

const EstimateAudit = sequelize.define('EstimateAudit', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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
  estimateNumber: {
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
    comment: 'CREATE_DRAFT, UPDATE_DRAFT, GENERATE, OVERRIDE'
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
  tableName: 'estimate_audits',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['estimateId']
    },
    {
      unique: false,
      fields: ['estimateNumber']
    },
    {
      unique: false,
      fields: ['userId']
    }
  ]
});

// Associations
Estimate.hasMany(EstimateAudit, { foreignKey: 'estimateId', as: 'audits', onDelete: 'CASCADE' });
EstimateAudit.belongsTo(Estimate, { foreignKey: 'estimateId' });

User.hasMany(EstimateAudit, { foreignKey: 'userId', as: 'performer' });
EstimateAudit.belongsTo(User, { foreignKey: 'userId', as: 'performer' });

module.exports = EstimateAudit;
