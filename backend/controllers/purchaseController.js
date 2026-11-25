const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const PurchaseEstimate = require('../models/PurchaseEstimate');
const PurchaseEstimateItem = require('../models/PurchaseEstimateItem');
const PurchaseEstimateAllocation = require('../models/PurchaseEstimateAllocation');
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
  ensureCustomerForParty,
  ensureProductForOrderLine
} = require('../utils/syncPurchaseMasterData');
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
      let computedTotalAmount = parseFloat(pJson.totalAmount) || 0;
      let itemsTotalAmount = 0;

      const enrichedItems = (pJson.items || []).map(item => {
        const ordered = parseFloat(item.quantity) || 0;
        const received = parseFloat(item.receivedQuantity) || 0;
        const pending = Math.max(0, ordered - received);
        const rate = parseFloat(item.rate) || 0;
        const itemAmt = parseFloat(item.amount) || (ordered * rate);

        totalOrdered += ordered;
        totalReceived += received;
        itemsTotalAmount += itemAmt;

        return {
          ...item,
          orderedQuantity: ordered,
          previouslyReceivedQuantity: received,
          pendingQuantity: pending,
          rate,
          amount: itemAmt
        };
      });

      const finalTotalAmount = computedTotalAmount > 0 ? computedTotalAmount : itemsTotalAmount;
      const averagePrice = totalOrdered > 0 ? parseFloat((finalTotalAmount / totalOrdered).toFixed(2)) : 0;

      return {
        ...pJson,
        items: enrichedItems,
        totalOrderedQuantity: totalOrdered,
        totalReceivedQuantity: totalReceived,
        totalPendingQuantity: Math.max(0, totalOrdered - totalReceived),
        totalAmount: finalTotalAmount,
        averagePrice
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
    const { organizationId, date } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const effectiveOrgId = (targetOfficeIds && targetOfficeIds.length > 0) ? targetOfficeIds[0] : req.user.organizationId;
    const nextPurchaseNumber = await generateUniquePurchaseNumber(effectiveOrgId, null, date);
    res.status(200).json({ nextPurchaseNumber });
  } catch (error) {
    console.error('Error generating next purchase number preview:', error);
    res.status(500).json({ error: 'Failed to generate next purchase order number preview' });
  }
};

/**
 * GET /api/purchases/in-hand-order-summary
 * Calculates:
 * purchase total order pending + in house stock - sales total order pending = in hand order
 * Both aggregate totals and product-wise breakdown.
 */
