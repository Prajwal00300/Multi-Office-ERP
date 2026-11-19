const { Op } = require('sequelize');
const sequelize = require('../config/database');
const PurchaseEstimate = require('../models/PurchaseEstimate');
const PurchaseEstimateItem = require('../models/PurchaseEstimateItem');
const PurchaseEstimateAllocation = require('../models/PurchaseEstimateAllocation');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
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

const normalizeMatchKey = (str) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');

const poAllocationInclude = {
  model: PurchaseEstimateAllocation,
  as: 'poAllocations',
  required: false,
  include: [
    {
      model: Purchase,
      as: 'purchase',
      attributes: ['id', 'purchaseNumber', 'purchaseDate', 'vendorName', 'status']
    },
    {
      model: PurchaseItem,
      as: 'purchaseItem',
      attributes: ['id', 'productId', 'productNameSnapshot', 'quantity', 'receivedQuantity', 'unit']
    }
  ]
};

function computePurchaseOrderStatus(items) {
  if (!items || items.length === 0) return 'Pending';
  let allFullyReceived = true;
  let anyReceived = false;

  for (const item of items) {
    const ordered = parseFloat(item.quantity) || 0;
    const received = parseFloat(item.receivedQuantity) || 0;
    if (received > 0.0001) {
      anyReceived = true;
    }
    if (received < ordered - 0.0005) {
      allFullyReceived = false;
    }
  }

  if (allFullyReceived && anyReceived) return 'Fully Received';
  if (anyReceived) return 'Partially Received';
  return 'Pending';
}

/**
 * Automatically allocates Purchase Estimate Voucher item quantities against matching open
 * Purchase Order lines (same office, matching party/vendor name, matching product) in FIFO order.
 * Updates PurchaseItem.receivedQuantity, Purchase.status, PurchaseEstimateAllocation, and item snapshots.
 */
async function allocatePurchaseEstimateToOrders(createdEstimateItems, estimate, partyNameToMatch, transaction) {
  if (!createdEstimateItems || createdEstimateItems.length === 0) return;
  const targetPartyKey = normalizeMatchKey(partyNameToMatch);
  if (!targetPartyKey) return;

  // Fetch all non-cancelled POs in the same office ordered FIFO (oldest first)
  const officePurchases = await Purchase.findAll({
    where: {
      organizationId: estimate.organizationId,
      status: { [Op.ne]: 'CANCELLED' }
    },
    include: [
      {
        model: PurchaseItem,
        as: 'items'
      }
    ],
    order: [
      ['purchaseDate', 'ASC'],
      ['id', 'ASC'],
      [{ model: PurchaseItem, as: 'items' }, 'id', 'ASC']
    ],
    transaction
  });

  // Filter to POs whose vendorName matches the selected customer/party
  const matchingPurchases = officePurchases.filter(po => normalizeMatchKey(po.vendorName) === targetPartyKey);
  if (matchingPurchases.length === 0) return;

  const affectedPurchaseIds = new Set();

  for (const estItem of createdEstimateItems) {
    let remainingToAllocate = parseFloat(estItem.quantity) || 0;
    if (remainingToAllocate <= 0) continue;

    const estProdId = estItem.productId ? Number(estItem.productId) : null;
    const estProdNameKey = normalizeMatchKey(estItem.productNameSnapshot);

    // Collect all matching PO lines across matching POs for this product
    const matchingLines = [];
    for (const po of matchingPurchases) {
      for (const pi of (po.items || [])) {
        const piProdId = pi.productId ? Number(pi.productId) : null;
        const piProdNameKey = normalizeMatchKey(pi.productNameSnapshot);
        const matchesProduct =
          (estProdId && piProdId && estProdId === piProdId) ||
          (estProdNameKey && piProdNameKey && estProdNameKey === piProdNameKey);

        if (matchesProduct) {
          matchingLines.push({ po, pi });
        }
      }
    }

    if (matchingLines.length === 0) continue;

    let firstAllocatedPurchaseId = null;
    let firstAllocatedPurchaseItemId = null;
    const touchedLines = [];

    for (const entry of matchingLines) {
      if (remainingToAllocate <= 0.0001) break;
      const { po, pi } = entry;

      const ordered = parseFloat(pi.quantity) || 0;
      const currentReceived = parseFloat(pi.receivedQuantity) || 0;
      const pending = Math.max(0, parseFloat((ordered - currentReceived).toFixed(3)));
      if (pending <= 0.0001) continue;

      const allocQty = parseFloat(Math.min(remainingToAllocate, pending).toFixed(3));
      const newReceived = parseFloat((currentReceived + allocQty).toFixed(3));

      await pi.update({ receivedQuantity: newReceived }, { transaction });
      pi.receivedQuantity = newReceived; // Keep in-memory state synced for subsequent rows

      await PurchaseEstimateAllocation.create({
        organizationId: estimate.organizationId,
        purchaseEstimateId: estimate.id,
        purchaseEstimateItemId: estItem.id,
        purchaseId: po.id,
        purchaseItemId: pi.id,
        allocatedQuantity: allocQty
      }, { transaction });

      if (!firstAllocatedPurchaseId) {
        firstAllocatedPurchaseId = po.id;
        firstAllocatedPurchaseItemId = pi.id;
      }
      touchedLines.push(pi);
      affectedPurchaseIds.add(po.id);
      remainingToAllocate = parseFloat((remainingToAllocate - allocQty).toFixed(3));
    }

    if (touchedLines.length > 0) {
      // Snapshot ordered / received / pending across the open/touched PO lines for this product
      const openOrTouched = matchingLines
        .map(m => m.pi)
        .filter(pi => touchedLines.includes(pi) || (parseFloat(pi.quantity) || 0) - (parseFloat(pi.receivedQuantity) || 0) > 0.0001);

      const snapOrdered = parseFloat(openOrTouched.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0).toFixed(3));
      const snapReceived = parseFloat(openOrTouched.reduce((s, l) => s + (parseFloat(l.receivedQuantity) || 0), 0).toFixed(3));
      const snapPending = Math.max(0, parseFloat((snapOrdered - snapReceived).toFixed(3)));

      await estItem.update({
        purchaseId: firstAllocatedPurchaseId,
        purchaseItemId: firstAllocatedPurchaseItemId,
        orderedQuantity: snapOrdered,
        receivedQuantityAfter: snapReceived,
        pendingQuantityAfter: snapPending
      }, { transaction });
    }
  }

  // Recalculate status for all affected Purchase Orders
  for (const purchaseId of affectedPurchaseIds) {
    const allLines = await PurchaseItem.findAll({
      where: { purchaseId },
      transaction
    });
    const newStatus = computePurchaseOrderStatus(allLines);
    await Purchase.update({ status: newStatus }, { where: { id: purchaseId }, transaction });
  }
}

