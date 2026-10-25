const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Organization = require('../models/Organization');
const User = require('../models/User');

/**
 * GET /api/organizations/eligible-ceos
 * Returns active CEO accounts that are not currently assigned to any office.
 * If query param 'currentOfficeId' is provided, the CEO of that office is also included.
 */
const getEligibleCeos = async (req, res) => {
  try {
    const { currentOfficeId } = req.query;

    const whereOrg = { ceoId: { [Op.ne]: null } };
    if (currentOfficeId) {
      whereOrg.id = { [Op.ne]: parseInt(currentOfficeId, 10) };
    }

    // Find all CEO IDs already assigned to other offices
    const assignedOrgs = await Organization.findAll({
      where: whereOrg,
      attributes: ['ceoId']
    });

    const assignedCeoIds = assignedOrgs.map(o => o.ceoId).filter(Boolean);

    // Eligible CEOs: role is CEO, status is ACTIVE, and not in assignedCeoIds
    const whereCeo = {
      role: 'CEO',
      status: 'ACTIVE'
    };

    if (assignedCeoIds.length > 0) {
      whereCeo.id = { [Op.notIn]: assignedCeoIds };
    }

    const eligibleCeos = await User.findAll({
      where: whereCeo,
      attributes: ['id', 'username', 'fullName', 'email', 'phone', 'status', 'createdAt'],
      order: [['fullName', 'ASC'], ['username', 'ASC']]
    });

    res.status(200).json(eligibleCeos);
  } catch (error) {
    console.error('Error fetching eligible CEOs:', error);
    res.status(500).json({ error: 'Internal server error while fetching eligible CEOs' });
  }
};

/**
 * POST /api/organizations
 * Atomic Office Creation and CEO Assignment.
 * Exclusively managed by SUPER_ADMIN.
 * Enforces:
 * 1. Each office must have exactly one assigned CEO upon creation.
 * 2. Each CEO can be assigned to only one office (1:1).
 * 3. Can assign an existing unassigned CEO (ceoId) OR create a new CEO inline (newCeo).
 * 4. Executed inside a database transaction to prevent partial/orphaned records.
 */
