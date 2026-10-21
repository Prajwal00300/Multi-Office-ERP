const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ceoController = require('../controllers/ceoController');

// Role check: Only CEO can access these routes
const requireCeo = (req, res, next) => {
  if (req.user.role !== 'CEO') {
    return res.status(403).json({ error: 'Access denied: CEO role required.' });
  }
  next();
};

router.use(authMiddleware, requireCeo);

// Executive Dashboard Summary
router.get('/dashboard-summary', ceoController.getDashboardSummary);

// Office Management
router.get('/offices', ceoController.getOffices);
router.post('/offices', ceoController.createOffice);
router.put('/offices/:id', ceoController.updateOffice);
router.patch('/offices/:id/status', ceoController.updateOfficeStatus);

// Employee Management
router.get('/employees', ceoController.getEmployees);
router.post('/employees', ceoController.createEmployee);
router.put('/employees/:id', ceoController.updateEmployee);
router.patch('/employees/:id/status', ceoController.updateEmployeeStatus);

// Employee Module Duty Assignments
router.get('/employees/:id/permissions', ceoController.getEmployeePermissions);
router.post('/employees/:id/permissions', ceoController.saveEmployeePermissions);

module.exports = router;
