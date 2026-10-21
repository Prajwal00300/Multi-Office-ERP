const { Op } = require('sequelize');
const Customer = require('../models/Customer');
const Organization = require('../models/Organization');
const {
  getAuthorizedOfficeScope,
  getAuthorizedTargetOfficeForCreation,
  verifyRecordOwnership,
  buildOfficeWhereClause
} = require('../utils/scopeFilter');

// Create a new customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, address, city, tin, organizationId } = req.body;

    const targetOrgId = await getAuthorizedTargetOfficeForCreation(req.user, organizationId);

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
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all customers (with search & organization support)
exports.getCustomers = async (req, res) => {
  try {
    const { search, organizationId } = req.query;

    const { targetOfficeIds } = await getAuthorizedOfficeScope(req.user, organizationId);
    let whereClause = buildOfficeWhereClause(targetOfficeIds);

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { name: { [Op.like]: searchTerm } },
          { phone: { [Op.like]: searchTerm } },
          { city: { [Op.like]: searchTerm } },
          { tin: { [Op.like]: searchTerm } }
        ]
      };
    }

    const customers = await Customer.findAll({
      where: whereClause,
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(customers);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single customer
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findByPk(id, {
      include: [
        {
          model: Organization,
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Ownership check
    await verifyRecordOwnership(customer, req.user);

    res.status(200).json(customer);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
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

    // Ownership check
    await verifyRecordOwnership(customer, req.user);

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
        return res.status(409).json({ error: 'Another customer with this name already exists in this organization' });
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
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
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

    // Ownership check
    await verifyRecordOwnership(customer, req.user);

    await customer.destroy();

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
