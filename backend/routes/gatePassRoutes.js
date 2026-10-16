const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const gatePassController = require('../controllers/gatePassController');

// All gate pass routes require authentication
router.use(authMiddleware);

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
