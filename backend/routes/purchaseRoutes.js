const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const purchaseController = require('../controllers/purchaseController');
const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware for Purchase module
const authorizePurchaseAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Purchase Management.'
    });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizePurchaseAccess);
router.use(checkModulePermission('PURCHASES'));

// Purchase routes
router.get('/', purchaseController.getPurchases);
router.get('/next-number', purchaseController.getNextPurchaseNumber);
// Navigation routes (declared before /:id)
router.get('/navigation/previous', purchaseController.getPreviousPurchase);
router.get('/navigation/next', purchaseController.getNextPurchase);

router.get('/:id', purchaseController.getPurchaseById);

// Order Placement & Modification
router.post('/', purchaseController.createPurchase);
router.put('/:id', purchaseController.updatePurchase);

// Order Received / Goods Receipt
router.post('/receive', purchaseController.receiveGoods);
router.post('/:id/receive', purchaseController.receiveGoods);

// Cancellation
router.post('/:id/cancel', purchaseController.cancelPurchase);

// Legacy approval workflow routes (preserved for compatibility)
router.post('/:id/submit', purchaseController.submitPurchase);
router.post('/:id/approve', purchaseController.approvePurchase);
router.post('/:id/reject', purchaseController.rejectPurchase);
router.post('/:id/override', purchaseController.overridePurchase);

module.exports = router;
