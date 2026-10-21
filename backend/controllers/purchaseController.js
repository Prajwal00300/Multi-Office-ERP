const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Purchase = require('../models/Purchase');
const PurchaseItem = require('../models/PurchaseItem');
const PurchaseAudit = require('../models/PurchaseAudit');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { calculatePurchaseTotals } = require('../services/purchaseCalculationService');
const { generateUniquePurchaseNumber } = require('../utils/purchaseNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

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
      whereClause.status = status.trim().toUpperCase();
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
          model: User,
          as: 'submitter',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: PurchaseItem,
          as: 'items'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(purchases);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchases' });
  }
};

/**
 * GET /api/purchases/:id - Retrieve purchase details and audit history
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
          model: User,
          as: 'submitter',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'overrider',
          attributes: ['id', 'username']
        },
        {
          model: PurchaseItem,
          as: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'category', 'size', 'unit', 'specifications']
            }
          ]
        },
        {
          model: PurchaseAudit,
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

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    await verifyRecordOwnership(purchase, req.user);

    res.status(200).json(purchase);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching purchase details:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase details' });
  }
};

/**
 * POST /api/purchases - Create a new purchase record
 */
exports.createPurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      vendorName,
      purchaseDate,
      purchaseDetails,
      remarks,
      items,
      totalAmount: manualAmount,
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

    // Process line items if provided
    const enrichedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        let productName = item.productNameSnapshot || item.name || '';
        let category = item.productCategorySnapshot || item.category || null;
        let size = item.productSizeSnapshot || item.size || null;
        let specifications = item.productSpecificationsSnapshot || item.specifications || null;
        let unit = item.unit || 'Kg';

        let productId = (item.productId && !isNaN(Number(item.productId)) && Number(item.productId) > 0)
          ? parseInt(item.productId, 10)
          : null;
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
          return res.status(400).json({ error: 'Product name or description is required for all line items.' });
        }

        enrichedItems.push({
          productId,
          productNameSnapshot: productName.trim(),
          productCategorySnapshot: category,
          productSizeSnapshot: size,
          productSpecificationsSnapshot: specifications,
          quantity: item.quantity,
          unit,
          rate: item.rate
        });
      }
    }

    // Calculate authoritative totals
    const calculated = calculatePurchaseTotals(enrichedItems, manualAmount);

    // Generate unique sequential purchase number
    const purchaseNumber = await generateUniquePurchaseNumber(transaction);

    // Create Purchase
    const newPurchase = await Purchase.create({
      purchaseNumber,
      organizationId: targetOrgId,
      purchaseDate: purchaseDate || new Date(),
      vendorName: vendorName ? vendorName.trim() : null,
      purchaseDetails: purchaseDetails ? purchaseDetails.trim() : null,
      totalQuantity: calculated.totalQuantity,
      totalAmount: calculated.totalAmount,
      status: 'DRAFT',
      createdBy: req.user.userId,
      remarks: remarks ? remarks.trim() : null
    }, { transaction });

    // Create Purchase Items
    if (calculated.calculatedItems.length > 0) {
      const itemsToCreate = calculated.calculatedItems.map(item => ({
        purchaseId: newPurchase.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        amount: item.amount
      }));

      await PurchaseItem.bulkCreate(itemsToCreate, { transaction });
    }

    // Record Audit
    await PurchaseAudit.create({
      purchaseId: newPurchase.id,
      purchaseNumber: newPurchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_CREATED',
      reason: 'Draft purchase record created',
      newValues: JSON.stringify({
        purchaseNumber: newPurchase.purchaseNumber,
        vendorName: newPurchase.vendorName,
        totalAmount: newPurchase.totalAmount,
        totalQuantity: newPurchase.totalQuantity,
        itemCount: calculated.calculatedItems.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const createdPurchase = await Purchase.findByPk(newPurchase.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseItem, as: 'items' }
      ]
    });

    res.status(201).json(createdPurchase);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: error.message || 'Internal server error while creating purchase record' });
  }
};

