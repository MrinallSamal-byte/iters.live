const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Security policy for the JWT signing secret:
// - production: JWT_SECRET MUST be set -> fail fast at boot, never fall back
//   to a guessable value (a known fallback would allow session forgery).
// - development: generate a random ephemeral secret once per boot so local
//   runs keep working without extra env setup.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Refusing to start in production without an explicit JWT_SECRET.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  JWT_SECRET is NOT set. Using a random ephemeral secret for this boot (dev only) — all sessions invalidate on restart. Set JWT_SECRET to persist sessions.');
}

const APP_SESSION_SECRET = process.env.JWT_SECRET;
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
