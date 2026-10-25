const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
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
const { MODULES } = require('../config/moduleRegistry');

/**
 * Helper: Retrieve all office IDs owned by the authenticated CEO.
 */
async function getCeoOfficeIds(ceoUserId) {
  const offices = await Organization.findAll({
    where: { ceoId: ceoUserId },
    attributes: ['id']
  });
  return offices.map(o => o.id);
}

/**
 * GET /api/ceo/dashboard-summary
 * Real-time summary for the CEO's executive dashboard
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const ceoId = req.user.userId;
    const { officeId } = req.query;

    const ownedOffices = await Organization.findAll({
      where: { ceoId },
      attributes: ['id', 'name', 'address', 'phone', 'status'],
      order: [['name', 'ASC']]
    });

    const ownedIds = ownedOffices.map(o => o.id);

    if (ownedIds.length === 0) {
      return res.status(200).json({
        totalOffices: 0,
        activeOffices: 0,
        totalEmployees: 0,
        totalDispatches: 0,
        totalRevenue: 0,
        offices: [],
        selectedOfficeId: 'ALL',
        stats: {
          officesCount: 0,
          employeesCount: 0,
          customersCount: 0,
          productsCount: 0,
          estimatesCount: 0,
          billsCount: 0,
          billsTotalAmount: 0,
          purchasesCount: 0,
          purchasesPendingApproval: 0,
          weighingCount: 0,
          gatePassesCount: 0
        }
      });
    }

    let targetIds = ownedIds;
    if (officeId && officeId !== 'ALL' && officeId !== '') {
      const parsedId = parseInt(officeId, 10);
      if (!ownedIds.includes(parsedId)) {
        return res.status(403).json({ error: 'Access denied: You do not own this office.' });
      }
      targetIds = [parsedId];
    }

    const orgIn = { [Op.in]: targetIds };

    const [
      employeesCount,
      customersCount,
      productsCount,
      estimatesCount,
      billsCount,
      billsSum,
      purchasesCount,
      purchasesPendingApproval,
      weighingCount,
      gatePassesCount,
      employeeCountsGrouped
    ] = await Promise.all([
      User.count({ where: { organizationId: orgIn } }),
      Customer.count({ where: { organizationId: orgIn } }),
      Product.count({ where: { organizationId: orgIn } }),
      Estimate.count({ where: { organizationId: orgIn } }),
      Bill.count({ where: { organizationId: orgIn } }),
      Bill.sum('finalAmount', { where: { organizationId: orgIn } }),
      Purchase.count({ where: { organizationId: orgIn } }),
      Purchase.count({ where: { organizationId: orgIn, status: 'PENDING_APPROVAL' } }),
      WeighingRecord.count({ where: { organizationId: orgIn } }),
      GatePass.count({ where: { organizationId: orgIn } }),
      User.findAll({
        attributes: ['organizationId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { organizationId: { [Op.in]: ownedIds } },
        group: ['organizationId'],
        raw: true
      })
    ]);

    const activeOffices = ownedOffices.filter(o => o.status !== 'INACTIVE').length;
    const officesWithCounts = ownedOffices.map(o => {
      const plain = o.get ? o.get({ plain: true }) : o;
      const match = employeeCountsGrouped.find(e => Number(e.organizationId) === Number(plain.id));
      return {
        ...plain,
        employeeCount: match ? parseInt(match.count, 10) : 0
      };
    });

    res.status(200).json({
      totalOffices: ownedIds.length,
      activeOffices,
      totalEmployees: employeesCount,
      totalDispatches: gatePassesCount,
      totalRevenue: parseFloat(billsSum || 0),
      offices: officesWithCounts,
      selectedOfficeId: officeId || 'ALL',
      stats: {
        officesCount: ownedIds.length,
        employeesCount,
        customersCount,
        productsCount,
        estimatesCount,
        billsCount,
        billsTotalAmount: parseFloat(billsSum || 0),
        purchasesCount,
        purchasesPendingApproval,
        weighingCount,
        gatePassesCount
      }
    });
  } catch (error) {
    console.error('Error fetching CEO dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error while fetching dashboard summary.' });
  }
};

/**
 * GET /api/ceo/offices
 * List all offices owned by the authenticated CEO
 */
exports.getOffices = async (req, res) => {
  try {
    const offices = await Organization.findAll({
      where: { ceoId: req.user.userId },
      attributes: ['id', 'name', 'address', 'phone', 'status', 'createdAt', 'updatedAt'],
      order: [['name', 'ASC']]
    });

    const officeList = await Promise.all(offices.map(async (office) => {
      const obj = office.toJSON();
      obj.employeeCount = await User.count({ where: { organizationId: office.id } });
      return obj;
    }));

    res.status(200).json(officeList);
  } catch (error) {
    console.error('Error fetching CEO offices:', error);
    res.status(500).json({ error: 'Internal server error while fetching offices.' });
  }
};

/**
 * POST /api/ceo/offices
 * Disabled for CEO role. Offices are created and assigned exclusively by SUPER_ADMIN.
 */
