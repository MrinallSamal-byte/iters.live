const { auth, db } = require('../database/firebase');

/**
 * Verify Firebase ID token and attach user to request
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

    // Verify Firebase ID Token
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get user from Firestore
    // Note: We might want to cache this or just use the token data if sufficient
    // But for full user details (role, department, etc.), we usually need the DB record
    // unless we put custom claims in the token.
    // For now, let's fetch from DB to be safe and consistent with previous logic.

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // Fallback: Try to find by email if UID doesn't match (e.g. legacy data migration issue)
      if (decodedToken.email) {
        const snapshot = await db.collection('users').where('email', '==', decodedToken.email).limit(1).get();
        if (!snapshot.empty) {
          req.user = snapshot.docs[0].data();
          req.user.id = snapshot.docs[0].id;
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const user = userDoc.data();

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Attach user to request
    req.user = user;
    req.user.id = userDoc.id; // Ensure ID is available

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    if (error.code === 'auth/id-token-expired') {
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
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;

      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        req.user = userDoc.data();
        req.user.id = userDoc.id;
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