exports.getInHandOrderSummary = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    const officeWhereClause = buildOfficeWhereClause(targetOfficeIds);

    // 1. Fetch In-House Stock from Products for target office
    const products = await Product.findAll({
      where: {
        ...officeWhereClause,
        status: 'ACTIVE'
      },
      attributes: ['id', 'name', 'unit', 'currentStock', 'organizationId']
    });

    const productMap = new Map();
    let totalInHouseStock = 0;

    for (const prod of products) {
      const stock = parseFloat(prod.currentStock) || 0;
      totalInHouseStock += stock;

      productMap.set(prod.id, {
        productId: prod.id,
        productName: prod.name,
        unit: prod.unit || 'Tons',
        purchasePending: 0,
        inHouseStock: stock,
        salesPending: 0,
        inHandOrder: stock
      });
    }

    // Helper to find product by id or case-insensitive name
    const findOrAddProduct = (productId, name) => {
      if (productId && productMap.has(productId)) {
        return productMap.get(productId);
      }
      const normName = (name || '').trim().toLowerCase();
      for (const item of productMap.values()) {
        if ((item.productName || '').trim().toLowerCase() === normName) {
          return item;
        }
      }
      const newEntry = {
        productId: productId || null,
        productName: name || 'Unassigned Product',
        unit: 'Tons',
        purchasePending: 0,
        inHouseStock: 0,
        salesPending: 0,
        inHandOrder: 0
      };
      if (productId) {
        productMap.set(productId, newEntry);
      } else {
        productMap.set(`name_${normName || Math.random()}`, newEntry);
      }
      return newEntry;
    };

    // 2. Fetch Pending Quantities from Purchase Orders
    const purchases = await Purchase.findAll({
      where: {
        ...officeWhereClause,
        status: { [Op.ne]: 'CANCELLED' }
      },
      include: [
        {
          model: PurchaseItem,
          as: 'items'
        }
      ]
    });

    let totalPurchasePending = 0;
    let sumOfOrderAvgPrices = 0;
    let totalPurchasesOrderedTons = 0;
    let totalPurchasesValue = 0;

    for (const po of purchases) {
      const pJson = po.toJSON();
      let poOrdered = parseFloat(pJson.totalOrderedQuantity) || parseFloat(pJson.totalQuantity) || 0;
      let poValue = parseFloat(pJson.totalAmount) || 0;
      let itemsVal = 0;
      let itemsQty = 0;

      for (const it of (pJson.items || [])) {
        const ord = parseFloat(it.quantity) || 0;
        const rec = parseFloat(it.receivedQuantity) || 0;
        const rate = parseFloat(it.rate) || 0;
        const amt = parseFloat(it.amount) || (ord * rate);
        const pen = Math.max(0, ord - rec);

        itemsQty += ord;
        itemsVal += amt;

        const entry = findOrAddProduct(it.productId, it.productNameSnapshot);
        if (pen > 0) {
          totalPurchasePending += pen;
          entry.purchasePending += pen;
        }

        if (!entry.productPurchaseVal) entry.productPurchaseVal = 0;
        if (!entry.productPurchaseQty) entry.productPurchaseQty = 0;
        entry.productPurchaseVal += amt;
        entry.productPurchaseQty += ord;
      }

      if (poOrdered <= 0) poOrdered = itemsQty;
      if (poValue <= 0) poValue = itemsVal;
      const poAvgPrice = poOrdered > 0 ? (poValue / poOrdered) : (parseFloat(pJson.averagePrice) || 0);

      if (poOrdered > 0 && poAvgPrice > 0) {
        sumOfOrderAvgPrices += poAvgPrice;
        totalPurchasesOrderedTons += poOrdered;
        totalPurchasesValue += poValue;
      }
    }

    // Formula: (avgPrice1 + avgPrice2 + ...) / (qty1 + qty2 + ...) e.g. (69000 + 58000) / (140 + 100)
    const inHandAveragePrice = totalPurchasesOrderedTons > 0 ? parseFloat((sumOfOrderAvgPrices / totalPurchasesOrderedTons).toFixed(2)) : 0;
    const weightedAveragePrice = totalPurchasesOrderedTons > 0 ? parseFloat((totalPurchasesValue / totalPurchasesOrderedTons).toFixed(2)) : 0;

    // 3. Fetch Pending Quantities from Sale Orders
    let totalSalesPending = 0;
    try {
      const { ensureSaleOrderTablesExist } = require('./saleOrderController');
      await ensureSaleOrderTablesExist();
      const SaleOrder = require('../models/SaleOrder');
      const SaleOrderItem = require('../models/SaleOrderItem');

      const saleOrders = await SaleOrder.findAll({
        where: {
          ...officeWhereClause,
          status: { [Op.ne]: 'CANCELLED' }
        },
        include: [
          {
            model: SaleOrderItem,
            as: 'items'
          }
        ]
      });

      for (const so of saleOrders) {
        for (const it of (so.items || [])) {
          const ord = parseFloat(it.quantity) || 0;
          const proc = parseFloat(it.processedQuantity) || 0;
          const pen = Math.max(0, ord - proc);
          if (pen > 0) {
            totalSalesPending += pen;
            const entry = findOrAddProduct(it.productId, it.productNameSnapshot);
            entry.salesPending += pen;
          }
        }
      }
    } catch (soErr) {
      console.warn('Could not query SaleOrder for in-hand order summary:', soErr.message);
    }

    // 4. Calculate In-Hand Order for each product and overall
    totalPurchasePending = parseFloat(totalPurchasePending.toFixed(3));
    totalInHouseStock = parseFloat(totalInHouseStock.toFixed(3));
    totalSalesPending = parseFloat(totalSalesPending.toFixed(3));
    const totalInHandOrder = parseFloat((totalPurchasePending + totalInHouseStock - totalSalesPending).toFixed(3));

    const productBreakdown = Array.from(productMap.values()).map(p => {
      const pPend = parseFloat(p.purchasePending.toFixed(3));
      const sStock = parseFloat(p.inHouseStock.toFixed(3));
      const sPend = parseFloat(p.salesPending.toFixed(3));
      const inHand = parseFloat((pPend + sStock - sPend).toFixed(3));
      const pVal = p.productPurchaseVal || 0;
      const pQty = p.productPurchaseQty || 0;
      const avgPrice = pQty > 0 ? parseFloat((pVal / pQty).toFixed(2)) : 0;
      return {
        productId: p.productId,
        productName: p.productName,
        unit: p.unit,
        purchasePending: pPend,
        inHouseStock: sStock,
        salesPending: sPend,
        inHandOrder: inHand,
        averagePrice: avgPrice
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));

    res.status(200).json({
      purchaseTotalOrderPending: totalPurchasePending,
      inHouseStock: totalInHouseStock,
      salesTotalOrderPending: totalSalesPending,
      inHandOrder: totalInHandOrder,
      inHandAveragePrice,
      weightedAveragePrice,
      productBreakdown
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error calculating In Hand Order summary:', error);
    res.status(500).json({ error: 'Failed to calculate In Hand Order summary' });
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
    let computedTotalAmount = parseFloat(pJson.totalAmount) || 0;
    let itemsTotalAmount = 0;

    const enrichedItems = (pJson.items || []).map(item => {
      const ordered = parseFloat(item.quantity) || 0;
      const received = parseFloat(item.receivedQuantity) || 0;
      const pending = Math.max(0, ordered - received);
      const rate = parseFloat(item.rate) || 0;
      const itemAmt = parseFloat(item.amount) || (ordered * rate);

      totalOrdered += ordered;
      totalReceived += received;
      itemsTotalAmount += itemAmt;

      return {
        ...item,
        orderedQuantity: ordered,
        previouslyReceivedQuantity: received,
        pendingQuantity: pending,
        rate,
        amount: itemAmt
      };
    });

    const finalTotalAmount = computedTotalAmount > 0 ? computedTotalAmount : itemsTotalAmount;
    const averagePrice = totalOrdered > 0 ? parseFloat((finalTotalAmount / totalOrdered).toFixed(2)) : 0;

    // Fetch linked Purchase Estimate Vouchers (receipts created via Purchase Estimate Voucher)
    let purchaseEstimateReceipts = [];
    try {
      const allocs = await PurchaseEstimateAllocation.findAll({
        where: { purchaseId: purchase.id },
        include: [
          {
            model: PurchaseEstimate,
            as: 'purchaseEstimate',
            include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }]
          },
          {
            model: PurchaseItem,
            as: 'purchaseItem',
            attributes: ['id', 'productNameSnapshot', 'carbonType', 'unit']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      const byEst = new Map();
      for (const a of allocs) {
        const est = a.purchaseEstimate;
        if (!est) continue;
        if (!byEst.has(est.id)) {
          byEst.set(est.id, {
            id: est.id,
            estimateNumber: est.estimateNumber,
            estimateDate: est.estimateDate,
            vehicle: est.vehicle,
            notes: est.notes,
            creator: est.creator,
            items: []
          });
        }
        byEst.get(est.id).items.push({
          purchaseItemId: a.purchaseItemId,
          productNameSnapshot: a.purchaseItem?.productNameSnapshot || 'Product',
          carbonType: a.purchaseItem?.carbonType || 'Low Carbon',
          unit: a.purchaseItem?.unit || 'Ton',
          quantityReceived: parseFloat(a.allocatedQuantity) || 0
        });
      }
      purchaseEstimateReceipts = Array.from(byEst.values());
    } catch (peAllocErr) {
      // Table may not exist yet on fresh DB before first purchase estimate; safe to ignore
      purchaseEstimateReceipts = [];
    }

    res.status(200).json({
      ...pJson,
      items: enrichedItems,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      totalPendingQuantity: Math.max(0, totalOrdered - totalReceived),
      totalAmount: finalTotalAmount,
      averagePrice,
      purchaseEstimateReceipts
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
 * GET /api/purchases/navigation/previous - Fetch previous purchase order in sequence
 */
exports.getPreviousPurchase = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.lt]: parseInt(currentId, 10) };
    }

    const purchase = await Purchase.findOne({
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
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    if (!purchase) {
      return res.status(404).json({ error: 'No preceding purchase order found for this office' });
    }

    await verifyRecordOwnership(purchase, req.user);
    res.status(200).json(purchase);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching previous purchase:', error);
    res.status(500).json({ error: 'Internal server error while fetching previous purchase' });
  }
};

/**
 * GET /api/purchases/navigation/next - Fetch next purchase order in sequence
 */
exports.getNextPurchase = async (req, res) => {
  try {
    const { currentId, organizationId } = req.query;
    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (currentId && !isNaN(Number(currentId))) {
      whereClause.id = { [Op.gt]: parseInt(currentId, 10) };
    }

    const purchase = await Purchase.findOne({
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
              attributes: ['id', 'name', 'unit', 'difference', 'specifications']
            }
          ]
        }
      ],
      order: [['id', 'ASC']]
    });

    if (!purchase) {
      return res.status(404).json({ error: 'No subsequent purchase order found for this office' });
    }

    await verifyRecordOwnership(purchase, req.user);
    res.status(200).json(purchase);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching next purchase:', error);
    res.status(500).json({ error: 'Internal server error while fetching next purchase' });
  }
};