exports.createOffice = async (req, res) => {
  return res.status(403).json({
    error: 'Access denied: CEOs cannot create offices. Offices and CEO assignments are managed exclusively by Super Admin.'
  });
};

/**
 * PUT /api/ceo/offices/:id
 * Update an office owned by the authenticated CEO
 */
exports.updateOffice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, status } = req.body;

    const office = await Organization.findByPk(id);
    if (!office || office.ceoId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied: You do not have ownership of this office.' });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Office name cannot be empty.' });
      office.name = name.trim();
    }

    if (address !== undefined) {
      if (!address.trim()) return res.status(400).json({ error: 'Office address cannot be empty.' });
      office.address = address.trim();
    }

    if (phone !== undefined) {
      if (!phone.trim()) return res.status(400).json({ error: 'Office phone cannot be empty.' });
      office.phone = phone.trim();
    }

    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      office.status = status;
    }

    await office.save();

    res.status(200).json({
      message: 'Office updated successfully.',
      office
    });
  } catch (error) {
    console.error('Error updating office:', error);
    res.status(500).json({ error: 'Internal server error while updating office.' });
  }
};

/**
 * PATCH /api/ceo/offices/:id/status
 * Activate or deactivate an office
 */
exports.updateOfficeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const office = await Organization.findByPk(id);
    if (!office || office.ceoId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied: You do not have ownership of this office.' });
    }

    office.status = status;
    await office.save();

    res.status(200).json({
      message: `Office ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`,
      office
    });
  } catch (error) {
    console.error('Error updating office status:', error);
    res.status(500).json({ error: 'Internal server error while updating office status.' });
  }
};

/**
 * GET /api/ceo/employees
 * List employees belonging to the authenticated CEO's offices
 */
exports.getEmployees = async (req, res) => {
  try {
    const { officeId, search, status } = req.query;
    const ownedIds = await getCeoOfficeIds(req.user.userId);

    if (ownedIds.length === 0) {
      return res.status(200).json([]);
    }

    let targetOfficeIds = ownedIds;
    if (officeId && officeId !== 'ALL' && officeId !== '') {
      const parsedId = parseInt(officeId, 10);
      if (!ownedIds.includes(parsedId)) {
        return res.status(403).json({ error: 'Access denied: You do not own this office.' });
      }
      targetOfficeIds = [parsedId];
    }

    const whereClause = {
      organizationId: { [Op.in]: targetOfficeIds }
    };

    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      whereClause.status = status;
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { username: { [Op.like]: term } },
        { fullName: { [Op.like]: term } },
        { phone: { [Op.like]: term } }
      ];
    }

    const employees = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'email', 'fullName', 'phone', 'role', 'status', 'organizationId', 'createdAt'],
      include: [
        {
          model: Organization,
          as: 'office',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedEmployees = employees.map(emp => {
      const plain = emp.get ? emp.get({ plain: true }) : emp;
      return {
        ...plain,
        officeName: plain.office ? plain.office.name : null
      };
    });

    res.status(200).json(formattedEmployees);
  } catch (error) {
    console.error('Error fetching CEO employees:', error);
    res.status(500).json({ error: 'Internal server error while fetching employees.' });
  }
};

/**
 * POST /api/ceo/employees
 * Create a new employee assigned to one of the CEO's offices
 */
