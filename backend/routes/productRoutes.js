const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');

const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware (SUPER_ADMIN and authorized ADMIN)
const authorizeProductAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions to access Product Master.' });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeProductAccess);
router.use(checkModulePermission('PRODUCT_MASTER'));

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/status', productController.updateProductStatus);

module.exports = router;
