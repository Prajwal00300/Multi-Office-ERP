const { Op } = require('sequelize');
const sequelize = require('../config/database');
const PurchaseEstimate = require('../models/PurchaseEstimate');
const PurchaseEstimateItem = require('../models/PurchaseEstimateItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const User = require('../models/User');
const InventoryMovement = require('../models/InventoryMovement');
const { calculateEstimateTotals } = require('../services/estimateCalculationService');
const { generateUniquePurchaseEstimateNumber } = require('../utils/purchaseEstimateNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * INCREASES stock in Product.currentStock and logs InventoryMovement IN for purchase estimate items
 */
async function addInventoryForPurchaseEstimateItems(items, estimate, userId, transaction, actionNote) {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    if (item.productId) {
      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (product && product.organizationId === estimate.organizationId) {
        const addQty = parseFloat(item.quantity) || 0;
        if (addQty > 0) {
          const currentStock = parseFloat(product.currentStock) || 0;
          const newStock = parseFloat((currentStock + addQty).toFixed(3));
          await product.update({ currentStock: newStock }, { transaction });

          await InventoryMovement.create({
            organizationId: estimate.organizationId,
            productId: product.id,
            movementType: 'IN',
            quantity: addQty,
            referenceType: 'PURCHASE_ESTIMATE',
            referenceId: estimate.id,
            referenceNumber: estimate.estimateNumber,
            notes: actionNote || `Purchase estimate voucher #${estimate.estimateNumber}`,
            performedBy: userId
          }, { transaction });
        }
      }
    }
  }
}

/**
 * Reverts previously added stock from Product.currentStock and removes previous PURCHASE_ESTIMATE InventoryMovements
 */
async function revertInventoryForPurchaseEstimateItems(items, estimate, transaction) {
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.productId) {
        const product = await Product.findByPk(item.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (product && product.organizationId === estimate.organizationId) {
          const revertQty = parseFloat(item.quantity) || 0;
          if (revertQty > 0) {
            const currentStock = parseFloat(product.currentStock) || 0;
            const newStock = parseFloat((currentStock - revertQty).toFixed(3));
            await product.update({ currentStock: newStock }, { transaction });
          }
        }
      }
    }
  }
  await InventoryMovement.destroy({
    where: {
      referenceType: 'PURCHASE_ESTIMATE',
      referenceId: estimate.id
    },
    transaction
  });
}

// GET /api/purchase-estimates - List purchase estimates with filters
exports.getPurchaseEstimates = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      startDate, 
      endDate, 
      organizationId 
    } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (status && status.trim() !== '' && status !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    if (startDate && endDate) {
      whereClause.estimateDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.estimateDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.estimateDate = { [Op.lte]: endDate };
    }

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { estimateNumber: { [Op.like]: searchTerm } },
        { basic: { [Op.like]: searchTerm } },
        { partyName: { [Op.like]: searchTerm } },
        { '$Customer.name$': { [Op.like]: searchTerm } }
      ];
    }

    const estimates = await PurchaseEstimate.findAll({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(estimates);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchase estimates:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase estimates' });
  }
};

// GET /api/purchase-estimates/:id - Get purchase estimate by ID
exports.getPurchaseEstimateById = async (req, res) => {
  try {
    const { id } = req.params;

    const estimate = await PurchaseEstimate.findByPk(id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin', 'address'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'locker', attributes: ['id', 'username'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { 
          model: PurchaseEstimateItem, 
          as: 'items',
          include: [{ model: Product, attributes: ['id', 'name', 'unit', 'difference', 'currentStock'] }]
        }
      ]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Purchase Estimate not found' });
    }

    await verifyRecordOwnership(estimate, req.user);

    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase estimate' });
  }
};

