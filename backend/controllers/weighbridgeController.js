const { Op } = require('sequelize');
const sequelize = require('../config/database');
const WeighingRecord = require('../models/WeighingRecord');
const GatePass = require('../models/GatePass');
const GatePassAudit = require('../models/GatePassAudit');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');

const ManualWeighbridgeProvider = require('../services/weighbridge/ManualWeighbridgeProvider');
const { 
  calculateNetWeight, 
  extractExpectedWeight, 
  calculateWeightDifference 
} = require('../services/weighbridge/WeighbridgeCalculationService');
const { 
  evaluateDiscrepancy, 
  DEFAULT_TOLERANCE_KG 
} = require('../services/weighbridge/WeightDiscrepancyService');
const { 
  calculateValidityWindow, 
  evaluateGatePassEligibility 
} = require('../services/weighbridge/GatePassEligibilityService');
const { generateUniqueWeighingNumber } = require('../utils/weighingNumberGenerator');

const manualProvider = new ManualWeighbridgeProvider();

/**
 * GET /api/weighbridge/transactions
 * Search for eligible finalized Bills or generated Estimates for weighbridge weighing.
 */
exports.searchTransactions = async (req, res) => {
  try {
    const { search, q, type, organizationId } = req.query;
    const queryTerm = search || q || '';

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

    const searchTerm = queryTerm ? queryTerm.trim() : '';

    let customerIds = [];
    if (searchTerm) {
      const matchingCustomers = await Customer.findAll({
        where: { name: { [Op.like]: `%${searchTerm}%` } },
        attributes: ['id']
      });
      customerIds = matchingCustomers.map(c => c.id);
    }

    let matchingBills = [];
    let matchingEstimates = [];

    // Search Bills if type is 'ALL' or 'BILL'
    if (!type || type === 'ALL' || type === 'BILL') {
      const billWhere = {
        status: { [Op.in]: ['FINALIZED', 'OVERRIDDEN'] }
      };
      if (targetOrgId) {
        billWhere.organizationId = targetOrgId;
      }
      if (searchTerm) {
        const orConditions = [{ billNumber: { [Op.like]: `%${searchTerm}%` } }];
        if (customerIds.length > 0) {
          orConditions.push({ customerId: { [Op.in]: customerIds } });
        }
        billWhere[Op.or] = orConditions;
      }

      matchingBills = await Bill.findAll({
        where: billWhere,
        subQuery: false,
        include: [
          { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
          { model: Organization, attributes: ['id', 'name'] },
          { model: BillItem, as: 'items' },
          {
            model: WeighingRecord,
            as: 'weighingRecords',
            where: { status: { [Op.ne]: 'SUPERSEDED' } },
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          },
          {
            model: GatePass,
            as: 'gatePasses',
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 20
      });
    }

    // Search Estimates if type is 'ALL' or 'ESTIMATE'
    if (!type || type === 'ALL' || type === 'ESTIMATE') {
      const estWhere = {
        status: { [Op.in]: ['GENERATED', 'OVERRIDDEN'] }
      };
      if (targetOrgId) {
        estWhere.organizationId = targetOrgId;
      }
      if (searchTerm) {
        const orConditions = [{ estimateNumber: { [Op.like]: `%${searchTerm}%` } }];
        if (customerIds.length > 0) {
          orConditions.push({ customerId: { [Op.in]: customerIds } });
        }
        estWhere[Op.or] = orConditions;
      }

      matchingEstimates = await Estimate.findAll({
        where: estWhere,
        subQuery: false,
        include: [
          { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
          { model: Organization, attributes: ['id', 'name'] },
          { model: EstimateItem, as: 'items' },
          {
            model: WeighingRecord,
            as: 'weighingRecords',
            where: { status: { [Op.ne]: 'SUPERSEDED' } },
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          },
          {
            model: GatePass,
            as: 'gatePasses',
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 20
      });
    }

    // Standardize transactions list
    const results = [
      ...matchingBills.map(b => {
        const expectedInfo = extractExpectedWeight(b.items);
        const latestWeighing = b.weighingRecords && b.weighingRecords.length > 0 ? b.weighingRecords[0] : null;
        const latestGatePass = b.gatePasses && b.gatePasses.length > 0 ? b.gatePasses[0] : null;

        return {
          id: b.id,
          transactionType: 'BILL',
          documentNumber: b.billNumber,
          date: b.billDate,
          createdAt: b.createdAt,
          organizationId: b.organizationId,
          organizationName: b.Organization ? b.Organization.name : '',
          customerId: b.customerId,
          customerName: b.Customer ? b.Customer.name : 'Unknown Customer',
          customerPhone: b.Customer ? b.Customer.phone : '',
          customerCity: b.Customer ? b.Customer.city : '',
          status: b.status,
          itemsCount: b.items ? b.items.length : 0,
          items: b.items,
          expectedWeight: expectedInfo.expectedWeight,
          expectedWeightUnit: expectedInfo.unit,
          isExpectedWeightAvailable: expectedInfo.isAvailable,
          expectedWeightReason: expectedInfo.reason,
          latestWeighing,
          latestGatePass
        };
      }),
      ...matchingEstimates.map(e => {
        const expectedInfo = extractExpectedWeight(e.items);
        const latestWeighing = e.weighingRecords && e.weighingRecords.length > 0 ? e.weighingRecords[0] : null;
        const latestGatePass = e.gatePasses && e.gatePasses.length > 0 ? e.gatePasses[0] : null;

        return {
          id: e.id,
          transactionType: 'ESTIMATE',
          documentNumber: e.estimateNumber,
          date: e.estimateDate,
          createdAt: e.createdAt,
          organizationId: e.organizationId,
          organizationName: e.Organization ? e.Organization.name : '',
          customerId: e.customerId,
          customerName: e.Customer ? e.Customer.name : 'Unknown Customer',
          customerPhone: e.Customer ? e.Customer.phone : '',
          customerCity: e.Customer ? e.Customer.city : '',
          status: e.status,
          itemsCount: e.items ? e.items.length : 0,
          items: e.items,
          expectedWeight: expectedInfo.expectedWeight,
          expectedWeightUnit: expectedInfo.unit,
          isExpectedWeightAvailable: expectedInfo.isAvailable,
          expectedWeightReason: expectedInfo.reason,
          latestWeighing,
          latestGatePass
        };
      })
    ];

    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching transactions for weighbridge:', error);
    res.status(500).json({ error: 'Internal server error while searching eligible transactions.' });
  }
};

/**
 * GET /api/weighbridge
 * List weighing history records with search and filter capabilities.
 */
exports.getWeighingRecords = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      transactionType, 
      organizationId, 
      startDate, 
      endDate 
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
        { vehicleNumber: { [Op.like]: term } },
        { driverName: { [Op.like]: term } },
        { '$Customer.name$': { [Op.like]: term } },
        { '$Bill.billNumber$': { [Op.like]: term } },
        { '$Estimate.estimateNumber$': { [Op.like]: term } }
      ];
    }

    const records = await WeighingRecord.findAll({
      where,
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city'] },
        { model: Bill, attributes: ['id', 'billNumber', 'status', 'createdAt'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status', 'createdAt'] },
        { model: User, as: 'recorder', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'discrepancyApprover', attributes: ['id', 'username', 'role'] }
      ],
      order: [['weighedAt', 'DESC']]
    });

    res.status(200).json(records);
  } catch (error) {
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
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'address'] },
        { 
          model: Bill, 
          attributes: ['id', 'billNumber', 'status', 'createdAt'],
          include: [{ model: BillItem, as: 'items' }]
        },
        { 
          model: Estimate, 
          attributes: ['id', 'estimateNumber', 'status', 'createdAt'],
          include: [{ model: EstimateItem, as: 'items' }]
        },
        { model: User, as: 'recorder', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'discrepancyApprover', attributes: ['id', 'username', 'role'] },
        {
          model: WeighingRecord,
          as: 'previousRecord',
          attributes: ['id', 'weighingNumber', 'tareWeight', 'grossWeight', 'netWeight', 'status', 'weighedAt']
        },
        {
          model: GatePass,
          as: 'gatePasses',
          attributes: ['id', 'gatePassNumber', 'status', 'validityExpiry', 'dispatchedAt']
        }
      ]
    });

    if (!record) {
      return res.status(404).json({ error: 'Weighing record not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && record.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view records for this office.' });
    }

    res.status(200).json(record);
  } catch (error) {
    console.error('Error fetching weighing record details:', error);
    res.status(500).json({ error: 'Internal server error while fetching weighing record.' });
  }
};

