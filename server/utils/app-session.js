const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production');
}

const APP_SESSION_SECRET = process.env.JWT_SECRET || 'iterasn-hub-dev-secret';
const APP_SESSION_EXPIRE = process.env.JWT_EXPIRE || '7d';

function sanitizeUser(user = {}) {
  return {
    id: user.id || user.uid || user.registration_number || null,
    registration_number: user.registration_number || null,
    name: user.name || 'User',
    email: user.email || null,
    role: user.role || 'student',
    department: user.department || null,
    year: user.year ?? null,
    section: user.section || null,
    semester: user.semester || null,
    phone_number: user.phone_number || null,
    profile_picture: user.profile_picture || null,
    is_active: user.is_active !== false
  };
}

function createAppSessionToken(user, extras = {}) {
  const safeUser = sanitizeUser(user);
  return jwt.sign(
    {
      sessionType: 'iter-app',
      demoMode: Boolean(extras.demoMode),
      authMode: extras.authMode || 'app-session',
      user: safeUser
    },
    APP_SESSION_SECRET,
    {
      issuer: 'iterasn-hub',
      audience: 'iter-native-clients',
      expiresIn: APP_SESSION_EXPIRE
    }
  );
}

function verifyAppSessionToken(token) {
  return jwt.verify(token, APP_SESSION_SECRET, {
    issuer: 'iterasn-hub',
    audience: 'iter-native-clients'
  });
}

module.exports = {
  createAppSessionToken,
  sanitizeUser,
  verifyAppSessionToken
};
