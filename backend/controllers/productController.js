const { Op } = require('sequelize');
const Product = require('../models/Product');
const Organization = require('../models/Organization');

const FORBIDDEN_PRICE_FIELDS = [
  'price',
  'sellingPrice',
  'selling_price',
  'rate',
  'cost',
  'defaultPrice',
  'defaultRate',
  'negotiatedPrice',
  'unitPrice',
  'productPrice'
];

// Helper to reject any selling price fields
const checkForPriceFields = (body) => {
  for (const field of FORBIDDEN_PRICE_FIELDS) {
    if (body[field] !== undefined) {
      return `Selling price fields are strictly prohibited in Product Master. Field '${field}' was rejected.`;
    }
  }
  return null;
};

// GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, status, organizationId } = req.query;
    let targetOrgId = req.user.organizationId;

    if (req.user.role === 'SUPER_ADMIN') {
      if (organizationId && organizationId !== 'ALL' && organizationId !== '') {
        targetOrgId = parseInt(organizationId, 10);
      } else {
        targetOrgId = null; // Can view all organizations
      }
    } else {
      if (!targetOrgId) {
        return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
      }
    }

    const whereClause = {};
    if (targetOrgId) {
      whereClause.organizationId = targetOrgId;
    }

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
      whereClause[Op.or] = [
        { name: { [Op.like]: searchTerm } },
        { category: { [Op.like]: searchTerm } },
        { size: { [Op.like]: searchTerm } },
        { description: { [Op.like]: searchTerm } },
        { specifications: { [Op.like]: searchTerm } }
      ];
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

    // Organization authorization check
    if (req.user.role !== 'SUPER_ADMIN' && product.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Internal server error while fetching product details' });
  }
};

// POST /api/products
exports.createProduct = async (req, res) => {
  try {
    // Strictly reject selling price fields
    const priceFieldError = checkForPriceFields(req.body);
    if (priceFieldError) {
      return res.status(400).json({ error: priceFieldError });
    }

    const {
      name,
      category,
      size,
      unit,
      description,
      specifications,
      status,
      organizationId
    } = req.body;

    // Determine target organization
    let targetOrgId = req.user.organizationId;
    if (req.user.role === 'SUPER_ADMIN') {
      if (!organizationId) {
        return res.status(400).json({ error: 'Super Admin must specify an organizationId when creating a product.' });
      }
      targetOrgId = organizationId;
    } else {
      if (!targetOrgId) {
        return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
      }
    }

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Product category is required' });
    }
    if (!size || !size.trim()) {
      return res.status(400).json({ error: 'Product size / diameter is required' });
    }
    if (!unit || !unit.trim()) {
      return res.status(400).json({ error: 'Unit of measurement is required' });
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

    // Check duplicate in same organization (name + category + size)
    const existingProduct = await Product.findOne({
      where: {
        organizationId: targetOrgId,
        name: name.trim(),
        category: category.trim(),
        size: size.trim()
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        error: `A product '${name.trim()}' (${category.trim()} - ${size.trim()}) already exists in this organization.`
      });
    }

    const newProduct = await Product.create({
      organizationId: targetOrgId,
      name: name.trim(),
      category: category.trim(),
      size: size.trim(),
      unit: unit.trim(),
      description: description ? description.trim() : null,
      specifications: formattedSpecs,
      status: status ? status.toUpperCase() : 'ACTIVE'
    });

    // Fetch with organization details
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
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error while creating product' });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    // Strictly reject selling price fields
    const priceFieldError = checkForPriceFields(req.body);
    if (priceFieldError) {
      return res.status(400).json({ error: priceFieldError });
    }

    const { id } = req.params;
    const {
      name,
      category,
      size,
      unit,
      description,
      specifications,
      status
    } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Organization authorization check
    if (req.user.role !== 'SUPER_ADMIN' && product.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields if updated
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }
    if (category !== undefined && !category.trim()) {
      return res.status(400).json({ error: 'Product category cannot be empty' });
    }
    if (size !== undefined && !size.trim()) {
      return res.status(400).json({ error: 'Product size / diameter cannot be empty' });
    }
    if (unit !== undefined && !unit.trim()) {
      return res.status(400).json({ error: 'Unit of measurement cannot be empty' });
    }
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    const targetName = name !== undefined ? name.trim() : product.name;
    const targetCategory = category !== undefined ? category.trim() : product.category;
    const targetSize = size !== undefined ? size.trim() : product.size;

    // Check duplicate in same organization if name, category, or size changed
    if (
      targetName !== product.name ||
      targetCategory !== product.category ||
      targetSize !== product.size
    ) {
      const duplicateProduct = await Product.findOne({
        where: {
          organizationId: product.organizationId,
          name: targetName,
          category: targetCategory,
          size: targetSize,
          id: { [Op.ne]: id }
        }
      });

      if (duplicateProduct) {
        return res.status(409).json({
          error: `Another product '${targetName}' (${targetCategory} - ${targetSize}) already exists in this organization.`
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

    // Organization authorization check
    if (req.user.role !== 'SUPER_ADMIN' && product.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let targetStatus;
    if (status) {
      targetStatus = status.toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(targetStatus)) {
        return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
      }
    } else {
      // Toggle
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
    console.error('Error updating product status:', error);
    res.status(500).json({ error: 'Internal server error while updating product status' });
  }
};