/**
 * PUT /api/purchases/:id - Update purchase record
 */
exports.updatePurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      vendorName,
      purchaseDate,
      purchaseDetails,
      remarks,
      items,
      totalAmount: manualAmount
    } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    // Block standard update if approved
    if (purchase.status === 'APPROVED') {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Approved purchases are locked and cannot be edited. An authorized modification by an Admin is required.'
      });
    }

    const enrichedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        let productName = item.productNameSnapshot || item.name || '';
        let category = item.productCategorySnapshot || item.category || null;
        let size = item.productSizeSnapshot || item.size || null;
        let specifications = item.productSpecificationsSnapshot || item.specifications || null;
        let unit = item.unit || 'Kg';

        let productId = (item.productId && !isNaN(Number(item.productId)) && Number(item.productId) > 0)
          ? parseInt(item.productId, 10)
          : null;
        if (productId) {
          const product = await Product.findByPk(productId, { transaction });
          if (product) {
            if (product.organizationId !== purchase.organizationId) {
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
          return res.status(400).json({ error: 'Product name or description is required for all line items.' });
        }

        enrichedItems.push({
          productId,
          productNameSnapshot: productName.trim(),
          productCategorySnapshot: category,
          productSizeSnapshot: size,
          productSpecificationsSnapshot: specifications,
          quantity: item.quantity,
          unit,
          rate: item.rate
        });
      }
    }

    const calculated = calculatePurchaseTotals(enrichedItems, manualAmount);

    const previousSnapshot = {
      vendorName: purchase.vendorName,
      purchaseDate: purchase.purchaseDate,
      purchaseDetails: purchase.purchaseDetails,
      totalQuantity: purchase.totalQuantity,
      totalAmount: purchase.totalAmount,
      items: purchase.items.map(i => ({
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount
      }))
    };

    // Update purchase record
    await purchase.update({
      vendorName: vendorName !== undefined ? (vendorName ? vendorName.trim() : null) : purchase.vendorName,
      purchaseDate: purchaseDate || purchase.purchaseDate,
      purchaseDetails: purchaseDetails !== undefined ? (purchaseDetails ? purchaseDetails.trim() : null) : purchase.purchaseDetails,
      remarks: remarks !== undefined ? (remarks ? remarks.trim() : null) : purchase.remarks,
      totalQuantity: calculated.totalQuantity,
      totalAmount: calculated.totalAmount
    }, { transaction });

    // Replace line items
    await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction });

    if (calculated.calculatedItems.length > 0) {
      const itemsToCreate = calculated.calculatedItems.map(item => ({
        purchaseId: purchase.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        amount: item.amount
      }));

      await PurchaseItem.bulkCreate(itemsToCreate, { transaction });
    }

    // Record audit
    await PurchaseAudit.create({
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_UPDATED',
      reason: 'Purchase record details updated',
      previousValues: JSON.stringify(previousSnapshot),
      newValues: JSON.stringify({
        vendorName: purchase.vendorName,
        totalQuantity: calculated.totalQuantity,
        totalAmount: calculated.totalAmount,
        itemCount: calculated.calculatedItems.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const updatedPurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: PurchaseItem, as: 'items' }
      ]
    });

    res.status(200).json(updatedPurchase);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating purchase:', error);
    res.status(500).json({ error: error.message || 'Internal server error while updating purchase' });
  }
};

/**
 * POST /api/purchases/:id/submit - Submit purchase for CEO/Admin approval
 */
