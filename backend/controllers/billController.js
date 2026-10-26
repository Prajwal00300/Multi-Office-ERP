const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Organization = require('../models/Organization');
const User = require('../models/User');
const InventoryMovement = require('../models/InventoryMovement');
const { calculateBillTotals } = require('../services/billingCalculationService');
const { generateUniqueBillNumber } = require('../utils/billNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * Deducts stock from Product.currentStock and logs InventoryMovement OUT
 */
async function deductInventoryForBillItems(items, bill, userId, transaction, actionNote) {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    if (item.productId) {
      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (product && product.organizationId === bill.organizationId) {
        const deductQty = parseFloat(item.quantity) || 0;
        if (deductQty > 0) {
          const currentStock = parseFloat(product.currentStock) || 0;
          const newStock = parseFloat((currentStock - deductQty).toFixed(3));
          await product.update({ currentStock: newStock }, { transaction });

          await InventoryMovement.create({
            organizationId: bill.organizationId,
            productId: product.id,
            movementType: 'OUT',
            quantity: deductQty,
            referenceType: 'BILL',
            referenceId: bill.id,
            referenceNumber: bill.billNumber,
            notes: actionNote || `Bill finalized #${bill.billNumber}`,
            performedBy: userId
          }, { transaction });
        }
      }
    }
  }
}

/**
 * Reverts previously deducted stock from Product.currentStock and removes previous BILL InventoryMovements
 */
async function revertInventoryForBillItems(items, bill, transaction) {
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.productId) {
        const product = await Product.findByPk(item.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (product && product.organizationId === bill.organizationId) {
          const revertQty = parseFloat(item.quantity) || 0;
          if (revertQty > 0) {
            const currentStock = parseFloat(product.currentStock) || 0;
            const newStock = parseFloat((currentStock + revertQty).toFixed(3));
            await product.update({ currentStock: newStock }, { transaction });
          }
        }
      }
    }
  }
  await InventoryMovement.destroy({
    where: {
      referenceType: 'BILL',
      referenceId: bill.id
    },
    transaction
  });
}

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
 * GET /api/bills/navigation/previous - Retrieve immediately preceding bill within authorized office
 * Query params: currentId (optional), organizationId (optional)
 */
exports.getPreviousBill = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId) {
      whereClause.id = { [Op.lt]: parseInt(currentId, 10) };
    }

    const bill = await Bill.findOne({
      where: whereClause,
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
          attributes: ['id', 'estimateNumber', 'estimateDate', 'status', 'basic', 'totalQuantity', 'total', 'others', 'grandTotal'],
          include: [
            {
              model: EstimateItem,
              as: 'items',
              include: [
                {
                  model: Product,
                  attributes: ['id', 'name', 'unit', 'difference', 'specifications']
                }
              ]
            }
          ]
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
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    if (!bill) {
      return res.status(404).json({ error: 'No previous transaction found for this office' });
    }

    // Ownership check
    await verifyRecordOwnership(bill, req.user);

    res.status(200).json(bill);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching previous bill:', error);
    res.status(500).json({ error: 'Internal server error while fetching previous bill' });
  }
};

/**
 * GET /api/bills/navigation/next - Retrieve immediately following bill within authorized office
 * Query params: currentId (optional), organizationId (optional)
 */
exports.getNextBill = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId) {
      whereClause.id = { [Op.gt]: parseInt(currentId, 10) };
    }

    const bill = await Bill.findOne({
      where: whereClause,
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
          attributes: ['id', 'estimateNumber', 'estimateDate', 'status', 'basic', 'totalQuantity', 'total', 'others', 'grandTotal'],
          include: [
            {
              model: EstimateItem,
              as: 'items',
              include: [
                {
                  model: Product,
                  attributes: ['id', 'name', 'unit', 'difference', 'specifications']
                }
              ]
            }
          ]
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
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
        }
      ],
      order: [['id', 'ASC']]
    });

    if (!bill) {
      return res.status(404).json({ error: 'No subsequent transaction found for this office' });
    }

    // Ownership check
    await verifyRecordOwnership(bill, req.user);

    res.status(200).json(bill);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching next bill:', error);
    res.status(500).json({ error: 'Internal server error while fetching next bill' });
  }
};

/**
 * GET /api/bills/next-number - Retrieve next upcoming bill number preview scoped to office
 */
