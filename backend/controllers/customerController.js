const { Op } = require('sequelize');
const Customer = require('../models/Customer');

// Create a new customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, address, city, tin, organizationId } = req.body;
    
    // Determine the target organization context
    let targetOrgId = req.user.organizationId;
    
    // If user is SUPER_ADMIN, they might provide organizationId in body.
    // If they are not SUPER_ADMIN, ignore any organizationId they send and use their own.
    if (req.user.role === 'SUPER_ADMIN') {
      if (!organizationId) {
        return res.status(400).json({ error: 'Super Admin must specify an organizationId when creating a customer.' });
      }
      targetOrgId = organizationId;
    } else {
      if (!targetOrgId) {
        return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
      }
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check for duplicate in the same organization
    const existingCustomer = await Customer.findOne({
      where: { 
        name: name.trim(),
        organizationId: targetOrgId
      }
    });

    if (existingCustomer) {
      return res.status(409).json({ error: 'A customer with this name already exists in this organization' });
    }

    const newCustomer = await Customer.create({
      organizationId: targetOrgId,
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      tin: tin ? tin.trim() : null,
    });

    res.status(201).json({ message: 'Customer created successfully', customer: newCustomer });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all customers (with search support)
exports.getCustomers = async (req, res) => {
  try {
    const { search, organizationId } = req.query;
    let targetOrgId = req.user.organizationId;

    if (req.user.role === 'SUPER_ADMIN') {
      if (!organizationId) {
        return res.status(400).json({ error: 'Super Admin must specify an organizationId context (?organizationId=...) to fetch customers.' });
      }
      targetOrgId = organizationId;
    } else {
      if (!targetOrgId) {
        return res.status(403).json({ error: 'Your account is not assigned to an organization.' });
      }
    }

    const whereClause = { organizationId: targetOrgId };

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: searchTerm } },
        { phone: { [Op.like]: searchTerm } },
        { city: { [Op.like]: searchTerm } },
        { tin: { [Op.like]: searchTerm } }
      ];
    }

    const customers = await Customer.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single customer
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findByPk(id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Auth check
    if (req.user.role !== 'SUPER_ADMIN' && customer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, city, tin } = req.body;
    
    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Auth check
    if (req.user.role !== 'SUPER_ADMIN' && customer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check duplicate name if name changed
    if (name.trim() !== customer.name) {
      const existingCustomer = await Customer.findOne({
        where: { 
          name: name.trim(),
          organizationId: customer.organizationId
        }
      });
      if (existingCustomer) {
        return res.status(409).json({ error: 'Another customer with this name already exists' });
      }
    }

    await customer.update({
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      tin: tin ? tin.trim() : null,
    });

    res.status(200).json({ message: 'Customer updated successfully', customer });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Auth check
    if (req.user.role !== 'SUPER_ADMIN' && customer.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await customer.destroy();

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
