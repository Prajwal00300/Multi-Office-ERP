const { Op } = require('sequelize');
const sequelize = require('../config/database');
const GatePass = require('../models/GatePass');
const GatePassAudit = require('../models/GatePassAudit');
const WeighingRecord = require('../models/WeighingRecord');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');

const { 
  DEFAULT_VALIDITY_MINUTES,
  TIME_EXCEEDED_MESSAGE,
  calculateValidityWindow, 
  checkValidityPeriod, 
  evaluateGatePassEligibility 
} = require('../services/weighbridge/GatePassEligibilityService');
const { generateUniqueGatePassNumber } = require('../utils/gatePassNumberGenerator');

/**
 * GET /api/gate-passes
 * List all gate passes with real-time validity evaluation and filters.
 */
exports.getGatePasses = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      organizationId, 
      startDate, 
      endDate,
      transactionType 
    } = req.query;

    let targetOrgId = req.user.organizationId;
    if (req.user.role === 'SUPER_ADMIN') {
      if (organizationId && organizationId !== 'ALL' && organizationId !== '') {
        targetOrgId = parseInt(organizationId, 10);
      } else {
        targetOrgId = null;
      }
    } else {
      if (!targetOrgId) {
        return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
      }
    }

    const where = {};
    if (targetOrgId) {
      where.organizationId = targetOrgId;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (transactionType && transactionType !== 'ALL') {
      where.transactionType = transactionType;
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
        { '$Customer.name$': { [Op.like]: term } },
        { '$Bill.billNumber$': { [Op.like]: term } },
        { '$Estimate.estimateNumber$': { [Op.like]: term } }
      ];
    }

    const passes = await GatePass.findAll({
      where,
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { model: Bill, attributes: ['id', 'billNumber', 'createdAt'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'createdAt'] },
        { 
          model: WeighingRecord, 
          as: 'weighingRecord',
          attributes: ['id', 'weighingNumber', 'tareWeight', 'grossWeight', 'netWeight', 'expectedWeight', 'weightDifference', 'weightUnit', 'weightSource', 'status']
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'dispatcher', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Evaluate live validity on returned passes
    const now = new Date().getTime();
    const enriched = passes.map(p => {
      const plain = p.toJSON();
      const expiry = new Date(plain.validityExpiry).getTime();
      const remainingMs = expiry - now;
      const isExpired = remainingMs <= 0;

      // If active pass has expired past validity, reflect REWEIGHING_REQUIRED status
      if (['READY_FOR_DISPATCH', 'ISSUED'].includes(plain.status) && isExpired) {
        plain.effectiveStatus = 'REWEIGHING_REQUIRED';
        plain.isExpired = true;
        plain.validityMessage = TIME_EXCEEDED_MESSAGE;
      } else {
        plain.effectiveStatus = plain.status;
        plain.isExpired = isExpired;
        plain.validityMessage = isExpired ? TIME_EXCEEDED_MESSAGE : null;
      }

      plain.remainingSeconds = isExpired ? 0 : Math.floor(remainingMs / 1000);
      return plain;
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error('Error fetching gate passes:', error);
    res.status(500).json({ error: 'Internal server error while fetching gate passes.' });
  }
};

/**
 * GET /api/gate-passes/:id
 * Retrieve single gate pass with comprehensive details for viewing or printing.
 */
exports.getGatePassById = async (req, res) => {
  try {
    const { id } = req.params;

    const gatePass = await GatePass.findByPk(id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'address', 'tin'] },
        { 
          model: Bill, 
          attributes: ['id', 'billNumber', 'billDate', 'status', 'finalAmount', 'createdAt'],
          include: [{ model: BillItem, as: 'items' }]
        },
        { 
          model: Estimate, 
          attributes: ['id', 'estimateNumber', 'estimateDate', 'status', 'grandTotal', 'createdAt'],
          include: [{ model: EstimateItem, as: 'items' }]
        },
        { 
          model: WeighingRecord, 
          as: 'weighingRecord',
          include: [
            { model: User, as: 'recorder', attributes: ['id', 'username', 'role'] },
            { model: User, as: 'discrepancyApprover', attributes: ['id', 'username', 'role'] },
            { 
              model: WeighingRecord, 
              as: 'previousRecord',
              attributes: ['id', 'weighingNumber', 'tareWeight', 'grossWeight', 'netWeight', 'weighedAt', 'status']
            }
          ]
        },
        { model: User, as: 'creator', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'issuer', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'dispatcher', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'canceller', attributes: ['id', 'username', 'role'] },
        {
          model: GatePassAudit,
          as: 'audits',
          include: [{ model: User, as: 'performer', attributes: ['id', 'username', 'role'] }],
          separate: true,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!gatePass) {
      return res.status(404).json({ error: 'Gate pass record not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && gatePass.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this gate pass.' });
    }

    const plain = gatePass.toJSON();
    const now = new Date().getTime();
    const expiry = new Date(plain.validityExpiry).getTime();
    const remainingMs = expiry - now;
    const isExpired = remainingMs <= 0;

    // Check if expired and update DB status if it was READY_FOR_DISPATCH or ISSUED
    if (['READY_FOR_DISPATCH', 'ISSUED'].includes(plain.status) && isExpired) {
      await gatePass.update({ status: 'REWEIGHING_REQUIRED' });
      plain.status = 'REWEIGHING_REQUIRED';
    }

    plain.isExpired = isExpired;
    plain.remainingSeconds = isExpired ? 0 : Math.floor(remainingMs / 1000);
    plain.validityMessage = isExpired ? TIME_EXCEEDED_MESSAGE : null;

    res.status(200).json(plain);
  } catch (error) {
    console.error('Error fetching gate pass details:', error);
    res.status(500).json({ error: 'Internal server error while fetching gate pass details.' });
  }
};

/**
 * POST /api/gate-passes
 * Create a new Gate Pass linked to an eligible Bill/Estimate and its latest WeighingRecord.
 */
exports.createGatePass = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      weighingRecordId,
      validityMinutes,
      remarks
    } = req.body;

    if (!weighingRecordId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A valid Weighing Record ID is required to generate a Gate Pass.' });
    }

    const weighingRecord = await WeighingRecord.findByPk(weighingRecordId, {
      include: [
        { model: Bill, include: [{ model: BillItem, as: 'items' }] },
        { model: Estimate, include: [{ model: EstimateItem, as: 'items' }] },
        { model: Customer }
      ],
      transaction
    });

    if (!weighingRecord) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Weighing record not found.' });
    }

    if (weighingRecord.status === 'SUPERSEDED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'This weighing record has been superseded by a reweighing. Please select the latest weighing record.' });
    }

    // Role check
    if (req.user.role !== 'SUPER_ADMIN' && weighingRecord.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You cannot create gate passes for another office.' });
    }

    // Determine target document & initial validity start time
    const targetDoc = weighingRecord.Bill || weighingRecord.Estimate;
    if (!targetDoc) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Associated transaction document (Bill or Estimate) not found.' });
    }

    // 10-Minute Validity Rule:
    // Initial validity starts from bill/estimate generation timestamp.
    // If this is a reweighing, validity starts from the reweighing timestamp.
    const initialStartTime = weighingRecord.isReweigh 
      ? weighingRecord.weighedAt 
      : targetDoc.createdAt;

    const durationMins = parseInt(validityMinutes || DEFAULT_VALIDITY_MINUTES, 10);
    const validityWindow = calculateValidityWindow(initialStartTime, durationMins);

    // Initial Gate Pass status evaluation
    const initialStatus = evaluateGatePassEligibility(
      weighingRecord,
      validityWindow.validityExpiry,
      'DRAFT'
    );

    // Generate unique sequential gate pass number
    const gatePassNumber = await generateUniqueGatePassNumber(transaction);

    // Create Gate Pass
    const newGatePass = await GatePass.create({
      gatePassNumber,
      organizationId: weighingRecord.organizationId,
      transactionType: weighingRecord.transactionType,
      billId: weighingRecord.billId,
      estimateId: weighingRecord.estimateId,
      customerId: weighingRecord.customerId,
      vehicleNumber: weighingRecord.vehicleNumber,
      weighingRecordId: weighingRecord.id,
      status: initialStatus.status,
      validityStart: validityWindow.validityStart,
      validityExpiry: validityWindow.validityExpiry,
      validityMinutes: validityWindow.validityMinutes,
      remarks: remarks ? remarks.trim() : null,
      createdBy: req.user.userId
    }, { transaction });

    // Create Audit entry
    await GatePassAudit.create({
      gatePassId: newGatePass.id,
      userId: req.user.userId,
      action: 'CREATED',
      reason: 'Gate pass generated for vehicle dispatch.',
      newValues: JSON.stringify({
        gatePassNumber,
        status: initialStatus.status,
        validityStart: validityWindow.validityStart,
        validityExpiry: validityWindow.validityExpiry
      }),
      ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    const created = await GatePass.findByPk(newGatePass.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone'] },
        { model: Bill, attributes: ['id', 'billNumber'] },
        { model: Estimate, attributes: ['id', 'estimateNumber'] },
        { model: WeighingRecord, as: 'weighingRecord' },
        { model: User, as: 'creator', attributes: ['id', 'username'] }
      ]
    });

    res.status(201).json({
      message: 'Gate pass created successfully.',
      gatePass: created,
      validity: validityWindow,
      statusReason: initialStatus.reason
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating gate pass:', error);
    res.status(500).json({ error: error.message || 'Internal server error while creating gate pass.' });
  }
};

