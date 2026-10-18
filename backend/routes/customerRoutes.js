const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');

const checkModulePermission = require('../middleware/checkModulePermission');

// All customer routes require authentication
router.use(authMiddleware);

// Role-based authorization middleware specifically for managing Customer Master (SUPER_ADMIN and authorized ADMIN)
const authorizeCustomerManagement = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions to manage Customer Master.' });
  }
  next();
};

// READ routes: Any authenticated user in the organization can view customers to select them for billing, estimates, etc.
// Multi-tenant organization isolation is enforced inside customerController.getCustomers.
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);

// WRITE routes: Only authorized Super Admin or Admin with CUSTOMER_MASTER permission can create, update, or delete customer records
router.post('/', authorizeCustomerManagement, checkModulePermission('CUSTOMER_MASTER'), customerController.createCustomer);
router.put('/:id', authorizeCustomerManagement, checkModulePermission('CUSTOMER_MASTER'), customerController.updateCustomer);
router.delete('/:id', authorizeCustomerManagement, checkModulePermission('CUSTOMER_MASTER'), customerController.deleteCustomer);

module.exports = router;