/**
 * POST /api/weighbridge
 * Record a manual weighing reading for a vehicle linked to an eligible Bill or Estimate.
 */
exports.createWeighingRecord = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      transactionType,
      transactionId,
      vehicleNumber,
      driverName,
      driverPhone,
      tareWeight,
      grossWeight,
      unit,
      remarks,
      organizationId: customOrgId
    } = req.body;

    if (!['BILL', 'ESTIMATE'].includes(transactionType)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Transaction type must be either BILL or ESTIMATE.' });
    }

    if (!transactionId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A valid Bill ID or Estimate ID is required.' });
    }

    if (!vehicleNumber || !vehicleNumber.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Vehicle registration number is required.' });
    }

    // Process and validate weights using ManualWeighbridgeProvider
    let reading;
    try {
      reading = await manualProvider.readWeight({
        tareWeight,
        grossWeight,
        unit: unit || 'Kg',
        vehicleNumber,
        driverName,
        driverPhone,
        remarks
      });
    } catch (provErr) {
      await transaction.rollback();
      return res.status(provErr.statusCode || 400).json({ error: provErr.message });
    }

    // Retrieve target transaction and line items
    let targetDoc = null;
    let items = [];
    let billId = null;
    let estimateId = null;

    if (transactionType === 'BILL') {
      targetDoc = await Bill.findByPk(transactionId, {
        include: [{ model: BillItem, as: 'items' }, { model: Customer }],
        transaction
      });
      if (!targetDoc) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Bill record not found.' });
      }
      if (!['FINALIZED', 'OVERRIDDEN'].includes(targetDoc.status)) {
        await transaction.rollback();
        return res.status(400).json({ error: `Bill #${targetDoc.billNumber} is in ${targetDoc.status} status and is not finalized for dispatch.` });
      }
      billId = targetDoc.id;
      items = targetDoc.items || [];
    } else {
      targetDoc = await Estimate.findByPk(transactionId, {
        include: [{ model: EstimateItem, as: 'items' }, { model: Customer }],
        transaction
      });
      if (!targetDoc) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Estimate record not found.' });
      }
      if (!['GENERATED', 'OVERRIDDEN'].includes(targetDoc.status)) {
        await transaction.rollback();
        return res.status(400).json({ error: `Estimate #${targetDoc.estimateNumber} is in ${targetDoc.status} status and is not generated for dispatch.` });
      }
      estimateId = targetDoc.id;
      items = targetDoc.items || [];
    }

    // Determine target organization context
    let targetOrgId = targetDoc.organizationId;
    if (req.user.role === 'SUPER_ADMIN') {
      if (customOrgId) {
        targetOrgId = parseInt(customOrgId, 10);
      }
    } else {
      if (req.user.organizationId !== targetDoc.organizationId) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Access denied: You do not have permission to record weights for another office.' });
      }
    }

    // Calculate Net Weight
    const netWeight = calculateNetWeight(reading.grossWeight, reading.tareWeight);

    // Extract Expected Weight from line items
    const expectedInfo = extractExpectedWeight(items, reading.unit);

    // Discrepancy Evaluation
    const discrepancyEval = evaluateDiscrepancy({
      actualNetWeight: netWeight,
      actualUnit: reading.unit,
      expectedWeight: expectedInfo.expectedWeight,
      expectedUnit: expectedInfo.unit,
      isExpectedWeightAvailable: expectedInfo.isAvailable,
      unavailableReason: expectedInfo.reason,
      toleranceKg: DEFAULT_TOLERANCE_KG
    });

    // Generate unique sequential weighing number
    const weighingNumber = await generateUniqueWeighingNumber(transaction);

    // Create WeighingRecord
    const newRecord = await WeighingRecord.create({
      weighingNumber,
      organizationId: targetOrgId,
      transactionType,
      billId,
      estimateId,
      customerId: targetDoc.customerId,
      vehicleNumber: reading.vehicleNumber,
      driverName: reading.driverName,
      driverPhone: reading.driverPhone,
      tareWeight: reading.tareWeight,
      grossWeight: reading.grossWeight,
      netWeight,
      expectedWeight: expectedInfo.expectedWeight,
      weightDifference: discrepancyEval.weightDifference,
      weightUnit: reading.unit,
      weightSource: reading.weightSource,
      status: discrepancyEval.status,
      discrepancyReason: discrepancyEval.reason,
      isReweigh: false,
      remarks: reading.remarks,
      recordedBy: req.user.userId,
      weighedAt: reading.readingTimestamp
    }, { transaction });

    await transaction.commit();

    const createdWithAssoc = await WeighingRecord.findByPk(newRecord.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone'] },
        { model: Bill, attributes: ['id', 'billNumber'] },
        { model: Estimate, attributes: ['id', 'estimateNumber'] },
        { model: User, as: 'recorder', attributes: ['id', 'username'] }
      ]
    });

    res.status(201).json({
      message: 'Weight record created successfully.',
      weighingRecord: createdWithAssoc,
      discrepancy: discrepancyEval
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating weighing record:', error);
    res.status(500).json({ error: error.message || 'Internal server error while creating weighing record.' });
  }
};