const createOrganization = async (req, res) => {
  try {
    // 1. Role Authorization: Only Super Admin can create offices
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        error: 'Access denied: Only Super Admin can create offices. CEOs and employees cannot create offices.' 
      });
    }

    const { name, address, phone, status, ceoId, newCeo } = req.body;

    // 2. Validate Office Business Fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Office name is required.' });
    }
    if (!address || address.trim() === '') {
      return res.status(400).json({ error: 'Office address is required.' });
    }
    if (!phone || phone.trim() === '') {
      return res.status(400).json({ error: 'Office phone number is required.' });
    }
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const cleanName = name.trim();

    // 3. Prevent Duplicate Office Name
    const existingOrg = await Organization.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        cleanName.toLowerCase()
      )
    });
    if (existingOrg) {
      return res.status(409).json({ error: `An office named "${cleanName}" already exists.` });
    }

    // 4. Validate CEO Requirement (Mandatory: Exactly one CEO per office)
    if (!ceoId && !newCeo) {
      return res.status(400).json({ 
        error: 'An assigned CEO is mandatory. Please select an eligible CEO or create a new CEO for this office.' 
      });
    }

    let existingCeoToAssign = null;
    let cleanCeoUsername = null;

    if (ceoId) {
      // Option A: Assigning an existing CEO
      existingCeoToAssign = await User.findOne({
        where: { id: ceoId, role: 'CEO' }
      });

      if (!existingCeoToAssign) {
        return res.status(400).json({ error: 'Selected CEO was not found or is not a CEO account.' });
      }

      if (existingCeoToAssign.status === 'INACTIVE') {
        return res.status(400).json({ 
          error: 'The selected CEO account is inactive. Please activate the CEO account or choose another.' 
        });
      }

      // Check if this CEO is already assigned to ANY office (1:1 rule)
      const existingAssignment = await Organization.findOne({
        where: { ceoId: existingCeoToAssign.id }
      });

      if (existingAssignment) {
        return res.status(400).json({ 
          error: `This CEO (${existingCeoToAssign.fullName || existingCeoToAssign.username}) is already assigned to office "${existingAssignment.name}". Each CEO can manage only one office.` 
        });
      }
    } else if (newCeo) {
      // Option B: Creating a new CEO account inline
      if (!newCeo.username || !newCeo.username.trim()) {
        return res.status(400).json({ error: 'CEO username is required when creating a new CEO.' });
      }
      if (!newCeo.password || !newCeo.password.trim()) {
        return res.status(400).json({ error: 'CEO initial password is required when creating a new CEO.' });
      }

      cleanCeoUsername = newCeo.username.trim();

      // Check for duplicate username
      const duplicateUser = await User.findOne({
        where: { username: cleanCeoUsername }
      });
      if (duplicateUser) {
        return res.status(409).json({ 
          error: `A user account with username "${cleanCeoUsername}" already exists.` 
        });
      }
    }

    // 5. Execute Creation inside a Database Transaction for Atomic Consistency
    const result = await sequelize.transaction(async (t) => {
      let finalCeo = existingCeoToAssign;

      if (newCeo) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newCeo.password.trim(), salt);

        finalCeo = await User.create({
          username: cleanCeoUsername,
          password: hashedPassword,
          fullName: newCeo.fullName ? newCeo.fullName.trim() : null,
          email: newCeo.email ? newCeo.email.trim() : null,
          phone: newCeo.phone ? newCeo.phone.trim() : null,
          role: 'CEO',
          status: 'ACTIVE',
          organizationId: null
        }, { transaction: t });
      }

      // Create Organization
      const organization = await Organization.create({
        name: cleanName,
        address: address.trim(),
        phone: phone.trim(),
        status: status || 'ACTIVE',
        ceoId: finalCeo.id
      }, { transaction: t });

      // Link CEO user's organizationId to this organization
      finalCeo.organizationId = organization.id;
      await finalCeo.save({ transaction: t });

      return {
        organization,
        ceo: {
          id: finalCeo.id,
          username: finalCeo.username,
          fullName: finalCeo.fullName,
          email: finalCeo.email,
          phone: finalCeo.phone
        }
      };
    });

    res.status(201).json({
      message: 'Office created and CEO assigned successfully.',
      organization: {
        ...result.organization.toJSON(),
        ceo: result.ceo
      }
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Internal server error while creating organization.' });
  }
};

/**
 * GET /api/organizations
 * Scope based on authenticated role:
 * - SUPER_ADMIN: sees all offices with assigned CEO details and staff counts.
 * - CEO: sees only their assigned office.
 * - Employees: see only their assigned office.
 */
const getAllOrganizations = async (req, res) => {
  try {
    const whereClause = {};

    if (req.user) {
      if (req.user.role === 'CEO') {
        whereClause.ceoId = req.user.userId;
      } else if (req.user.role !== 'SUPER_ADMIN') {
        if (req.user.organizationId) {
          whereClause.id = req.user.organizationId;
        } else {
          return res.status(200).json([]);
        }
      }
    }

    const organizations = await Organization.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'ceo',
          attributes: ['id', 'username', 'fullName', 'phone', 'email', 'status']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Enrich with employee counts
    const enriched = await Promise.all(organizations.map(async (org) => {
      const obj = org.toJSON();
      obj.employeeCount = await User.count({ where: { organizationId: org.id } });
      return obj;
    }));

    res.status(200).json(enriched);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Internal server error while fetching organizations.' });
  }
};

/**
 * GET /api/organizations/:id
 */
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findByPk(id, {
      include: [
        {
          model: User,
          as: 'ceo',
          attributes: ['id', 'username', 'fullName', 'phone', 'email', 'status']
        }
      ]
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization/Office not found.' });
    }

    // Role check
    if (req.user) {
      if (req.user.role === 'CEO' && organization.ceoId !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this office.' });
      }
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO' && req.user.organizationId !== organization.id) {
        return res.status(403).json({ error: 'Access denied: Not your assigned office.' });
      }
    }

    const obj = organization.toJSON();
    obj.employeeCount = await User.count({ where: { organizationId: organization.id } });

    res.status(200).json(obj);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Internal server error while fetching organization.' });
  }
};

