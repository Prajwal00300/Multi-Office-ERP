const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const GoodsReceipt = require('../models/GoodsReceipt');
const GoodsReceiptItem = require('../models/GoodsReceiptItem');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { calculatePurchaseTotals } = require('../services/purchaseCalculationService');
const { generateUniquePurchaseNumber, generateUniqueReceiptNumber } = require('../utils/purchaseNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

/**
 * Helper to compute overall order status based on product lines.
 *
 * - Pending: No quantity has been received for any product line.
 * - Partially Received: At least one quantity has been received, but at least one product line still has a pending quantity.
 * - Fully Received: All product lines have been received in full.
 */
const computeOrderStatus = (items) => {
  if (!items || items.length === 0) return 'Pending';

  let hasAnyReceived = false;
  let hasAnyPending = false;

  for (const item of items) {
    const ordered = parseFloat(item.quantity) || 0;
    const received = parseFloat(item.receivedQuantity) || 0;

    if (received > 0) {
      hasAnyReceived = true;
    }
    if (ordered > received) {
      hasAnyPending = true;
    }
  }

  if (!hasAnyReceived) return 'Pending';
  if (hasAnyReceived && hasAnyPending) return 'Partially Received';
  return 'Fully Received';
};

/**
 * GET /api/purchases - List purchases with filters and organization isolation
 */
exports.getPurchases = async (req, res) => {
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
      whereClause.status = status.trim();
    }

    if (startDate && endDate) {
      whereClause.purchaseDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.purchaseDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.purchaseDate = { [Op.lte]: endDate };
    }

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { purchaseNumber: { [Op.like]: searchTerm } },
        { vendorName: { [Op.like]: searchTerm } },
        { purchaseDetails: { [Op.like]: searchTerm } },
        { remarks: { [Op.like]: searchTerm } }
      ];
    }

    const purchases = await Purchase.findAll({
      where: whereClause,
      include: [
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
          model: PurchaseItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'unit', 'currentStock']
            }
          ]
        },
        {
          model: GoodsReceipt,
          as: 'receipts',
          include: [
            {
              model: GoodsReceiptItem,
              as: 'items'
            },
            {
              model: User,
              as: 'receiver',
              attributes: ['id', 'username']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich purchases with calculated pending and received summary
    const formattedPurchases = purchases.map(purchase => {
      const pJson = purchase.toJSON();
      let totalOrdered = 0;
      let totalReceived = 0;

      const enrichedItems = (pJson.items || []).map(item => {
        const ordered = parseFloat(item.quantity) || 0;
        const received = parseFloat(item.receivedQuantity) || 0;
        const pending = Math.max(0, ordered - received);

        totalOrdered += ordered;
        totalReceived += received;

        return {
          ...item,
          orderedQuantity: ordered,
          previouslyReceivedQuantity: received,
          pendingQuantity: pending
        };
      });

      return {
        ...pJson,
        items: enrichedItems,
        totalOrderedQuantity: totalOrdered,
        totalReceivedQuantity: totalReceived,
        totalPendingQuantity: Math.max(0, totalOrdered - totalReceived)
      };
    });

    res.status(200).json(formattedPurchases);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchases' });
  }
};

/**
 * GET /api/purchases/next-number - Preview next sequential purchase order number
 */
exports.getNextPurchaseNumber = async (req, res) => {
  try {
    const nextPurchaseNumber = await generateUniquePurchaseNumber();
    res.status(200).json({ nextPurchaseNumber });
  } catch (error) {
    console.error('Error generating next purchase number preview:', error);
    res.status(500).json({ error: 'Failed to generate next purchase order number preview' });
  }
};

/**
 * GET /api/purchases/:id - Retrieve purchase order by ID
 */
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findByPk(id, {
      include: [
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
          model: PurchaseItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'unit', 'currentStock']
            }
          ]
        },
        {
          model: GoodsReceipt,
          as: 'receipts',
          include: [
            {
              model: GoodsReceiptItem,
              as: 'items'
            },
            {
              model: User,
              as: 'receiver',
              attributes: ['id', 'username']
            }
          ]
        }
      ],
      order: [
        [{ model: PurchaseItem, as: 'items' }, 'id', 'ASC'],
        [{ model: GoodsReceipt, as: 'receipts' }, 'createdAt', 'DESC']
      ]
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // Ownership check
    await verifyRecordOwnership(purchase, req.user);

    const pJson = purchase.toJSON();
    let totalOrdered = 0;
    let totalReceived = 0;

    const enrichedItems = (pJson.items || []).map(item => {
      const ordered = parseFloat(item.quantity) || 0;
      const received = parseFloat(item.receivedQuantity) || 0;
      const pending = Math.max(0, ordered - received);

      totalOrdered += ordered;
      totalReceived += received;

      return {
        ...item,
        orderedQuantity: ordered,
        previouslyReceivedQuantity: received,
        pendingQuantity: pending
      };
    });

    res.status(200).json({
      ...pJson,
      items: enrichedItems,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      totalPendingQuantity: Math.max(0, totalOrdered - totalReceived)
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchase details:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase details' });
  }
};

