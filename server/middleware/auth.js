const jwt = require('jsonwebtoken');
const { query } = require('../database/db');

/**
 * Verify JWT token and attach user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const users = await query(
      'SELECT id, registration_number, email, name, role, department, year, section FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Attach user to request
    req.user = users[0];
    // Attach per-login variation seed if present in token
    if (decoded.varSeed !== undefined) {
      req.variationSeed = decoded.varSeed;
    }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Check if user has required role(s)
 */
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional auth - attaches user if token is valid but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const users = await query(
        'SELECT id, registration_number, email, name, role, department FROM users WHERE id = $1 AND is_active = TRUE',
        [decoded.userId]
      );

      if (users.length > 0) {
        req.user = users[0];
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
};

module.exports = {
  authMiddleware,
  verifyToken: authMiddleware, // Alias for compatibility
  roleMiddleware,
  optionalAuth
};
