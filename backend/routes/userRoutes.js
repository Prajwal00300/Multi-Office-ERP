const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getUsersByOrganization, createUser, updateUser, deleteUser } = require('../controllers/userController');

// Super Admin Only Middleware
const superAdminMiddleware = (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin only.' });
  }
  next();
};

// All routes require authentication and SUPER_ADMIN role
router.use(authMiddleware, superAdminMiddleware);

router.get('/organization/:orgId', getUsersByOrganization);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
