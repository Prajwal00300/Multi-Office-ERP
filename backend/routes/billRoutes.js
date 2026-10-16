const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const billController = require('../controllers/billController');

const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware for Billing module
const authorizeBillingAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Billing Management.'
    });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeBillingAccess);
router.use(checkModulePermission('BILLING'));

// Billing routes
router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.get('/:id/audit', billController.getBillAudits);
router.post('/', billController.createBill);
router.put('/:id', billController.updateBill);
router.post('/:id/finalize', billController.finalizeBill);
router.post('/:id/override', billController.overrideBill);

module.exports = router;