/**
 * POST /api/gate-passes/:id/issue
 * Mark gate pass as ISSUED for printing. Does not confirm dispatch.
 */
exports.issueGatePass = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const gatePass = await GatePass.findByPk(id, {
      include: [{ model: WeighingRecord, as: 'weighingRecord' }],
      transaction
    });

    if (!gatePass) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && gatePass.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You cannot issue gate passes for another office.' });
    }

    // Check validity
    const validity = checkValidityPeriod(gatePass.validityExpiry);
    if (validity.isExpired) {
      await gatePass.update({ status: 'REWEIGHING_REQUIRED' }, { transaction });
      await transaction.commit();
      return res.status(400).json({ error: TIME_EXCEEDED_MESSAGE });
    }

    // Check discrepancy
    if (gatePass.weighingRecord && gatePass.weighingRecord.status === 'DISCREPANCY_FLAGGED') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot issue gate pass: Weight discrepancy has not been approved by Admin/CEO.' 
      });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Vehicle has already been dispatched.' });
    }

    if (gatePass.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot issue a cancelled gate pass.' });
    }

    const prevStatus = gatePass.status;
    await gatePass.update({
      status: 'ISSUED',
      issuedAt: new Date(),
      issuedBy: req.user.userId
    }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.userId,
      action: 'ISSUED',
      reason: 'Gate pass issued for vehicle dispatch & printing.',
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'ISSUED', issuedAt: new Date() }),
      ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    const updated = await GatePass.findByPk(id, {
      include: [
        { model: User, as: 'issuer', attributes: ['id', 'username'] },
        { model: WeighingRecord, as: 'weighingRecord' }
      ]
    });

    res.status(200).json({
      message: 'Gate pass issued successfully. Ready for printing.',
      gatePass: updated
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error issuing gate pass:', error);
    res.status(500).json({ error: 'Internal server error while issuing gate pass.' });
  }
};