exports.submitPurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const purchase = await Purchase.findByPk(id, { transaction });
    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    if (purchase.status === 'APPROVED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Purchase is already approved.' });
    }

    if (purchase.status === 'PENDING_APPROVAL') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Purchase is already submitted and pending review.' });
    }

    const previousStatus = purchase.status;

    await purchase.update({
      status: 'PENDING_APPROVAL',
      submittedAt: new Date(),
      submittedBy: req.user.userId
    }, { transaction });

    await PurchaseAudit.create({
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_SUBMITTED',
      reason: 'Purchase submitted for review and approval',
      previousValues: JSON.stringify({ status: previousStatus }),
      newValues: JSON.stringify({ status: 'PENDING_APPROVAL', submittedBy: req.user.userId }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    res.status(200).json({ message: 'Purchase submitted for approval successfully', purchase });
  } catch (error) {
    await transaction.rollback();
    console.error('Error submitting purchase:', error);
    res.status(500).json({ error: 'Internal server error while submitting purchase' });
  }
};

/**
 * POST /api/purchases/:id/approve - Review and approve purchase (CEO / Admin only)
 */
exports.approvePurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    // RBAC: Only Super Admin, CEO, and Admin can approve
    if (!['SUPER_ADMIN', 'CEO', 'ADMIN'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Permission denied: Only CEO / Admin or Super Admin can approve purchase records.' });
    }

    const purchase = await Purchase.findByPk(id, { transaction });
    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    if (purchase.status === 'APPROVED') {
      await transaction.rollback();
      return res.status(400).json({ error: 'This purchase record is already approved.' });
    }

    const previousStatus = purchase.status;

    await purchase.update({
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: req.user.userId,
      rejectionReason: null
    }, { transaction });

    await PurchaseAudit.create({
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_APPROVED',
      reason: 'Purchase approved by authorized executive',
      previousValues: JSON.stringify({ status: previousStatus }),
      newValues: JSON.stringify({
        status: 'APPROVED',
        approvedBy: req.user.userId,
        approvedAt: purchase.approvedAt
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const approvedPurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'approver', attributes: ['id', 'username'] },
        { model: PurchaseItem, as: 'items' }
      ]
    });

    res.status(200).json(approvedPurchase);
  } catch (error) {
    await transaction.rollback();
    console.error('Error approving purchase:', error);
    res.status(500).json({ error: 'Internal server error while approving purchase' });
  }
};

/**
 * POST /api/purchases/:id/reject - Reject purchase submission
 */
