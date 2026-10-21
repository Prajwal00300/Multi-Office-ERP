const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing from Authorization header' });
    }

    // Verify token using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user exists and check active status
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'role', 'status', 'organizationId']
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ 
        error: 'Your account has been deactivated. Please contact your administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // If user belongs to an office (employee), check if office is inactive
    if (user.organizationId) {
      const office = await Organization.findByPk(user.organizationId, {
        attributes: ['id', 'status']
      });

      if (office && office.status === 'INACTIVE') {
        return res.status(403).json({
          error: 'Your assigned office is currently inactive.',
          code: 'OFFICE_INACTIVE'
        });
      }
    }

    // Attach verified user information to request
    req.user = {
      userId: user.id,
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