/**
 * PUT /api/organizations/:id
 * Update office details and/or reassign CEO.
 * Super Admin can update all fields including CEO reassignment.
 * CEO can only update name, address, phone of their own office.
 */
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, status, ceoId } = req.body;

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization/Office not found.' });
    }

    // Role check
    if (req.user) {
      if (req.user.role === 'CEO') {
        if (organization.ceoId !== req.user.userId) {
          return res.status(403).json({ error: 'Access denied: You do not own this office.' });
        }
        if (ceoId !== undefined && ceoId !== organization.ceoId) {
          return res.status(403).json({ error: 'Access denied: CEOs cannot reassign office CEO ownership.' });
        }
      } else if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Access denied: Only Super Admin and CEO can update offices.' });
      }
    }

    // Validation
    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({ error: 'Office name cannot be empty.' });
    }
    if (address !== undefined && address.trim() === '') {
      return res.status(400).json({ error: 'Office address cannot be empty.' });
    }
    if (phone !== undefined && phone.trim() === '') {
      return res.status(400).json({ error: 'Office phone cannot be empty.' });
    }
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    // Check duplicate name
    if (name && name.trim().toLowerCase() !== organization.name.toLowerCase()) {
      const duplicate = await Organization.findOne({
        where: {
          name: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('name')),
            name.trim().toLowerCase()
          ),
          id: { [Op.ne]: id }
        }
      });
      if (duplicate) {
        return res.status(409).json({ error: `An office named "${name.trim()}" already exists.` });
      }
    }

    // If Super Admin is updating the assigned CEO
    let targetCeo = null;
    if (req.user && req.user.role === 'SUPER_ADMIN' && ceoId !== undefined) {
      if (!ceoId) {
        return res.status(400).json({ error: 'An office must have an assigned CEO. You cannot remove CEO assignment without assigning a replacement.' });
      }

      const parsedCeoId = parseInt(ceoId, 10);
      if (parsedCeoId !== organization.ceoId) {
        targetCeo = await User.findOne({ where: { id: parsedCeoId, role: 'CEO' } });
        if (!targetCeo) {
          return res.status(404).json({ error: 'Target CEO was not found.' });
        }
        if (targetCeo.status === 'INACTIVE') {
          return res.status(400).json({ error: 'Target CEO account is inactive.' });
        }

        // Verify the new CEO is not already assigned to another office
        const existingOffice = await Organization.findOne({
          where: {
            ceoId: parsedCeoId,
            id: { [Op.ne]: organization.id }
          }
        });
        if (existingOffice) {
          return res.status(400).json({ 
            error: `Selected CEO (${targetCeo.fullName || targetCeo.username}) is already assigned to office "${existingOffice.name}". Each CEO can only manage one office.` 
          });
        }
      }
    }

    // Execute update in transaction
    await sequelize.transaction(async (t) => {
      if (name) organization.name = name.trim();
      if (address) organization.address = address.trim();
      if (phone) organization.phone = phone.trim();
      if (status) organization.status = status;

      if (targetCeo) {
        const oldCeoId = organization.ceoId;
        organization.ceoId = targetCeo.id;

        // Disassociate old CEO's user record if linked to this org
        if (oldCeoId) {
          await User.update(
            { organizationId: null },
            { where: { id: oldCeoId, organizationId: organization.id }, transaction: t }
          );
        }

        // Associate new CEO's user record
        targetCeo.organizationId = organization.id;
        await targetCeo.save({ transaction: t });
      }

      await organization.save({ transaction: t });
    });

    const updated = await Organization.findByPk(id, {
      include: [
        {
          model: User,
          as: 'ceo',
          attributes: ['id', 'username', 'fullName', 'phone', 'email', 'status']
        }
      ]
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Internal server error while updating organization.' });
  }
};

/**
 * DELETE /api/organizations/:id
 * Only Super Admin can delete offices.
 */
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Only Super Admin can delete offices.' });
    }

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({ error: 'Office not found.' });
    }

    await sequelize.transaction(async (t) => {
      // Unlink CEO
      if (organization.ceoId) {
        await User.update(
          { organizationId: null },
          { where: { id: organization.ceoId, organizationId: organization.id }, transaction: t }
        );
      }

      // Physically delete
      await organization.destroy({ transaction: t });
    });

    res.status(200).json({ 
      message: 'Office deleted successfully.' 
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Internal server error while deleting organization.' });
  }
};

module.exports = {
  getEligibleCeos,
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization
};
