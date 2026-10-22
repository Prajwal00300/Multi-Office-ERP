const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const weighbridgeController = require('../controllers/weighbridgeController');

const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware for Weighbridge module
const authorizeWeighbridgeAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Weighbridge Management.'
    });
  }
  next();
};

// All weighbridge routes require authenticated user
router.use(authMiddleware);
router.use(authorizeWeighbridgeAccess);
router.use(checkModulePermission('WEIGHBRIDGE'));

// Search eligible transactions (Bills/Estimates)
router.get('/transactions', weighbridgeController.searchTransactions);

// List weighing history records
router.get('/', weighbridgeController.getWeighingRecords);

// Get single weighing record details
router.get('/:id', weighbridgeController.getWeighingRecordById);

// Create new manual weighing record
router.post('/', weighbridgeController.createWeighingRecord);

// Reweigh a vehicle
router.post('/:id/reweigh', weighbridgeController.reweighTransaction);

// CEO / Admin discrepancy approval
router.post('/:id/approve-discrepancy', weighbridgeController.approveDiscrepancy);

module.exports = router;
