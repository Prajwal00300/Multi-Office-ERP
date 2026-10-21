const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const BillAudit = require('../models/BillAudit');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Estimate = require('../models/Estimate');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { calculateBillTotals } = require('../services/billingCalculationService');
const { generateUniqueBillNumber } = require('../utils/billNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * GET /api/bills - List bills with filters and org isolation
 */
exports.getBills = async (req, res) => {
  try {
    const {
      search,
      status,
      startDate,
      endDate,
      organizationId,
      customerId
    } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (customerId) {
      whereClause.customerId = parseInt(customerId, 10);
    }

    if (status && status.trim() !== '' && status !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    if (startDate && endDate) {
      whereClause.billDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.billDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.billDate = { [Op.lte]: endDate };
    }

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { billNumber: { [Op.like]: searchTerm } },
        { '$Customer.name$': { [Op.like]: searchTerm } },
        { notes: { [Op.like]: searchTerm } }
      ];
    }

    const bills = await Bill.findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          attributes: ['id', 'name', 'city', 'phone', 'tin']
        },
        {
          model: Organization,
          attributes: ['id', 'name']
        },
        {
          model: Estimate,
          attributes: ['id', 'estimateNumber', 'status']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'finalizer',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: BillItem,
          as: 'items'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(bills);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Internal server error while fetching bills' });
  }
};

/**
 * GET /api/bills/:id - Retrieve bill details and bill items
 */
exports.getBillById = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findByPk(id, {
      include: [
        {
          model: Customer,
          attributes: ['id', 'name', 'address', 'city', 'phone', 'tin']
        },
        {
          model: Organization,
          attributes: ['id', 'name', 'address', 'phone']
        },
        {
          model: Estimate,
          attributes: ['id', 'estimateNumber', 'estimateDate', 'status']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'finalizer',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: BillItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'category', 'size', 'unit', 'specifications']
            }
          ]
        },
        {
          model: BillAudit,
          as: 'audits',
          include: [
            {
              model: User,
              as: 'performer',
              attributes: ['id', 'username', 'role']
            }
          ],
          separate: true,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Ownership check
    await verifyRecordOwnership(bill, req.user);

    res.status(200).json(bill);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching bill details:', error);
    res.status(500).json({ error: 'Internal server error while fetching bill details' });
  }
};

/**
 * POST /api/bills - Create a draft bill (with optional estimate reference)
 */
