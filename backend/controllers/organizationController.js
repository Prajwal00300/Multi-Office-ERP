const Organization = require('../models/Organization');
const User = require('../models/User');

// POST /api/organizations
const createOrganization = async (req, res) => {
  try {
    const { name, address, phone, status, ceoId } = req.body;

    // Validation
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name is required' });
    if (!address || address.trim() === '') return res.status(400).json({ error: 'Address is required' });
    if (!phone || phone.trim() === '') return res.status(400).json({ error: 'Phone is required' });
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    let assignedCeoId = null;
    if (req.user) {
      if (req.user.role === 'CEO') {
        assignedCeoId = req.user.userId;
      } else if (req.user.role === 'SUPER_ADMIN' && ceoId) {
        assignedCeoId = ceoId;
      }
    }

    const organization = await Organization.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      status: status || 'ACTIVE',
      ceoId: assignedCeoId
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Internal server error while creating organization' });
  }
};

// GET /api/organizations
const getAllOrganizations = async (req, res) => {
  try {
    const whereClause = {};

    // Scope based on user role if authenticated
    if (req.user) {
      if (req.user.role === 'CEO') {
        whereClause.ceoId = req.user.userId;
      } else if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId) {
        whereClause.id = req.user.organizationId;
      }
    }

    const organizations = await Organization.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'ceo',
          attributes: ['id', 'username', 'fullName', 'phone']
        }
      ],
      order: [['name', 'ASC']]
    });

    res.status(200).json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Internal server error while fetching organizations' });
  }
};

// GET /api/organizations/:id
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findByPk(id, {
      include: [
        {
          model: User,
          as: 'ceo',
          attributes: ['id', 'username', 'fullName', 'phone']
        }
      ]
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Role check
    if (req.user) {
      if (req.user.role === 'CEO' && organization.ceoId !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this organization/office.' });
      }
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO' && req.user.organizationId !== organization.id) {
        return res.status(403).json({ error: 'Access denied: Not your assigned organization/office.' });
      }
    }

    res.status(200).json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Internal server error while fetching organization' });
  }
};

// PUT /api/organizations/:id
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, status, ceoId } = req.body;

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Role check
    if (req.user) {
      if (req.user.role === 'CEO' && organization.ceoId !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this organization/office.' });
      }
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CEO') {
        return res.status(403).json({ error: 'Access denied: Only Super Admin and CEO can update organizations.' });
      }
    }

    // Validation
    if (name !== undefined && name.trim() === '') return res.status(400).json({ error: 'Name cannot be empty' });
    if (address !== undefined && address.trim() === '') return res.status(400).json({ error: 'Address cannot be empty' });
    if (phone !== undefined && phone.trim() === '') return res.status(400).json({ error: 'Phone cannot be empty' });
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    // Update fields
    if (name) organization.name = name.trim();
    if (address) organization.address = address.trim();
    if (phone) organization.phone = phone.trim();
    if (status) organization.status = status;
    if (req.user && req.user.role === 'SUPER_ADMIN' && ceoId !== undefined) {
      organization.ceoId = ceoId || null;
    }

    await organization.save();

    res.status(200).json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Internal server error while updating organization' });
  }
};

// DELETE /api/organizations/:id
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Super Admin only can delete organizations.' });
    }

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Physically delete the record from the database
    await organization.destroy();

    res.status(200).json({ 
      message: 'Organization has been deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Internal server error while deleting organization' });
  }
};

module.exports = {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization
};
