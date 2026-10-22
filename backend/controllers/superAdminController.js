const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Estimate = require('../models/Estimate');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const EstimateItem = require('../models/EstimateItem');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const WeighingRecord = require('../models/WeighingRecord');
const GatePass = require('../models/GatePass');

/**
 * GET /api/super-admin/ceos
 * List all registered CEO accounts with office & employee counts
 */
exports.getCeos = async (req, res) => {
  try {
    const { search, status } = req.query;

    const whereClause = { role: 'CEO' };

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

    const ceos = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'fullName', 'phone', 'role', 'status', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Organization,
          as: 'offices',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Compute office count and total employee count for each CEO
    const ceoList = await Promise.all(ceos.map(async (ceo) => {
      const ceoObj = ceo.toJSON();
      const officeIds = (ceoObj.offices || []).map(o => o.id);

      let employeeCount = 0;
      if (officeIds.length > 0) {
        employeeCount = await User.count({
          where: {
            organizationId: { [Op.in]: officeIds }
          }
        });
      }

      ceoObj.officeCount = officeIds.length;
      ceoObj.employeeCount = employeeCount;
      return ceoObj;
    }));

    res.status(200).json(ceoList);
  } catch (error) {
    console.error('Error fetching CEOs:', error);
    res.status(500).json({ error: 'Internal server error while fetching CEO accounts.' });
  }
};

/**
 * POST /api/super-admin/ceos
 * Create a new CEO account
 */