exports.createBill = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customerId,
      estimateId,
      billDate,
      items,
      gstPercentage,
      transportCost,
      notes,
      organizationId: customOrgId
    } = req.body;

    // Determine target office
    let targetOrgId;
    try {
      targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, customOrgId);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 400).json({ error: scopeErr.message });
    }

    // Customer validation
    if (!customerId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Customer is required.' });
    }

    const customer = await Customer.findByPk(customerId, { transaction });
    if (!customer) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Customer not found.' });
    }

    if (customer.organizationId !== targetOrgId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Selected customer belongs to a different organization.' });
    }

    // Optional estimate validation
    let validEstimateId = null;
    if (estimateId) {
      const estimate = await Estimate.findByPk(estimateId, { transaction });
      if (!estimate) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Referenced estimate not found.' });
      }
      if (estimate.organizationId !== targetOrgId) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Referenced estimate belongs to a different organization.' });
      }
      if (estimate.customerId !== customer.id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Referenced estimate customer does not match the bill customer.' });
      }
      validEstimateId = estimate.id;
    }

    // Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A bill must contain at least one product item.' });
    }

    // Process and enrich product snapshots
    const enrichedItems = [];
    for (const item of items) {
      let productName = item.productNameSnapshot || item.name || '';
      let category = item.productCategorySnapshot || item.category || null;
      let size = item.productSizeSnapshot || item.size || null;
      let specifications = item.productSpecificationsSnapshot || item.specifications || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (productId) {
        const product = await Product.findByPk(productId, { transaction });
        if (product) {
          if (product.organizationId !== targetOrgId) {
            await transaction.rollback();
            return res.status(403).json({ error: `Product "${product.name}" belongs to another organization.` });
          }
          productName = product.name;
          category = product.category;
          size = product.size;
          unit = product.unit || unit;
          specifications = product.specifications;
        }
      }

      if (!productName.trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Description Goods (product name) is required for all line items.' });
      }

      enrichedItems.push({
        productId,
        productNameSnapshot: productName.trim(),
        productCategorySnapshot: category,
        productSizeSnapshot: size,
        productSpecificationsSnapshot: specifications,
        btls: item.btls || null,
        quantity: item.quantity,
        unit,
        rate: item.rate !== undefined ? item.rate : item.negotiatedRate
      });
    }

    // Authoritative calculation
    const calculated = calculateBillTotals(enrichedItems, gstPercentage, transportCost);

    // Generate unique sequential bill number
    const billNumber = await generateUniqueBillNumber(transaction);

    // Create Bill
    const newBill = await Bill.create({
      billNumber,
      organizationId: targetOrgId,
      customerId: customer.id,
      estimateId: validEstimateId,
      billDate: billDate || new Date(),
      productSubtotal: calculated.productSubtotal,
      gstPercentage: calculated.gstPercentage,
      gstAmount: calculated.gstAmount,
      transportCost: calculated.transportCost,
      finalAmount: calculated.finalAmount,
      status: 'DRAFT',
      createdBy: req.user.userId,
      notes: notes || null
    }, { transaction });

    // Create Bill Items
    const itemsToCreate = calculated.calculatedItems.map(item => ({
      billId: newBill.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      productCategorySnapshot: item.productCategorySnapshot,
      productSizeSnapshot: item.productSizeSnapshot,
      productSpecificationsSnapshot: item.productSpecificationsSnapshot,
      btls: item.btls,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount
    }));

    await BillItem.bulkCreate(itemsToCreate, { transaction });

    // Record Audit Log
    await BillAudit.create({
      billId: newBill.id,
      billNumber: newBill.billNumber,
      userId: req.user.userId,
      action: 'CREATE_DRAFT',
      reason: 'Draft bill created',
      newValues: JSON.stringify({
        billNumber: newBill.billNumber,
        customerId: newBill.customerId,
        estimateId: newBill.estimateId,
        productSubtotal: newBill.productSubtotal,
        gstPercentage: newBill.gstPercentage,
        gstAmount: newBill.gstAmount,
        transportCost: newBill.transportCost,
        finalAmount: newBill.finalAmount,
        itemCount: itemsToCreate.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const createdBill = await Bill.findByPk(newBill.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: BillItem, as: 'items' }
      ]
    });

    res.status(201).json(createdBill);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating bill:', error);
    res.status(500).json({ error: error.message || 'Internal server error while creating bill' });
  }
};

/**
 * PUT /api/bills/:id - Update draft bill
 */
