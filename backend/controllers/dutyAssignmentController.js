const sequelize = require('../config/database');
const Organization = require('../models/Organization');
const User = require('../models/User');
const DutyAssignment = require('../models/DutyAssignment');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Estimate = require('../models/Estimate');
const Bill = require('../models/Bill');
const Purchase = require('../models/Purchase');
const WeighingRecord = require('../models/WeighingRecord');
const GatePass = require('../models/GatePass');
const { 
  MODULES, 
  VALID_MODULE_IDS, 
  IMPLEMENTED_MODULE_IDS 
} = require('../config/moduleRegistry');

/**
 * GET /api/duty-assignments/modules
 * Return all registered system modules and their implementation status.
 */
exports.getModules = async (req, res) => {
  try {
    res.status(200).json({
      modules: MODULES,
      implementedModuleIds: IMPLEMENTED_MODULE_IDS
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Internal server error while fetching modules.' });
  }
};

/**
 * GET /api/duty-assignments/organizations
 * Return all organizations (Super Admin only).
 */
/**
 * GET /api/duty-assignments/organizations
 * Return organizations (Super Admin sees all, CEO sees own offices).
 */
exports.getOrganizations = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role === 'CEO') {
      whereClause.ceoId = req.user.userId;
    } else if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Super Admin or CEO only.' });
    }

    const organizations = await Organization.findAll({
      where: whereClause,
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'phone', 'address', 'status', 'ceoId']
    });

    res.status(200).json(organizations);
  } catch (error) {
    console.error('Error fetching organizations for duty assignment:', error);
    res.status(500).json({ error: 'Internal server error while fetching organizations.' });
  }
};

/**
 * GET /api/duty-assignments/admins/:organizationId
 * Return all users belonging to the specified organization.
 */
exports.getAdminsByOrganization = async (req, res) => {
  try {
    const orgId = parseInt(req.params.organizationId, 10);
    if (isNaN(orgId)) {
      return res.status(400).json({ error: 'Valid Organization ID is required.' });
    }

    // Verify organization exists
    const organization = await Organization.findByPk(orgId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    // CEO authorization check
    if (req.user.role === 'CEO' && organization.ceoId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this office.' });
    } else if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO') {
      return res.status(403).json({ error: 'Access denied: Super Admin or CEO only.' });
    }

    const admins = await User.findAll({
      where: {
        organizationId: orgId,
        role: { [Op.in]: ['ADMIN', 'OPERATIONS_BILLING', 'WEIGHBRIDGE_CONTROLLER', 'PAYMENT_COLLECTOR'] }
      },
      attributes: ['id', 'username', 'role', 'organizationId', 'createdAt'],
      order: [['username', 'ASC']]
    });

    res.status(200).json({
      organization: {
        id: organization.id,
        name: organization.name
      },
      admins
    });
  } catch (error) {
    console.error('Error fetching organization admins:', error);
    res.status(500).json({ error: 'Internal server error while fetching organization admins.' });
  }
};

/**
 * GET /api/duty-assignments/permissions/:userId
 * Return saved module permissions for the selected Admin.
 */
exports.getAdminPermissions = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { organizationId } = req.query;

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Valid User ID is required.' });
    }

    // Find target user
    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'username', 'role', 'organizationId']
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Authorization: Super Admin, CEO owning the office, or user inspecting their own permissions
    if (req.user.role === 'CEO') {
      const office = await Organization.findByPk(targetUser.organizationId);
      if (!office || office.ceoId !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this employee\'s office.' });
      }
    } else if (req.user.role !== 'SUPER_ADMIN' && req.user.userId !== targetUserId) {
      return res.status(403).json({ error: 'Access denied: You cannot view permissions for another user.' });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Duty assignments can only be viewed for users with the ADMIN role.' });
    }

    // Verify organization matching if query param provided
    if (organizationId && targetUser.organizationId !== parseInt(organizationId, 10)) {
      return res.status(400).json({ error: 'User does not belong to the requested organization.' });
    }

    // Fetch saved permissions
    const savedRecords = await DutyAssignment.findAll({
      where: {
        userId: targetUser.id,
        organizationId: targetUser.organizationId
      }
    });

    const hasConfiguredDuties = savedRecords.length > 0;
    const permissionsMap = {};

    // Standardize all implemented modules
    IMPLEMENTED_MODULE_IDS.forEach(moduleId => {
      const existing = savedRecords.find(r => r.moduleKey === moduleId);
      if (existing) {
        permissionsMap[moduleId] = Boolean(existing.isEnabled);
      } else {
        // If duties have never been configured, default to true. If duties are configured, missing defaults to false.
        permissionsMap[moduleId] = !hasConfiguredDuties;
      }
    });

    res.status(200).json({
      userId: targetUser.id,
      username: targetUser.username,
      organizationId: targetUser.organizationId,
      hasConfiguredDuties,
      permissions: permissionsMap
    });
  } catch (error) {
    console.error('Error fetching admin permissions:', error);
    res.status(500).json({ error: 'Internal server error while fetching admin permissions.' });
  }
};