exports.getNextBillNumber = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const effectiveOrgId = (targetOfficeIds && targetOfficeIds.length > 0) ? targetOfficeIds[0] : req.user.organizationId;
    const nextBillNumber = await generateUniqueBillNumber(effectiveOrgId);
    res.status(200).json({ nextBillNumber });
  } catch (error) {
    console.error('Error generating next bill number preview:', error);
    res.status(500).json({ error: 'Failed to generate next bill number preview' });
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
          attributes: ['id', 'estimateNumber', 'estimateDate', 'status', 'basic', 'totalQuantity', 'total', 'others', 'grandTotal'],
          include: [
            {
              model: EstimateItem,
              as: 'items',
              include: [
                {
                  model: Product,
                  attributes: ['id', 'name', 'unit', 'difference', 'specifications']
                }
              ]
            }
          ]
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
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
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
      status,
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
      let specifications = item.productSpecificationsSnapshot || item.specifications || item.description || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (!productId && productName.trim()) {
        const matchedProduct = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            name: productName.trim()
          },
          transaction
        });
        if (matchedProduct) {
          productId = matchedProduct.id;
        }
      }

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
          if (!specifications) {
            specifications = product.specifications;
          }
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

    // Generate unique sequential bill number scoped to this office
    const billNumber = await generateUniqueBillNumber(targetOrgId, transaction);

    const isFinalized = status === 'FINALIZED';
    const billStatus = isFinalized ? 'FINALIZED' : 'DRAFT';

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
      status: billStatus,
      createdBy: req.user.userId,
      finalizedAt: isFinalized ? new Date() : null,
      finalizedBy: isFinalized ? req.user.userId : null,
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

    // Deduct stock if bill is finalized
    if (isFinalized) {
      await deductInventoryForBillItems(itemsToCreate, newBill, req.user.userId, transaction, `Bill created #${newBill.billNumber}`);
    }

    await transaction.commit();

    const createdBill = await Bill.findByPk(newBill.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'finalizer', attributes: ['id', 'username'] },
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
      notes,
      status
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
      let specifications = item.productSpecificationsSnapshot || item.specifications || item.description || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (!productId && productName.trim()) {
        const matchedProduct = await Product.findOne({
          where: {
            organizationId: bill.organizationId,
            name: productName.trim()
          },
          transaction
        });
        if (matchedProduct) {
          productId = matchedProduct.id;
        }
      }

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
          if (!specifications) {
            specifications = product.specifications;
          }
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

    const wasFinalized = bill.status === 'FINALIZED' || bill.status === 'OVERRIDDEN';
    const willBeFinalized = status === 'FINALIZED' || wasFinalized;
    const targetStatus = willBeFinalized ? (bill.status === 'OVERRIDDEN' ? 'OVERRIDDEN' : 'FINALIZED') : 'DRAFT';

    // If bill was already finalized or overridden, revert its previously deducted stock first
    if (wasFinalized) {
      await revertInventoryForBillItems(bill.items, bill, transaction);
    }

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
      status: targetStatus,
      finalizedAt: willBeFinalized ? (bill.finalizedAt || new Date()) : bill.finalizedAt,
      finalizedBy: willBeFinalized ? (bill.finalizedBy || req.user.userId) : bill.finalizedBy,
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

    // If bill will be finalized/overridden, deduct the updated items' stock
    if (willBeFinalized) {
      await deductInventoryForBillItems(itemsToCreate, bill, req.user.userId, transaction, `Bill updated #${bill.billNumber}`);
    }

    await transaction.commit();

    const updatedBill = await Bill.findByPk(bill.id, {
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
      const existingFinalized = await Bill.findByPk(bill.id, {
        include: [
          { model: Customer, attributes: ['id', 'name', 'phone', 'city', 'tin'] },
          { model: Organization, attributes: ['id', 'name'] },
          { model: Estimate, attributes: ['id', 'estimateNumber', 'status'] },
          { model: User, as: 'creator', attributes: ['id', 'username'] },
          { model: User, as: 'finalizer', attributes: ['id', 'username'] },
          { model: BillItem, as: 'items' }
        ]
      });
      return res.status(200).json(existingFinalized);
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

    // Deduct stock for all line items that have a productId, safely within transaction
    await deductInventoryForBillItems(bill.items, bill, req.user.userId, transaction, `Bill finalized #${bill.billNumber}`);

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
      let specifications = item.productSpecificationsSnapshot || item.specifications || item.description || null;
      let unit = item.unit || 'Kg';

      let productId = item.productId || null;
      if (!productId && productName.trim()) {
        const matchedProduct = await Product.findOne({
          where: {
            organizationId: bill.organizationId,
            name: productName.trim()
          },
          transaction
        });
        if (matchedProduct) {
          productId = matchedProduct.id;
        }
      }

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
          if (!specifications) {
            specifications = product.specifications;
          }
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

    // Revert previous stock if the bill was finalized or overridden
    await revertInventoryForBillItems(bill.items, bill, transaction);

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

    // Deduct stock for new items
    await deductInventoryForBillItems(itemsToCreate, bill, req.user.userId, transaction, `Bill overridden #${bill.billNumber}`);

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
