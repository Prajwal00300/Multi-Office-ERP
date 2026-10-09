const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization'); // Assuming this exists based on context

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations', // Table name
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tin: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'customers',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['name']
    }
  ]
});

// Associations (if applicable, though we might not need to export them directly here if not initialized centrally)
// We'll set up standard associations to ensure constraints
Organization.hasMany(Customer, { foreignKey: 'organizationId' });
Customer.belongsTo(Organization, { foreignKey: 'organizationId' });

module.exports = Customer;