exports.updateBill = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      customerId,
      estimateId,
      billDate,
      items,
      gstPercentage,
      transportCost,
      notes
    } = req.body;

    const bill = await Bill.findByPk(id, {
      include: [{ model: BillItem, as: 'items' }],
      transaction
    });

    if (!bill) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(bill, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Only DRAFT bills can be updated via this endpoint
    if (bill.status !== 'DRAFT') {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot edit bill because it is ${bill.status}. Finalized bills require an authorized override.`
      });
    }

    // Customer validation if updated
    let targetCustomerId = bill.customerId;
    if (customerId && customerId !== bill.customerId) {
      const customer = await Customer.findByPk(customerId, { transaction });
      if (!customer || customer.organizationId !== bill.organizationId) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Customer is invalid or belongs to another organization.' });
      }
      targetCustomerId = customer.id;
    }

    // Optional estimate validation if updated
    let targetEstimateId = bill.estimateId;
    if (estimateId !== undefined) {
      if (estimateId) {
        const estimate = await Estimate.findByPk(estimateId, { transaction });
        if (!estimate || estimate.organizationId !== bill.organizationId) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Referenced estimate is invalid or belongs to another organization.' });
        }
        targetEstimateId = estimate.id;
      } else {
        targetEstimateId = null;
      }
    }

    // Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A bill must contain at least one product item.' });
    }

    const enrichedItems = [];
    for (const item of items) {
      let productName = item.productNameSnapshot || item.name || '';
      let category = item.productCategorySnapshot || item.category || null;
      let size = item.productSizeSnapshot || item.size || null;
      let specifications = item.productSpecificationsSnapshot || item.specifications || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (productId) {
        const product = await Product.findByPk(productId, { transaction });
        if (product) {
          if (product.organizationId !== bill.organizationId) {
            await transaction.rollback();
            return res.status(403).json({ error: `Product "${product.name}" belongs to another organization.` });
          }
          productName = product.name;
          category = product.category;
          size = product.size;
          unit = product.unit || unit;
          specifications = product.specifications;
        }
      }

      if (!productName.trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Description Goods (product name) is required for all line items.' });
      }

      enrichedItems.push({
        productId,
        productNameSnapshot: productName.trim(),
        productCategorySnapshot: category,
        productSizeSnapshot: size,
        productSpecificationsSnapshot: specifications,
        btls: item.btls || null,
        quantity: item.quantity,
        unit,
        rate: item.rate !== undefined ? item.rate : item.negotiatedRate
      });
    }

    // Authoritative calculation
    const calculated = calculateBillTotals(enrichedItems, gstPercentage, transportCost);

    // Snapshot previous values for audit
    const previousSnapshot = {
      customerId: bill.customerId,
      estimateId: bill.estimateId,
      productSubtotal: bill.productSubtotal,
      gstPercentage: bill.gstPercentage,
      gstAmount: bill.gstAmount,
      transportCost: bill.transportCost,
      finalAmount: bill.finalAmount,
      items: bill.items.map(i => ({
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount
      }))
    };

    // Update bill header
    await bill.update({
      customerId: targetCustomerId,
      estimateId: targetEstimateId,
      billDate: billDate || bill.billDate,
      productSubtotal: calculated.productSubtotal,
      gstPercentage: calculated.gstPercentage,
      gstAmount: calculated.gstAmount,
      transportCost: calculated.transportCost,
      finalAmount: calculated.finalAmount,
      notes: notes !== undefined ? notes : bill.notes
    }, { transaction });

    // Replace line items
    await BillItem.destroy({ where: { billId: bill.id }, transaction });

    const itemsToCreate = calculated.calculatedItems.map(item => ({
      billId: bill.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      productCategorySnapshot: item.productCategorySnapshot,
      productSizeSnapshot: item.productSizeSnapshot,
      productSpecificationsSnapshot: item.productSpecificationsSnapshot,
      btls: item.btls,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount
    }));

    await BillItem.bulkCreate(itemsToCreate, { transaction });

    // Record audit
    await BillAudit.create({
      billId: bill.id,
      billNumber: bill.billNumber,
      userId: req.user.userId,
      action: 'UPDATE_DRAFT',
      reason: 'Draft bill updated',
      previousValues: JSON.stringify(previousSnapshot),
      newValues: JSON.stringify({
        customerId: targetCustomerId,
        estimateId: targetEstimateId,
        productSubtotal: calculated.productSubtotal,
        gstPercentage: calculated.gstPercentage,
        gstAmount: calculated.gstAmount,
        transportCost: calculated.transportCost,
        finalAmount: calculated.finalAmount,
        itemCount: itemsToCreate.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const updatedBill = await Bill.findByPk(bill.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: BillItem, as: 'items' }
      ]
    });

    res.status(200).json(updatedBill);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating bill:', error);
    res.status(500).json({ error: error.message || 'Internal server error while updating bill' });
  }
};

/**
 * POST /api/bills/:id/finalize - Finalize and lock bill
 */
exports.finalizeBill = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const bill = await Bill.findByPk(id, {
      include: [{ model: BillItem, as: 'items' }],
      transaction
    });

    if (!bill) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(bill, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    if (bill.status === 'FINALIZED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Bill is already finalized and locked.' });
    }

    if (!bill.items || bill.items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot finalize a bill with no product line items.' });
    }

    const previousSnapshot = {
      status: bill.status,
      finalAmount: bill.finalAmount
    };

    await bill.update({
      status: 'FINALIZED',
      finalizedAt: new Date(),
      finalizedBy: req.user.userId
    }, { transaction });

    await BillAudit.create({
      billId: bill.id,
      billNumber: bill.billNumber,
      userId: req.user.userId,
      action: 'FINALIZE',
      reason: 'Bill finalized and locked against standard editing',
      previousValues: JSON.stringify(previousSnapshot),
      newValues: JSON.stringify({
        status: 'FINALIZED',
        finalizedAt: bill.finalizedAt,
        finalizedBy: req.user.userId,
        finalAmount: bill.finalAmount
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const finalizedBill = await Bill.findByPk(bill.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'finalizer', attributes: ['id', 'username'] },
        { model: BillItem, as: 'items' }
      ]
    });

    res.status(200).json(finalizedBill);
  } catch (error) {
    await transaction.rollback();
    console.error('Error finalizing bill:', error);
    res.status(500).json({ error: error.message || 'Internal server error while finalizing bill' });
  }
};

/**
 * POST /api/bills/:id/override - Authorized override of finalized bill
 */
exports.overrideBill = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      reason,
      customerId,
      estimateId,
      billDate,
      items,
      gstPercentage,
      transportCost,
      notes
    } = req.body;

    // RBAC: Only SUPER_ADMIN, CEO, and ADMIN are allowed to perform overrides
    if (!['SUPER_ADMIN', 'CEO', 'ADMIN'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Permission denied: Only Admin, CEO, or Super Admin can override a finalized bill.' });
    }

    if (!reason || !reason.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A mandatory reason must be provided for an authorized override.' });
    }

    const bill = await Bill.findByPk(id, {
      include: [{ model: BillItem, as: 'items' }],
      transaction
    });

    if (!bill) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(bill, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Customer validation
    let targetCustomerId = bill.customerId;
    if (customerId && customerId !== bill.customerId) {
      const customer = await Customer.findByPk(customerId, { transaction });
      if (!customer || customer.organizationId !== bill.organizationId) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Customer is invalid or belongs to another organization.' });
      }
      targetCustomerId = customer.id;
    }

    // Optional estimate validation
    let targetEstimateId = bill.estimateId;
    if (estimateId !== undefined) {
      if (estimateId) {
        const estimate = await Estimate.findByPk(estimateId, { transaction });
        if (!estimate || estimate.organizationId !== bill.organizationId) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Referenced estimate is invalid or belongs to another organization.' });
        }
        targetEstimateId = estimate.id;
      } else {
        targetEstimateId = null;
      }
    }

    // Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A bill must contain at least one product item.' });
    }

    const enrichedItems = [];
    for (const item of items) {
      let productName = item.productNameSnapshot || item.name || '';
      let category = item.productCategorySnapshot || item.category || null;
      let size = item.productSizeSnapshot || item.size || null;
      let specifications = item.productSpecificationsSnapshot || item.specifications || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (productId) {
        const product = await Product.findByPk(productId, { transaction });
        if (product) {
          if (product.organizationId !== bill.organizationId) {
            await transaction.rollback();
            return res.status(403).json({ error: `Product "${product.name}" belongs to another organization.` });
          }
          productName = product.name;
          category = product.category;
          size = product.size;
          unit = product.unit || unit;
          specifications = product.specifications;
        }
      }

      if (!productName.trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Description Goods (product name) is required for all line items.' });
      }

      enrichedItems.push({
        productId,
        productNameSnapshot: productName.trim(),
        productCategorySnapshot: category,
        productSizeSnapshot: size,
        productSpecificationsSnapshot: specifications,
        btls: item.btls || null,
        quantity: item.quantity,
        unit,
        rate: item.rate !== undefined ? item.rate : item.negotiatedRate
      });
    }

    // Authoritative calculation
    const calculated = calculateBillTotals(enrichedItems, gstPercentage, transportCost);

    // Capture comprehensive previous snapshot
    const previousSnapshot = {
      status: bill.status,
      customerId: bill.customerId,
      estimateId: bill.estimateId,
      productSubtotal: bill.productSubtotal,
      gstPercentage: bill.gstPercentage,
      gstAmount: bill.gstAmount,
      transportCost: bill.transportCost,
      finalAmount: bill.finalAmount,
      items: bill.items.map(i => ({
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount
      }))
    };

    // Update bill
    await bill.update({
      customerId: targetCustomerId,
      estimateId: targetEstimateId,
      billDate: billDate || bill.billDate,
      productSubtotal: calculated.productSubtotal,
      gstPercentage: calculated.gstPercentage,
      gstAmount: calculated.gstAmount,
      transportCost: calculated.transportCost,
      finalAmount: calculated.finalAmount,
      status: 'OVERRIDDEN',
      lastOverriddenBy: req.user.userId,
      lastOverriddenAt: new Date(),
      notes: notes !== undefined ? notes : bill.notes
    }, { transaction });

    // Replace line items
    await BillItem.destroy({ where: { billId: bill.id }, transaction });

    const itemsToCreate = calculated.calculatedItems.map(item => ({
      billId: bill.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      productCategorySnapshot: item.productCategorySnapshot,
      productSizeSnapshot: item.productSizeSnapshot,
      productSpecificationsSnapshot: item.productSpecificationsSnapshot,
      btls: item.btls,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount
    }));

    await BillItem.bulkCreate(itemsToCreate, { transaction });

    // Write audit record
    await BillAudit.create({
      billId: bill.id,
      billNumber: bill.billNumber,
      userId: req.user.userId,
      action: 'OVERRIDE',
      reason: reason.trim(),
      previousValues: JSON.stringify(previousSnapshot),
      newValues: JSON.stringify({
        status: 'OVERRIDDEN',
        lastOverriddenBy: req.user.userId,
        lastOverriddenAt: bill.lastOverriddenAt,
        customerId: targetCustomerId,
        estimateId: targetEstimateId,
        productSubtotal: calculated.productSubtotal,
        gstPercentage: calculated.gstPercentage,
        gstAmount: calculated.gstAmount,
        transportCost: calculated.transportCost,
        finalAmount: calculated.finalAmount,
        itemCount: itemsToCreate.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const overriddenBill = await Bill.findByPk(bill.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'finalizer', attributes: ['id', 'username'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { model: BillItem, as: 'items' }
      ]
    });

    res.status(200).json(overriddenBill);
  } catch (error) {
    await transaction.rollback();
    console.error('Error overriding bill:', error);
    res.status(500).json({ error: error.message || 'Internal server error while overriding bill' });
  }
};

/**
 * GET /api/bills/:id/audit - Retrieve audit history
 */
exports.getBillAudits = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findByPk(id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Ownership check
    await verifyRecordOwnership(bill, req.user);

    const audits = await BillAudit.findAll({
      where: { billId: id },
      include: [
        {
          model: User,
          as: 'performer',
          attributes: ['id', 'username', 'role']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(audits);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching bill audits:', error);
    res.status(500).json({ error: 'Internal server error while fetching bill audit logs' });
  }
};