/**
 * POST /api/weighbridge/:id/reweigh
 * Reweigh an existing vehicle. Preserves original record and creates new weighing entry.
 */
exports.reweighTransaction = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      tareWeight,
      grossWeight,
      unit,
      driverName,
      driverPhone,
      remarks,
      reweighReason
    } = req.body;

    const previousRecord = await WeighingRecord.findByPk(id, { transaction });
    if (!previousRecord) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Previous weighing record not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && previousRecord.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You do not have permission to reweigh records for this office.' });
    }

    // Process new weights
    let reading;
    try {
      reading = await manualProvider.readWeight({
        tareWeight,
        grossWeight,
        unit: unit || previousRecord.weightUnit,
        vehicleNumber: previousRecord.vehicleNumber,
        driverName: driverName || previousRecord.driverName,
        driverPhone: driverPhone || previousRecord.driverPhone,
        remarks: remarks || previousRecord.remarks
      });
    } catch (provErr) {
      await transaction.rollback();
      return res.status(provErr.statusCode || 400).json({ error: provErr.message });
    }

    // Fetch items for expected weight
    let items = [];
    if (previousRecord.transactionType === 'BILL') {
      const b = await Bill.findByPk(previousRecord.billId, {
        include: [{ model: BillItem, as: 'items' }],
        transaction
      });
      items = b?.items || [];
    } else {
      const e = await Estimate.findByPk(previousRecord.estimateId, {
        include: [{ model: EstimateItem, as: 'items' }],
        transaction
      });
      items = e?.items || [];
    }

    const netWeight = calculateNetWeight(reading.grossWeight, reading.tareWeight);
    const expectedInfo = extractExpectedWeight(items, reading.unit);

    const discrepancyEval = evaluateDiscrepancy({
      actualNetWeight: netWeight,
      actualUnit: reading.unit,
      expectedWeight: expectedInfo.expectedWeight,
      expectedUnit: expectedInfo.unit,
      isExpectedWeightAvailable: expectedInfo.isAvailable,
      unavailableReason: expectedInfo.reason,
      toleranceKg: DEFAULT_TOLERANCE_KG
    });

    // Mark previous record as superseded
    await previousRecord.update({ status: 'SUPERSEDED' }, { transaction });

    // Generate new unique weighing number
    const weighingNumber = await generateUniqueWeighingNumber(transaction);

    // Create fresh weighing record preserving history
    const freshRecord = await WeighingRecord.create({
      weighingNumber,
      organizationId: previousRecord.organizationId,
      transactionType: previousRecord.transactionType,
      billId: previousRecord.billId,
      estimateId: previousRecord.estimateId,
      customerId: previousRecord.customerId,
      vehicleNumber: previousRecord.vehicleNumber,
      driverName: reading.driverName,
      driverPhone: reading.driverPhone,
      tareWeight: reading.tareWeight,
      grossWeight: reading.grossWeight,
      netWeight,
      expectedWeight: expectedInfo.expectedWeight,
      weightDifference: discrepancyEval.weightDifference,
      weightUnit: reading.unit,
      weightSource: reading.weightSource,
      status: discrepancyEval.status,
      discrepancyReason: discrepancyEval.reason,
      isReweigh: true,
      previousRecordId: previousRecord.id,
      remarks: reweighReason ? `[REWEIGH] ${reweighReason} | ${reading.remarks || ''}` : reading.remarks,
      recordedBy: req.user.userId,
      weighedAt: reading.readingTimestamp
    }, { transaction });

    // If there is an active GatePass associated with this transaction, update it
    const activeGatePass = await GatePass.findOne({
      where: {
        organizationId: previousRecord.organizationId,
        [Op.or]: [
          previousRecord.billId ? { billId: previousRecord.billId } : null,
          previousRecord.estimateId ? { estimateId: previousRecord.estimateId } : null
        ].filter(Boolean),
        status: { [Op.notIn]: ['DISPATCHED', 'CANCELLED'] }
      },
      transaction
    });

    if (activeGatePass) {
      // Calculate fresh 10-minute validity starting from reweighing timestamp
      const validityWindow = calculateValidityWindow(reading.readingTimestamp, activeGatePass.validityMinutes || 10);
      const newStatus = discrepancyEval.isDiscrepancy ? 'WEIGHT_REVIEW_REQUIRED' : 'READY_FOR_DISPATCH';

      const prevStatus = activeGatePass.status;
      await activeGatePass.update({
        weighingRecordId: freshRecord.id,
        validityStart: validityWindow.validityStart,
        validityExpiry: validityWindow.validityExpiry,
        status: newStatus
      }, { transaction });

      // Audit log
      await GatePassAudit.create({
        gatePassId: activeGatePass.id,
        userId: req.user.userId,
        action: 'REWEIGH_COMPLETED',
        reason: reweighReason || 'Reweighing performed after validity expiration or operator request.',
        previousValues: JSON.stringify({
          status: prevStatus,
          weighingRecordId: previousRecord.id
        }),
        newValues: JSON.stringify({
          status: newStatus,
          weighingRecordId: freshRecord.id,
          validityStart: validityWindow.validityStart,
          validityExpiry: validityWindow.validityExpiry
        }),
        ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
      }, { transaction });
    }

    await transaction.commit();

    const result = await WeighingRecord.findByPk(freshRecord.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Customer, attributes: ['id', 'name', 'phone'] },
        { model: Bill, attributes: ['id', 'billNumber'] },
        { model: Estimate, attributes: ['id', 'estimateNumber'] },
        { model: User, as: 'recorder', attributes: ['id', 'username'] }
      ]
    });

    res.status(201).json({
      message: 'Reweighing completed successfully. Previous readings preserved.',
      weighingRecord: result,
      activeGatePass
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error reweighing transaction:', error);
    res.status(500).json({ error: error.message || 'Internal server error while reweighing transaction.' });
  }
};