exports.createEmployee = async (req, res) => {
  try {
    const { username, password, fullName, phone, email, role, officeId, organizationId, status } = req.body;
    const targetOfficeId = officeId || organizationId;

    if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
    if (!password || !password.trim()) return res.status(400).json({ error: 'Password is required.' });
    if (!targetOfficeId) return res.status(400).json({ error: 'Office selection is required.' });

    // Enforce role security: CEO cannot create another CEO or Super Admin!
    const allowedRoles = ['ADMIN', 'OPERATIONS_BILLING', 'WEIGHBRIDGE_CONTROLLER', 'PAYMENT_COLLECTOR', 'USER'];
    const assignedRole = role && allowedRoles.includes(role) ? role : 'ADMIN';

    // Verify office ownership
    const office = await Organization.findByPk(targetOfficeId);
    if (!office || office.ceoId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied: You do not own the selected office.' });
    }

    const cleanUsername = username.trim();
    const existing = await User.findOne({ where: { username: cleanUsername } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const newEmployee = await User.create({
      username: cleanUsername,
      password: hashedPassword,
      fullName: fullName ? fullName.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      role: assignedRole,
      status: status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
      organizationId: office.id
    });

    const empObj = newEmployee.toJSON();
    delete empObj.password;
    empObj.office = { id: office.id, name: office.name };
    empObj.officeName = office.name;

    res.status(201).json({
      message: 'Employee account created successfully.',
      employee: empObj
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error while creating employee.' });
  }
};

/**
 * PUT /api/ceo/employees/:id
 * Update an employee belonging to the CEO's offices
 */
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullName, phone, email, role, officeId, organizationId, status } = req.body;
    const targetOfficeId = officeId || organizationId;

    const ownedIds = await getCeoOfficeIds(req.user.userId);

    const employee = await User.findByPk(id);
    if (!employee || !ownedIds.includes(employee.organizationId)) {
      return res.status(403).json({ error: 'Access denied: This employee does not belong to your offices.' });
    }

    if (username && username.trim() !== employee.username) {
      const cleanUser = username.trim();
      const duplicate = await User.findOne({ where: { username: cleanUser } });
      if (duplicate) return res.status(409).json({ error: 'Username already in use.' });
      employee.username = cleanUser;
    }

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password.trim(), salt);
    }

    if (fullName !== undefined) employee.fullName = fullName ? fullName.trim() : null;
    if (email !== undefined) employee.email = email ? email.trim() : null;
    if (phone !== undefined) employee.phone = phone ? phone.trim() : null;

    if (role) {
      const allowedRoles = ['ADMIN', 'OPERATIONS_BILLING', 'WEIGHBRIDGE_CONTROLLER', 'PAYMENT_COLLECTOR', 'USER'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role assignment.' });
      }
      employee.role = role;
    }

    if (targetOfficeId) {
      const targetId = parseInt(targetOfficeId, 10);
      if (!ownedIds.includes(targetId)) {
        return res.status(403).json({ error: 'Access denied: Target office does not belong to you.' });
      }
      employee.organizationId = targetId;
    }

    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      employee.status = status;
    }

    await employee.save();

    const empObj = employee.toJSON();
    delete empObj.password;
    const assignedOffice = await Organization.findByPk(employee.organizationId);
    empObj.office = assignedOffice ? { id: assignedOffice.id, name: assignedOffice.name } : null;
    empObj.officeName = assignedOffice ? assignedOffice.name : null;

    res.status(200).json({
      message: 'Employee updated successfully.',
      employee: empObj
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error while updating employee.' });
  }
};

/**
 * PATCH /api/ceo/employees/:id/status
 * Activate or deactivate an employee account
 */
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const ownedIds = await getCeoOfficeIds(req.user.userId);
    const employee = await User.findByPk(id);

    if (!employee || !ownedIds.includes(employee.organizationId)) {
      return res.status(403).json({ error: 'Access denied: This employee does not belong to your offices.' });
    }

    employee.status = status;
    await employee.save();

    res.status(200).json({
      message: `Employee ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`,
      employee: {
        id: employee.id,
        username: employee.username,
        status: employee.status
      }
    });
  } catch (error) {
    console.error('Error updating employee status:', error);
    res.status(500).json({ error: 'Internal server error while updating employee status.' });
  }
};

/**
 * GET /api/ceo/employees/:id/permissions
 * Retrieve Duty Assignment permissions for an employee
 */
exports.getEmployeePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const ownedIds = await getCeoOfficeIds(req.user.userId);

    const employee = await User.findByPk(id);
    if (!employee || !ownedIds.includes(employee.organizationId)) {
      return res.status(403).json({ error: 'Access denied: This employee does not belong to your offices.' });
    }

    const assignments = await DutyAssignment.findAll({
      where: {
        userId: id,
        organizationId: employee.organizationId
      }
    });

    const permissions = {};
    assignments.forEach(a => {
      permissions[a.moduleKey] = a.isEnabled;
    });

    res.status(200).json({
      employee: {
        id: employee.id,
        username: employee.username,
        role: employee.role,
        organizationId: employee.organizationId
      },
      permissions,
      hasConfiguredDuties: assignments.length > 0,
      modules: MODULES
    });
  } catch (error) {
    console.error('Error fetching employee permissions:', error);
    res.status(500).json({ error: 'Internal server error while fetching permissions.' });
  }
};

/**
 * POST /api/ceo/employees/:id/permissions
 * Save Duty Assignment permissions for an employee
 */
exports.saveEmployeePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body; // { [moduleKey]: boolean }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Permissions payload is required.' });
    }

    const ownedIds = await getCeoOfficeIds(req.user.userId);
    const employee = await User.findByPk(id);

    if (!employee || !ownedIds.includes(employee.organizationId)) {
      return res.status(403).json({ error: 'Access denied: This employee does not belong to your offices.' });
    }

    for (const [moduleKey, isEnabled] of Object.entries(permissions)) {
      const [assignment] = await DutyAssignment.findOrCreate({
        where: {
          userId: id,
          organizationId: employee.organizationId,
          moduleKey
        },
        defaults: {
          isEnabled: Boolean(isEnabled)
        }
      });

      if (assignment.isEnabled !== Boolean(isEnabled)) {
        assignment.isEnabled = Boolean(isEnabled);
        await assignment.save();
      }
    }

    res.status(200).json({
      message: 'Employee module permissions updated successfully.',
      permissions
    });
  } catch (error) {
    console.error('Error saving employee permissions:', error);
    res.status(500).json({ error: 'Internal server error while saving permissions.' });
  }
};
