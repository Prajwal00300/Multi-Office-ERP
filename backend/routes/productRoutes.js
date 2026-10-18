const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');

const checkModulePermission = require('../middleware/checkModulePermission');

// All product routes require authentication
router.use(authMiddleware);

// Role-based authorization middleware for managing Product Master catalog (SUPER_ADMIN and authorized ADMIN)
const authorizeProductManagement = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions to manage Product Master.' });
  }
  next();
};

// READ routes: Any authenticated user within their organization (Super Admin, Admin, Operations Billing, Weighbridge)
// can view product catalog to select products for billing, estimates, gate passes, etc.
// Multi-tenant organization isolation is enforced inside productController.getProducts.
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// WRITE routes: Only authorized Super Admin or Admin with PRODUCT_MASTER permission can create, update, or alter products
router.post('/', authorizeProductManagement, checkModulePermission('PRODUCT_MASTER'), productController.createProduct);
router.put('/:id', authorizeProductManagement, checkModulePermission('PRODUCT_MASTER'), productController.updateProduct);
router.patch('/:id/status', authorizeProductManagement, checkModulePermission('PRODUCT_MASTER'), productController.updateProductStatus);

module.exports = router;