exports.createCeo = async (req, res) => {
  try {
    const { username, password, fullName, phone, email, status } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const cleanUsername = username.trim();

    // Check duplicate
    const existing = await User.findOne({ where: { username: cleanUsername } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const newCeo = await User.create({
      username: cleanUsername,
      password: hashedPassword,
      fullName: fullName ? fullName.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      role: 'CEO',
      status: status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
      organizationId: null
    });

    const ceoObj = newCeo.toJSON();
    delete ceoObj.password;

    res.status(201).json({
      message: 'CEO account created successfully.',
      ceo: ceoObj
    });
  } catch (error) {
    console.error('Error creating CEO:', error);
    res.status(500).json({ error: 'Internal server error while creating CEO account.' });
  }
};

/**
 * GET /api/super-admin/ceos/:id
 * Retrieve comprehensive CEO details: profile, offices, employees, and consolidated statistics
 */
exports.getCeoDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const ceo = await User.findOne({
      where: { id, role: 'CEO' },
      attributes: ['id', 'username', 'fullName', 'email', 'phone', 'role', 'status', 'createdAt', 'updatedAt']
    });

    if (!ceo) {
      return res.status(404).json({ error: 'CEO account not found.' });
    }

    // Fetch offices owned by this CEO
    const offices = await Organization.findAll({
      where: { ceoId: id },
      attributes: ['id', 'name', 'address', 'phone', 'status', 'createdAt'],
      order: [['name', 'ASC']]
    });

    const officeIds = offices.map(o => o.id);

    // Compute per-office breakdown
    const enrichedOffices = await Promise.all(offices.map(async (office) => {
      const orgId = office.id;
      const [
        empCount,
        billsCount,
        billsSum,
        estimatesCount,
        purchasesCount,
        productsCount,
        customersCount
      ] = await Promise.all([
        User.count({ where: { organizationId: orgId } }),
        Bill.count({ where: { organizationId: orgId } }),
        Bill.sum('finalAmount', { where: { organizationId: orgId } }),
        Estimate.count({ where: { organizationId: orgId } }),
        Purchase.count({ where: { organizationId: orgId } }),
        Product.count({ where: { organizationId: orgId } }),
        Customer.count({ where: { organizationId: orgId } })
      ]);

      const oJson = office.toJSON();
      return {
        ...oJson,
        employeeCount: empCount,
        billsCount: billsCount || 0,
        billsTotalAmount: parseFloat(billsSum || 0),
        estimatesCount: estimatesCount || 0,
        purchasesCount: purchasesCount || 0,
        productsCount: productsCount || 0,
        customersCount: customersCount || 0
      };
    }));

    // Fetch employees across all offices owned by this CEO
    let employees = [];
    if (officeIds.length > 0) {
      const empList = await User.findAll({
        where: { organizationId: { [Op.in]: officeIds } },
        attributes: ['id', 'username', 'fullName', 'email', 'phone', 'role', 'status', 'organizationId', 'createdAt'],
        include: [
          {
            model: Organization,
            as: 'office',
            attributes: ['id', 'name']
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      employees = empList.map(emp => {
        const plain = emp.get ? emp.get({ plain: true }) : emp;
        return {
          ...plain,
          officeName: plain.office ? plain.office.name : null
        };
      });
    }

    // Consolidated Metrics across offices
    let stats = {
      customersCount: 0,
      productsCount: 0,
      estimatesCount: 0,
      billsCount: 0,
      billsTotalAmount: 0,
      purchasesCount: 0,
      weighingCount: 0,
      gatePassesCount: 0
    };

    if (officeIds.length > 0) {
      const orgIn = { [Op.in]: officeIds };

      const [
        customersCount,
        productsCount,
        estimatesCount,
        billsCount,
        billsSum,
        purchasesCount,
        weighingCount,
        gatePassesCount
      ] = await Promise.all([
        Customer.count({ where: { organizationId: orgIn } }),
        Product.count({ where: { organizationId: orgIn } }),
        Estimate.count({ where: { organizationId: orgIn } }),
        Bill.count({ where: { organizationId: orgIn } }),
        Bill.sum('finalAmount', { where: { organizationId: orgIn } }),
        Purchase.count({ where: { organizationId: orgIn } }),
        WeighingRecord.count({ where: { organizationId: orgIn } }),
        GatePass.count({ where: { organizationId: orgIn } })
      ]);

      stats = {
        customersCount,
        productsCount,
        estimatesCount,
        billsCount,
        billsTotalAmount: parseFloat(billsSum || 0),
        purchasesCount,
        weighingCount,
        gatePassesCount
      };
    }

    res.status(200).json({
      ceo,
      offices: enrichedOffices,
      employees,
      stats,
      counts: {
        offices: offices.length,
        employees: employees.length
      }
    });
  } catch (error) {
    console.error('Error fetching CEO details:', error);
    res.status(500).json({ error: 'Internal server error while fetching CEO details.' });
  }
};

/**
 * PATCH /api/super-admin/ceos/:id/status
 * Activate or deactivate a CEO account
 */
exports.updateCeoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const ceo = await User.findOne({ where: { id, role: 'CEO' } });
    if (!ceo) {
      return res.status(404).json({ error: 'CEO account not found.' });
    }

    ceo.status = status;
    await ceo.save();

    res.status(200).json({
      message: `CEO account ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`,
      ceo: {
        id: ceo.id,
        username: ceo.username,
        status: ceo.status
      }
    });
  } catch (error) {
    console.error('Error updating CEO status:', error);
    res.status(500).json({ error: 'Internal server error while updating CEO status.' });
  }
};

/**
 * PUT /api/super-admin/ceos/:id
 * Update CEO profile information
 */
exports.updateCeo = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullName, phone, email, status } = req.body;

    const ceo = await User.findOne({ where: { id, role: 'CEO' } });
    if (!ceo) {
      return res.status(404).json({ error: 'CEO account not found.' });
    }

    if (username && username.trim() !== ceo.username) {
      const cleanUser = username.trim();
      const duplicate = await User.findOne({ where: { username: cleanUser } });
      if (duplicate) {
        return res.status(409).json({ error: 'Username already in use.' });
      }
      ceo.username = cleanUser;
    }

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      ceo.password = await bcrypt.hash(password.trim(), salt);
    }

    if (fullName !== undefined) ceo.fullName = fullName ? fullName.trim() : null;
    if (email !== undefined) ceo.email = email ? email.trim() : null;
    if (phone !== undefined) ceo.phone = phone ? phone.trim() : null;
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) ceo.status = status;

    await ceo.save();

    const ceoObj = ceo.toJSON();
    delete ceoObj.password;

    res.status(200).json({
      message: 'CEO account updated successfully.',
      ceo: ceoObj
    });
  } catch (error) {
    console.error('Error updating CEO:', error);
    res.status(500).json({ error: 'Internal server error while updating CEO account.' });
  }
};

