const { Op } = require('sequelize');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const BillItem = require('../models/BillItem');
const EstimateItem = require('../models/EstimateItem');
const PurchaseItem = require('../models/PurchaseItem');
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

    if (price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Product price is required' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Product price must be a valid non-negative number' });
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
      price: parsedPrice,
      description: description ? description.trim() : null,
      specifications: formattedSpecs,
      status: status ? status.toUpperCase() : 'ACTIVE'
    });

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

    let targetPrice = product.price;
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Product price must be a valid non-negative number' });
      }
      targetPrice = parsedPrice;
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
      price: targetPrice,
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
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Ownership check
    await verifyRecordOwnership(product, req.user);

    // Check if referenced in historical transactions
    const [billItemCount, estimateItemCount, purchaseItemCount] = await Promise.all([
      BillItem.count({ where: { productId: id } }),
      EstimateItem.count({ where: { productId: id } }),
      PurchaseItem.count({ where: { productId: id } })
    ]);

    if (billItemCount > 0 || estimateItemCount > 0 || purchaseItemCount > 0) {
      return res.status(400).json({
        error: `Cannot delete product "${product.name}" because it is referenced in existing transactions (${billItemCount} bills, ${estimateItemCount} estimates, ${purchaseItemCount} purchases). You can deactivate it instead.`
      });
    }

    await product.destroy();

    res.status(200).json({
      message: `Product "${product.name}" deleted successfully`,
      id: parseInt(id, 10)
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error while deleting product' });
  }
};