/**
 * POST /api/duty-assignments/permissions
 * Save or update module permissions for a specific organization Admin (Super Admin only).
 */
exports.saveAdminPermissions = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO') {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: Only Super Admin or CEO can modify duty assignments.' });
    }

    const { organizationId, userId, permissions } = req.body;

    if (!organizationId || !userId || !permissions || typeof permissions !== 'object') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'organizationId, userId, and a permissions object are required.' 
      });
    }

    const orgId = parseInt(organizationId, 10);
    const targetUserId = parseInt(userId, 10);

    // Verify Organization exists
    const organization = await Organization.findByPk(orgId, { transaction });
    if (!organization) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Organization not found.' });
    }

    // Verify CEO ownership
    if (req.user.role === 'CEO' && organization.ceoId !== req.user.userId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You do not own this office.' });
    }

    // Verify User exists and belongs to this organization
    const targetUser = await User.findByPk(targetUserId, { transaction });
    if (!targetUser) {
      await transaction.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.organizationId !== orgId) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Cross-organization assignment rejected: User "${targetUser.username}" does not belong to organization "${organization.name}".` 
      });
    }

    // Validate that no unimplemented modules are enabled
    for (const key of Object.keys(permissions)) {
      if (!VALID_MODULE_IDS.includes(key)) {
        await transaction.rollback();
        return res.status(400).json({ error: `Unknown module key "${key}".` });
      }

      if (!IMPLEMENTED_MODULE_IDS.includes(key) && permissions[key] === true) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `Module "${key}" is not yet implemented in the ERP system and cannot be enabled.` 
        });
      }
    }

    // Upsert permissions for all implemented modules
    const updatedPermissions = {};
    for (const moduleId of IMPLEMENTED_MODULE_IDS) {
      const isEnabled = Boolean(permissions[moduleId]);
      updatedPermissions[moduleId] = isEnabled;

      // Check if existing record
      const existing = await DutyAssignment.findOne({
        where: {
          organizationId: orgId,
          userId: targetUserId,
          moduleKey: moduleId
        },
        transaction
      });

      if (existing) {
        await existing.update({ isEnabled }, { transaction });
      } else {
        await DutyAssignment.create({
          organizationId: orgId,
          userId: targetUserId,
          moduleKey: moduleId,
          isEnabled
        }, { transaction });
      }
    }

    await transaction.commit();

    res.status(200).json({
      message: `Duty assignments for ${targetUser.username} saved successfully.`,
      organizationId: orgId,
      userId: targetUserId,
      permissions: updatedPermissions
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error saving admin permissions:', error);
    res.status(500).json({ error: 'Internal server error while saving duty assignments.' });
  }
};

/**
 * GET /api/duty-assignments/my-permissions
 * Return active permissions for the currently logged-in user.
 * Allows frontend sidebar and route guards to enforce permissions dynamically.
 */
exports.getMyPermissions = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super Admin and CEO have unrestricted access to all implemented modules in their scope
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'CEO') {
      const execPerms = {};
      IMPLEMENTED_MODULE_IDS.forEach(m => {
        execPerms[m] = true;
      });
      return res.status(200).json({
        role: req.user.role,
        organizationId: req.user.organizationId || null,
        permissions: execPerms
      });
    }

    // For ADMIN role, fetch duty assignments
    if (req.user.role === 'ADMIN') {
      const records = await DutyAssignment.findAll({
        where: {
          userId: req.user.userId,
          organizationId: req.user.organizationId
        }
      });

      const permsMap = {};
      const hasConfiguredDuties = records.length > 0;

      IMPLEMENTED_MODULE_IDS.forEach(moduleId => {
        const found = records.find(r => r.moduleKey === moduleId);
        if (found) {
          permsMap[moduleId] = Boolean(found.isEnabled);
        } else {
          // If unconfigured, default to true; if configured, missing is false
          permsMap[moduleId] = !hasConfiguredDuties;
        }
      });

      return res.status(200).json({
        role: 'ADMIN',
        organizationId: req.user.organizationId,
        permissions: permsMap
      });
    }

    // For operational roles (OPERATIONS_BILLING, WEIGHBRIDGE_CONTROLLER):
    // Standard role-based access
    const operationalPerms = {};
    IMPLEMENTED_MODULE_IDS.forEach(m => {
      if (req.user.role === 'OPERATIONS_BILLING') {
        operationalPerms[m] = ['ESTIMATES', 'BILLING', 'PURCHASES'].includes(m);
      } else if (req.user.role === 'WEIGHBRIDGE_CONTROLLER') {
        operationalPerms[m] = ['WEIGHBRIDGE', 'GATE_PASS'].includes(m);
      } else {
        operationalPerms[m] = false;
      }
    });

    res.status(200).json({
      role: req.user.role,
      organizationId: req.user.organizationId,
      permissions: operationalPerms
    });
  } catch (error) {
    console.error('Error fetching my permissions:', error);
    res.status(500).json({ error: 'Internal server error while fetching current user permissions.' });
  }
};

/**
 * GET /api/duty-assignments/admin-dashboard-summary
 * Return real-time module status, permissions, and entity counts for the logged-in user's organization.
 */
exports.getAdminDashboardSummary = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
    }

    const whereOrg = isSuperAdmin ? {} : { organizationId: orgId };

    const [
      customersCount,
      productsCount,
      estimatesCount,
      billsCount,
      purchasesCount,
      weighbridgeCount,
      gatePassCount,
      orgData
    ] = await Promise.all([
      Customer.count({ where: whereOrg }).catch(() => 0),
      Product.count({ where: whereOrg }).catch(() => 0),
      Estimate.count({ where: whereOrg }).catch(() => 0),
      Bill.count({ where: whereOrg }).catch(() => 0),
      Purchase.count({ where: whereOrg }).catch(() => 0),
      WeighingRecord.count({ where: whereOrg }).catch(() => 0),
      GatePass.count({ where: whereOrg }).catch(() => 0),
      orgId ? Organization.findByPk(orgId, { attributes: ['id', 'name', 'address', 'phone', 'status'] }) : null
    ]);

    // Permissions map
    const permissions = {};
    if (isSuperAdmin) {
      IMPLEMENTED_MODULE_IDS.forEach(m => {
        permissions[m] = true;
      });
    } else {
      const records = await DutyAssignment.findAll({
        where: {
          userId: req.user.userId,
          organizationId: orgId
        }
      });
      const hasConfiguredDuties = records.length > 0;
      IMPLEMENTED_MODULE_IDS.forEach(m => {
        const found = records.find(r => r.moduleKey === m);
        if (found) {
          permissions[m] = Boolean(found.isEnabled);
        } else {
          permissions[m] = !hasConfiguredDuties;
        }
      });
    }

    res.status(200).json({
      role: req.user.role,
      organization: orgData,
      permissions,
      counts: {
        CUSTOMER_MASTER: customersCount,
        PRODUCT_MASTER: productsCount,
        ESTIMATES: estimatesCount,
        BILLING: billsCount,
        PURCHASES: purchasesCount,
        WEIGHBRIDGE: weighbridgeCount,
        GATE_PASS: gatePassCount
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error while fetching admin dashboard summary.' });
  }
};
