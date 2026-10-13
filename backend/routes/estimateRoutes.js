const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const estimateController = require('../controllers/estimateController');

// Role-based authorization middleware for Estimate module
const authorizeEstimateAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Estimate Management.'
    });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeEstimateAccess);

// Estimate routes
router.get('/', estimateController.getEstimates);
router.get('/by-number/:estimateNumber', estimateController.getEstimateByNumber);
router.get('/:id', estimateController.getEstimateById);
router.get('/:id/audit', estimateController.getEstimateAudit);
router.post('/', estimateController.createEstimate);
router.put('/:id', estimateController.updateEstimate);
router.post('/:id/generate', estimateController.generateEstimate);
router.post('/:id/override', estimateController.overrideEstimate);

module.exports = router;