/**
 * GET /api/purchases/lookup/:orderId - Look up purchase order by Order ID / purchaseNumber
 * Used by the Order Received interface.
 */
exports.lookupPurchaseByNumber = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || !orderId.trim()) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const cleanOrderId = orderId.trim();

    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [
          { purchaseNumber: cleanOrderId },
          { purchaseNumber: { [Op.like]: `%${cleanOrderId}%` } }
        ]
      },
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        },
        {
          model: PurchaseItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'unit', 'currentStock']
            }
          ]
        },
        {
          model: GoodsReceipt,
          as: 'receipts',
          include: [
            {
              model: GoodsReceiptItem,
              as: 'items'
            },
            {
              model: User,
              as: 'receiver',
              attributes: ['id', 'username']
            }
          ]
        }
      ],
      order: [
        [{ model: PurchaseItem, as: 'items' }, 'id', 'ASC'],
        [{ model: GoodsReceipt, as: 'receipts' }, 'createdAt', 'DESC']
      ]
    });

    if (!purchase) {
      return res.status(404).json({ error: `Purchase Order "${cleanOrderId}" not found.` });
    }

    // Ownership check against user's office scope
    await verifyRecordOwnership(purchase, req.user);

    const pJson = purchase.toJSON();
    let totalOrdered = 0;
    let totalReceived = 0;

    const enrichedLines = (pJson.items || []).map(item => {
      const ordered = parseFloat(item.quantity) || 0;
      const received = parseFloat(item.receivedQuantity) || 0;
      const pending = Math.max(0, ordered - received);

      totalOrdered += ordered;
      totalReceived += received;

      return {
        id: item.id,
        purchaseItemId: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        carbonType: item.carbonType,
        orderedQuantity: ordered,
        previouslyReceivedQuantity: received,
        pendingQuantity: pending,
        unit: item.unit || 'Ton',
        rate: item.rate,
        currentStock: item.Product?.currentStock || 0
      };
    });

    res.status(200).json({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate,
      partyName: purchase.vendorName,
      vendorName: purchase.vendorName,
      status: purchase.status,
      organizationId: purchase.organizationId,
      organization: purchase.Organization,
      productLines: enrichedLines,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      totalPendingQuantity: Math.max(0, totalOrdered - totalReceived),
      receipts: pJson.receipts || []
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error looking up purchase order:', error);
    res.status(500).json({ error: 'Internal server error while looking up purchase order' });
  }
};

/**
 * POST /api/purchases - PART 1: PLACE ORDER
 * Creates a purchase order with multiple products atomically without modifying inventory.
 */