/**
 * POST /api/weighbridge/:id/approve-discrepancy
 * Authorized CEO / Admin override to approve a flagged weight discrepancy.
 */
exports.approveDiscrepancy = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { approvalReason } = req.body;

    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Permission denied: Only Admin or Super Admin can approve weight discrepancies.' });
    }

    if (!approvalReason || !approvalReason.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A mandatory reason is required to approve a weight discrepancy.' });
    }

    const record = await WeighingRecord.findByPk(id, { transaction });
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Weighing record not found.' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && record.organizationId !== req.user.organizationId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Access denied: You do not have permission to approve records for another office.' });
    }

    if (record.status !== 'DISCREPANCY_FLAGGED') {
      await transaction.rollback();
      return res.status(400).json({ error: `Cannot approve: record is in '${record.status}' status (must be DISCREPANCY_FLAGGED).` });
    }

    const previousStatus = record.status;
    await record.update({
      status: 'APPROVED',
      discrepancyApprovedBy: req.user.userId,
      discrepancyApprovedAt: new Date(),
      discrepancyApprovalReason: approvalReason.trim()
    }, { transaction });

    // If an associated GatePass is blocked on WEIGHT_REVIEW_REQUIRED, unlock it
    const associatedGatePass = await GatePass.findOne({
      where: {
        weighingRecordId: record.id,
        status: 'WEIGHT_REVIEW_REQUIRED'
      },
      transaction
    });

    if (associatedGatePass) {
      await associatedGatePass.update({
        status: 'READY_FOR_DISPATCH'
      }, { transaction });

      await GatePassAudit.create({
        gatePassId: associatedGatePass.id,
        userId: req.user.userId,
        action: 'DISCREPANCY_APPROVED',
        reason: approvalReason.trim(),
        previousValues: JSON.stringify({ status: 'WEIGHT_REVIEW_REQUIRED' }),
        newValues: JSON.stringify({ status: 'READY_FOR_DISPATCH' }),
        ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'
      }, { transaction });
    }

    await transaction.commit();

    const updated = await WeighingRecord.findByPk(record.id, {
      include: [
        { model: User, as: 'recorder', attributes: ['id', 'username'] },
        { model: User, as: 'discrepancyApprover', attributes: ['id', 'username', 'role'] }
      ]
    });

    res.status(200).json({
      message: 'Weight discrepancy approved successfully by Admin.',
      weighingRecord: updated,
      gatePassUnlocked: Boolean(associatedGatePass)
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error approving discrepancy:', error);
    res.status(500).json({ error: 'Internal server error while approving weight discrepancy.' });
  }
};