exports.rejectPurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!['SUPER_ADMIN', 'CEO', 'ADMIN'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Permission denied: Only CEO / Admin or Super Admin can reject purchase records.' });
    }

    if (!reason || !reason.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A valid reason is required to reject a purchase.' });
    }

    const purchase = await Purchase.findByPk(id, { transaction });
    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const previousStatus = purchase.status;

    await purchase.update({
      status: 'REJECTED',
      rejectionReason: reason.trim()
    }, { transaction });

    await PurchaseAudit.create({
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_REJECTED',
      reason: reason.trim(),
      previousValues: JSON.stringify({ status: previousStatus }),
      newValues: JSON.stringify({ status: 'REJECTED', reason: reason.trim() }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    res.status(200).json({ message: 'Purchase rejected', purchase });
  } catch (error) {
    await transaction.rollback();
    console.error('Error rejecting purchase:', error);
    res.status(500).json({ error: 'Internal server error while rejecting purchase' });
  }
};

/**
 * POST /api/purchases/:id/override - Authorized modification of approved purchases (Admin only)
 */
exports.overridePurchase = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      reason,
      vendorName,
      purchaseDate,
      purchaseDetails,
      remarks,
      items,
      totalAmount: manualAmount
    } = req.body;

    if (!['SUPER_ADMIN', 'CEO', 'ADMIN'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Permission denied: Only Admin, CEO, or Super Admin can modify an approved purchase.' });
    }

    if (!reason || !reason.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'A mandatory reason is required for an authorized modification of an approved purchase.' });
    }

    const purchase = await Purchase.findByPk(id, {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction
    });

    if (!purchase) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(purchase, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const enrichedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        let productName = item.productNameSnapshot || item.name || '';
        let category = item.productCategorySnapshot || item.category || null;
        let size = item.productSizeSnapshot || item.size || null;
        let specifications = item.productSpecificationsSnapshot || item.specifications || null;
        let unit = item.unit || 'Kg';

        let productId = (item.productId && !isNaN(Number(item.productId)) && Number(item.productId) > 0)
          ? parseInt(item.productId, 10)
          : null;
        if (productId) {
          const product = await Product.findByPk(productId, { transaction });
          if (product) {
            if (product.organizationId !== purchase.organizationId) {
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
          return res.status(400).json({ error: 'Product name or description is required for all line items.' });
        }

        enrichedItems.push({
          productId,
          productNameSnapshot: productName.trim(),
          productCategorySnapshot: category,
          productSizeSnapshot: size,
          productSpecificationsSnapshot: specifications,
          quantity: item.quantity,
          unit,
          rate: item.rate
        });
      }
    }

    const calculated = calculatePurchaseTotals(enrichedItems, manualAmount);

    const previousSnapshot = {
      status: purchase.status,
      vendorName: purchase.vendorName,
      purchaseDate: purchase.purchaseDate,
      purchaseDetails: purchase.purchaseDetails,
      totalQuantity: purchase.totalQuantity,
      totalAmount: purchase.totalAmount,
      items: purchase.items.map(i => ({
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount
      }))
    };

    await purchase.update({
      vendorName: vendorName !== undefined ? (vendorName ? vendorName.trim() : null) : purchase.vendorName,
      purchaseDate: purchaseDate || purchase.purchaseDate,
      purchaseDetails: purchaseDetails !== undefined ? (purchaseDetails ? purchaseDetails.trim() : null) : purchase.purchaseDetails,
      remarks: remarks !== undefined ? (remarks ? remarks.trim() : null) : purchase.remarks,
      totalQuantity: calculated.totalQuantity,
      totalAmount: calculated.totalAmount,
      status: 'OVERRIDDEN',
      lastOverriddenBy: req.user.userId,
      lastOverriddenAt: new Date()
    }, { transaction });

    await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction });

    if (calculated.calculatedItems.length > 0) {
      const itemsToCreate = calculated.calculatedItems.map(item => ({
        purchaseId: purchase.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        productCategorySnapshot: item.productCategorySnapshot,
        productSizeSnapshot: item.productSizeSnapshot,
        productSpecificationsSnapshot: item.productSpecificationsSnapshot,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        amount: item.amount
      }));

      await PurchaseItem.bulkCreate(itemsToCreate, { transaction });
    }

    await PurchaseAudit.create({
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      userId: req.user.userId,
      action: 'PURCHASE_AUTHORIZED_MODIFICATION',
      reason: reason.trim(),
      previousValues: JSON.stringify(previousSnapshot),
      newValues: JSON.stringify({
        status: 'OVERRIDDEN',
        lastOverriddenBy: req.user.userId,
        vendorName: purchase.vendorName,
        totalQuantity: calculated.totalQuantity,
        totalAmount: calculated.totalAmount,
        itemCount: calculated.calculatedItems.length
      }),
      ipAddress: req.ip || req.connection.remoteAddress
    }, { transaction });

    await transaction.commit();

    const overriddenPurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: User, as: 'overrider', attributes: ['id', 'username'] },
        { model: PurchaseItem, as: 'items' }
      ]
    });

    res.status(200).json(overriddenPurchase);
  } catch (error) {
    await transaction.rollback();
    console.error('Error overriding purchase:', error);
    res.status(500).json({ error: error.message || 'Internal server error while performing authorized override' });
  }
};

/**
 * GET /api/purchases/:id/audit - Retrieve purchase audit history
 */
exports.getPurchaseAudits = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findByPk(id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    // Ownership check
    await verifyRecordOwnership(purchase, req.user);

    const audits = await PurchaseAudit.findAll({
      where: { purchaseId: id },
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
    console.error('Error fetching purchase audits:', error);
    res.status(500).json({ error: 'Internal server error while fetching purchase audit logs' });
  }
};
