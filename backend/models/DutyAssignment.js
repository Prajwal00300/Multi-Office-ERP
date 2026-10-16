const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const User = require('./User');

const DutyAssignment = sequelize.define('DutyAssignment', {
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
    },
    comment: 'Organization context for the permission record'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Admin user to whom the module permission is assigned'
  },
  moduleKey: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: 'Stable module identifier (e.g. BILLING, ESTIMATES, WEIGHBRIDGE)'
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether access to this module is enabled (ON) or disabled (OFF)'
  }
}, {
  tableName: 'duty_assignments',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['organizationId', 'userId', 'moduleKey'],
      name: 'unique_org_user_module_assignment'
    },
    {
      fields: ['userId']
    },
    {
      fields: ['organizationId']
    }
  ]
});

// Define Associations
Organization.hasMany(DutyAssignment, { foreignKey: 'organizationId', as: 'dutyAssignments', onDelete: 'CASCADE' });
DutyAssignment.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

User.hasMany(DutyAssignment, { foreignKey: 'userId', as: 'dutyAssignments', onDelete: 'CASCADE' });
DutyAssignment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = DutyAssignment;
