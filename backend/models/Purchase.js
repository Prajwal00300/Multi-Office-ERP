const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('./Organization');
const User = require('./User');

const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  purchaseNumber: {
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
  purchaseDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  vendorName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Supplier, vendor, or supplier party name'
  },
  purchaseDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Summary or description of the purchase transaction'
  },
  totalQuantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total purchase amount'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Pending',
    comment: 'Pending, Partially Received, Fully Received, DRAFT, APPROVED, CANCELLED'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  submittedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  tableName: 'purchases',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['purchaseNumber']
    },
    {
      unique: true,
      fields: ['purchaseNumber', 'organizationId']
    },
    {
      unique: false,
      fields: ['organizationId']
    },
    {
      unique: false,
      fields: ['status']
    },
    {
      unique: false,
      fields: ['purchaseDate']
    }
  ]
});

// Associations
Organization.hasMany(Purchase, { foreignKey: 'organizationId' });
Purchase.belongsTo(Organization, { foreignKey: 'organizationId' });

User.hasMany(Purchase, { foreignKey: 'createdBy', as: 'createdPurchases' });
Purchase.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Purchase, { foreignKey: 'submittedBy', as: 'submittedPurchases' });
Purchase.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

User.hasMany(Purchase, { foreignKey: 'approvedBy', as: 'approvedPurchases' });
Purchase.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

User.hasMany(Purchase, { foreignKey: 'lastOverriddenBy', as: 'overriddenPurchases' });
Purchase.belongsTo(User, { foreignKey: 'lastOverriddenBy', as: 'overrider' });

module.exports = Purchase;
