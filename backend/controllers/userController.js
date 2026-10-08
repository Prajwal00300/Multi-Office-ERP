const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /api/users/organization/:orgId
const getUsersByOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    
    // Only return users who belong to this organization
    const users = await User.findAll({ 
      where: { organizationId: orgId },
      attributes: { exclude: ['password'] } // Never send passwords
    });
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching org users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/users
// Used by SUPER_ADMIN to explicitly create users for a specific organization and role
const createUser = async (req, res) => {
  try {
    const { username, password, role, organizationId } = req.body;

    if (!username || !password || !role || !organizationId) {
      return res.status(400).json({ error: 'Username, password, role, and organizationId are required' });
    }

    // Check if username exists
    const existingUser = await User.findOne({ where: { username: username.trim() } });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const newUser = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: role,
      organizationId: organizationId
    });

    const userObj = newUser.toJSON();
    delete userObj.password;

    res.status(201).json({ message: 'User created successfully', user: userObj });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, organizationId } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (username && username.trim() !== user.username) {
      const existingUser = await User.findOne({ where: { username: username.trim() } });
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      user.username = username.trim();
    }

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password.trim(), salt);
    }

    if (role) user.role = role;
    if (organizationId !== undefined) user.organizationId = organizationId;

    await user.save();

    const updatedUser = user.toJSON();
    delete updatedUser.password;

    res.status(200).json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting the super admin who is currently logged in, but simple logic for now
    if (req.user && req.user.userId.toString() === id.toString()) {
        return res.status(400).json({ error: 'You cannot delete yourself' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUsersByOrganization,
  createUser,
  updateUser,
  deleteUser
};