/**
 * GET /api/purchases/lookup/:orderId - Look up purchase order by Order ID / purchaseNumber
 */
exports.lookupPurchaseByNumber = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || !orderId.trim()) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const cleanOrderId = orderId.trim();

    const orConditions = [
      { purchaseNumber: cleanOrderId },
      { purchaseNumber: { [Op.like]: `%${cleanOrderId}%` } }
    ];
    if (!isNaN(Number(cleanOrderId))) {
      orConditions.push({ id: Number(cleanOrderId) });
    }

    const whereClause = {
      [Op.or]: orConditions
    };

    const targetOrgId = req.query.organizationId || (req.user && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO' ? req.user.organizationId : null);
    if (targetOrgId) {
      whereClause.organizationId = targetOrgId;
    }

    const purchase = await Purchase.findOne({
      where: whereClause,
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

    // Auto-register new party in Customer Master so it appears in Purchase Estimate Voucher
    if (effectivePartyName) {
      await ensureCustomerForParty(targetOrgId, effectivePartyName, transaction);
    }

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

      // If no existing productId was linked, auto-register or match the product in Product Master (stock stays 0 until received)
      if (!productId && productName) {
        const syncedProduct = await ensureProductForOrderLine(
          targetOrgId,
          { name: productName, unit, specifications },
          transaction
        );
        if (syncedProduct) {
          productId = syncedProduct.id;
          productName = syncedProduct.name;
          unit = syncedProduct.unit || unit;
          specifications = syncedProduct.specifications || specifications;
        }
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

    // 3. Resolve Serial Number (purchaseNumber: sequential integer 1, 2, 3, 4...)
    const effectivePurchaseDate = purchaseDate ? String(purchaseDate).split('T')[0] : new Date().toISOString().split('T')[0];
    let finalOrderNumber = (purchaseNumber && /^[0-9]+$/.test(String(purchaseNumber).trim()))
      ? String(parseInt(purchaseNumber, 10))
      : null;

    if (finalOrderNumber) {
      const existing = await Purchase.findOne({
        where: { purchaseNumber: finalOrderNumber, organizationId: targetOrgId, purchaseDate: effectivePurchaseDate },
        transaction
      });
      if (existing) {
        finalOrderNumber = await generateUniquePurchaseNumber(targetOrgId, transaction, effectivePurchaseDate);
      }
    } else {
      finalOrderNumber = await generateUniquePurchaseNumber(targetOrgId, transaction, effectivePurchaseDate);
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

    if (effectivePartyName) {
      await ensureCustomerForParty(purchase.organizationId, effectivePartyName, transaction);
    }

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

        if (!productId && productName) {
          const syncedProduct = await ensureProductForOrderLine(
            purchase.organizationId,
            { name: productName, unit, specifications },
            transaction
          );
          if (syncedProduct) {
            productId = syncedProduct.id;
            productName = syncedProduct.name;
            unit = syncedProduct.unit || unit;
          }
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

// DELETE /api/purchases/:id
exports.deletePurchase = async (req, res) => {
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

    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const hasAnyReceived = (purchase.items || []).some(it => parseFloat(it.receivedQuantity) > 0);
    if (hasAnyReceived) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Cannot delete a purchase order that has already received goods.'
      });
    }

    // Delete purchase items and purchase
    await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction });
    await purchase.destroy({ transaction });

    await transaction.commit();
    res.status(200).json({ message: 'Purchase Order deleted successfully.' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting purchase:', error);
    res.status(500).json({ error: error.message || 'Internal server error while deleting purchase' });
  }
};

