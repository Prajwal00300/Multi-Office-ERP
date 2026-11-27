const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const saleOrderController = require('../controllers/saleOrderController');
const checkModulePermission = require('../middleware/checkModulePermission');

const authorizeSaleAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING', 'USER', 'WEIGHBRIDGE_CONTROLLER'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Sales Management.'
    });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeSaleAccess);
router.use(checkModulePermission(['SALES', 'ESTIMATES', 'BILLING']));

// Sale Order routes
router.get('/', saleOrderController.getSaleOrders);
router.get('/next-number', saleOrderController.getNextSaleOrderNumber);
router.get('/pending-order-summary', saleOrderController.getPendingSaleOrderSummary);

// Navigation routes (declared before /:id)
router.get('/navigation/previous', saleOrderController.getPreviousSaleOrder);
router.get('/navigation/next', saleOrderController.getNextSaleOrder);
router.get('/navigation/first', saleOrderController.getFirstSaleOrder);
router.get('/navigation/last', saleOrderController.getLastSaleOrder);

router.get('/:id', saleOrderController.getSaleOrderById);

// Order Placement & Modification
router.post('/', saleOrderController.createSaleOrder);
router.put('/:id', saleOrderController.updateSaleOrder);
router.delete('/:id', saleOrderController.deleteSaleOrder);

module.exports = router;
