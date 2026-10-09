const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');

// Role-based authorization middleware specifically for customers
const authorizeCustomerAccess = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN'];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions to manage customers.' });
  }
  next();
};

router.use(authMiddleware);
router.use(authorizeCustomerAccess);

router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomerById);

module.exports = router;
