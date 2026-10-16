const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const weighbridgeController = require('../controllers/weighbridgeController');

// All weighbridge routes require authenticated user
router.use(authMiddleware);

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
