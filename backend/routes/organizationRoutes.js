const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getEligibleCeos,
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization
} = require('../controllers/organizationController');

// All organization routes require authentication
router.use(authMiddleware);

// Eligible unassigned CEOs (must come before /:id)
router.get('/eligible-ceos', getEligibleCeos);

router.post('/', createOrganization);
router.get('/', getAllOrganizations);
router.get('/:id', getOrganizationById);
router.put('/:id', updateOrganization);
router.delete('/:id', deleteOrganization);

module.exports = router;