exports.createPurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      purchaseNumber,
      purchaseDate,
      partyName,
      vendorName,
      purchaseDetails,
      remarks,
      items,
      organizationId
    } = req.body;

    // 1. Resolve Office ID securely
    let targetOrgId;
    try {
      targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const effectivePartyName = (partyName || vendorName || '').trim();

    // 2. Validate product rows
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'At least one valid product line is required.' });
    }

    const enrichedItems = [];
    let totalOrderedQty = 0;
    let totalAmt = 0;

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      let productName = (row.productNameSnapshot || row.productName || row.name || '').trim();
      let category = row.productCategorySnapshot || row.category || 'General';
      let size = row.productSizeSnapshot || row.size || '-';
      let specifications = row.productSpecificationsSnapshot || row.specifications || null;
      let unit = row.unit || 'Ton';

      // Carbon Type validation: must be 'Low Carbon' or 'High Carbon'
      let carbonType = (row.carbonType || '').trim();
      if (!carbonType) {
        carbonType = 'Low Carbon';
      } else if (!['Low Carbon', 'High Carbon'].includes(carbonType)) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `Row #${i + 1}: Carbon Type must be either "Low Carbon" or "High Carbon". Received: "${carbonType}".` 
        });
      }

      // Validate Product ID if provided
      let productId = (row.productId && !isNaN(Number(row.productId)) && Number(row.productId) > 0)
        ? parseInt(row.productId, 10)
        : null;

      if (productId) {
        const product = await Product.findByPk(productId, { transaction });
        if (!product) {
          await transaction.rollback();
          return res.status(400).json({ error: `Row #${i + 1}: Selected product not found.` });
        }
        if (product.organizationId !== targetOrgId) {
          await transaction.rollback();
          return res.status(403).json({ error: `Row #${i + 1}: Product "${product.name}" belongs to another organization.` });
        }
        productName = product.name;
        category = product.category || category;
        size = product.size || size;
        unit = product.unit || unit;
        specifications = product.specifications || specifications;
      }

      if (!productName) {
        await transaction.rollback();
        return res.status(400).json({ error: `Row #${i + 1}: Product selection or description is required.` });
      }

      // Quantity validation: must be positive number
      const q = parseFloat(row.quantity);
      if (isNaN(q) || q <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: `Row #${i + 1}: Quantity must be a valid positive number (> 0).` });
      }

      const rate = parseFloat(row.rate) || 0;
      const amount = Math.round((q * rate + Number.EPSILON) * 100) / 100;

      totalOrderedQty += q;
      totalAmt += amount;

      enrichedItems.push({
        productId,
        productNameSnapshot: productName,
        productCategorySnapshot: category,
        productSizeSnapshot: size,
        productSpecificationsSnapshot: specifications,
        quantity: q,
        carbonType,
        receivedQuantity: 0,
        unit,
        rate,
        amount
      });
    }

    // 3. Resolve Order ID (purchaseNumber)
    let finalOrderNumber = purchaseNumber ? purchaseNumber.trim() : null;
    if (finalOrderNumber) {
      const existing = await Purchase.findOne({
        where: { purchaseNumber: finalOrderNumber },
        transaction
      });
      if (existing) {
        await transaction.rollback();
        return res.status(409).json({ error: `Purchase Order ID "${finalOrderNumber}" already exists. Please choose a unique Order ID.` });
      }
    } else {
      finalOrderNumber = await generateUniquePurchaseNumber(transaction);
    }

    // 4. Create Parent Purchase Order
    const newPurchase = await Purchase.create({
      purchaseNumber: finalOrderNumber,
      organizationId: targetOrgId,
      purchaseDate: purchaseDate || new Date(),
      vendorName: effectivePartyName || null,
      purchaseDetails: purchaseDetails ? purchaseDetails.trim() : null,
      totalQuantity: totalOrderedQty,
      totalAmount: totalAmt,
      status: 'Pending',
      createdBy: req.user.userId,
      remarks: remarks ? remarks.trim() : null
    }, { transaction });

    // 5. Create Product Line Items linked to parent order
    const itemsToCreate = enrichedItems.map(item => ({
      purchaseId: newPurchase.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      productCategorySnapshot: item.productCategorySnapshot,
      productSizeSnapshot: item.productSizeSnapshot,
      productSpecificationsSnapshot: item.productSpecificationsSnapshot,
      quantity: item.quantity,
      carbonType: item.carbonType,
      receivedQuantity: 0,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount
    }));

    await PurchaseItem.bulkCreate(itemsToCreate, { transaction });

    // IMPORTANT: Creating a purchase order must NOT increase inventory stock.
    // Stock is only modified upon goods receipt.
    await transaction.commit();

    const createdPurchase = await Purchase.findByPk(newPurchase.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseItem, as: 'items' }
      ]
    });

    res.status(201).json({
      message: `Purchase Order "${finalOrderNumber}" placed successfully.`,
      purchase: createdPurchase
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error placing purchase order:', error);
    res.status(500).json({ error: error.message || 'Internal server error while placing purchase order' });
  }
};