/**
 * Reverts all PO quantity allocations previously created by a Purchase Estimate Voucher
 * and recalculates parent Purchase Order statuses.
 */
async function revertPurchaseEstimateOrderAllocations(estimateId, transaction) {
  const allocations = await PurchaseEstimateAllocation.findAll({
    where: { purchaseEstimateId: estimateId },
    transaction
  });

  if (!allocations || allocations.length === 0) return;

  const affectedPurchaseIds = new Set();

  for (const alloc of allocations) {
    const pi = await PurchaseItem.findByPk(alloc.purchaseItemId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (pi) {
      const currentReceived = parseFloat(pi.receivedQuantity) || 0;
      const revertQty = parseFloat(alloc.allocatedQuantity) || 0;
      const newReceived = Math.max(0, parseFloat((currentReceived - revertQty).toFixed(3)));
      await pi.update({ receivedQuantity: newReceived }, { transaction });
    }
    affectedPurchaseIds.add(alloc.purchaseId);
  }

  await PurchaseEstimateAllocation.destroy({
    where: { purchaseEstimateId: estimateId },
    transaction
  });

  for (const purchaseId of affectedPurchaseIds) {
    const po = await Purchase.findByPk(purchaseId, { transaction });
    if (po && po.status !== 'CANCELLED') {
      const allLines = await PurchaseItem.findAll({
        where: { purchaseId },
        transaction
      });
      const newStatus = computePurchaseOrderStatus(allLines);
      await po.update({ status: newStatus }, { transaction });
    }
  }
}

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

let tablesVerified = false;
async function ensurePurchaseEstimateTablesExist() {
  if (tablesVerified) return;
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS purchase_estimates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estimateNumber VARCHAR(255) NOT NULL,
        organizationId INT NOT NULL,
        customerId INT NULL,
        partyName VARCHAR(255) NULL,
        estimateDate DATE NOT NULL,
        basic VARCHAR(255) NULL,
        terms VARCHAR(255) NULL,
        vehicle VARCHAR(255) NULL,
        transport VARCHAR(255) NULL,
        broker VARCHAR(255) NULL,
        dueDate DATE NULL,
        shortageQty DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        shortageAmt DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        expBeforeTax DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        taxRate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        taxAmount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        surchargeRate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        expAfterTax DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        totalQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        others DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        grandTotal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        status ENUM('DRAFT', 'GENERATED', 'OVERRIDDEN') NOT NULL DEFAULT 'DRAFT',
        createdBy INT NOT NULL,
        lockedAt DATETIME NULL,
        lockedBy INT NULL,
        lastOverriddenBy INT NULL,
        lastOverriddenAt DATETIME NULL,
        notes TEXT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_pe_orgId (organizationId),
        INDEX idx_pe_num (estimateNumber),
        INDEX idx_pe_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS purchase_estimate_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchaseEstimateId INT NOT NULL,
        productId INT NULL,
        productNameSnapshot VARCHAR(255) NOT NULL,
        productCategorySnapshot VARCHAR(255) NULL,
        productSizeSnapshot VARCHAR(255) NULL,
        productSpecificationsSnapshot TEXT NULL,
        btls VARCHAR(50) NULL,
        quantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        unit VARCHAR(50) NOT NULL DEFAULT 'Ton',
        negotiatedRate DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        purchaseId INT NULL,
        purchaseItemId INT NULL,
        orderedQuantity DECIMAL(15, 3) NULL,
        receivedQuantityAfter DECIMAL(15, 3) NULL,
        pendingQuantityAfter DECIMAL(15, 3) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_pei_estId (purchaseEstimateId),
        INDEX idx_pei_productId (productId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [peiCols] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_estimate_items'
    `);
    const peiColNames = peiCols.map(c => (c.COLUMN_NAME || c.column_name || '').toLowerCase());
    const peiNewCols = [
      { name: 'purchaseid', sql: 'ADD COLUMN purchaseId INT NULL' },
      { name: 'purchaseitemid', sql: 'ADD COLUMN purchaseItemId INT NULL' },
      { name: 'orderedquantity', sql: 'ADD COLUMN orderedQuantity DECIMAL(15, 3) NULL' },
      { name: 'receivedquantityafter', sql: 'ADD COLUMN receivedQuantityAfter DECIMAL(15, 3) NULL' },
      { name: 'pendingquantityafter', sql: 'ADD COLUMN pendingQuantityAfter DECIMAL(15, 3) NULL' }
    ];
    for (const col of peiNewCols) {
      if (!peiColNames.includes(col.name)) {
        await sequelize.query(`ALTER TABLE purchase_estimate_items ${col.sql}`);
      }
    }

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS purchase_estimate_po_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organizationId INT NOT NULL,
        purchaseEstimateId INT NOT NULL,
        purchaseEstimateItemId INT NOT NULL,
        purchaseId INT NOT NULL,
        purchaseItemId INT NOT NULL,
        allocatedQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_pepa_orgId (organizationId),
        INDEX idx_pepa_estId (purchaseEstimateId),
        INDEX idx_pepa_estItemId (purchaseEstimateItemId),
        INDEX idx_pepa_purId (purchaseId),
        INDEX idx_pepa_purItemId (purchaseItemId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesVerified = true;
  } catch (err) {
    console.warn('ensurePurchaseEstimateTablesExist notice:', err.message);
  }
}

// GET /api/purchase-estimates - List purchase estimates with filters
exports.getPurchaseEstimates = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
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
    await ensurePurchaseEstimateTablesExist();
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
        },
        poAllocationInclude
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
    console.error('Error fetching purchase estimate by ID:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase estimate' });
  }
};

// GET /api/purchase-estimates/navigation/previous
exports.getPreviousPurchaseEstimate = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.lt]: parseInt(currentId, 10) };
    }

    const prevEstimate = await PurchaseEstimate.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
      ],
      order: [['id', 'DESC']]
    });

    if (!prevEstimate) return res.status(404).json({ error: 'No previous purchase estimate found' });
    res.status(200).json(prevEstimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching previous purchase estimate:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/next
exports.getNextPurchaseEstimate = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.gt]: parseInt(currentId, 10) };
    }

    const nextEstimate = await PurchaseEstimate.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
      ],
      order: [['id', 'ASC']]
    });

    if (!nextEstimate) return res.status(404).json({ error: 'No next purchase estimate found' });
    res.status(200).json(nextEstimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching next purchase estimate:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/first
exports.getFirstPurchaseEstimate = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const firstEstimate = await PurchaseEstimate.findOne({
      where: officeWhere,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
      ],
      order: [['id', 'ASC']]
    });

    if (!firstEstimate) return res.status(404).json({ error: 'No purchase estimates found' });
    res.status(200).json(firstEstimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching first purchase estimate:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/navigation/last
exports.getLastPurchaseEstimate = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    const lastEstimate = await PurchaseEstimate.findOne({
      where: officeWhere,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
      ],
      order: [['id', 'DESC']]
    });

    if (!lastEstimate) return res.status(404).json({ error: 'No purchase estimates found' });
    res.status(200).json(lastEstimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching last purchase estimate:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/by-number/:estimateNumber
exports.getPurchaseEstimateByNumber = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
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
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
      ]
    });

    if (!estimate) return res.status(404).json({ error: `Purchase Estimate #${estimateNumber} not found` });
    res.status(200).json(estimate);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchase estimate by number:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/pending-order-summary
exports.getPendingOrderSummary = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { organizationId, customerId, partyName } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    let resolvedPartyName = partyName ? partyName.trim() : '';
    if (!resolvedPartyName && customerId) {
      const cust = await Customer.findByPk(customerId);
      if (cust) resolvedPartyName = cust.name || '';
    }

    const targetPartyKey = normalizeMatchKey(resolvedPartyName);
    if (!targetPartyKey) {
      return res.status(200).json({
        partyName: '',
        orders: [],
        products: [],
        totalOrdered: 0,
        totalReceived: 0,
        totalPending: 0
      });
    }

    const purchases = await Purchase.findAll({
      where: {
        ...officeWhere,
        status: { [Op.ne]: 'CANCELLED' }
      },
      include: [
        {
          model: PurchaseItem,
          as: 'items'
        }
      ],
      order: [
        ['purchaseDate', 'ASC'],
        ['id', 'ASC'],
        [{ model: PurchaseItem, as: 'items' }, 'id', 'ASC']
      ]
    });

    const matchingPurchases = purchases.filter(po => normalizeMatchKey(po.vendorName) === targetPartyKey);

    // Filter to open POs (with pending > 0) for active receiving display;
    // also return all matching POs so recently completed ones can be referenced if needed.
    const openOrders = [];
    const productMap = new Map();
    let totalOrdered = 0;
    let totalReceived = 0;
    let totalPending = 0;

    for (const po of matchingPurchases) {
      let poOrd = 0;
      let poRec = 0;
      const poItems = (po.items || []).map(it => {
        const ord = parseFloat(it.quantity) || 0;
        const rec = parseFloat(it.receivedQuantity) || 0;
        const pen = Math.max(0, parseFloat((ord - rec).toFixed(3)));
        poOrd += ord;
        poRec += rec;
        return {
          purchaseItemId: it.id,
          productId: it.productId,
          productName: it.productNameSnapshot,
          description: it.productSpecificationsSnapshot || '',
          rate: parseFloat(it.rate) || 0,
          unit: it.unit || 'Ton',
          orderedQuantity: ord,
          receivedQuantity: rec,
          pendingQuantity: pen
        };
      });

      const poPen = Math.max(0, parseFloat((poOrd - poRec).toFixed(3)));
      if (poPen > 0.0001) {
        openOrders.push({
          id: po.id,
          purchaseNumber: po.purchaseNumber,
          purchaseDate: po.purchaseDate,
          vendorName: po.vendorName,
          status: po.status,
          totalOrdered: parseFloat(poOrd.toFixed(3)),
          totalReceived: parseFloat(poRec.toFixed(3)),
          totalPending: poPen,
          items: poItems
        });

        totalOrdered += poOrd;
        totalReceived += poRec;
        totalPending += poPen;

        for (const it of poItems) {
          if (it.pendingQuantity <= 0.0001) continue;
          const prodKey = it.productId ? `id:${it.productId}` : `name:${normalizeMatchKey(it.productName)}`;
          const key = `${prodKey}:::${normalizeMatchKey(it.description)}`;
          if (!productMap.has(key)) {
            productMap.set(key, {
              productId: it.productId,
              productName: it.productName,
              description: it.description || '',
              rate: it.rate || 0,
              unit: it.unit || 'Ton',
              orderedQuantity: 0,
              receivedQuantity: 0,
              pendingQuantity: 0,
              purchaseNumbers: []
            });
          }
          const entry = productMap.get(key);
          entry.orderedQuantity = parseFloat((entry.orderedQuantity + it.orderedQuantity).toFixed(3));
          entry.receivedQuantity = parseFloat((entry.receivedQuantity + it.receivedQuantity).toFixed(3));
          entry.pendingQuantity = parseFloat((entry.pendingQuantity + it.pendingQuantity).toFixed(3));
          if (!entry.description && it.description) {
            entry.description = it.description;
          }
          if (!entry.rate && it.rate) {
            entry.rate = it.rate;
          }
          if (!entry.purchaseNumbers.includes(po.purchaseNumber)) {
            entry.purchaseNumbers.push(po.purchaseNumber);
          }
        }
      }
    }

    res.status(200).json({
      partyName: resolvedPartyName,
      orders: openOrders,
      products: Array.from(productMap.values()),
      totalOrdered: parseFloat(totalOrdered.toFixed(3)),
      totalReceived: parseFloat(totalReceived.toFixed(3)),
      totalPending: parseFloat(totalPending.toFixed(3))
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching pending order summary:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/purchase-estimates/next-number
exports.getNextPurchaseEstimateNumber = async (req, res) => {
  try {
    await ensurePurchaseEstimateTablesExist();
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const effectiveOrgId = (targetOfficeIds && targetOfficeIds.length > 0) ? targetOfficeIds[0] : (req.user.organizationId || null);
    const nextNumber = await generateUniquePurchaseEstimateNumber(effectiveOrgId);
    res.status(200).json({ nextEstimateNumber: nextNumber });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error generating next purchase estimate number:', error);
    res.status(500).json({ error: error.message || 'Failed to generate next purchase estimate number' });
  }
};

// POST /api/purchase-estimates - Create purchase estimate
exports.createPurchaseEstimate = async (req, res) => {
  await ensurePurchaseEstimateTablesExist();
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

    // If partyName was supplied without an existing customerId (e.g., from an earlier PO), find or register in Customer Master
    if (!validCustomerId && resolvedPartyName) {
      const existingCust = await Customer.findOne({
        where: {
          organizationId: targetOrgId,
          [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), resolvedPartyName.toLowerCase())]
        },
        transaction: t
      });
      if (existingCust) {
        validCustomerId = existingCust.id;
      } else {
        const createdCust = await Customer.create({
          organizationId: targetOrgId,
          name: resolvedPartyName
        }, { transaction: t });
        validCustomerId = createdCust.id;
      }
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

      let resolvedProductId = row.productId ? parseInt(row.productId, 10) : null;
      if (isNaN(resolvedProductId)) resolvedProductId = null;

      if (resolvedProductId) {
        const product = await Product.findOne({
          where: { id: resolvedProductId, organizationId: targetOrgId },
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
        } else {
          resolvedProductId = null;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description / name is required on row ${i + 1}.` });
      }

      // If productId is missing (e.g. product entered on an earlier PO), match or create in Product Master so stock updates cleanly
      if (!resolvedProductId && productNameSnapshot) {
        const matchedProd = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())]
          },
          transaction: t
        });
        if (matchedProd) {
          resolvedProductId = matchedProd.id;
          unit = matchedProd.unit || unit;
        } else {
          const createdProd = await Product.create({
            organizationId: targetOrgId,
            name: productNameSnapshot,
            unit: unit || 'Ton',
            difference: 0,
            specifications: productSpecificationsSnapshot || null,
            currentStock: 0,
            status: 'ACTIVE'
          }, { transaction: t });
          resolvedProductId = createdProd.id;
        }
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
        productId: resolvedProductId,
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

    const createdEstimateItems = [];
    for (const item of calculatedItems) {
      const createdItem = await PurchaseEstimateItem.create({
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
      createdEstimateItems.push(createdItem);
    }

    // Automatically allocate received quantities to matching open Purchase Orders (FIFO)
    await allocatePurchaseEstimateToOrders(createdEstimateItems, newEstimate, resolvedPartyName, t);

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
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
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
  await ensurePurchaseEstimateTablesExist();
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

    if (!validCustomerId && resolvedPartyName) {
      const existingCust = await Customer.findOne({
        where: {
          organizationId: targetOrgId,
          [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), resolvedPartyName.toLowerCase())]
        },
        transaction: t
      });
      if (existingCust) {
        validCustomerId = existingCust.id;
      } else {
        const createdCust = await Customer.create({
          organizationId: targetOrgId,
          name: resolvedPartyName
        }, { transaction: t });
        validCustomerId = createdCust.id;
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

      let resolvedProductId = row.productId ? parseInt(row.productId, 10) : null;
      if (isNaN(resolvedProductId)) resolvedProductId = null;

      if (resolvedProductId) {
        const product = await Product.findOne({
          where: { id: resolvedProductId, organizationId: targetOrgId },
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
        } else {
          resolvedProductId = null;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description is required on row ${i + 1}.` });
      }

      if (!resolvedProductId && productNameSnapshot) {
        const matchedProd = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())]
          },
          transaction: t
        });
        if (matchedProd) {
          resolvedProductId = matchedProd.id;
          unit = matchedProd.unit || unit;
        } else {
          const createdProd = await Product.create({
            organizationId: targetOrgId,
            name: productNameSnapshot,
            unit: unit || 'Ton',
            difference: 0,
            specifications: productSpecificationsSnapshot || null,
            currentStock: 0,
            status: 'ACTIVE'
          }, { transaction: t });
          resolvedProductId = createdProd.id;
        }
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
        productId: resolvedProductId,
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

    // Revert previously added stock and PO allocations for this estimate's items
    const existingItems = await PurchaseEstimateItem.findAll({ where: { purchaseEstimateId: estimate.id }, transaction: t });
    await revertPurchaseEstimateOrderAllocations(estimate.id, t);
    await revertInventoryForPurchaseEstimateItems(existingItems, estimate, t);

    // Replace items
    await PurchaseEstimateItem.destroy({ where: { purchaseEstimateId: estimate.id }, transaction: t });

    const createdEstimateItems = [];
    for (const item of calculatedItems) {
      const createdItem = await PurchaseEstimateItem.create({
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
      createdEstimateItems.push(createdItem);
    }

    // Resolve party name for PO allocation if not explicitly passed
    let allocationPartyName = resolvedPartyName;
    if (!allocationPartyName && validCustomerId) {
      const cust = await Customer.findByPk(validCustomerId, { transaction: t });
      if (cust) allocationPartyName = cust.name;
    }

    // Re-allocate received quantities to matching open Purchase Orders (FIFO)
    await allocatePurchaseEstimateToOrders(createdEstimateItems, estimate, allocationPartyName, t);

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
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
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

      let resolvedProductId = row.productId ? parseInt(row.productId, 10) : null;
      if (isNaN(resolvedProductId)) resolvedProductId = null;

      if (resolvedProductId) {
        const product = await Product.findOne({
          where: { id: resolvedProductId, organizationId: targetOrgId },
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
        } else {
          resolvedProductId = null;
        }
      }

      if (!productNameSnapshot) {
        await t.rollback();
        return res.status(400).json({ error: `Product description is required on row ${i + 1}.` });
      }

      if (!resolvedProductId && productNameSnapshot) {
        const matchedProd = await Product.findOne({
          where: {
            organizationId: targetOrgId,
            [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))), productNameSnapshot.toLowerCase())]
          },
          transaction: t
        });
        if (matchedProd) {
          resolvedProductId = matchedProd.id;
          unit = matchedProd.unit || unit;
        } else {
          const createdProd = await Product.create({
            organizationId: targetOrgId,
            name: productNameSnapshot,
            unit: unit || 'Ton',
            difference: 0,
            specifications: productSpecificationsSnapshot || null,
            currentStock: 0,
            status: 'ACTIVE'
          }, { transaction: t });
          resolvedProductId = createdProd.id;
        }
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
        productId: resolvedProductId,
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

    // Revert previously added inventory and PO allocations
    await revertPurchaseEstimateOrderAllocations(estimate.id, t);
    await revertInventoryForPurchaseEstimateItems(estimate.items, estimate, t);

    // Replace items
    await PurchaseEstimateItem.destroy({ where: { purchaseEstimateId: estimate.id }, transaction: t });

    const createdEstimateItems = [];
    for (const item of calculatedItems) {
      const createdItem = await PurchaseEstimateItem.create({
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
      createdEstimateItems.push(createdItem);
    }

    let overridePartyName = estimate.partyName;
    if (!overridePartyName && estimate.customerId) {
      const cust = await Customer.findByPk(estimate.customerId, { transaction: t });
      if (cust) overridePartyName = cust.name;
    }

    await allocatePurchaseEstimateToOrders(createdEstimateItems, estimate, overridePartyName, t);

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
        { model: PurchaseEstimateItem, as: 'items' },
        poAllocationInclude
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
  await ensurePurchaseEstimateTablesExist();
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

    // Revert PO allocations and inventory additions if any exist
    await revertPurchaseEstimateOrderAllocations(estimate.id, t);
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