/**
 * PATCH /api/super-admin/offices/:id/assign-ceo
 * Assign an office to a CEO or transfer office ownership
 */
exports.assignOfficeToCeo = async (req, res) => {
  try {
    const { id } = req.params;
    const { ceoId, officeId } = req.body;

    // Support both /offices/:id/assign-ceo and /ceos/:id/assign-office
    const targetOfficeId = officeId || id;
    const targetCeoId = ceoId !== undefined ? ceoId : (req.originalUrl?.includes('/ceos/') ? id : null);

    const office = await Organization.findByPk(targetOfficeId);
    if (!office) {
      return res.status(404).json({ error: 'Office not found.' });
    }

    if (targetCeoId) {
      const ceo = await User.findOne({ where: { id: targetCeoId, role: 'CEO' } });
      if (!ceo) {
        return res.status(404).json({ error: 'Selected CEO does not exist.' });
      }
      office.ceoId = ceo.id;
    } else {
      office.ceoId = null;
    }

    await office.save();

    res.status(200).json({
      message: 'Office assigned to CEO successfully.',
      office
    });
  } catch (error) {
    console.error('Error assigning office to CEO:', error);
    res.status(500).json({ error: 'Internal server error while assigning office.' });
  }
};

/**
 * GET /api/super-admin/ceos/:id/modules/:moduleKey
 * Retrieve real database business records belonging to a CEO's offices,
 * with optional officeId filter.
 */
exports.getCeoModuleData = async (req, res) => {
  try {
    const { id, moduleKey } = req.params;
    const { officeId, search } = req.query;

    const ceo = await User.findOne({ where: { id, role: 'CEO' } });
    if (!ceo) {
      return res.status(404).json({ error: 'CEO not found.' });
    }

    const offices = await Organization.findAll({
      where: { ceoId: id },
      attributes: ['id', 'name']
    });

    const ownedOfficeIds = offices.map(o => o.id);
    if (ownedOfficeIds.length === 0) {
      return res.status(200).json({ records: [], offices: [] });
    }

    let targetOfficeIds = ownedOfficeIds;
    if (officeId && officeId !== 'ALL' && officeId !== '') {
      const parsed = parseInt(officeId, 10);
      if (ownedOfficeIds.includes(parsed)) {
        targetOfficeIds = [parsed];
      }
    }

    const orgFilter = { organizationId: { [Op.in]: targetOfficeIds } };
    let records = [];

    // Normalize moduleKey to uppercase and replace hyphens with underscores (e.g. 'bills' -> 'BILLS', 'gate-passes' -> 'GATE_PASSES')
    const normalizedKey = (moduleKey || '').toUpperCase().replace('-', '_');

    switch (normalizedKey) {
      case 'CUSTOMERS':
        records = await Customer.findAll({
          where: orgFilter,
          include: [{ model: Organization, attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'PRODUCTS':
        records = await Product.findAll({
          where: orgFilter,
          include: [{ model: Organization, attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'ESTIMATES':
        records = await Estimate.findAll({
          where: orgFilter,
          include: [
            { model: Organization, attributes: ['id', 'name'] },
            { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
            { model: EstimateItem, as: 'items' }
          ],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'BILLS':
        records = await Bill.findAll({
          where: orgFilter,
          include: [
            { model: Organization, attributes: ['id', 'name'] },
            { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
            { model: BillItem, as: 'items' }
          ],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'PURCHASES':
        records = await Purchase.findAll({
          where: orgFilter,
          include: [
            { model: Organization, attributes: ['id', 'name'] },
            { model: PurchaseItem, as: 'items' }
          ],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'WEIGHBRIDGE':
        records = await WeighingRecord.findAll({
          where: orgFilter,
          include: [
            { model: Organization, attributes: ['id', 'name'] },
            { model: Customer, attributes: ['id', 'name'] }
          ],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      case 'GATE_PASSES':
        records = await GatePass.findAll({
          where: orgFilter,
          include: [{ model: Organization, attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        break;

      default:
        return res.status(400).json({ error: `Unknown module key: ${moduleKey}` });
    }

    res.status(200).json({
      records,
      offices
    });
  } catch (error) {
    console.error('Error fetching CEO module data:', error);
    res.status(500).json({ error: 'Internal server error while fetching module data.' });
  }
};
