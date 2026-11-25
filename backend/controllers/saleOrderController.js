const { Op } = require('sequelize');
const sequelize = require('../config/database');
const SaleOrder = require('../models/SaleOrder');
const SaleOrderItem = require('../models/SaleOrderItem');
const SaleOrderAllocation = require('../models/SaleOrderAllocation');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');
const {
  ensureCustomerForParty,
  ensureProductForOrderLine
} = require('../utils/syncPurchaseMasterData');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

let tablesVerified = false;

async function ensureSaleOrderTablesExist() {
  if (tablesVerified) return;
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderNumber VARCHAR(255) NOT NULL,
        organizationId INT NOT NULL,
        customerId INT NULL,
        customerName VARCHAR(255) NULL,
        orderDate DATE NOT NULL,
        orderDetails TEXT NULL,
        totalQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        totalAmount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        createdBy INT NOT NULL,
        remarks TEXT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_so_org_num (organizationId, orderNumber),
        INDEX idx_so_cust (customerId),
        INDEX idx_so_date (orderDate),
        INDEX idx_so_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        saleOrderId INT NOT NULL,
        productId INT NULL,
        productNameSnapshot VARCHAR(255) NOT NULL,
        productCategorySnapshot VARCHAR(255) NULL,
        productSizeSnapshot VARCHAR(255) NULL,
        productSpecificationsSnapshot TEXT NULL,
        quantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        processedQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        carbonType VARCHAR(50) NOT NULL DEFAULT 'Low Carbon',
        unit VARCHAR(50) NOT NULL DEFAULT 'Ton',
        rate DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_soi_so (saleOrderId),
        INDEX idx_soi_prod (productId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_order_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organizationId INT NOT NULL,
        estimateId INT NOT NULL,
        estimateItemId INT NOT NULL,
        saleOrderId INT NOT NULL,
        saleOrderItemId INT NOT NULL,
        allocatedQuantity DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_soa_est (estimateId),
        INDEX idx_soa_est_item (estimateItemId),
        INDEX idx_soa_so (saleOrderId),
        INDEX idx_soa_so_item (saleOrderItemId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    tablesVerified = true;
  } catch (err) {
    console.warn('ensureSaleOrderTablesExist notice:', err.message);
  }
}

const normalizeMatchKey = (str) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');

const computeSaleOrderStatus = (items) => {
  if (!items || items.length === 0) return 'Pending';
  let hasAnyProcessed = false;
  let hasAnyPending = false;

  for (const item of items) {
    const ordered = parseFloat(item.quantity) || 0;
    const processed = parseFloat(item.processedQuantity) || 0;

    if (processed > 0.0001) {
      hasAnyProcessed = true;
    }
    if (ordered - processed > 0.0001) {
      hasAnyPending = true;
    }
  }

  if (!hasAnyProcessed) return 'Pending';
  if (hasAnyProcessed && hasAnyPending) return 'Partially Processed';
  return 'Fully Processed';
};

const generateUniqueSaleOrderNumber = async (organizationId, transaction, targetDate) => {
  if (organizationId && typeof organizationId === 'object' && organizationId.commit) {
    targetDate = transaction;
    transaction = organizationId;
    organizationId = null;
  }

  // Normalize date string (YYYY-MM-DD)
  let effectiveDate = targetDate;
  if (!effectiveDate) {
    effectiveDate = new Date().toISOString().split('T')[0];
  } else if (effectiveDate instanceof Date) {
    effectiveDate = effectiveDate.toISOString().split('T')[0];
  } else {
    effectiveDate = String(effectiveDate).split('T')[0].trim();
  }

  await ensureSaleOrderTablesExist();
  let query;
  let replacements = [];

  if (organizationId) {
    query = "SELECT MAX(CAST(orderNumber AS UNSIGNED)) AS maxNum FROM sale_orders WHERE organizationId = ? AND orderDate = ? AND orderNumber REGEXP '^[0-9]+$'";
    replacements = [parseInt(organizationId, 10), effectiveDate];
  } else {
    query = "SELECT MAX(CAST(orderNumber AS UNSIGNED)) AS maxNum FROM sale_orders WHERE orderDate = ? AND orderNumber REGEXP '^[0-9]+$'";
    replacements = [effectiveDate];
  }

  const options = { replacements };
  if (transaction) {
    options.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      options.lock = transaction.LOCK.UPDATE;
    }
  }

  const [results] = await sequelize.query(query, options);

  let nextSequence = 1;
  if (results && results[0] && results[0].maxNum !== null && results[0].maxNum !== undefined) {
    const currentMax = parseInt(results[0].maxNum, 10);
    if (!isNaN(currentMax) && currentMax >= 1) {
      nextSequence = currentMax + 1;
    }
  }

  while (true) {
    const candidate = String(nextSequence);
    const where = { orderNumber: candidate, orderDate: effectiveDate };
    if (organizationId) {
      where.organizationId = parseInt(organizationId, 10);
    }
    const existing = await SaleOrder.findOne({
      where,
      transaction
    });
    if (!existing) {
      return candidate;
    }
    nextSequence++;
  }
};

