const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const purchaseEstimateController = require('../controllers/purchaseEstimateController');
const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware for Purchase Estimate module
const authorizePurchaseEstimateAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Purchase Estimate Management.'
    });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizePurchaseEstimateAccess);
router.use(checkModulePermission('PURCHASES'));

// Purchase Estimate routes
router.get('/', purchaseEstimateController.getPurchaseEstimates);
router.get('/navigation/previous', purchaseEstimateController.getPreviousPurchaseEstimate);
router.get('/navigation/next', purchaseEstimateController.getNextPurchaseEstimate);
router.get('/navigation/first', purchaseEstimateController.getFirstPurchaseEstimate);
router.get('/navigation/last', purchaseEstimateController.getLastPurchaseEstimate);
router.get('/by-number/:estimateNumber', purchaseEstimateController.getPurchaseEstimateByNumber);
router.get('/next-number', purchaseEstimateController.getNextPurchaseEstimateNumber);
router.get('/:id', purchaseEstimateController.getPurchaseEstimateById);
router.post('/', purchaseEstimateController.createPurchaseEstimate);
router.put('/:id', purchaseEstimateController.updatePurchaseEstimate);
router.delete('/:id', purchaseEstimateController.deletePurchaseEstimate);
router.post('/:id/generate', purchaseEstimateController.generatePurchaseEstimate);
router.post('/:id/override', purchaseEstimateController.overridePurchaseEstimate);

module.exports = router;