// GET /api/purchase-estimates/navigation/previous
exports.getPreviousPurchaseEstimate = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;
    if (!currentId) return res.status(400).json({ error: 'currentId query parameter is required' });

    const currentEstimate = await PurchaseEstimate.findByPk(currentId);
    if (!currentEstimate) return res.status(404).json({ error: 'Current purchase estimate not found' });

    const targetOrgId = currentEstimate.organizationId;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId || targetOrgId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const prevEstimate = await PurchaseEstimate.findOne({
      where: {
        ...officeWhere,
        organizationId: targetOrgId,
        id: { [Op.lt]: currentEstimate.id }
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ],
      order: [['id', 'DESC']]
    });

    if (!prevEstimate) return res.status(404).json({ message: 'No previous purchase estimate found' });
    res.status(200).json(prevEstimate);
  } catch (error) {
    console.error('Error fetching previous purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/next
exports.getNextPurchaseEstimate = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;
    if (!currentId) return res.status(400).json({ error: 'currentId query parameter is required' });

    const currentEstimate = await PurchaseEstimate.findByPk(currentId);
    if (!currentEstimate) return res.status(404).json({ error: 'Current purchase estimate not found' });

    const targetOrgId = currentEstimate.organizationId;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId || targetOrgId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const nextEstimate = await PurchaseEstimate.findOne({
      where: {
        ...officeWhere,
        organizationId: targetOrgId,
        id: { [Op.gt]: currentEstimate.id }
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ],
      order: [['id', 'ASC']]
    });

    if (!nextEstimate) return res.status(404).json({ message: 'No next purchase estimate found' });
    res.status(200).json(nextEstimate);
  } catch (error) {
    console.error('Error fetching next purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/first
exports.getFirstPurchaseEstimate = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const firstEstimate = await PurchaseEstimate.findOne({
      where: officeWhere,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ],
      order: [['id', 'ASC']]
    });

    if (!firstEstimate) return res.status(404).json({ message: 'No purchase estimates found' });
    res.status(200).json(firstEstimate);
  } catch (error) {
    console.error('Error fetching first purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/last
exports.getLastPurchaseEstimate = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const lastEstimate = await PurchaseEstimate.findOne({
      where: officeWhere,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ],
      order: [['id', 'DESC']]
    });

    if (!lastEstimate) return res.status(404).json({ message: 'No purchase estimates found' });
    res.status(200).json(lastEstimate);
  } catch (error) {
    console.error('Error fetching last purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/purchase-estimates/by-number/:estimateNumber
exports.getPurchaseEstimateByNumber = async (req, res) => {
  try {
    const { estimateNumber } = req.params;
    const { organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const estimate = await PurchaseEstimate.findOne({
      where: {
        ...officeWhere,
        estimateNumber: estimateNumber.trim()
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ]
    });

    if (!estimate) return res.status(404).json({ error: `Purchase Estimate #${estimateNumber} not found` });
    res.status(200).json(estimate);
  } catch (error) {
    console.error('Error fetching purchase estimate by number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/purchase-estimates/next-number
exports.getNextPurchaseEstimateNumber = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);
    const nextNumber = await generateUniquePurchaseEstimateNumber(targetOrgId);
    res.status(200).json({ nextEstimateNumber: nextNumber });
  } catch (error) {
    console.error('Error generating next purchase estimate number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/purchase-estimates - Create purchase estimate
exports.createPurchaseEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      customerId,
      partyName,
      organizationId,
      estimateDate,
      basic,
      terms,
      vehicle,
      transport,
      broker,
      dueDate,
      shortageQty,
      shortageAmt,
      expBeforeTax,
      taxRate,
      taxAmount,
      surchargeRate,
      expAfterTax,
      items,
      others,
      notes,
      status // 'DRAFT' or 'GENERATED'
    } = req.body;

    const targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);

    // Validate Customer if customerId provided
    let validCustomerId = null;
    let resolvedPartyName = partyName ? partyName.trim() : null;

    if (customerId) {
      const customer = await Customer.findOne({
        where: { id: customerId, organizationId: targetOrgId },
        transaction: t
      });
      if (customer) {
        validCustomerId = customer.id;
        if (!resolvedPartyName) {
          resolvedPartyName = customer.name;
        }
      }
    }

    if (!validCustomerId && !resolvedPartyName) {
      await t.rollback();
      return res.status(400).json({ error: 'Supplier / Party / Customer name is required.' });
    }

    // Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'At least one product item row is required.' });
    }

    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      let productNameSnapshot = row.productNameSnapshot ? row.productNameSnapshot.trim() : '';
      let productCategorySnapshot = row.productCategorySnapshot || null;
      let productSizeSnapshot = row.productSizeSnapshot || null;
      let productSpecificationsSnapshot = row.productSpecificationsSnapshot || row.specifications || row.description || null;
      let unit = row.unit ? row.unit.trim() : 'Ton';

      if (row.productId) {
        const product = await Product.findOne({
          where: { id: row.productId, organizationId: targetOrgId },
          transaction: t
        });

        if (product) {
          if (!productNameSnapshot) {
            productNameSnapshot = product.name;
          }
          productCategorySnapshot = product.category || 'General';
          productSizeSnapshot = product.size || '-';
          if (!productSpecificationsSnapshot) {
            productSpecificationsSnapshot = product.specifications;
          }
          unit = product.unit || unit;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description / name is required on row ${i + 1}.` });
      }

      const qty = parseFloat(row.quantity);
      if (isNaN(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid quantity on row ${i + 1}. Must be greater than 0.` });
      }

      const rate = parseFloat(row.negotiatedRate || row.rate || 0);
      if (isNaN(rate) || rate < 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid rate on row ${i + 1}. Must be 0 or greater.` });
      }

      preparedItems.push({
        productId: row.productId || null,
        productNameSnapshot,
        productCategorySnapshot,
        productSizeSnapshot,
        productSpecificationsSnapshot,
        btls: row.btls !== undefined && row.btls !== null ? String(row.btls).trim() : null,
        quantity: qty,
        unit,
        negotiatedRate: rate
      });
    }

    // Authoritative totals calculation
    const {
      calculatedItems,
      totalQuantity,
      total,
      expBeforeTax: validatedExpBefore,
      taxRate: validatedTaxRate,
      taxAmount: validatedTaxAmount,
      surchargeRate: validatedSurchargeRate,
      expAfterTax: validatedExpAfter,
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others, {
      expBeforeTax,
      taxRate,
      surchargeRate,
      expAfterTax
    });

    const estimateNumber = await generateUniquePurchaseEstimateNumber(targetOrgId, t);
    const isGenerated = status === 'GENERATED';

    const newEstimate = await PurchaseEstimate.create({
      estimateNumber,
      organizationId: targetOrgId,
      customerId: validCustomerId,
      partyName: resolvedPartyName,
      estimateDate: estimateDate || new Date(),
      basic: basic ? basic.trim() : null,
      terms: terms ? terms.trim() : null,
      vehicle: vehicle ? vehicle.trim() : null,
      transport: transport ? transport.trim() : null,
      broker: broker ? broker.trim() : null,
      dueDate: dueDate || null,
      shortageQty: parseFloat(shortageQty) || 0,
      shortageAmt: parseFloat(shortageAmt) || 0,
      expBeforeTax: validatedExpBefore,
      taxRate: validatedTaxRate,
      taxAmount: validatedTaxAmount,
      surchargeRate: validatedSurchargeRate,
      expAfterTax: validatedExpAfter,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal,
      status: isGenerated ? 'GENERATED' : 'DRAFT',
      createdBy: req.user.userId,
      lockedAt: isGenerated ? new Date() : null,
      lockedBy: isGenerated ? req.user.userId : null,
      notes: notes ? notes.trim() : null
    }, { transaction: t });

    for (const item of calculatedItems) {
      await PurchaseEstimateItem.create({
        purchaseEstimateId: newEstimate.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        btls: item.btls,
        quantity: item.quantity,
        unit: item.unit,
        negotiatedRate: item.negotiatedRate,
        amount: item.amount
      }, { transaction: t });
    }

    // INCREASES inventory stock for purchase items
    await addInventoryForPurchaseEstimateItems(
      calculatedItems,
      newEstimate,
      req.user.userId,
      t,
      `Purchase estimate created #${newEstimate.estimateNumber}`
    );

    await t.commit();

    const completeEstimate = await PurchaseEstimate.findByPk(newEstimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ]
    });

    res.status(201).json({
      message: `Purchase Estimate ${estimateNumber} created successfully`,
      estimate: completeEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating purchase estimate:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal server error while creating purchase estimate' });
  }
};

// PUT /api/purchase-estimates/:id - Update purchase estimate
exports.updatePurchaseEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      customerId,
      partyName,
      estimateDate,
      basic,
      terms,
      vehicle,
      transport,
      broker,
      dueDate,
      shortageQty,
      shortageAmt,
      expBeforeTax,
      taxRate,
      taxAmount,
      surchargeRate,
      expAfterTax,
      items,
      others,
      notes
    } = req.body;

    const estimate = await PurchaseEstimate.findByPk(id, { transaction: t });
    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Purchase Estimate not found' });
    }

    await verifyRecordOwnership(estimate, req.user);
    const targetOrgId = estimate.organizationId;

    let validCustomerId = estimate.customerId;
    let resolvedPartyName = partyName !== undefined ? (partyName ? partyName.trim() : null) : estimate.partyName;

    if (customerId !== undefined) {
      if (customerId) {
        const customer = await Customer.findOne({
          where: { id: customerId, organizationId: targetOrgId },
          transaction: t
        });
        if (customer) {
          validCustomerId = customer.id;
          if (!resolvedPartyName) resolvedPartyName = customer.name;
        }
      } else {
        validCustomerId = null;
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'At least one product item row is required.' });
    }

    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      let productNameSnapshot = row.productNameSnapshot ? row.productNameSnapshot.trim() : '';
      let productCategorySnapshot = row.productCategorySnapshot || null;
      let productSizeSnapshot = row.productSizeSnapshot || null;
      let productSpecificationsSnapshot = row.productSpecificationsSnapshot || row.specifications || row.description || null;
      let unit = row.unit ? row.unit.trim() : 'Ton';

      if (row.productId) {
        const product = await Product.findOne({
          where: { id: row.productId, organizationId: targetOrgId },
          transaction: t
        });

        if (product) {
          if (!productNameSnapshot) {
            productNameSnapshot = product.name;
          }
          productCategorySnapshot = product.category || 'General';
          productSizeSnapshot = product.size || '-';
          if (!productSpecificationsSnapshot) {
            productSpecificationsSnapshot = product.specifications;
          }
          unit = product.unit || unit;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description is required on row ${i + 1}.` });
      }

      const qty = parseFloat(row.quantity);
      if (isNaN(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid quantity on row ${i + 1}. Must be greater than 0.` });
      }

      const rate = parseFloat(row.negotiatedRate || row.rate || 0);
      if (isNaN(rate) || rate < 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid rate on row ${i + 1}. Must be 0 or greater.` });
      }

      preparedItems.push({
        productId: row.productId || null,
        productNameSnapshot,
        productCategorySnapshot,
        productSizeSnapshot,
        productSpecificationsSnapshot,
        btls: row.btls !== undefined && row.btls !== null ? String(row.btls).trim() : null,
        quantity: qty,
        unit,
        negotiatedRate: rate
      });
    }

    const {
      calculatedItems,
      totalQuantity,
      total,
      expBeforeTax: validatedExpBefore,
      taxRate: validatedTaxRate,
      taxAmount: validatedTaxAmount,
      surchargeRate: validatedSurchargeRate,
      expAfterTax: validatedExpAfter,
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others, {
      expBeforeTax,
      taxRate,
      surchargeRate,
      expAfterTax
    });

    await estimate.update({
      customerId: validCustomerId,
      partyName: resolvedPartyName,
      estimateDate: estimateDate || estimate.estimateDate,
      basic: basic !== undefined ? (basic ? basic.trim() : null) : estimate.basic,
      terms: terms !== undefined ? (terms ? terms.trim() : null) : estimate.terms,
      vehicle: vehicle !== undefined ? (vehicle ? vehicle.trim() : null) : estimate.vehicle,
      transport: transport !== undefined ? (transport ? transport.trim() : null) : estimate.transport,
      broker: broker !== undefined ? (broker ? broker.trim() : null) : estimate.broker,
      dueDate: dueDate !== undefined ? (dueDate || null) : estimate.dueDate,
      shortageQty: shortageQty !== undefined ? (parseFloat(shortageQty) || 0) : estimate.shortageQty,
      shortageAmt: shortageAmt !== undefined ? (parseFloat(shortageAmt) || 0) : estimate.shortageAmt,
      expBeforeTax: validatedExpBefore,
      taxRate: validatedTaxRate,
      taxAmount: validatedTaxAmount,
      surchargeRate: validatedSurchargeRate,
      expAfterTax: validatedExpAfter,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : estimate.notes
    }, { transaction: t });

    // Revert previously added stock for this estimate's items
    const existingItems = await PurchaseEstimateItem.findAll({ where: { purchaseEstimateId: estimate.id }, transaction: t });
    await revertInventoryForPurchaseEstimateItems(existingItems, estimate, t);

    // Replace items
    await PurchaseEstimateItem.destroy({ where: { purchaseEstimateId: estimate.id }, transaction: t });

    for (const item of calculatedItems) {
      await PurchaseEstimateItem.create({
        purchaseEstimateId: estimate.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        btls: item.btls,
        quantity: item.quantity,
        unit: item.unit,
        negotiatedRate: item.negotiatedRate,
        amount: item.amount
      }, { transaction: t });
    }

    // Add updated inventory stock
    await addInventoryForPurchaseEstimateItems(
      calculatedItems,
      estimate,
      req.user.userId,
      t,
      `Purchase estimate updated #${estimate.estimateNumber}`
    );

    await t.commit();

    const updatedEstimate = await PurchaseEstimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Purchase estimate ${estimate.estimateNumber} updated successfully`,
      estimate: updatedEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error while updating purchase estimate' });
  }
};

// POST /api/purchase-estimates/:id/generate - Lock & generate
exports.generatePurchaseEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const estimate = await PurchaseEstimate.findByPk(id, {
      include: [{ model: PurchaseEstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Purchase estimate not found' });
    }

    await verifyRecordOwnership(estimate, req.user);

    if (estimate.status !== 'DRAFT') {
      await t.rollback();
      return res.status(400).json({ error: `Purchase estimate is already ${estimate.status} and locked.` });
    }

    if (!estimate.items || estimate.items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Cannot generate a purchase estimate with zero product items.' });
    }

    await estimate.update({
      status: 'GENERATED',
      lockedAt: new Date(),
      lockedBy: req.user.userId
    }, { transaction: t });

    // Ensure inventory was added
    const existingMovement = await InventoryMovement.findOne({
      where: {
        referenceType: 'PURCHASE_ESTIMATE',
        referenceId: estimate.id
      },
      transaction: t
    });
    if (!existingMovement) {
      await addInventoryForPurchaseEstimateItems(
        estimate.items,
        estimate,
        req.user.userId,
        t,
        `Purchase estimate generated #${estimate.estimateNumber}`
      );
    }

    await t.commit();

    const finalizedEstimate = await PurchaseEstimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'locker', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Purchase estimate ${estimate.estimateNumber} generated and locked successfully`,
      estimate: finalizedEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error generating purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error while generating purchase estimate' });
  }
};

// POST /api/purchase-estimates/:id/override - Override locked purchase estimate
exports.overridePurchaseEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      reason,
      customerId,
      partyName,
      estimateDate,
      basic,
      items,
      others,
      notes
    } = req.body;

    const allowedOverrideRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN'];
    if (!allowedOverrideRoles.includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({
        error: 'Access denied. Only Super Admin, CEO, or Admin are authorized to override locked purchase estimates.'
      });
    }

    if (!reason || !reason.trim()) {
      await t.rollback();
      return res.status(400).json({
        error: 'An override reason is mandatory when modifying a locked purchase estimate.'
      });
    }

    const estimate = await PurchaseEstimate.findByPk(id, {
      include: [{ model: PurchaseEstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Purchase estimate not found' });
    }

    await verifyRecordOwnership(estimate, req.user);
    const targetOrgId = estimate.organizationId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'At least one product item row is required.' });
    }

    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      let productNameSnapshot = row.productNameSnapshot ? row.productNameSnapshot.trim() : '';
      let productCategorySnapshot = row.productCategorySnapshot || null;
      let productSizeSnapshot = row.productSizeSnapshot || null;
      let productSpecificationsSnapshot = row.productSpecificationsSnapshot || row.specifications || row.description || null;
      let unit = row.unit ? row.unit.trim() : 'Ton';

      if (row.productId) {
        const product = await Product.findOne({
          where: { id: row.productId, organizationId: targetOrgId },
          transaction: t
        });

        if (product) {
          if (!productNameSnapshot) {
            productNameSnapshot = product.name;
          }
          productCategorySnapshot = product.category || 'General';
          productSizeSnapshot = product.size || '-';
          if (!productSpecificationsSnapshot) {
            productSpecificationsSnapshot = product.specifications;
          }
          unit = product.unit || unit;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description is required on row ${i + 1}.` });
      }

      const qty = parseFloat(row.quantity);
      if (isNaN(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid quantity on row ${i + 1}. Must be greater than 0.` });
      }

      const rate = parseFloat(row.negotiatedRate || row.rate || 0);
      if (isNaN(rate) || rate < 0) {
        await t.rollback();
        return res.status(400).json({ error: `Invalid rate on row ${i + 1}. Must be 0 or greater.` });
      }

      preparedItems.push({
        productId: row.productId || null,
        productNameSnapshot,
        productCategorySnapshot,
        productSizeSnapshot,
        productSpecificationsSnapshot,
        btls: row.btls !== undefined && row.btls !== null ? String(row.btls).trim() : null,
        quantity: qty,
        unit,
        negotiatedRate: rate
      });
    }

    const {
      calculatedItems,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others);

    await estimate.update({
      customerId: customerId !== undefined ? customerId : estimate.customerId,
      partyName: partyName !== undefined ? partyName : estimate.partyName,
      estimateDate: estimateDate || estimate.estimateDate,
      basic: basic !== undefined ? (basic ? basic.trim() : null) : estimate.basic,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal,
      status: 'OVERRIDDEN',
      lastOverriddenBy: req.user.userId,
      lastOverriddenAt: new Date(),
      notes: notes !== undefined ? (notes ? notes.trim() : null) : estimate.notes
    }, { transaction: t });

    // Revert previously added inventory
    await revertInventoryForPurchaseEstimateItems(estimate.items, estimate, t);

    // Replace items
    await PurchaseEstimateItem.destroy({ where: { purchaseEstimateId: estimate.id }, transaction: t });

    for (const item of calculatedItems) {
      await PurchaseEstimateItem.create({
        purchaseEstimateId: estimate.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        btls: item.btls,
        quantity: item.quantity,
        unit: item.unit,
        negotiatedRate: item.negotiatedRate,
        amount: item.amount
      }, { transaction: t });
    }

    // Add new inventory quantities
    await addInventoryForPurchaseEstimateItems(
      calculatedItems,
      estimate,
      req.user.userId,
      t,
      `Purchase estimate overridden #${estimate.estimateNumber}`
    );

    await t.commit();

    const overriddenEstimate = await PurchaseEstimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Authorized override completed for purchase estimate ${estimate.estimateNumber}. Record is locked.`,
      estimate: overriddenEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error overriding purchase estimate:', error);
    res.status(500).json({ error: 'Internal server error while overriding purchase estimate' });
  }
};

// DELETE /api/purchase-estimates/:id
exports.deletePurchaseEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const estimate = await PurchaseEstimate.findByPk(id, {
      include: [{ model: PurchaseEstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Purchase estimate not found' });
    }

    try {
      await verifyRecordOwnership(estimate, req.user);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Revert inventory additions if any exist
    await revertInventoryForPurchaseEstimateItems(estimate.items || [], estimate, t);

    // Delete purchase estimate items and purchase estimate
    await PurchaseEstimateItem.destroy({ where: { purchaseEstimateId: estimate.id }, transaction: t });
    await estimate.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Purchase estimate deleted successfully' });
  } catch (error) {
    await t.rollback();
    console.error('Error deleting purchase estimate:', error);
    res.status(500).json({ error: 'Failed to delete purchase estimate' });
  }
};