/**
 * POST /api/purchases/:id/receive & POST /api/purchases/receive - PART 2: ORDER RECEIVED
 * Records goods received against a Purchase Order, updates line quantities and stock atomically.
 */
exports.receiveGoods = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const targetIdOrNumber = req.params.id || req.body.id || req.body.orderId || req.body.purchaseNumber;
    const {
      receiptDate,
      remarks,
      idempotencyKey,
      items // Array of { purchaseItemId, quantityReceivedNow }
    } = req.body;

    if (!targetIdOrNumber) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Order ID or Purchase ID is required.' });
    }

    // 1. Idempotency control: prevent double counting of retried requests
    if (idempotencyKey && idempotencyKey.trim()) {
      const existingReceipt = await GoodsReceipt.findOne({
        where: { idempotencyKey: idempotencyKey.trim() },
        include: [{ model: GoodsReceiptItem, as: 'items' }],
        transaction
      });
      if (existingReceipt) {
        await transaction.rollback();
        return res.status(200).json({
          message: 'Receipt already recorded (idempotent).',
          receipt: existingReceipt,
          idempotent: true
        });
      }
    }

    // 2. Retrieve parent Purchase Order with row lock
    let whereCondition;
    if (!isNaN(Number(targetIdOrNumber))) {
      whereCondition = { [Op.or]: [{ id: Number(targetIdOrNumber) }, { purchaseNumber: String(targetIdOrNumber).trim() }] };
    } else {
      whereCondition = { purchaseNumber: String(targetIdOrNumber).trim() };
    }

    const purchase = await Purchase.findOne({
      where: whereCondition,
      include: [
        {
          model: PurchaseItem,
          as: 'items'
        }
      ],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: `Purchase Order "${targetIdOrNumber}" not found.` });
    }

    // 3. Office ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    if (purchase.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot record receipts against a cancelled purchase order.' });
    }

    // 4. Validate items received
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'At least one product line received quantity must be specified.' });
    }

    const receiptLinesToProcess = [];
    let totalQtyReceivedThisReceipt = 0;

    for (let i = 0; i < items.length; i++) {
      const inputItem = items[i];
      const purchaseItemId = parseInt(inputItem.purchaseItemId || inputItem.id, 10);
      const qtyReceivedNow = parseFloat(inputItem.quantityReceivedNow || inputItem.quantityReceived || 0);

      // Validate non-negative
      if (isNaN(qtyReceivedNow) || qtyReceivedNow < 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `Line #${i + 1}: Quantity received now cannot be negative. Received: ${inputItem.quantityReceivedNow}` 
        });
      }

      // Skip lines with 0 received now
      if (qtyReceivedNow === 0) {
        continue;
      }

      // Match against purchase order line item
      const orderLine = (purchase.items || []).find(it => it.id === purchaseItemId);
      if (!orderLine) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `Line item #${purchaseItemId} does not belong to Purchase Order "${purchase.purchaseNumber}". Unrelated products cannot be received.` 
        });
      }

      const orderedQty = parseFloat(orderLine.quantity) || 0;
      const previouslyReceivedQty = parseFloat(orderLine.receivedQuantity) || 0;
      const pendingQty = Math.max(0, orderedQty - previouslyReceivedQty);

      // Validate total received quantity does not exceed ordered quantity
      if (qtyReceivedNow > pendingQty) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Quantity received now (${qtyReceivedNow} Tons) exceeds pending quantity (${pendingQty} Tons) for "${orderLine.productNameSnapshot}". Over-receiving is not permitted.`
        });
      }

      totalQtyReceivedThisReceipt += qtyReceivedNow;
      receiptLinesToProcess.push({
        orderLine,
        qtyReceivedNow
      });
    }

    if (receiptLinesToProcess.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'At least one product line must have a quantity received now greater than 0.' });
    }

    // 5. Generate unique Receipt ID (GRN)
    const receiptNumber = await generateUniqueReceiptNumber(transaction);

    // 6. Create GoodsReceipt Header
    const goodsReceipt = await GoodsReceipt.create({
      receiptNumber,
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      organizationId: purchase.organizationId,
      receiptDate: receiptDate || new Date(),
      receivedBy: req.user.userId,
      remarks: remarks ? remarks.trim() : null,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null
    }, { transaction });

    // 7. Process each received line:
    //    - Record GoodsReceiptItem
    //    - Increment PurchaseItem.receivedQuantity
    //    - Increase Product.currentStock strictly by newly received quantity
    //    - Record traceable InventoryMovement
    for (const { orderLine, qtyReceivedNow } of receiptLinesToProcess) {
      // 7a. GoodsReceiptItem
      await GoodsReceiptItem.create({
        goodsReceiptId: goodsReceipt.id,
        purchaseItemId: orderLine.id,
        productId: orderLine.productId,
        productNameSnapshot: orderLine.productNameSnapshot,
        carbonType: orderLine.carbonType,
        quantityReceived: qtyReceivedNow
      }, { transaction });

      // 7b. Update PurchaseItem.receivedQuantity
      await orderLine.increment('receivedQuantity', { by: qtyReceivedNow, transaction });

      // 7c. Increase inventory stock for product if linked
      if (orderLine.productId) {
        await Product.increment('currentStock', {
          by: qtyReceivedNow,
          where: {
            id: orderLine.productId,
            organizationId: purchase.organizationId
          },
          transaction
        });

        // 7d. Record traceable inventory movement
        await InventoryMovement.create({
          organizationId: purchase.organizationId,
          productId: orderLine.productId,
          movementType: 'IN',
          quantity: qtyReceivedNow,
          referenceType: 'GOODS_RECEIPT',
          referenceId: goodsReceipt.id,
          referenceNumber: goodsReceipt.receiptNumber,
          purchaseItemId: orderLine.id,
          performedBy: req.user.userId,
          notes: `Goods Receipt #${goodsReceipt.receiptNumber} for PO #${purchase.purchaseNumber}: ${orderLine.productNameSnapshot} (${orderLine.carbonType})`
        }, { transaction });
      }
    }

    // 8. Recalculate Overall Order Status across all lines
    const allLines = await PurchaseItem.findAll({
      where: { purchaseId: purchase.id },
      transaction
    });

    const newOverallStatus = computeOrderStatus(allLines);
    await purchase.update({ status: newOverallStatus }, { transaction });

    await transaction.commit();

    // 9. Fetch complete receipt with items and updated purchase
    const completeReceipt = await GoodsReceipt.findByPk(goodsReceipt.id, {
      include: [
        { model: GoodsReceiptItem, as: 'items' },
        { model: User, as: 'receiver', attributes: ['id', 'username'] }
      ]
    });

    const updatedPurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: PurchaseItem, as: 'items' },
        { model: Organization, attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json({
      message: `Goods receipt "${receiptNumber}" recorded successfully. Total received now: ${totalQtyReceivedThisReceipt} Tons.`,
      status: newOverallStatus,
      receipt: completeReceipt,
      purchase: updatedPurchase
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error recording goods received:', error);
    res.status(500).json({ error: error.message || 'Internal server error while recording goods received' });
  }
};

/**
 * PUT /api/purchases/:id - Edit purchase order (if Pending)
 */
exports.updatePurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      purchaseDate,
      partyName,
      vendorName,
      purchaseDetails,
      remarks,
      items
    } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Only allow editing if no goods have been received yet
    const hasAnyReceived = (purchase.items || []).some(it => parseFloat(it.receivedQuantity) > 0);
    if (hasAnyReceived) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot modify this purchase order because goods have already been received against it.' 
      });
    }

    const effectivePartyName = (partyName || vendorName || '').trim();

    if (items && Array.isArray(items) && items.length > 0) {
      // Validate and rebuild items
      await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction });

      let totalOrderedQty = 0;
      let totalAmt = 0;
      const itemsToCreate = [];

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        let productName = (row.productNameSnapshot || row.productName || row.name || '').trim();
        let category = row.productCategorySnapshot || row.category || 'General';
        let size = row.productSizeSnapshot || row.size || '-';
        let specifications = row.productSpecificationsSnapshot || row.specifications || null;
        let unit = row.unit || 'Ton';

        let carbonType = (row.carbonType || '').trim();
        if (!carbonType) {
          carbonType = 'Low Carbon';
        } else if (!['Low Carbon', 'High Carbon'].includes(carbonType)) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `Row #${i + 1}: Carbon Type must be either "Low Carbon" or "High Carbon".` 
          });
        }

        let productId = (row.productId && !isNaN(Number(row.productId)) && Number(row.productId) > 0)
          ? parseInt(row.productId, 10)
          : null;

        if (productId) {
          const product = await Product.findByPk(productId, { transaction });
          if (product && product.organizationId === purchase.organizationId) {
            productName = product.name;
            category = product.category || category;
            size = product.size || size;
            unit = product.unit || unit;
          }
        }

        if (!productName) {
          await transaction.rollback();
          return res.status(400).json({ error: `Row #${i + 1}: Product name is required.` });
        }

        const q = parseFloat(row.quantity);
        if (isNaN(q) || q <= 0) {
          await transaction.rollback();
          return res.status(400).json({ error: `Row #${i + 1}: Quantity must be greater than 0.` });
        }

        const rate = parseFloat(row.rate) || 0;
        const amount = Math.round((q * rate + Number.EPSILON) * 100) / 100;

        totalOrderedQty += q;
        totalAmt += amount;

        itemsToCreate.push({
          purchaseId: purchase.id,
          productId,
          productNameSnapshot: productName,
          productCategorySnapshot: category,
          productSizeSnapshot: size,
          productSpecificationsSnapshot: specifications,
          quantity: q,
          carbonType,
          receivedQuantity: 0,
          unit,
          rate,
          amount
        });
      }

      await PurchaseItem.bulkCreate(itemsToCreate, { transaction });

      await purchase.update({
        purchaseDate: purchaseDate || purchase.purchaseDate,
        vendorName: effectivePartyName || purchase.vendorName,
        purchaseDetails: purchaseDetails !== undefined ? purchaseDetails : purchase.purchaseDetails,
        remarks: remarks !== undefined ? remarks : purchase.remarks,
        totalQuantity: totalOrderedQty,
        totalAmount: totalAmt,
        status: 'Pending'
      }, { transaction });
    } else {
      await purchase.update({
        purchaseDate: purchaseDate || purchase.purchaseDate,
        vendorName: effectivePartyName || purchase.vendorName,
        purchaseDetails: purchaseDetails !== undefined ? purchaseDetails : purchase.purchaseDetails,
        remarks: remarks !== undefined ? remarks : purchase.remarks
      }, { transaction });
    }

    await transaction.commit();

    const updatedPurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: PurchaseItem, as: 'items' },
        { model: Organization, attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json({
      message: `Purchase Order "${purchase.purchaseNumber}" updated successfully.`,
      purchase: updatedPurchase
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: error.message || 'Internal server error while updating purchase order' });
  }
};