// GET /api/sale-orders - List sale orders
exports.getSaleOrders = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
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
      whereClause.status = status.trim();
    }

    if (startDate && endDate) {
      whereClause.orderDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.orderDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.orderDate = { [Op.lte]: endDate };
    }

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { orderNumber: { [Op.like]: searchTerm } },
        { customerName: { [Op.like]: searchTerm } },
        { remarks: { [Op.like]: searchTerm } }
      ];
    }

    const orders = await SaleOrder.findAll({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        {
          model: SaleOrderItem,
          as: 'items',
          include: [{ model: Product, attributes: ['id', 'name', 'unit', 'difference', 'currentStock'], required: false }]
        }
      ],
      order: [
        ['orderDate', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const response = orders.map(order => {
      const o = order.toJSON();
      let totOrd = 0;
      let totProc = 0;
      let totAmt = 0;
      for (const it of (o.items || [])) {
        const q = parseFloat(it.quantity) || 0;
        const r = parseFloat(it.rate) || 0;
        totOrd += q;
        totProc += parseFloat(it.processedQuantity) || 0;
        totAmt += q * r;
      }
      o.totalOrderedQuantity = parseFloat(totOrd.toFixed(3));
      o.totalProcessedQuantity = parseFloat(totProc.toFixed(3));
      o.pendingQuantity = Math.max(0, parseFloat((totOrd - totProc).toFixed(3)));
      const finalAmt = parseFloat(o.totalAmount) || totAmt;
      o.totalAmount = parseFloat(finalAmt.toFixed(2));
      o.averagePrice = totOrd > 0 ? parseFloat((finalAmt / totOrd).toFixed(2)) : 0;
      return o;
    });

    res.status(200).json(response);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching sale orders:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/sale-orders/next-number - Preview next upcoming order number
exports.getNextSaleOrderNumber = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { organizationId, date } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const effectiveOrgId = (targetOfficeIds && targetOfficeIds.length > 0) ? targetOfficeIds[0] : (req.user.organizationId || null);
    const nextNumber = await generateUniqueSaleOrderNumber(effectiveOrgId, null, date);
    res.status(200).json({ nextOrderNumber: nextNumber });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error generating next sale order number:', error);
    res.status(500).json({ error: error.message || 'Failed to generate next sale order number' });
  }
};

// GET /api/sale-orders/pending-order-summary - Returns open sale orders & products for customer
exports.getPendingSaleOrderSummary = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { organizationId, customerId, customerName } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhere = buildOfficeWhereClause(targetOfficeIds);

    let resolvedName = customerName ? customerName.trim() : '';
    if (!resolvedName && customerId) {
      const cust = await Customer.findByPk(customerId);
      if (cust) resolvedName = cust.name || '';
    }

    const targetKey = normalizeMatchKey(resolvedName);
    if (!targetKey) {
      return res.status(200).json({
        customerName: '',
        orders: [],
        products: [],
        totalOrdered: 0,
        totalProcessed: 0,
        totalPending: 0
      });
    }

    const orders = await SaleOrder.findAll({
      where: {
        ...officeWhere,
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
      ]
    });

    const matchingOrders = orders.filter(so => normalizeMatchKey(so.customerName) === targetKey);

    const openOrders = [];
    const productMap = new Map();
    let totalOrdered = 0;
    let totalProcessed = 0;
    let totalPending = 0;

    for (const so of matchingOrders) {
      let soOrd = 0;
      let soProc = 0;
      const soItems = (so.items || []).map(it => {
        const ord = parseFloat(it.quantity) || 0;
        const proc = parseFloat(it.processedQuantity) || 0;
        const pen = Math.max(0, parseFloat((ord - proc).toFixed(3)));
        soOrd += ord;
        soProc += proc;
        return {
          saleOrderItemId: it.id,
          productId: it.productId,
          productName: it.productNameSnapshot,
          description: it.productSpecificationsSnapshot || '',
          rate: parseFloat(it.rate) || 0,
          unit: it.unit || 'Ton',
          orderedQuantity: ord,
          processedQuantity: proc,
          pendingQuantity: pen
        };
      });

      const soPen = Math.max(0, parseFloat((soOrd - soProc).toFixed(3)));
      if (soPen > 0.0001) {
        openOrders.push({
          id: so.id,
          orderNumber: so.orderNumber,
          orderDate: so.orderDate,
          customerName: so.customerName,
          status: so.status,
          totalOrdered: parseFloat(soOrd.toFixed(3)),
          totalProcessed: parseFloat(soProc.toFixed(3)),
          totalPending: soPen,
          items: soItems
        });

        totalOrdered += soOrd;
        totalProcessed += soProc;
        totalPending += soPen;

        for (const it of soItems) {
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
              processedQuantity: 0,
              pendingQuantity: 0,
              orderNumbers: []
            });
          }
          const entry = productMap.get(key);
          entry.orderedQuantity = parseFloat((entry.orderedQuantity + it.orderedQuantity).toFixed(3));
          entry.processedQuantity = parseFloat((entry.processedQuantity + it.processedQuantity).toFixed(3));
          entry.pendingQuantity = parseFloat((entry.pendingQuantity + it.pendingQuantity).toFixed(3));
          if (!entry.description && it.description) {
            entry.description = it.description;
          }
          if (!entry.rate && it.rate) {
            entry.rate = it.rate;
          }
          if (!entry.orderNumbers.includes(so.orderNumber)) {
            entry.orderNumbers.push(so.orderNumber);
          }
        }
      }
    }

    res.status(200).json({
      customerName: resolvedName,
      orders: openOrders,
      products: Array.from(productMap.values()),
      totalOrdered: parseFloat(totalOrdered.toFixed(3)),
      totalProcessed: parseFloat(totalProcessed.toFixed(3)),
      totalPending: parseFloat(totalPending.toFixed(3))
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching pending sale order summary:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// GET /api/sale-orders/:id - Single sale order
exports.getSaleOrderById = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { id } = req.params;

    const order = await SaleOrder.findByPk(id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        {
          model: SaleOrderItem,
          as: 'items',
          include: [{ model: Product, attributes: ['id', 'name', 'unit', 'difference', 'currentStock'], required: false }]
        },
        {
          model: SaleOrderAllocation,
          as: 'allocations',
          required: false,
          include: [
            {
              model: Estimate,
              attributes: ['id', 'estimateNumber', 'estimateDate', 'status']
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Sale Order not found' });
    }

    await verifyRecordOwnership(order, req.user);

    const oJson = order.toJSON();
    let totOrd = 0;
    let totProc = 0;
    let itemsTotalAmount = 0;

    oJson.items = (oJson.items || []).map(item => {
      const ord = parseFloat(item.quantity) || 0;
      const proc = parseFloat(item.processedQuantity) || 0;
      const pen = Math.max(0, parseFloat((ord - proc).toFixed(3)));
      const rate = parseFloat(item.rate) || 0;
      const itemAmt = parseFloat(item.amount) || (ord * rate);

      totOrd += ord;
      totProc += proc;
      itemsTotalAmount += itemAmt;

      return {
        ...item,
        orderedQuantity: ord,
        processedQuantity: proc,
        pendingQuantity: pen,
        rate,
        amount: itemAmt
      };
    });

    const finalTotalAmount = parseFloat(oJson.totalAmount) || itemsTotalAmount;
    oJson.totalOrderedQuantity = parseFloat(totOrd.toFixed(3));
    oJson.totalProcessedQuantity = parseFloat(totProc.toFixed(3));
    oJson.pendingQuantity = Math.max(0, parseFloat((totOrd - totProc).toFixed(3)));
    oJson.totalAmount = parseFloat(finalTotalAmount.toFixed(2));
    oJson.averagePrice = totOrd > 0 ? parseFloat((finalTotalAmount / totOrd).toFixed(2)) : 0;

    res.status(200).json(oJson);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching sale order by id:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// POST /api/sale-orders - Create Sale Order
exports.createSaleOrder = async (req, res) => {
  await ensureSaleOrderTablesExist();
  const t = await sequelize.transaction();
  try {
    const {
      organizationId,
      customerId,
      customerName,
      orderNumber,
      orderDate,
      items,
      remarks,
      status
    } = req.body;

    const targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);

    const cleanCustName = String(customerName || '').trim();
    if (!cleanCustName) {
      await t.rollback();
      return res.status(400).json({ error: 'Customer / Buyer Name is required.' });
    }

    // Auto-sync customer to Customer Master
    let resolvedCustomerId = customerId && !isNaN(Number(customerId)) ? parseInt(customerId, 10) : null;
    try {
      const ensuredCust = await ensureCustomerForParty(targetOrgId, cleanCustName, t);
      if (ensuredCust) {
        resolvedCustomerId = ensuredCust.id;
      }
    } catch (custErr) {
      console.warn('Auto-sync customer warning:', custErr.message);
    }

    // Determine unique sequential order number
    const effectiveOrderDate = orderDate ? String(orderDate).split('T')[0] : new Date().toISOString().split('T')[0];
    let finalOrderNumber = orderNumber ? String(orderNumber).trim() : '';
    if (!finalOrderNumber) {
      finalOrderNumber = await generateUniqueSaleOrderNumber(targetOrgId, t, effectiveOrderDate);
    } else {
      const existing = await SaleOrder.findOne({
        where: {
          organizationId: targetOrgId,
          orderNumber: finalOrderNumber,
          orderDate: effectiveOrderDate
        },
        transaction: t
      });
      if (existing) {
        finalOrderNumber = await generateUniqueSaleOrderNumber(targetOrgId, t, effectiveOrderDate);
      }
    }

    const validItems = (items || []).filter(it => (it.productName || it.productNameSnapshot || '').trim() && (parseFloat(it.quantity) || 0) > 0);
    if (validItems.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'At least one valid item with a positive quantity is required.' });
    }

    let totalQty = 0;
    let totalAmt = 0;

    const preparedItems = [];
    for (const it of validItems) {
      const pName = String(it.productName || it.productNameSnapshot || '').trim();
      const pDesc = String(it.description || it.productSpecificationsSnapshot || '').trim();
      const q = parseFloat(it.quantity) || 0;
      const rate = parseFloat(it.price || it.rate) || 0;
      const amt = parseFloat((q * rate).toFixed(2));
      const unit = String(it.unit || 'Ton').trim();
      const carbonType = it.carbonType === 'High Carbon' ? 'High Carbon' : 'Low Carbon';

      // Auto-sync product to Product Master
      let pId = it.productId && !isNaN(Number(it.productId)) ? parseInt(it.productId, 10) : null;
      try {
        const ensuredProd = await ensureProductForOrderLine(targetOrgId, { name: pName, unit, specifications: pDesc }, t);
        if (ensuredProd) {
          pId = ensuredProd.id;
        }
      } catch (prodErr) {
        console.warn('Auto-sync product warning:', prodErr.message);
      }

      totalQty += q;
      totalAmt += amt;

      preparedItems.push({
        productId: pId,
        productNameSnapshot: pName,
        productSpecificationsSnapshot: pDesc || null,
        quantity: q,
        processedQuantity: 0,
        carbonType,
        unit,
        rate,
        amount: amt
      });
    }

    const newOrder = await SaleOrder.create({
      orderNumber: finalOrderNumber,
      organizationId: targetOrgId,
      customerId: resolvedCustomerId,
      customerName: cleanCustName,
      orderDate: orderDate || new Date(),
      totalQuantity: parseFloat(totalQty.toFixed(3)),
      totalAmount: parseFloat(totalAmt.toFixed(2)),
      status: status || 'Pending',
      createdBy: req.user.userId,
      remarks: remarks ? String(remarks).trim() : null
    }, { transaction: t });

    for (const itemData of preparedItems) {
      await SaleOrderItem.create({
        ...itemData,
        saleOrderId: newOrder.id
      }, { transaction: t });
    }

    await t.commit();

    const createdRecord = await SaleOrder.findByPk(newOrder.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ]
    });

    res.status(201).json(createdRecord);
  } catch (error) {
    await t.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating sale order:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// PUT /api/sale-orders/:id - Update Sale Order
exports.updateSaleOrder = async (req, res) => {
  await ensureSaleOrderTablesExist();
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      customerName,
      customerId,
      orderDate,
      items,
      remarks,
      status
    } = req.body;

    const existingOrder = await SaleOrder.findByPk(id, {
      include: [{ model: SaleOrderItem, as: 'items' }],
      transaction: t
    });

    if (!existingOrder) {
      await t.rollback();
      return res.status(404).json({ error: 'Sale Order not found' });
    }

    await verifyRecordOwnership(existingOrder, req.user);

    const cleanCustName = customerName ? String(customerName).trim() : existingOrder.customerName;

    let resolvedCustomerId = customerId && !isNaN(Number(customerId)) ? parseInt(customerId, 10) : existingOrder.customerId;
    if (cleanCustName) {
      try {
        const ensuredCust = await ensureCustomerForParty(existingOrder.organizationId, cleanCustName, t);
        if (ensuredCust) {
          resolvedCustomerId = ensuredCust.id;
        }
      } catch (custErr) {
        console.warn('Auto-sync customer warning:', custErr.message);
      }
    }

    let totalQty = 0;
    let totalAmt = 0;

    if (items && Array.isArray(items)) {
      const validItems = items.filter(it => (it.productName || it.productNameSnapshot || '').trim() && (parseFloat(it.quantity) || 0) > 0);
      if (validItems.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'At least one valid item row with a positive quantity is required.' });
      }

      // Map existing processed quantities so allocations are preserved
      const existingProcessedMap = new Map();
      for (const oldIt of existingOrder.items) {
        const key = `${oldIt.productId || normalizeMatchKey(oldIt.productNameSnapshot)}:::${normalizeMatchKey(oldIt.productSpecificationsSnapshot)}`;
        existingProcessedMap.set(key, parseFloat(oldIt.processedQuantity) || 0);
      }

      await SaleOrderItem.destroy({
        where: { saleOrderId: existingOrder.id },
        transaction: t
      });

      for (const it of validItems) {
        const pName = String(it.productName || it.productNameSnapshot || '').trim();
        const pDesc = String(it.description || it.productSpecificationsSnapshot || '').trim();
        const q = parseFloat(it.quantity) || 0;
        const rate = parseFloat(it.price || it.rate) || 0;
        const amt = parseFloat((q * rate).toFixed(2));
        const unit = String(it.unit || 'Ton').trim();
        const carbonType = it.carbonType === 'High Carbon' ? 'High Carbon' : 'Low Carbon';

        let pId = it.productId && !isNaN(Number(it.productId)) ? parseInt(it.productId, 10) : null;
        try {
          const ensuredProd = await ensureProductForOrderLine(existingOrder.organizationId, { name: pName, unit, specifications: pDesc }, t);
          if (ensuredProd) pId = ensuredProd.id;
        } catch (prodErr) {
          console.warn('Auto-sync product warning:', prodErr.message);
        }

        const matchKey = `${pId || normalizeMatchKey(pName)}:::${normalizeMatchKey(pDesc)}`;
        const preservedProcessed = existingProcessedMap.get(matchKey) || 0;

        totalQty += q;
        totalAmt += amt;

        await SaleOrderItem.create({
          saleOrderId: existingOrder.id,
          productId: pId,
          productNameSnapshot: pName,
          productSpecificationsSnapshot: pDesc || null,
          quantity: q,
          processedQuantity: preservedProcessed,
          carbonType,
          unit,
          rate,
          amount: amt
        }, { transaction: t });
      }
    } else {
      totalQty = parseFloat(existingOrder.totalQuantity) || 0;
      totalAmt = parseFloat(existingOrder.totalAmount) || 0;
    }

    const updatedItems = await SaleOrderItem.findAll({
      where: { saleOrderId: existingOrder.id },
      transaction: t
    });

    const computedStatus = status && status !== 'Pending' ? status : computeSaleOrderStatus(updatedItems);

    await existingOrder.update({
      customerName: cleanCustName,
      customerId: resolvedCustomerId,
      orderDate: orderDate || existingOrder.orderDate,
      totalQuantity: parseFloat(totalQty.toFixed(3)),
      totalAmount: parseFloat(totalAmt.toFixed(2)),
      remarks: remarks !== undefined ? (remarks ? String(remarks).trim() : null) : existingOrder.remarks,
      status: computedStatus
    }, { transaction: t });

    await t.commit();

    const result = await SaleOrder.findByPk(existingOrder.id, {
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ]
    });

    res.status(200).json(result);
  } catch (error) {
    await t.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating sale order:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// DELETE /api/sale-orders/:id
exports.deleteSaleOrder = async (req, res) => {
  await ensureSaleOrderTablesExist();
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const order = await SaleOrder.findByPk(id, { transaction: t });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Sale Order not found' });
    }

    await verifyRecordOwnership(order, req.user);

    await SaleOrderAllocation.destroy({
      where: { saleOrderId: order.id },
      transaction: t
    });

    await SaleOrderItem.destroy({
      where: { saleOrderId: order.id },
      transaction: t
    });

    await order.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({ message: `Sale Order #${order.orderNumber} deleted successfully.` });
  } catch (error) {
    await t.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting sale order:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Navigation: Previous
exports.getPreviousSaleOrder = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.lt]: parseInt(currentId, 10) };
    }

    const prevOrder = await SaleOrder.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ],
      order: [['id', 'DESC']]
    });

    if (!prevOrder) return res.status(404).json({ error: 'No previous sale order found' });
    res.status(200).json(prevOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Navigation: Next
exports.getNextSaleOrder = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.gt]: parseInt(currentId, 10) };
    }

    const nextOrder = await SaleOrder.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ],
      order: [['id', 'ASC']]
    });

    if (!nextOrder) return res.status(404).json({ error: 'No next sale order found' });
    res.status(200).json(nextOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Navigation: First
exports.getFirstSaleOrder = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const whereClause = buildOfficeWhereClause(targetOfficeIds);

    const firstOrder = await SaleOrder.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ],
      order: [['id', 'ASC']]
    });

    if (!firstOrder) return res.status(404).json({ error: 'No sale order found' });
    res.status(200).json(firstOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Navigation: Last
exports.getLastSaleOrder = async (req, res) => {
  try {
    await ensureSaleOrderTablesExist();
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const whereClause = buildOfficeWhereClause(targetOfficeIds);

    const lastOrder = await SaleOrder.findOne({
      where: whereClause,
      include: [
        { model: Customer, attributes: ['id', 'name', 'city', 'phone', 'tin'], required: false },
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: SaleOrderItem, as: 'items' }
      ],
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return res.status(404).json({ error: 'No sale order found' });
    res.status(200).json(lastOrder);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports.ensureSaleOrderTablesExist = ensureSaleOrderTablesExist;
