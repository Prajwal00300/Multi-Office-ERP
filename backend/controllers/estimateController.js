const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const User = require('../models/User');
const InventoryMovement = require('../models/InventoryMovement');
const SaleOrder = require('../models/SaleOrder');
const SaleOrderItem = require('../models/SaleOrderItem');
const SaleOrderAllocation = require('../models/SaleOrderAllocation');
const { ensureSaleOrderTablesExist } = require('./saleOrderController');
const { ensureCustomerForParty, ensureProductForOrderLine } = require('../utils/syncPurchaseMasterData');
const { calculateEstimateTotals } = require('../services/estimateCalculationService');
const { generateUniqueEstimateNumber } = require('../utils/estimateNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * Deducts stock from Product.currentStock and logs InventoryMovement OUT for estimate items
 */
async function deductInventoryForEstimateItems(items, estimate, userId, transaction, actionNote) {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    if (item.productId) {
      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (product && product.organizationId === estimate.organizationId) {
        const deductQty = parseFloat(item.quantity) || 0;
        if (deductQty > 0) {
          const currentStock = parseFloat(product.currentStock) || 0;
          const newStock = parseFloat((currentStock - deductQty).toFixed(3));
          await product.update({ currentStock: newStock }, { transaction });

          await InventoryMovement.create({
            organizationId: estimate.organizationId,
            productId: product.id,
            movementType: 'OUT',
            quantity: deductQty,
            referenceType: 'ESTIMATE',
            referenceId: estimate.id,
            referenceNumber: estimate.estimateNumber,
            notes: actionNote || `Sale estimate voucher #${estimate.estimateNumber}`,
            performedBy: userId
          }, { transaction });
        }
      }
    }
  }
}

/**
 * Reverts previously deducted stock from Product.currentStock and removes previous ESTIMATE InventoryMovements
 */
async function revertInventoryForEstimateItems(items, estimate, transaction) {
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
            const newStock = parseFloat((currentStock + revertQty).toFixed(3));
            await product.update({ currentStock: newStock }, { transaction });
          }
        }
      }
    }
  }
  await InventoryMovement.destroy({
    where: {
      referenceType: 'ESTIMATE',
      referenceId: estimate.id
    },
    transaction
  });
}

const normalizeMatchKey = (str) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');

const computeSaleOrderStatusFromItems = (items) => {
  if (!items || items.length === 0) return 'Pending';
  let hasAnyProcessed = false;
  let hasAnyPending = false;

  for (const item of items) {
    const ordered = parseFloat(item.quantity) || 0;
    const processed = parseFloat(item.processedQuantity) || 0;

    if (processed > 0.0001) hasAnyProcessed = true;
    if (ordered - processed > 0.0001) hasAnyPending = true;
  }

  if (!hasAnyProcessed) return 'Pending';
  if (hasAnyProcessed && hasAnyPending) return 'Partially Processed';
  return 'Fully Processed';
};

const soAllocationInclude = {
  model: SaleOrderAllocation,
  as: 'soAllocations',
  required: false,
  include: [
    {
      model: SaleOrder,
      attributes: ['id', 'orderNumber', 'orderDate', 'status']
    },
    {
      model: SaleOrderItem,
      attributes: ['id', 'productNameSnapshot', 'quantity', 'processedQuantity', 'unit']
    }
  ]
};

/**
 * Automatically allocates Sale Estimate Voucher item quantities against matching open
 * Sale Order lines (same office, matching customer, matching product) in FIFO order.
 * Updates SaleOrderItem.processedQuantity, SaleOrder.status, and creates SaleOrderAllocation.
 */
