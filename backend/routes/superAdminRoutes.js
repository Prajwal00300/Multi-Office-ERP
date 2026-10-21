const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const superAdminController = require('../controllers/superAdminController');

// Super Admin authorization middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied: Super Admin only.' });
  }
  next();
};

router.use(authMiddleware, requireSuperAdmin);

// CEO Management endpoints
router.get('/ceos', superAdminController.getCeos);
router.post('/ceos', superAdminController.createCeo);
router.get('/ceos/:id', superAdminController.getCeoDetails);
router.put('/ceos/:id', superAdminController.updateCeo);
router.patch('/ceos/:id/status', superAdminController.updateCeoStatus);

// Office assignment endpoint
router.patch('/offices/:id/assign-ceo', superAdminController.assignOfficeToCeo);

// Drilldown into real module records for a specific CEO
router.get('/ceos/:id/modules/:moduleKey', superAdminController.getCeoModuleData);

module.exports = router;
