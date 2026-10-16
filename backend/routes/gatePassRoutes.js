const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const gatePassController = require('../controllers/gatePassController');

const checkModulePermission = require('../middleware/checkModulePermission');

// Role-based authorization middleware for Gate Pass module
const authorizeGatePassAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions to access Gate Pass Management.'
    });
  }
  next();
};

// All gate pass routes require authentication
router.use(authMiddleware);
router.use(authorizeGatePassAccess);
router.use(checkModulePermission('GATE_PASS'));

// List gate passes with search and filters
router.get('/', gatePassController.getGatePasses);

// Get single gate pass details
router.get('/:id', gatePassController.getGatePassById);

// Create new gate pass
router.post('/', gatePassController.createGatePass);

// Issue gate pass for printing
router.post('/:id/issue', gatePassController.issueGatePass);

// Confirm gate crossing (dispatch)
router.post('/:id/confirm-dispatch', gatePassController.confirmDispatch);

// Cancel gate pass
router.post('/:id/cancel', gatePassController.cancelGatePass);

// Request reweigh
router.post('/:id/request-reweigh', gatePassController.requestReweigh);

module.exports = router;