async function allocateEstimateToSaleOrders(createdEstimateItems, estimate, customerNameToMatch, transaction) {
  if (!createdEstimateItems || createdEstimateItems.length === 0) return;
  await ensureSaleOrderTablesExist();
  const targetKey = normalizeMatchKey(customerNameToMatch);
  if (!targetKey && !estimate.customerId) return;

  const officeOrders = await SaleOrder.findAll({
    where: {
      organizationId: estimate.organizationId,
      status: { [Op.ne]: 'CANCELLED' }
    },
    include: [
      {
        model: SaleOrderItem,
        as: 'items'
      }
    ],
    order: [
      ['orderDate', 'ASC'],
      ['id', 'ASC'],
      [{ model: SaleOrderItem, as: 'items' }, 'id', 'ASC']
    ],
    transaction
  });

  const matchingOrders = officeOrders.filter(so =>
    (estimate.customerId && so.customerId && Number(estimate.customerId) === Number(so.customerId)) ||
    (targetKey && normalizeMatchKey(so.customerName) === targetKey)
  );

  if (matchingOrders.length === 0) return;

  const affectedOrderIds = new Set();

  for (const estItem of createdEstimateItems) {
    let remainingToAllocate = parseFloat(estItem.quantity) || 0;
    if (remainingToAllocate <= 0) continue;

    const estProdId = estItem.productId ? Number(estItem.productId) : null;
    const estProdNameKey = normalizeMatchKey(estItem.productNameSnapshot);

    const matchingLines = [];
    for (const so of matchingOrders) {
      for (const soi of (so.items || [])) {
        const soiProdId = soi.productId ? Number(soi.productId) : null;
        const soiProdNameKey = normalizeMatchKey(soi.productNameSnapshot);
        const matchesProduct =
          (estProdId && soiProdId && estProdId === soiProdId) ||
          (estProdNameKey && soiProdNameKey && estProdNameKey === soiProdNameKey);

        if (matchesProduct) {
          matchingLines.push({ so, soi });
        }
      }
    }

    if (matchingLines.length === 0) continue;

    for (const entry of matchingLines) {
      if (remainingToAllocate <= 0.0001) break;
      const { so, soi } = entry;

      const orderedQty = parseFloat(soi.quantity) || 0;
      const currentProcessed = parseFloat(soi.processedQuantity) || 0;
      const pendingQty = Math.max(0, parseFloat((orderedQty - currentProcessed).toFixed(3)));

      if (pendingQty <= 0.0001) continue;

      const allocQty = Math.min(remainingToAllocate, pendingQty);
      remainingToAllocate = parseFloat((remainingToAllocate - allocQty).toFixed(3));
      const newProcessed = parseFloat((currentProcessed + allocQty).toFixed(3));

      await soi.update({ processedQuantity: newProcessed }, { transaction });
      soi.processedQuantity = newProcessed;

      await SaleOrderAllocation.create({
        organizationId: estimate.organizationId,
        estimateId: estimate.id,
        estimateItemId: estItem.id,
        saleOrderId: so.id,
        saleOrderItemId: soi.id,
        allocatedQuantity: allocQty
      }, { transaction });

      affectedOrderIds.add(so.id);
    }
  }

  for (const orderId of affectedOrderIds) {
    const freshItems = await SaleOrderItem.findAll({
      where: { saleOrderId: orderId },
      transaction
    });
    const newStatus = computeSaleOrderStatusFromItems(freshItems);
    await SaleOrder.update(
      { status: newStatus },
      { where: { id: orderId }, transaction }
    );
  }
}

/**
 * Reverts all SaleOrderAllocations previously created by a Sale Estimate Voucher.
 */
async function revertEstimateSaleOrderAllocations(estimateId, transaction) {
  await ensureSaleOrderTablesExist();
  const allocations = await SaleOrderAllocation.findAll({
    where: { estimateId },
    transaction
  });

  if (!allocations || allocations.length === 0) return;

  const affectedOrderIds = new Set();

  for (const alloc of allocations) {
    const soi = await SaleOrderItem.findByPk(alloc.saleOrderItemId, { transaction });
    if (soi) {
      const currentProcessed = parseFloat(soi.processedQuantity) || 0;
      const allocQty = parseFloat(alloc.allocatedQuantity) || 0;
      const newProcessed = Math.max(0, parseFloat((currentProcessed - allocQty).toFixed(3)));
      await soi.update({ processedQuantity: newProcessed }, { transaction });
    }
    affectedOrderIds.add(alloc.saleOrderId);
  }

  await SaleOrderAllocation.destroy({
    where: { estimateId },
    transaction
  });

  for (const orderId of affectedOrderIds) {
    const freshItems = await SaleOrderItem.findAll({
      where: { saleOrderId: orderId },
      transaction
    });
    const newStatus = computeSaleOrderStatusFromItems(freshItems);
    await SaleOrder.update(
      { status: newStatus },
      { where: { id: orderId }, transaction }
    );
  }
}

