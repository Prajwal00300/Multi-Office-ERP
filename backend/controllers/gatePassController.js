const { Op } = require('sequelize');
const sequelize = require('../config/database');
const GatePass = require('../models/GatePass');
const GatePassAudit = require('../models/GatePassAudit');
const WeighingRecord = require('../models/WeighingRecord');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');

const { generateUniqueGatePassNumber } = require('../utils/gatePassNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * GET /api/gate-passes
 * List all gate passes with filters and real-time status.
 */
exports.getGatePasses = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      organizationId, 
      startDate, 
      endDate
    } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);

    let where = {};
    where = buildOfficeWhereClause(targetOfficeIds, where);

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(`${startDate}T00:00:00.000Z`), new Date(`${endDate}T23:59:59.999Z`)]
      };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(`${startDate}T00:00:00.000Z`) };
    } else if (endDate) {
      where.createdAt = { [Op.lte]: new Date(`${endDate}T23:59:59.999Z`) };
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { gatePassNumber: { [Op.like]: term } },
        { vehicleNumber: { [Op.like]: term } },
        { '$Customer.name$': { [Op.like]: term } }
      ];
    }

    const passes = await GatePass.findAll({
      where,
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { 
          model: WeighingRecord, 
          as: 'weighingRecord',
          attributes: ['id', 'weighingNumber', 'firstWeight', 'grossWeight', 'taleWeight', 'weightUnit', 'weighedAt']
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'dispatcher', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const now = Date.now();
    const enriched = passes.map(p => {
      const plain = p.toJSON();
      plain.customer = plain.Customer || plain.customer;
      plain.organization = plain.Organization || plain.organization;
      const expiry = new Date(plain.validityExpiry).getTime();
      const remainingMs = expiry - now;
      const isExpired = remainingMs <= 0;

      plain.isExpired = isExpired;
      plain.remainingSeconds = isExpired ? 0 : Math.floor(remainingMs / 1000);
      return plain;
    });

    res.status(200).json(enriched);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching gate passes:', error);
    res.status(500).json({ error: 'Internal server error while fetching gate passes.' });
  }
};

/**
 * GET /api/gate-passes/check-eligibility
 * Check if a valid Weighbridge slip exists for the Customer + Vehicle within the 10-minute window.
 */
exports.checkEligibility = async (req, res) => {
  try {
    const { customerId, vehicleNumber, organizationId } = req.query;
    if (!customerId || !vehicleNumber || !vehicleNumber.trim()) {
      return res.status(200).json({ found: false });
    }

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const cleanVehicle = vehicleNumber.trim();

    const record = await WeighingRecord.findOne({
      where: {
        organizationId: { [Op.in]: targetOfficeIds },
        customerId: parseInt(customerId, 10),
        vehicleDetails: { [Op.like]: `%${cleanVehicle}%` }
      },
      order: [['weighedAt', 'DESC']],
      include: [{ model: Customer, attributes: ['id', 'name'] }]
    });

    if (!record) {
      return res.status(200).json({ 
        found: false, 
        message: 'No matching Weighbridge slip found for this Customer and Vehicle.' 
      });
    }

    // Check if duplicate gate pass exists for this slip
    const existingPass = await GatePass.findOne({
      where: {
        weighingRecordId: record.id,
        status: { [Op.ne]: 'CANCELLED' }
      }
    });

    const slipTime = new Date(record.weighedAt || record.createdAt).getTime();
    const now = Date.now();
    const elapsedMs = now - slipTime;
    const remainingMs = Math.max(0, TEN_MINUTES_MS - elapsedMs);
    const isExpired = elapsedMs > TEN_MINUTES_MS;

    res.status(200).json({
      found: true,
      weighingRecordId: record.id,
      weighingNumber: record.weighingNumber,
      slipTime: record.weighedAt || record.createdAt,
      elapsedMs,
      remainingMs,
      remainingSeconds: Math.floor(remainingMs / 1000),
      isExpired,
      alreadyUsed: Boolean(existingPass),
      existingPassNumber: existingPass?.gatePassNumber || null
    });
  } catch (error) {
    console.error('Error checking gate pass eligibility:', error);
    res.status(500).json({ error: 'Failed to check slip eligibility.' });
  }
};

/**
 * GET /api/gate-passes/:id
 * Retrieve single gate pass with Customer, Organization, and Weighbridge record.
 */
exports.getGatePassById = async (req, res) => {
  try {
    const { id } = req.params;

    const gatePass = await GatePass.findByPk(id, {
      include: [
        { model: Organization, attributes: ['id', 'name', 'address', 'phone'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'address', 'tin'] },
        { 
          model: WeighingRecord, 
          as: 'weighingRecord',
          attributes: ['id', 'weighingNumber', 'firstWeight', 'grossWeight', 'taleWeight', 'weightUnit', 'weighedAt']
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'issuer', attributes: ['id', 'username'] },
        { model: User, as: 'dispatcher', attributes: ['id', 'username'] },
        { model: User, as: 'canceller', attributes: ['id', 'username'] }
      ]
    });

    if (!gatePass) {
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    await verifyRecordOwnership(gatePass, req.user);

    const now = Date.now();
    const plain = gatePass.toJSON();
    plain.customer = plain.Customer || plain.customer;
    plain.organization = plain.Organization || plain.organization;
    const expiry = new Date(plain.validityExpiry).getTime();
    const remainingMs = expiry - now;
    plain.isExpired = remainingMs <= 0;
    plain.remainingSeconds = plain.isExpired ? 0 : Math.floor(remainingMs / 1000);

    res.status(200).json(plain);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching gate pass details:', error);
    res.status(500).json({ error: 'Internal server error while fetching gate pass.' });
  }
};

/**
 * POST /api/gate-passes
 * Create and save a new Gate Pass.
 * Enforces:
 * 1. Exactly 3 business fields: Customer Name (customerId), Vehicle Number, Gross Weight (> 0)
 * 2. 10-Minute Rule from Weighbridge slip generation
 * 3. Duplicate prevention for same Weighbridge slip
 * 4. Office-level authorization
 */
exports.createGatePass = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customerId,
      vehicleNumber,
      grossWeight,
      weightUnit,
      weighingRecordId: customWeighingId,
      organizationId: customOrgId
    } = req.body;

    // Field 1: Customer Name
    if (!customerId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Customer Name is required. Please select a customer from the dropdown.' });
    }

    // Field 2: Vehicle Number
    if (!vehicleNumber || typeof vehicleNumber !== 'string' || !vehicleNumber.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Vehicle Number is required. Please enter the vehicle registration number.' });
    }
    const cleanVehicleNumber = vehicleNumber.trim();

    // Field 3: Gross Weight (must be positive numeric value greater than zero)
    if (grossWeight === undefined || grossWeight === null || grossWeight === '') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Gross Weight is required.' });
    }
    const parsedGrossWeight = parseFloat(grossWeight);
    if (isNaN(parsedGrossWeight) || parsedGrossWeight <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Gross Weight must be a valid positive number greater than zero.' });
    }

    // Office authorization check
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, customOrgId);

    // Verify Customer exists and belongs to authorized office
    const customer = await Customer.findByPk(customerId, { transaction });
    if (!customer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Selected customer not found.' });
    }
    if (!targetOfficeIds.includes(customer.organizationId) && req.user.role !== 'SUPER_ADMIN') {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: Customer does not belong to your authorized office.' });
    }

    // Identify the corresponding Weighbridge slip
    let weighingRecord = null;

    if (customWeighingId) {
      weighingRecord = await WeighingRecord.findByPk(customWeighingId, { transaction });
      if (!weighingRecord) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Specified Weighbridge record not found.' });
      }
      if (!targetOfficeIds.includes(weighingRecord.organizationId)) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Access denied: Weighbridge slip belongs to another office.' });
      }
      if (parseInt(weighingRecord.customerId, 10) !== parseInt(customerId, 10)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Weighbridge slip customer does not match the selected customer.' });
      }
    } else {
      // Find the most recent Weighbridge record matching this Customer and Vehicle in authorized office
      weighingRecord = await WeighingRecord.findOne({
        where: {
          organizationId: { [Op.in]: targetOfficeIds },
          customerId: customer.id,
          vehicleDetails: { [Op.like]: `%${cleanVehicleNumber}%` }
        },
        order: [['weighedAt', 'DESC']],
        transaction
      });
    }

    if (!weighingRecord) {
      await transaction.rollback();
      return res.status(404).json({ 
        error: `No Weighbridge slip found for Customer "${customer.name}" and Vehicle "${cleanVehicleNumber}". A weighbridge slip must be generated before creating a Gate Pass.` 
      });
    }

    // Prevent duplicate Gate Pass creation for the same Weighbridge slip
    const existingPass = await GatePass.findOne({
      where: {
        weighingRecordId: weighingRecord.id,
        status: { [Op.ne]: 'CANCELLED' }
      },
      transaction
    });

    if (existingPass) {
      await transaction.rollback();
      return res.status(409).json({ 
        error: `A Gate Pass (Pass #${existingPass.gatePassNumber}) has already been generated for Weighbridge Slip #${weighingRecord.weighingNumber}. Duplicate gate passes for the same weighing slip are not permitted.` 
      });
    }

    // 10-Minute Rule Validation (Server-side Authoritative Enforcement)
    const slipGenTime = new Date(weighingRecord.weighedAt || weighingRecord.createdAt);
    const now = new Date();
    const elapsedMs = now.getTime() - slipGenTime.getTime();

    if (elapsedMs > TEN_MINUTES_MS) {
      const elapsedMins = Math.floor(elapsedMs / 60000);
      const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
      await transaction.rollback();
      return res.status(400).json({
        error: `The 10-minute window for Weighbridge Slip #${weighingRecord.weighingNumber} has expired. The slip was generated at ${slipGenTime.toLocaleTimeString()} (${elapsedMins}m ${elapsedSecs}s ago). A Gate Pass must be saved within 10 minutes of Weighbridge slip generation.`
      });
    }

    // Calculate validity window: exactly 10 minutes from slip generation
    const validityStart = slipGenTime;
    const validityExpiry = new Date(slipGenTime.getTime() + TEN_MINUTES_MS);

    // Generate unique Gate Pass number
    const gatePassNumber = await generateUniqueGatePassNumber(transaction);

    // Save the Gate Pass record
    const newGatePass = await GatePass.create({
      gatePassNumber,
      organizationId: weighingRecord.organizationId,
      customerId: customer.id,
      vehicleNumber: cleanVehicleNumber,
      grossWeight: parsedGrossWeight,
      weightUnit: weightUnit && weightUnit.trim() ? weightUnit.trim() : (weighingRecord.weightUnit || 'Ton'),
      weighingRecordId: weighingRecord.id,
      status: 'ISSUED',
      validityStart,
      validityExpiry,
      validityMinutes: 10,
      issuedAt: now,
      issuedBy: req.user.id,
      createdBy: req.user.id
    }, { transaction });

    // Record audit entry
    await GatePassAudit.create({
      gatePassId: newGatePass.id,
      userId: req.user.id,
      action: 'CREATED',
      reason: 'Gate pass created within 10-minute validity window.',
      newValues: JSON.stringify({
        gatePassNumber,
        customerName: customer.name,
        vehicleNumber: cleanVehicleNumber,
        grossWeight: parsedGrossWeight,
        weighingRecordId: weighingRecord.id,
        validityStart,
        validityExpiry
      }),
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    const created = await GatePass.findByPk(newGatePass.id, {
      include: [
        { model: Organization, attributes: ['id', 'name', 'address'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { 
          model: WeighingRecord, 
          as: 'weighingRecord',
          attributes: ['id', 'weighingNumber', 'firstWeight', 'grossWeight', 'taleWeight', 'weightUnit', 'weighedAt']
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] }
      ]
    });

    res.status(201).json({
      message: 'Gate Pass saved successfully.',
      gatePass: created
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating gate pass:', error);
    res.status(500).json({ error: error.message || 'Internal server error while saving gate pass.' });
  }
};

/**
 * POST /api/gate-passes/:id/confirm-dispatch
 * Confirm physical vehicle crossing through gate.
 */
exports.confirmDispatch = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const gatePass = await GatePass.findByPk(id, { transaction });
    if (!gatePass) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    try {
      await verifyRecordOwnership(gatePass, req.user);
    } catch (authErr) {
      await transaction.rollback();
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Vehicle has already been dispatched.' });
    }

    if (gatePass.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot dispatch a cancelled gate pass.' });
    }

    const prevStatus = gatePass.status;
    const dispatchTime = new Date();

    await gatePass.update({
      status: 'DISPATCHED',
      dispatchedAt: dispatchTime,
      dispatchedBy: req.user.id
    }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.id,
      action: 'DISPATCH_CONFIRMED',
      reason: 'Physical gate crossing confirmed.',
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'DISPATCHED', dispatchedAt: dispatchTime }),
      ipAddress: req.ip || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Dispatch confirmed successfully. Vehicle has crossed the gate.',
      gatePass
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error confirming dispatch:', error);
    res.status(500).json({ error: 'Internal server error while confirming dispatch.' });
  }
};

/**
 * POST /api/gate-passes/:id/cancel
 * Cancel a gate pass with a mandatory cancellation reason.
 */
exports.cancelGatePass = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A mandatory reason is required to cancel a gate pass.' });
    }

    const gatePass = await GatePass.findByPk(id, { transaction });
    if (!gatePass) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    try {
      await verifyRecordOwnership(gatePass, req.user);
    } catch (authErr) {
      await transaction.rollback();
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot cancel a gate pass after vehicle has already been dispatched.' });
    }

    const prevStatus = gatePass.status;
    await gatePass.update({
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: req.user.id,
      cancellationReason: reason.trim()
    }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.id,
      action: 'CANCELLED',
      reason: reason.trim(),
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason.trim() }),
      ipAddress: req.ip || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Gate pass cancelled successfully.',
      gatePass
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling gate pass:', error);
    res.status(500).json({ error: 'Internal server error while cancelling gate pass.' });
  }
};

/**
 * Compatibility stubs
 */
exports.issueGatePass = async (req, res) => {
  res.status(200).json({ message: 'Gate pass is ready for printing.' });
};

exports.requestReweigh = async (req, res) => {
  res.status(400).json({ error: 'Reweigh is handled in the Weighbridge module.' });
};
