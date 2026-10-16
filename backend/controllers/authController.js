const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate request
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });

    }
    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check for duplicate username
    const existingUser = await User.findOne({ where: { username: username.trim() } });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    // Create user (role always USER, organizationId always NULL)
    const newUser = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: 'USER',
      organizationId: null
    });

    // Send successful response (without password)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        organizationId: newUser.organizationId
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate request
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ where: { username: username.trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Fetch organization info if assigned
    let org = null;
    if (user.organizationId) {
      org = await Organization.findByPk(user.organizationId, {
        attributes: ['id', 'name', 'address', 'phone', 'status']
      });
    }

    // Generate JWT
    const payload = {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        userId: user.id,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
        organization: org
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'username', 'role', 'organizationId']
    });

    let org = null;
    if (user && user.organizationId) {
      org = await Organization.findByPk(user.organizationId, {
        attributes: ['id', 'name', 'address', 'phone', 'status']
      });
    }

    res.status(200).json({
      user: {
        id: req.user.userId,
        userId: req.user.userId,
        username: user?.username || '',
        role: req.user.role,
        organizationId: req.user.organizationId,
        organization: org
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  getMe
};
