const DutyAssignment = require('../models/DutyAssignment');
const { MODULES } = require('../config/moduleRegistry');

/**
 * Centralized backend authorization middleware to enforce module-level duty assignments.
 *
 * Rules:
 * 1. Super Admin and CEO have unrestricted access to all modules across their authorized offices.
 * 2. Office Admins and employees are checked against their specific organizationId and userId in DutyAssignment.
 * 3. Cross-office access is strictly rejected.
 * 4. Disabling a module denies access to both reading and writing on that module's endpoints.
 *
 * @param {string} moduleKey - Stable identifier from MODULES registry (e.g. 'BILLING', 'CUSTOMER_MASTER')
 */
const checkModulePermission = (moduleKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Rule 1: SUPER_ADMIN and CEO have executive access across their authorized scope
      if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'CEO') {
        return next();
      }

      // Rule 2: For employee roles, check DutyAssignment
      if (!req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied: Your account is not assigned to an office.' });
      }

      // Check if duty assignments have been configured for this user
      const assignmentCount = await DutyAssignment.count({
        where: {
          userId: req.user.userId,
          organizationId: req.user.organizationId
        }
      });

      // If no duty assignments have been configured yet, allow access by default for their role
      if (assignmentCount === 0) {
        return next();
      }

      // Find the specific module permission
      const assignment = await DutyAssignment.findOne({
        where: {
          userId: req.user.userId,
          organizationId: req.user.organizationId,
          moduleKey
        }
      });

      if (assignment && assignment.isEnabled) {
        return next();
      }

      const moduleDef = MODULES.find(m => m.id === moduleKey);
      const moduleDisplayName = moduleDef ? moduleDef.name : moduleKey;

      return res.status(403).json({
        error: `Access denied. The "${moduleDisplayName}" module has been disabled for your account.`,
        code: 'MODULE_ACCESS_DISABLED',
        moduleKey
      });
    } catch (error) {
      console.error(`Error checking module permission for ${moduleKey}:`, error);
      return res.status(500).json({ error: 'Internal server error during authorization check' });
    }
  };
};

module.exports = checkModulePermission;