/**
 * POST /api/gate-passes/:id/confirm-dispatch
 * Gate Operator action: Confirm that vehicle physically crossed the gate.
 * Validates 10-minute validity and discrepancy approvals.
 */
exports.confirmDispatch = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const gatePass = await GatePass.findByPk(id, {
      include: [{ model: WeighingRecord, as: 'weighingRecord' }],
      transaction
    });

    if (!gatePass) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && gatePass.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You cannot confirm dispatch for another office.' });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Duplicate dispatch prevented: Vehicle has already been dispatched.' });
    }

    if (gatePass.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot dispatch a cancelled gate pass.' });
    }

    // Ten-Minute Validity Check (Backend Authoritative Enforcement)
    const validity = checkValidityPeriod(gatePass.validityExpiry);
    if (validity.isExpired) {
      // Mark workflow as requiring reweighing
      await gatePass.update({ status: 'REWEIGHING_REQUIRED' }, { transaction });

      await GatePassAudit.create({
        gatePassId: gatePass.id,
        userId: req.user.userId,
        action: 'DISPATCH_BLOCKED_EXPIRY',
        reason: TIME_EXCEEDED_MESSAGE,
        previousValues: JSON.stringify({ status: gatePass.status }),
        newValues: JSON.stringify({ status: 'REWEIGHING_REQUIRED' }),
        ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
      }, { transaction });

      await transaction.commit();
      return res.status(400).json({ error: TIME_EXCEEDED_MESSAGE });
    }

    // Weight discrepancy check
    if (gatePass.weighingRecord && gatePass.weighingRecord.status === 'DISCREPANCY_FLAGGED') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot confirm dispatch: An unresolved weight discrepancy exists. Admin/CEO approval is required.' 
      });
    }

    const prevStatus = gatePass.status;
    const dispatchTime = new Date();

    await gatePass.update({
      status: 'DISPATCHED',
      dispatchedAt: dispatchTime,
      dispatchedBy: req.user.userId
    }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.userId,
      action: 'DISPATCH_CONFIRMED',
      reason: 'Physical gate crossing confirmed by gate operator.',
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'DISPATCHED', dispatchedAt: dispatchTime }),
      ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    const updated = await GatePass.findByPk(id, {
      include: [
        { model: User, as: 'dispatcher', attributes: ['id', 'username'] },
        { model: WeighingRecord, as: 'weighingRecord' }
      ]
    });

    res.status(200).json({
      message: 'Dispatch confirmed successfully. Vehicle has crossed the gate.',
      gatePass: updated
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

    if (req.user.role !== 'SUPER_ADMIN' && gatePass.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You cannot cancel gate passes for another office.' });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot cancel a gate pass after vehicle has already been dispatched.' });
    }

    const prevStatus = gatePass.status;
    await gatePass.update({
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: req.user.userId,
      cancellationReason: reason.trim()
    }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.userId,
      action: 'CANCELLED',
      reason: reason.trim(),
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason.trim() }),
      ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    const updated = await GatePass.findByPk(id, {
      include: [{ model: User, as: 'canceller', attributes: ['id', 'username'] }]
    });

    res.status(200).json({
      message: 'Gate pass cancelled successfully.',
      gatePass: updated
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling gate pass:', error);
    res.status(500).json({ error: 'Internal server error while cancelling gate pass.' });
  }
};

/**
 * POST /api/gate-passes/:id/request-reweigh
 * Explicit action by authorized user to mark gate pass as requiring reweighing.
 */
exports.requestReweigh = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const gatePass = await GatePass.findByPk(id, { transaction });
    if (!gatePass) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Gate pass not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && gatePass.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You cannot request reweighing for another office.' });
    }

    if (gatePass.status === 'DISPATCHED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot request reweighing: Vehicle has already been dispatched.' });
    }

    const prevStatus = gatePass.status;
    await gatePass.update({ status: 'REWEIGHING_REQUIRED' }, { transaction });

    await GatePassAudit.create({
      gatePassId: gatePass.id,
      userId: req.user.userId,
      action: 'REWEIGH_REQUESTED',
      reason: reason ? reason.trim() : 'Manual reweigh requested by operator/admin.',
      previousValues: JSON.stringify({ status: prevStatus }),
      newValues: JSON.stringify({ status: 'REWEIGHING_REQUIRED' }),
      ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Gate pass marked for reweighing. Vehicle must be reweighed.',
      gatePass
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error requesting reweigh:', error);
    res.status(500).json({ error: 'Internal server error while requesting reweigh.' });
  }
};