/**
 * POST /api/purchases/:id/cancel - Cancel a purchase order if not yet received
 */
exports.cancelPurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const purchase = await Purchase.findByPk(id, {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    await verifyRecordOwnership(purchase, req.user);

    const hasAnyReceived = (purchase.items || []).some(it => parseFloat(it.receivedQuantity) > 0);
    if (hasAnyReceived) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot cancel a purchase order that has already received goods.' 
      });
    }

    await purchase.update({ status: 'CANCELLED' }, { transaction });
    await transaction.commit();

    res.status(200).json({
      message: `Purchase Order "${purchase.purchaseNumber}" has been cancelled.`,
      purchase
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling purchase:', error);
    res.status(500).json({ error: error.message || 'Internal server error while cancelling purchase' });
  }
};

// Legacy compatibility stubs for submit, approve, reject, override
exports.submitPurchase = async (req, res) => {
  res.status(200).json({ message: 'Purchase order is active and ready for receipt.' });
};

exports.approvePurchase = async (req, res) => {
  res.status(200).json({ message: 'Purchase order approved.' });
};

exports.rejectPurchase = async (req, res) => {
  res.status(200).json({ message: 'Purchase order rejected.' });
};

exports.overridePurchase = async (req, res) => {
  res.status(200).json({ message: 'Purchase order updated.' });
};
