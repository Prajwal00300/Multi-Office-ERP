const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Estimate = require('../models/Estimate');
const EstimateItem = require('../models/EstimateItem');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { calculateEstimateTotals } = require('../services/estimateCalculationService');
const { generateUniqueEstimateNumber } = require('../utils/estimateNumberGenerator');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

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
        }
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
    if (!customerId) {
      await t.rollback();
      return res.status(400).json({ error: 'Customer is required.' });
    }

    const customer = await Customer.findOne({
      where: {
        id: customerId,
        organizationId: targetOrgId
      },
      transaction: t
    });

    if (!customer) {
      await t.rollback();
      return res.status(400).json({ error: 'Selected customer not found in the designated organization.' });
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
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others);

    // 5. Generate persistent unique estimate number scoped to this office
    const estimateNumber = await generateUniqueEstimateNumber(targetOrgId, t);

    const isGenerated = status === 'GENERATED';

    // 6. Create Estimate
    const newEstimate = await Estimate.create({
      estimateNumber,
      organizationId: targetOrgId,
      customerId,
      estimateDate: estimateDate || new Date(),
      basic: basic ? basic.trim() : null,
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
      others: validatedOthers,
      grandTotal
    } = calculateEstimateTotals(preparedItems, others);

    // Update Estimate
    await estimate.update({
      customerId: customerId || estimate.customerId,
      estimateDate: estimateDate || estimate.estimateDate,
      basic: basic !== undefined ? (basic ? basic.trim() : null) : estimate.basic,
      totalQuantity,
      total,
      others: validatedOthers,
      grandTotal,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : estimate.notes
    }, { transaction: t });

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
