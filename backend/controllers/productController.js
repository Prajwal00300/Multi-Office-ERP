const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const BillItem = require('../models/BillItem');
const EstimateItem = require('../models/EstimateItem');
const PurchaseItem = require('../models/PurchaseItem');
const GoodsReceiptItem = require('../models/GoodsReceiptItem');
const InventoryMovement = require('../models/InventoryMovement');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

// Product Controller

// GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, status, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    // Category filter
    if (category && category.trim() !== '' && category !== 'ALL') {
      whereClause.category = category.trim();
    }

    // Status filter
    if (status && status.trim() !== '' && status !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    // Search query
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { name: { [Op.like]: searchTerm } },
          { category: { [Op.like]: searchTerm } },
          { size: { [Op.like]: searchTerm } },
          { description: { [Op.like]: searchTerm } },
          { specifications: { [Op.like]: searchTerm } }
        ]
      };
    }

    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(products);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error while fetching products' });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Ownership check
    await verifyRecordOwnership(product, req.user);

    res.status(200).json(product);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Internal server error while fetching product details' });
  }
};

// POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      size,
      unit,
      price,
      difference,
      quantity,
      currentStock,
      description,
      specifications,
      status,
      organizationId
    } = req.body;

    const targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    const productCategory = (category && category.trim()) ? category.trim() : 'General';
    const productSize = (size && size.trim()) ? size.trim() : '-';
    const productUnit = (unit && unit.trim()) ? unit.trim() : 'Ton';

    // Difference / Price: accept either difference or price, support positive, zero, and negative values
    const rawDiff = (difference !== undefined && difference !== null && difference !== '')
      ? difference
      : price;

    if (rawDiff === undefined || rawDiff === null || rawDiff === '') {
      return res.status(400).json({ error: 'Product difference is required' });
    }
    const parsedDiff = parseFloat(rawDiff);
    if (isNaN(parsedDiff)) {
      return res.status(400).json({ error: 'Product difference must be a valid number' });
    }

    // Quantity / Current Stock: how much quantity is in the inventory
    const rawQty = (quantity !== undefined && quantity !== null && quantity !== '')
      ? quantity
      : currentStock;
    const parsedStock = (rawQty !== undefined && rawQty !== null && rawQty !== '')
      ? parseFloat(rawQty)
      : 0;

    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Quantity must be a valid non-negative number' });
    }

    if (status && !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    // Format specifications
    let formattedSpecs = null;
    if (specifications) {
      formattedSpecs = typeof specifications === 'object'
        ? JSON.stringify(specifications)
        : specifications.trim();
    }

    // Check duplicate in same organization (by name)
    const existingProduct = await Product.findOne({
      where: {
        organizationId: targetOrgId,
        name: name.trim()
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        error: `A product '${name.trim()}' already exists in this organization.`
      });
    }

    const newProduct = await Product.create({
      organizationId: targetOrgId,
      name: name.trim(),
      category: productCategory,
      size: productSize,
      unit: productUnit,
      price: parsedDiff,
      difference: parsedDiff,
      currentStock: parsedStock,
      description: description ? description.trim() : null,
      specifications: formattedSpecs,
      status: status ? status.toUpperCase() : 'ACTIVE'
    });

    // If initial inventory quantity was entered, record initial inventory movement
    if (parsedStock > 0) {
      try {
        await InventoryMovement.create({
          organizationId: targetOrgId,
          productId: newProduct.id,
          movementType: 'IN',
          quantity: parsedStock,
          referenceType: 'MANUAL',
          referenceNumber: 'INITIAL_STOCK',
          performedBy: req.user?.userId || null,
          notes: 'Initial inventory quantity recorded during product creation'
        });
      } catch (invErr) {
        console.warn('Note recording initial inventory movement:', invErr.message);
      }
    }

    const createdProductWithOrg = await Product.findByPk(newProduct.id, {
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: createdProductWithOrg
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error while creating product' });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      size,
      unit,
      price,
      difference,
      quantity,
      currentStock,
      description,
      specifications,
      status
    } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Ownership check
    await verifyRecordOwnership(product, req.user);

    // Validate required fields if updated
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }
    if (unit !== undefined && !unit.trim()) {
      return res.status(400).json({ error: 'Unit of measurement cannot be empty' });
    }
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    let targetDiff = product.difference !== undefined ? product.difference : product.price;
    const rawDiff = difference !== undefined ? difference : price;
    if (rawDiff !== undefined && rawDiff !== null && rawDiff !== '') {
      const parsedDiff = parseFloat(rawDiff);
      if (isNaN(parsedDiff)) {
        return res.status(400).json({ error: 'Product difference must be a valid number' });
      }
      targetDiff = parsedDiff;
    }

    let targetStock = product.currentStock;
    const rawQty = quantity !== undefined ? quantity : currentStock;
    if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
      const parsedQty = parseFloat(rawQty);
      if (isNaN(parsedQty) || parsedQty < 0) {
        return res.status(400).json({ error: 'Quantity must be a valid non-negative number' });
      }
      targetStock = parsedQty;
    }

    const targetName = name !== undefined ? name.trim() : product.name;
    const targetCategory = category !== undefined ? (category.trim() || 'General') : product.category;
    const targetSize = size !== undefined ? (size.trim() || '-') : product.size;

    // Check duplicate in same organization if name changed
    if (targetName.toLowerCase() !== product.name.toLowerCase()) {
      const duplicateProduct = await Product.findOne({
        where: {
          organizationId: product.organizationId,
          name: targetName,
          id: { [Op.ne]: id }
        }
      });

      if (duplicateProduct) {
        return res.status(409).json({
          error: `Another product '${targetName}' already exists in this organization.`
        });
      }
    }

    let formattedSpecs = product.specifications;
    if (specifications !== undefined) {
      if (!specifications) {
        formattedSpecs = null;
      } else {
        formattedSpecs = typeof specifications === 'object'
          ? JSON.stringify(specifications)
          : specifications.trim();
      }
    }

    await product.update({
      name: targetName,
      category: targetCategory,
      size: targetSize,
      unit: unit !== undefined ? unit.trim() : product.unit,
      difference: targetDiff,
      price: targetDiff,
      currentStock: targetStock,
      description: description !== undefined ? (description ? description.trim() : null) : product.description,
      specifications: formattedSpecs,
      status: status !== undefined ? status.toUpperCase() : product.status
    });

    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error while updating product' });
  }
};

