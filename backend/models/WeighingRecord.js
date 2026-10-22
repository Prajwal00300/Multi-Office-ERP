const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const Customer = require('./Customer');
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
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  vehicleDetails: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Vehicle details / registration number'
  },
  firstWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Empty vehicle weight'
  },
  grossWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Weight of vehicle and goods'
  },
  taleWeight: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
    comment: 'Weight of goods (Gross Weight - First Weight)'
  },
  weightUnit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Ton',
    comment: 'Measurement unit: Ton or Kg'
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
  },

  // Virtual aliases for backward compatibility with existing code
  vehicleNumber: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('vehicleDetails');
    }
  },
  tareWeight: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('firstWeight');
    }
  },
  netWeight: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('taleWeight');
    }
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
      fields: ['customerId']
    },
    {
      unique: false,
      fields: ['vehicleDetails']
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

User.hasMany(WeighingRecord, { foreignKey: 'recordedBy', as: 'recordedWeighings' });
WeighingRecord.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

module.exports = WeighingRecord;