// GET /api/estimates - List estimates with filters
exports.getEstimates = async (req, res) => {
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

    // Status filter
    if (status && status.trim() !== '' && status !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    // Date range filter
    if (startDate && endDate) {
      whereClause.estimateDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.estimateDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.estimateDate = {
        [Op.lte]: endDate
      };
    }

    // Search query on estimateNumber or Customer name
    const customerWhere = {};
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { estimateNumber: { [Op.like]: searchTerm } },
        { basic: { [Op.like]: searchTerm } },
        { '$Customer.name$': { [Op.like]: searchTerm } }
      ];
    }

    const estimates = await Estimate.findAll({
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: EstimateItem,
          as: 'items'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(estimates);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching estimates:', error);
    res.status(500).json({ error: 'Internal server error while fetching estimates' });
  }
};

// GET /api/estimates/:id - Get estimate details
exports.getEstimateById = async (req, res) => {
  try {
    const { id } = req.params;

    const estimate = await Estimate.findByPk(id, {
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'locker',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: EstimateItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
        },
        soAllocationInclude
      ]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Ownership check
    await verifyRecordOwnership(estimate, req.user);

    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching estimate details:', error);
    res.status(500).json({ error: 'Internal server error while fetching estimate details' });
  }
};

/**
 * GET /api/estimates/navigation/previous - Retrieve immediately preceding estimate within authorized office
 * Query params: currentId (optional), organizationId (optional)
 */
exports.getPreviousEstimate = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId) {
      whereClause.id = { [Op.lt]: parseInt(currentId, 10) };
    }

    const estimate = await Estimate.findOne({
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'locker',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
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
      ],
      order: [['id', 'DESC']]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'No previous estimate found for this office' });
    }

    await verifyRecordOwnership(estimate, req.user);

    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching previous estimate:', error);
    res.status(500).json({ error: 'Internal server error while fetching previous estimate' });
  }
};

/**
 * GET /api/estimates/navigation/next - Retrieve immediately following estimate within authorized office
 * Query params: currentId (optional), organizationId (optional)
 */
exports.getNextEstimate = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId) {
      whereClause.id = { [Op.gt]: parseInt(currentId, 10) };
    }

    const estimate = await Estimate.findOne({
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'locker',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
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
      ],
      order: [['id', 'ASC']]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'No subsequent estimate found for this office' });
    }

    await verifyRecordOwnership(estimate, req.user);

    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching next estimate:', error);
    res.status(500).json({ error: 'Internal server error while fetching next estimate' });
  }
};

/**
 * GET /api/estimates/navigation/first - Retrieve the very first estimate for this office
 */
exports.getFirstEstimate = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    const estimate = await Estimate.findOne({
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
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
      ],
      order: [['id', 'ASC']]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'No estimates found for this office' });
    }

    await verifyRecordOwnership(estimate, req.user);
    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching first estimate:', error);
    res.status(500).json({ error: 'Internal server error while fetching first estimate' });
  }
};

/**
 * GET /api/estimates/navigation/last - Retrieve the latest/last estimate for this office
 */
exports.getLastEstimate = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    const estimate = await Estimate.findOne({
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
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
      ],
      order: [['id', 'DESC']]
    });

    if (!estimate) {
      return res.status(404).json({ error: 'No estimates found for this office' });
    }

    await verifyRecordOwnership(estimate, req.user);
    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching last estimate:', error);
    res.status(500).json({ error: 'Internal server error while fetching last estimate' });
  }
};

// GET /api/estimates/by-number/:estimateNumber - Lookup for future Gate Pass integration
exports.getEstimateByNumber = async (req, res) => {
  try {
    const { estimateNumber } = req.params;

    const estimate = await Estimate.findOne({
      where: { estimateNumber: estimateNumber.trim() },
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
          model: EstimateItem,
          as: 'items'
        }
      ]
    });

    if (!estimate) {
      return res.status(404).json({ error: `Estimate '${estimateNumber}' not found` });
    }

    // Ownership check
    await verifyRecordOwnership(estimate, req.user);

    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error looking up estimate by number:', error);
    res.status(500).json({ error: 'Internal server error while looking up estimate' });
  }
};