// PATCH /api/products/:id/status
exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Ownership check
    await verifyRecordOwnership(product, req.user);

    let targetStatus;
    if (status) {
      targetStatus = status.toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(targetStatus)) {
        return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
      }
    } else {
      targetStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    await product.update({ status: targetStatus });

    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      message: `Product successfully ${targetStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`,
      product: updatedProduct
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating product status:', error);
    res.status(500).json({ error: 'Internal server error while updating product status' });
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }

    // Ownership check
    try {
      await verifyRecordOwnership(product, req.user);
    } catch (scopeErr) {
      await transaction.rollback();
      return res.status(scopeErr.statusCode || 403).json({ error: scopeErr.message });
    }

    const productId = parseInt(id, 10);

    // Safely unlink productId in historical transaction line items.
    // All bill, estimate, purchase, and receipt lines preserve full product details in snapshot fields,
    // so historical documents and financial calculations remain 100% intact and unaffected.
    await Promise.all([
      BillItem.update({ productId: null }, { where: { productId }, transaction }),
      EstimateItem.update({ productId: null }, { where: { productId }, transaction }),
      PurchaseItem.update({ productId: null }, { where: { productId }, transaction }),
      GoodsReceiptItem.update({ productId: null }, { where: { productId }, transaction }),
      InventoryMovement.update({ productId: null }, { where: { productId }, transaction })
    ]);

    await product.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({
      message: `Product "${product.name}" deleted successfully without affecting existing bills or transactions`,
      id: productId
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message || 'Internal server error while deleting product' });
  }
};
