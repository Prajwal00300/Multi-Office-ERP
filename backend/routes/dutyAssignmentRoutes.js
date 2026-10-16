const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dutyAssignmentController = require('../controllers/dutyAssignmentController');

// All duty assignment routes require authentication
router.use(authMiddleware);

// Get available system modules and implementation status
router.get('/modules', dutyAssignmentController.getModules);

// Get active user's permissions (accessible by any authenticated user)
router.get('/my-permissions', dutyAssignmentController.getMyPermissions);

// Get real-time summary for Admin console (counts & permitted modules)
router.get('/admin-dashboard-summary', dutyAssignmentController.getAdminDashboardSummary);

// Super Admin endpoints
router.get('/organizations', dutyAssignmentController.getOrganizations);
router.get('/admins/:organizationId', dutyAssignmentController.getAdminsByOrganization);
router.get('/permissions/:userId', dutyAssignmentController.getAdminPermissions);
router.post('/permissions', dutyAssignmentController.saveAdminPermissions);

module.exports = router;
