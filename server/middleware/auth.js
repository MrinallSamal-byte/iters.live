const { auth, db } = require('../database/firebase');
const { verifyAppSessionToken } = require('../utils/app-session');
const { getLocalDemoUserFromToken } = require('../services/demo-auth.service');
const { evaluateSession } = require('../services/session-guard.service');

// Never let credential material ride along on req.user.
const CREDENTIAL_FIELDS = ['password', 'password_hash'];

function attachSessionUser(req, user) {
  const safeUser = { ...user };
  for (const field of CREDENTIAL_FIELDS) {
    delete safeUser[field];
  }
  req.user = {
    ...safeUser,
    id: safeUser.id || safeUser.uid || safeUser.registration_number
  };
}

function isAccountInactive(user) {
  return Boolean(user) && user.is_active === false;
}

// Mirror of the session guard's revocation rule for the raw Firebase-token
// channel: a token issued before `sessions_revoked_at` is dead, however valid
// it still is cryptographically.
function isSessionRevoked(user, decodedToken) {
  const revokedAt = Date.parse(user?.sessions_revoked_at || '');
  if (Number.isNaN(revokedAt)) return false;

  const issuedAt = Number(decodedToken.auth_time || decodedToken.iat);
  if (!Number.isFinite(issuedAt)) return false;

  return issuedAt * 1000 < revokedAt;
}

/**
 * Try to authenticate an app-session JWT.
 * Returns null when the token is not an app-session token at all, otherwise
 * the guard verdict ({ allowed, reason, user }).
 */
async function resolveAppSession(token) {
  let decodedSession;
  try {
    decodedSession = verifyAppSessionToken(token);
  } catch (_) {
    return null;
  }

  if (!decodedSession?.user) {
    return null;
  }

  return evaluateSession(decodedSession.user, decodedSession);
}

function sendSessionDenied(res, reason) {
  if (reason === 'inactive') {
    return res.status(403).json({
      success: false,
      message: 'Account is inactive',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Session has been revoked. Please sign in again.',
    code: 'SESSION_REVOKED'
  });
}

/**
 * Verify the bearer token and attach the user to the request
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

    const verdict = await resolveAppSession(token);
    if (verdict) {
      if (!verdict.allowed) {
        return sendSessionDenied(res, verdict.reason);
      }
      attachSessionUser(req, verdict.user);
      return next();
    }

    // Local demo tokens are unsigned, so they are only honoured outside production.
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_LOCAL_DEMO_AUTH === 'true'
    ) {
      const localDemoUser = getLocalDemoUserFromToken(token);
      if (localDemoUser) {
        attachSessionUser(req, localDemoUser);
        return next();
      }
    }

    // Verify Firebase ID Token
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // The role, department, etc. live in the user record, not in the token.
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // Fallback: Try to find by email if UID doesn't match (e.g. legacy data migration issue)
      // Only an email the identity provider has verified may match an account,
      // otherwise anyone could take one over by registering that address.
      if (decodedToken.email && decodedToken.email_verified === true) {
        const snapshot = await db.collection('users').where('email', '==', decodedToken.email).limit(1).get();
        if (!snapshot.empty) {
          const fallbackUser = snapshot.docs[0].data();
          if (isAccountInactive(fallbackUser)) {
            return res.status(403).json({
              success: false,
              message: 'Account is inactive',
              code: 'ACCOUNT_INACTIVE'
            });
          }
          if (isSessionRevoked(fallbackUser, decodedToken)) {
            return sendSessionDenied(res, 'revoked');
          }
          attachSessionUser(req, { ...fallbackUser, id: snapshot.docs[0].id });
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const user = userDoc.data();

    if (isAccountInactive(user)) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    if (isSessionRevoked(user, decodedToken)) {
      return sendSessionDenied(res, 'revoked');
    }

    // Attach user to request
    attachSessionUser(req, {
      ...user,
      id: userDoc.id
    });

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
 * Check if user has required role(s).
 * Accepts roles as separate arguments or as arrays: roleMiddleware('a', 'b')
 * and roleMiddleware(['a', 'b']) are equivalent.
 */
const roleMiddleware = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
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

      const verdict = await resolveAppSession(token);
      if (verdict) {
        // A revoked/inactive session is treated exactly like a guest.
        if (verdict.allowed) {
          attachSessionUser(req, verdict.user);
        }
        return next();
      }

      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.ALLOW_LOCAL_DEMO_AUTH === 'true'
      ) {
        const localDemoUser = getLocalDemoUserFromToken(token);
        if (localDemoUser) {
          attachSessionUser(req, localDemoUser);
          return next();
        }
      }

      try {
        const decodedToken = await auth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && !isAccountInactive(userDoc.data())) {
          attachSessionUser(req, {
            ...userDoc.data(),
            id: userDoc.id
          });
        }
      } catch (tokenError) {
        // Token is invalid/expired - silently ignore for optional auth
        console.log('Optional auth: Invalid token, proceeding as guest');
      }
    }
  } catch (error) {
    // Ignore all errors for optional auth
    console.log('Optional auth error:', error.message);
  }

  next(); // Always proceed, even with errors
};

module.exports = {
  authMiddleware,
  verifyToken: authMiddleware, // Alias for compatibility
  roleMiddleware,
  optionalAuth
};
