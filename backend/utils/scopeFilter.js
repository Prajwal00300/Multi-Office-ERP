const { Op } = require('sequelize');
const Organization = require('../models/Organization');

/**
 * Resolves the authorized office (organization) scope for the authenticated user.
 *
 * Rules:
 * 1. SUPER_ADMIN:
 *    - Has full system-wide visibility across all CEOs and offices.
 *    - Can view all offices (targetOfficeIds: null) or filter by a specific office.
 *
 * 2. CEO:
 *    - Owns multiple offices where ceoId === user.userId.
 *    - If requestedOfficeId is supplied, strictly validates that the office belongs to this CEO.
 *    - If no requestedOfficeId is supplied, returns all office IDs owned by this CEO (consolidated).
 *    - Cross-CEO access is strictly forbidden (throws 403).
 *
 * 3. EMPLOYEE (ADMIN, OPERATIONS_BILLING, WEIGHBRIDGE_CONTROLLER, PAYMENT_COLLECTOR, USER):
 *    - Only authorized for their single assigned office (user.organizationId).
 *    - Any attempt to access or query another office throws 403.
 *
 * @param {Object} user - Decoded req.user
 * @param {string|number|null} requestedOfficeId - Query or parameter office ID
 * @returns {Promise<{ targetOfficeIds: number[]|null, isRestricted: boolean }>}
 */
async function getAuthorizedOfficeScope(user, requestedOfficeId) {
  if (!user) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const cleanRequestedId = requestedOfficeId && requestedOfficeId !== 'ALL' && requestedOfficeId !== ''
    ? parseInt(requestedOfficeId, 10)
    : null;

  // 1. SUPER_ADMIN
  if (user.role === 'SUPER_ADMIN') {
    if (cleanRequestedId) {
      return { targetOfficeIds: [cleanRequestedId], isRestricted: true };
    }
    return { targetOfficeIds: null, isRestricted: false };
  }

  // 2. CEO
  if (user.role === 'CEO') {
    const ownedOffices = await Organization.findAll({
      where: { ceoId: user.userId },
      attributes: ['id', 'name', 'status']
    });

    const ownedIds = ownedOffices.map(o => o.id);

    if (cleanRequestedId) {
      if (!ownedIds.includes(cleanRequestedId)) {
        const err = new Error('Access denied: You do not have ownership of this office.');
        err.statusCode = 403;
        throw err;
      }
      return { targetOfficeIds: [cleanRequestedId], isRestricted: true };
    }

    // Consolidated across all owned offices (or empty placeholder if no offices yet)
    return {
      targetOfficeIds: ownedIds.length > 0 ? ownedIds : [-1],
      isRestricted: true
    };
  }

  // 3. EMPLOYEE / OPERATIONAL USERS
  if (!user.organizationId) {
    const err = new Error('Access denied: Your account is not assigned to an office.');
    err.statusCode = 403;
    throw err;
  }

  const employeeOrgId = parseInt(user.organizationId, 10);

  if (cleanRequestedId && cleanRequestedId !== employeeOrgId) {
    const err = new Error('Access denied: You are only authorized to access your assigned office.');
    err.statusCode = 403;
    throw err;
  }

  return { targetOfficeIds: [employeeOrgId], isRestricted: true };
}

/**
 * Validates and determines the target office ID when creating a new record.
 *
 * @param {Object} user - Decoded req.user
 * @param {string|number|null} requestedOfficeId - Body organizationId / officeId
 * @returns {Promise<number>}
 */
async function getAuthorizedTargetOfficeForCreation(user, requestedOfficeId) {
  if (!user) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const cleanRequestedId = requestedOfficeId ? parseInt(requestedOfficeId, 10) : null;

  if (user.role === 'SUPER_ADMIN') {
    if (!cleanRequestedId) {
      const err = new Error('Super Admin must specify an office (organizationId) when creating a record.');
      err.statusCode = 400;
      throw err;
    }
    const office = await Organization.findByPk(cleanRequestedId);
    if (!office) {
      const err = new Error('Target office not found.');
      err.statusCode = 404;
      throw err;
    }
    return cleanRequestedId;
  }

  if (user.role === 'CEO') {
    if (!cleanRequestedId) {
      const err = new Error('Please select an office for this record.');
      err.statusCode = 400;
      throw err;
    }
    const office = await Organization.findByPk(cleanRequestedId);
    if (!office || office.ceoId !== user.userId) {
      const err = new Error('Access denied: You do not own the specified office.');
      err.statusCode = 403;
      throw err;
    }
    return cleanRequestedId;
  }

  // Employee: Always bound to their assigned office
  if (!user.organizationId) {
    const err = new Error('Access denied: Your account is not assigned to an office.');
    err.statusCode = 403;
    throw err;
  }

  const employeeOrgId = parseInt(user.organizationId, 10);
  if (cleanRequestedId && cleanRequestedId !== employeeOrgId) {
    const err = new Error('Access denied: You cannot create records for another office.');
    err.statusCode = 403;
    throw err;
  }

  return employeeOrgId;
}

/**
 * Verifies that a record belongs to an office within the user's authorized scope.
 * Throws 403 if unauthorized.
 *
 * @param {Object} record - Database record containing organizationId
 * @param {Object} user - Decoded req.user
 */
async function verifyRecordOwnership(record, user) {
  if (!record) {
    const err = new Error('Record not found.');
    err.statusCode = 404;
    throw err;
  }

  if (user.role === 'SUPER_ADMIN') {
    return true;
  }

  const recordOrgId = parseInt(record.organizationId, 10);

  if (user.role === 'CEO') {
    const office = await Organization.findByPk(recordOrgId);
    if (!office || office.ceoId !== user.userId) {
      const err = new Error('Access denied: You do not own the office associated with this record.');
      err.statusCode = 403;
      throw err;
    }
    return true;
  }

  // Employee
  const employeeOrgId = parseInt(user.organizationId, 10);
  if (recordOrgId !== employeeOrgId) {
    const err = new Error('Access denied: This record does not belong to your assigned office.');
    err.statusCode = 403;
    throw err;
  }

  return true;
}

/**
 * Builds a Sequelize where clause given targetOfficeIds.
 *
 * @param {number[]|null} targetOfficeIds
 * @param {Object} existingWhere
 * @returns {Object}
 */
function buildOfficeWhereClause(targetOfficeIds, existingWhere = {}) {
  if (!targetOfficeIds) {
    return existingWhere;
  }

  if (targetOfficeIds.length === 1) {
    return {
      ...existingWhere,
      organizationId: targetOfficeIds[0]
    };
  }

  return {
    ...existingWhere,
    organizationId: {
      [Op.in]: targetOfficeIds
    }
  };
}

module.exports = {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
};