/**
 * GET /api/estimates/next-number - Retrieve next upcoming estimate number preview scoped to office
 */
exports.getNextEstimateNumber = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const effectiveOrgId = (targetOfficeIds && targetOfficeIds.length > 0) ? targetOfficeIds[0] : req.user.organizationId;
    const nextEstimateNumber = await generateUniqueEstimateNumber(effectiveOrgId);
    res.status(200).json({ nextEstimateNumber });
  } catch (error) {
    console.error('Error generating next estimate number preview:', error);
    res.status(500).json({ error: 'Failed to generate next estimate number preview' });
  }
};


// POST /api/estimates - Create draft or generated estimate
exports.createEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      customerId,
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
      tds,
      tcs,
      items,
      others,
      notes,
      status // 'DRAFT' or 'GENERATED'
    } = req.body;

    // 1. Resolve Office ID securely
    let targetOrgId;
    try {
      targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 400).json({ error: scopeErr.message });
    }

    // 2. Validate Customer exists and belongs to target organization
    let customer = null;
    let resolvedCustomerId = customerId && !String(customerId).startsWith('party:') && !isNaN(Number(customerId))
      ? parseInt(customerId, 10)
      : null;

    if (resolvedCustomerId) {
      customer = await Customer.findOne({
        where: { id: resolvedCustomerId, organizationId: targetOrgId },
        transaction: t
      });
    }

    if (!customer) {
      const nameCandidate = req.body.customerName || req.body.partyName || (customerId && String(customerId).startsWith('party:') ? String(customerId).slice(6) : '');
      if (nameCandidate && nameCandidate.trim()) {
        try {
          customer = await ensureCustomerForParty(targetOrgId, nameCandidate.trim(), t);
          if (customer) {
            resolvedCustomerId = customer.id;
          }
        } catch (custSyncErr) {
          console.warn('Could not auto-sync customer in createEstimate:', custSyncErr.message);
        }
      }
    }

    if (!customer) {
      await t.rollback();
      return res.status(400).json({ error: 'Customer is required and must exist in the designated organization.' });
    }

    // 3. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'At least one product item row is required.' });
    }

    // Validate and snapshot product details
    const preparedItems = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      let productNameSnapshot = row.productNameSnapshot ? row.productNameSnapshot.trim() : '';
      let productCategorySnapshot = row.productCategorySnapshot || null;
      let productSizeSnapshot = row.productSizeSnapshot || null;
      let productSpecificationsSnapshot = row.productSpecificationsSnapshot || row.specifications || row.description || null;
      let unit = row.unit ? row.unit.trim() : 'Kg';

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
      } else if (productNameSnapshot) {
        const prodMatch = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [
              sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())
            ]
          },
          transaction: t
        });
        if (prodMatch) {
          row.productId = prodMatch.id;
          productCategorySnapshot = prodMatch.category || productCategorySnapshot;
          productSizeSnapshot = prodMatch.size || productSizeSnapshot;
          productSpecificationsSnapshot = prodMatch.specifications || productSpecificationsSnapshot;
          unit = prodMatch.unit || unit;
        } else {
          try {
            const syncedProduct = await ensureProductForOrderLine(
              targetOrgId,
              { name: productNameSnapshot, unit, specifications: productSpecificationsSnapshot },
              t
            );
            if (syncedProduct) {
              row.productId = syncedProduct.id;
            }
          } catch (syncErr) {
            console.warn('Could not auto-sync product in createEstimate:', syncErr.message);
          }
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

    // 4. Calculate authoritative totals via calculation service
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

    // 5. Generate persistent unique estimate number scoped to this office
    const estimateNumber = await generateUniqueEstimateNumber(targetOrgId, t);

    const isGenerated = status === 'GENERATED';

    // 6. Create Estimate
    const newEstimate = await Estimate.create({
      estimateNumber,
      organizationId: targetOrgId,
      customerId: resolvedCustomerId,
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
      tds: parseFloat(tds) || 0,
      tcs: parseFloat(tcs) || 0,
      grandTotal,
      status: isGenerated ? 'GENERATED' : 'DRAFT',
      createdBy: req.user.userId,
      lockedAt: isGenerated ? new Date() : null,
      lockedBy: isGenerated ? req.user.userId : null,
      notes: notes ? notes.trim() : null
    }, { transaction: t });

    // 7. Create Estimate Items
    for (const item of calculatedItems) {
      await EstimateItem.create({
        estimateId: newEstimate.id,
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

    // 8. Deduct inventory stock for estimate items
    await deductInventoryForEstimateItems(
      calculatedItems,
      newEstimate,
      req.user.userId,
      t,
      `Sale estimate created #${newEstimate.estimateNumber}`
    );

    // 9. Allocate against open Sale Orders for this customer
    const createdEstimateItems = await EstimateItem.findAll({
      where: { estimateId: newEstimate.id },
      transaction: t
    });
    await allocateEstimateToSaleOrders(createdEstimateItems, newEstimate, customer.name, t);

    await t.commit();

    // Fetch complete estimate to return
    const completeEstimate = await Estimate.findByPk(newEstimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: EstimateItem, as: 'items' }
      ]
    });

    res.status(201).json({
      message: `Estimate ${estimateNumber} created successfully (${isGenerated ? 'Generated & Locked' : 'Draft'})`,
      estimate: completeEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating estimate:', error);
    res.status(500).json({ error: 'Internal server error while creating estimate' });
  }
};

// PUT /api/estimates/:id - Update draft estimate
exports.updateEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      customerId,
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
      tds,
      tcs,
      items,
      others,
      notes
    } = req.body;

    const estimate = await Estimate.findByPk(id, { transaction: t });
    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(estimate, req.user);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const targetOrgId = estimate.organizationId;

    // Validate Customer if changed
    if (customerId && customerId !== estimate.customerId) {
      const customer = await Customer.findOne({
        where: { id: customerId, organizationId: targetOrgId },
        transaction: t
      });
      if (!customer) {
        await t.rollback();
        return res.status(400).json({ error: 'Selected customer not found in this organization.' });
      }
    }

    // Validate items
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
      let unit = row.unit ? row.unit.trim() : 'Kg';

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
      } else if (productNameSnapshot) {
        const prodMatch = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [
              sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())
            ]
          },
          transaction: t
        });
        if (prodMatch) {
          row.productId = prodMatch.id;
          productCategorySnapshot = prodMatch.category || productCategorySnapshot;
          productSizeSnapshot = prodMatch.size || productSizeSnapshot;
          productSpecificationsSnapshot = prodMatch.specifications || productSpecificationsSnapshot;
          unit = prodMatch.unit || unit;
        } else {
          try {
            const syncedProduct = await ensureProductForOrderLine(
              targetOrgId,
              { name: productNameSnapshot, unit, specifications: productSpecificationsSnapshot },
              t
            );
            if (syncedProduct) {
              row.productId = syncedProduct.id;
            }
          } catch (syncErr) {
            console.warn('Could not auto-sync product in createEstimate:', syncErr.message);
          }
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

    // Authoritative calculations
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
      expBeforeTax: expBeforeTax !== undefined ? expBeforeTax : estimate.expBeforeTax,
      taxRate: taxRate !== undefined ? taxRate : estimate.taxRate,
      surchargeRate: surchargeRate !== undefined ? surchargeRate : estimate.surchargeRate,
      expAfterTax: expAfterTax !== undefined ? expAfterTax : estimate.expAfterTax
    });

    // Update Estimate
    await estimate.update({
      customerId: customerId || estimate.customerId,
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
      tds: tds !== undefined ? (parseFloat(tds) || 0) : estimate.tds,
      tcs: tcs !== undefined ? (parseFloat(tcs) || 0) : estimate.tcs,
      grandTotal,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : estimate.notes
    }, { transaction: t });

    // Revert previously deducted stock and sale order allocations for this estimate's existing items
    await revertEstimateSaleOrderAllocations(estimate.id, t);
    const existingItems = await EstimateItem.findAll({ where: { estimateId: estimate.id }, transaction: t });
    await revertInventoryForEstimateItems(existingItems, estimate, t);

    // Replace items
    await EstimateItem.destroy({ where: { estimateId: estimate.id }, transaction: t });

    for (const item of calculatedItems) {
      await EstimateItem.create({
        estimateId: estimate.id,
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

    // Deduct inventory stock for updated estimate items
    await deductInventoryForEstimateItems(
      calculatedItems,
      estimate,
      req.user.userId,
      t,
      `Sale estimate updated #${estimate.estimateNumber}`
    );

    // Re-allocate against open Sale Orders for this customer
    const updatedEstimateItems = await EstimateItem.findAll({
      where: { estimateId: estimate.id },
      transaction: t
    });
    const estCustomer = await Customer.findByPk(estimate.customerId, { transaction: t });
    await allocateEstimateToSaleOrders(updatedEstimateItems, estimate, estCustomer?.name, t);

    await t.commit();

    const updatedEstimate = await Estimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: EstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Draft estimate ${estimate.estimateNumber} updated successfully`,
      estimate: updatedEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating estimate:', error);
    res.status(500).json({ error: 'Internal server error while updating estimate' });
  }
};

// POST /api/estimates/:id/generate - Lock & generate estimate
exports.generateEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const estimate = await Estimate.findByPk(id, {
      include: [{ model: EstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(estimate, req.user);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    if (estimate.status !== 'DRAFT') {
      await t.rollback();
      return res.status(400).json({ error: `Estimate is already ${estimate.status} and locked.` });
    }

    if (!estimate.items || estimate.items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Cannot generate an estimate with zero product items.' });
    }

    await estimate.update({
      status: 'GENERATED',
      lockedAt: new Date(),
      lockedBy: req.user.userId
    }, { transaction: t });

    // Ensure inventory stock is deducted if not already deducted
    const existingMovement = await InventoryMovement.findOne({
      where: {
        referenceType: 'ESTIMATE',
        referenceId: estimate.id
      },
      transaction: t
    });
    if (!existingMovement) {
      await deductInventoryForEstimateItems(
        estimate.items,
        estimate,
        req.user.userId,
        t,
        `Sale estimate generated #${estimate.estimateNumber}`
      );
    }

    await t.commit();

    const finalizedEstimate = await Estimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'locker', attributes: ['id', 'username'] },
        { model: EstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Estimate ${estimate.estimateNumber} generated and locked successfully`,
      estimate: finalizedEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error generating estimate:', error);
    res.status(500).json({ error: 'Internal server error while generating estimate' });
  }
};

// POST /api/estimates/:id/override - Authorized override for CEO/Admin or Super Admin
exports.overrideEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      reason,
      customerId,
      estimateDate,
      basic,
      items,
      others,
      notes
    } = req.body;

    // MANDATORY ROLE CHECK: Only SUPER_ADMIN, CEO, and ADMIN can override
    const allowedOverrideRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN'];
    if (!allowedOverrideRoles.includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({
        error: 'Access denied. Only Super Admin, CEO, or Admin are authorized to override locked estimates.'
      });
    }

    // MANDATORY REASON CHECK
    if (!reason || !reason.trim()) {
      await t.rollback();
      return res.status(400).json({
        error: 'An override reason is mandatory when modifying a locked estimate.'
      });
    }

    const estimate = await Estimate.findByPk(id, {
      include: [{ model: EstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(estimate, req.user);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const targetOrgId = estimate.organizationId;

    // Snapshot PREVIOUS values for audit trail
    const previousValuesSnapshot = {
      customerId: estimate.customerId,
      estimateDate: estimate.estimateDate,
      basic: estimate.basic,
      totalQuantity: estimate.totalQuantity,
      total: estimate.total,
      others: estimate.others,
      grandTotal: estimate.grandTotal,
      status: estimate.status,
      items: estimate.items.map(it => ({
        productName: it.productNameSnapshot,
        btls: it.btls,
        quantity: it.quantity,
        unit: it.unit,
        negotiatedRate: it.negotiatedRate,
        amount: it.amount
      }))
    };

    // Validate Customer if changed
    if (customerId && customerId !== estimate.customerId) {
      const customer = await Customer.findOne({
        where: { id: customerId, organizationId: targetOrgId },
        transaction: t
      });
      if (!customer) {
        await t.rollback();
        return res.status(400).json({ error: 'Selected customer not found in this organization.' });
      }
    }

    // Validate new items
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
      let unit = row.unit ? row.unit.trim() : 'Kg';

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
      } else if (productNameSnapshot) {
        const prodMatch = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [
              sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())
            ]
          },
          transaction: t
        });
        if (prodMatch) {
          row.productId = prodMatch.id;
          productCategorySnapshot = prodMatch.category || productCategorySnapshot;
          productSizeSnapshot = prodMatch.size || productSizeSnapshot;
          productSpecificationsSnapshot = prodMatch.specifications || productSpecificationsSnapshot;
          unit = prodMatch.unit || unit;
        } else {
          try {
            const syncedProduct = await ensureProductForOrderLine(
              targetOrgId,
              { name: productNameSnapshot, unit, specifications: productSpecificationsSnapshot },
              t
            );
            if (syncedProduct) {
              row.productId = syncedProduct.id;
            }
          } catch (syncErr) {
            console.warn('Could not auto-sync product in createEstimate:', syncErr.message);
          }
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

    // Authoritative recalculation of financial values
    const {
      calculatedItems,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others);

    // Update Estimate - retains estimateNumber, remains LOCKED under 'OVERRIDDEN'
    await estimate.update({
      customerId: customerId || estimate.customerId,
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

    // Revert previously deducted stock for this estimate's existing items
    await revertEstimateSaleOrderAllocations(estimate.id, t);
    await revertInventoryForEstimateItems(estimate.items, estimate, t);

    // Replace items
    await EstimateItem.destroy({ where: { estimateId: estimate.id }, transaction: t });

    for (const item of calculatedItems) {
      await EstimateItem.create({
        estimateId: estimate.id,
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

    // Deduct stock for the new overridden items
    await deductInventoryForEstimateItems(
      calculatedItems,
      estimate,
      req.user.userId,
      t,
      `Sale estimate overridden #${estimate.estimateNumber}`
    );

    // Re-allocate against open Sale Orders for this customer
    const freshEstimateItems = await EstimateItem.findAll({
      where: { estimateId: estimate.id },
      transaction: t
    });
    const estCustomer = await Customer.findByPk(estimate.customerId, { transaction: t });
    await allocateEstimateToSaleOrders(freshEstimateItems, estimate, estCustomer?.name, t);

    const newValuesSnapshot = {
      customerId: estimate.customerId,
      estimateDate: estimate.estimateDate,
      basic: estimate.basic,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal,
      status: 'OVERRIDDEN',
      itemsCount: calculatedItems.length,
      overriddenBy: req.user.userId
    };

    await t.commit();

    const overriddenEstimate = await Estimate.findByPk(estimate.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'] },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { model: EstimateItem, as: 'items' }
      ]
    });

    res.status(200).json({
      message: `Authorized override completed for estimate ${estimate.estimateNumber}. Record is locked.`,
      estimate: overriddenEstimate
    });
  } catch (error) {
    await t.rollback();
    console.error('Error overriding estimate:', error);
    res.status(500).json({ error: 'Internal server error while overriding estimate' });
  }
};

// DELETE /api/estimates/:id
exports.deleteEstimate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const estimate = await Estimate.findByPk(id, {
      include: [{ model: EstimateItem, as: 'items' }],
      transaction: t
    });

    if (!estimate) {
      await t.rollback();
      return res.status(404).json({ error: 'Estimate not found' });
    }

    try {
      await verifyRecordOwnership(estimate, req.user);
    } catch (scopeErr) {
      await t.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Revert inventory deductions and sale order allocations if any exist
    await revertEstimateSaleOrderAllocations(estimate.id, t);
    await revertInventoryForEstimateItems(estimate.items || [], estimate, t);

    // Delete estimate items and estimate
    await EstimateItem.destroy({ where: { estimateId: estimate.id }, transaction: t });
    await estimate.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Estimate deleted successfully' });
  } catch (error) {
    await t.rollback();
    console.error('Error deleting estimate:', error);
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
};
