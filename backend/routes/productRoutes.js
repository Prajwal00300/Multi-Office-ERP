const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');

// Role-based authorization middleware (Configured for SUPER_ADMIN for now as specified)
const authorizeProductAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions to access Product Master.' });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeProductAccess);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/status', productController.updateProductStatus);

module.exports = router;
