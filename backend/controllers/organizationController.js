const Organization = require('../models/Organization');

// POST /api/organizations
const createOrganization = async (req, res) => {
  try {
    const { name, address, phone, status } = req.body;

    // Validation
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name is required' });
    if (!address || address.trim() === '') return res.status(400).json({ error: 'Address is required' });
    if (!phone || phone.trim() === '') return res.status(400).json({ error: 'Phone is required' });
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    }

    const organization = await Organization.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      status: status || 'ACTIVE',
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
    const organizations = await Organization.findAll();
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
    const organization = await Organization.findByPk(id);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
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
    const { name, address, phone, status } = req.body;

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
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
