const { Op } = require('sequelize');
const sequelize = require('../config/database');
const WeighingRecord = require('../models/WeighingRecord');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { generateUniqueWeighingNumber } = require('../utils/weighingNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * GET /api/weighbridge
 * List weighing history records with search and filter capabilities.
 */
exports.getWeighingRecords = async (req, res) => {
  try {
    const { 
      search, 
      organizationId, 
      startDate, 
      endDate 
    } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);

    let where = {};
    where = buildOfficeWhereClause(targetOfficeIds, where);

    if (startDate && endDate) {
      where.weighedAt = {
        [Op.between]: [new Date(`${startDate}T00:00:00.000Z`), new Date(`${endDate}T23:59:59.999Z`)]
      };
    } else if (startDate) {
      where.weighedAt = { [Op.gte]: new Date(`${startDate}T00:00:00.000Z`) };
    } else if (endDate) {
      where.weighedAt = { [Op.lte]: new Date(`${endDate}T23:59:59.999Z`) };
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { weighingNumber: { [Op.like]: term } },
        { vehicleDetails: { [Op.like]: term } },
        { '$Customer.name$': { [Op.like]: term } }
      ];
    }

    const records = await WeighingRecord.findAll({
      where,
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { model: User, as: 'recorder', attributes: ['id', 'username', 'fullName', 'role'] }
      ],
      order: [['weighedAt', 'DESC']]
    });

    res.status(200).json(records);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching weighing records:', error);
    res.status(500).json({ error: 'Internal server error while fetching weighing history.' });
  }
};

/**
 * GET /api/weighbridge/:id
 * Retrieve full details of a specific weighing record.
 */
exports.getWeighingRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await WeighingRecord.findByPk(id, {
      include: [
        { model: Organization, attributes: ['id', 'name', 'address', 'phone'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'address'] },
        { model: User, as: 'recorder', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    if (!record) {
      return res.status(404).json({ error: 'Weighing record not found.' });
    }

    await verifyRecordOwnership(record, req.user);

    res.status(200).json(record);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching weighing record details:', error);
    res.status(500).json({ error: 'Internal server error while fetching weighing record.' });
  }
};

/**
 * POST /api/weighbridge
 * Record a manual weighing slip with:
 * - customer name (customerId)
 * - vehicle details (vehicleDetails)
 * - first weight (empty vehicle weight)
 * - gross weight (vehicle and goods weight)
 * - tale weight (weight of goods = gross weight - first weight)
 */
exports.createWeighingRecord = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customerId,
      vehicleDetails,
      firstWeight,
      grossWeight,
      taleWeight,
      weightUnit,
      organizationId: customOrgId
    } = req.body;

    if (!customerId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Please select a Customer from the dropdown menu.' });
    }

    if (!vehicleDetails || !vehicleDetails.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Vehicle details are required.' });
    }

    const parsedFirst = parseFloat(firstWeight);
    const parsedGross = parseFloat(grossWeight);

    if (isNaN(parsedFirst) || parsedFirst < 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'First weight (empty vehicle weight) must be a non-negative number.' });
    }

    if (isNaN(parsedGross) || parsedGross < 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Gross weight must be a non-negative number.' });
    }

    // Tale weight is calculated as (gross weight - first weight) unless explicitly specified
    let calculatedTale;
    if (taleWeight !== undefined && taleWeight !== '' && !isNaN(parseFloat(taleWeight))) {
      calculatedTale = parseFloat(taleWeight);
    } else {
      calculatedTale = parsedGross - parsedFirst;
    }

    // Verify Customer exists
    const customer = await Customer.findByPk(customerId, { transaction });
    if (!customer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Selected customer not found.' });
    }

    // Determine target office context
    let targetOrgId;
    try {
      targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, customOrgId || customer.organizationId);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Generate unique sequential weighing slip number
    const weighingNumber = await generateUniqueWeighingNumber(transaction);

    const newRecord = await WeighingRecord.create({
      weighingNumber,
      organizationId: targetOrgId,
      customerId,
      vehicleDetails: vehicleDetails.trim(),
      firstWeight: parsedFirst,
      grossWeight: parsedGross,
      taleWeight: calculatedTale,
      weightUnit: weightUnit && weightUnit.trim() ? weightUnit.trim() : 'Ton',
      recordedBy: req.user.id,
      weighedAt: new Date()
    }, { transaction });

    await transaction.commit();

    const createdWithAssoc = await WeighingRecord.findByPk(newRecord.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { model: User, as: 'recorder', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    res.status(201).json({
      message: 'Weighbridge entry recorded successfully.',
      weighingRecord: createdWithAssoc
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating weighing record:', error);
    res.status(500).json({ error: error.message || 'Internal server error while creating weighing record.' });
  }
};

/**
 * Compatibility stubs
 */
exports.searchTransactions = async (req, res) => {
  res.status(200).json([]);
};

exports.reweighTransaction = async (req, res) => {
  res.status(400).json({ error: 'Reweigh workflow has been replaced with direct manual entry.' });
};

exports.approveDiscrepancy = async (req, res) => {
  res.status(400).json({ error: 'Discrepancy approval is no longer required.' });
};
