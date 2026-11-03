const express = require('express');
const router = express.Router();
const { db, auth, isFirebaseAdminReady } = require('../database/firebase');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const sessionModule = require('../middleware/session');
const { createAppSessionToken } = require('../utils/app-session');
const { getLocalDemoUser, registerLocalDemoStudent } = require('../services/demo-auth.service');
const { revokeUserSessions } = require('../services/session-guard.service');
const { isValidDocId } = require('../services/firebase-data.service');
const bcrypt = require('bcrypt');

const allowLocalDemoAuth = process.env.ALLOW_LOCAL_DEMO_AUTH === 'true' || process.env.NODE_ENV !== 'production';

// Strict limiter for credential endpoints (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

// Dedicated limiter for account creation (prevents mass registration abuse)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' }
});

// Registration numbers double as Firestore document ids, so they must be a
// conservative, path-safe token (no slashes, spaces or control characters).
const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

// Hash compared against when the account does not exist, so response time does
// not reveal whether a registration number is registered.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalisation-only', 10);

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({
    success: false,
    message: errors.array()[0].msg || 'Invalid request',
    errors: errors.array()
  });
  return true;
}

function buildLocalDemoLoginResponse(user) {
  const localAccessToken = `demo-local-${user.registration_number || user.id || user.role}-${Date.now()}`;
  return {
    success: true,
    message: 'Demo login successful',
    data: {
      user,
      accessToken: localAccessToken,
      appAccessToken: createAppSessionToken(user, {
        demoMode: true,
        authMode: 'local-demo'
      }),
      refreshToken: null,
      demoMode: true,
      authMode: 'local-demo'
    }
  };
}

/**
 * POST /api/auth/google-login
 * Verify Google ID token and create/return session
 * 
 * Case A - Existing user with portal connected → Redirect to Dashboard
 * Case B - New user (never connected portal) → Redirect to /connect-portal
 */
router.post('/google-login', loginLimiter, async (req, res, next) => {
  try {
    if (!isFirebaseAdminReady) {
      return res.status(503).json({
        success: false,
        message: 'Google login is unavailable until Firebase Admin is configured.'
      });
    }

    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'ID Token is required' });
    }

    // Verify the ID token. Only a failure here means "bad token"; any later
    // failure is a server problem and must not be reported as one.
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (tokenError) {
      console.error('Google Login token verification failed:', tokenError.message);
      return res.status(401).json({ success: false, message: 'Invalid ID Token' });
    }
    const { uid, email, name, picture } = decodedToken;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'The Google account has no email address, so it cannot be used to sign in.'
      });
    }

    // Check if user exists in Firestore
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    let user;
    let userId;
    let isNewUser = false;
    let needsPortalConnection = false;

    if (usersSnapshot.empty) {
      // New user - create account and go directly to dashboard
      // Portal fetching is suspended - users go straight to dashboard
      isNewUser = true;
      needsPortalConnection = false; // Disabled: Portal connection page is suspended
      
      userId = uid; // Use Firebase UID as ID
      const newUser = {
        name: name || 'Google User',
        email,
        role: 'student', // Default role
        profile_picture: picture || null,
        is_active: true,
        created_at: new Date(),
        last_login: new Date(),
        registration_number: 'GOOGLE_' + uid.substring(0, 8).toUpperCase(),
        // Portal connection fields - defaulting to connected with demo data
        portalConnected: true, // Mark as connected so user goes to dashboard
        isVerified: false,
        profile: null
      };

      await db.collection('users').doc(userId).set(newUser);
      user = newUser;
      user.id = userId;
    } else {
      const userDoc = usersSnapshot.docs[0];
      user = userDoc.data();
      user.id = userDoc.id;

      if (user.is_active === false) {
        return res.status(403).json({ success: false, message: 'Account is inactive.' });
      }

      // Portal fetching is suspended - all users go directly to dashboard
      // Commented out portal connection check:
      // if (!user.portalConnected) {
      //   needsPortalConnection = true;
      // }
      needsPortalConnection = false; // Always go to dashboard

      // Update last login
      await userDoc.ref.update({ last_login: new Date() });
    }

    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token: idToken,
        appAccessToken: createAppSessionToken(user, {
          authMode: 'google-id-token'
        }),
        isNewUser,
        needsPortalConnection,
        redirectUrl: null // Portal connection page is suspended - go directly to dashboard
      }
    });

  } catch (error) {
    console.error('Google Login Error:', error);
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login with registration_number and password (Legacy/Dummy Accounts)
 * 
 * Case C - Direct login with reg+pass automatically triggers portal sync
 * User never sees /connect-portal unless using Google OAuth first time
 */
router.post('/login', loginLimiter, [
  body('registration_number').trim().notEmpty().withMessage('Registration number is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { registration_number, password } = req.body;

    if (typeof registration_number !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Registration number and password must be text' });
    }

    if (!isFirebaseAdminReady) {
      if (allowLocalDemoAuth) {
        const demoUser = getLocalDemoUser(registration_number, password);
        if (!demoUser) {
          return res.status(401).json({ success: false, message: 'Invalid registration number or password' });
        }

        return res.json(buildLocalDemoLoginResponse(demoUser));
      }

      return res.status(503).json({
        success: false,
        message: 'Login is unavailable until Firebase Admin is configured on the server.'
      });
    }

    // Registration numbers are document ids: anything that cannot be one
    // cannot be a registered account (and must not reach the SDK, which throws).
    const userDoc = isValidDocId(registration_number)
      ? await db.collection('users').doc(registration_number).get()
      : null;

    // Google-created accounts have no password hash. Compare against a dummy
    // hash in every "no usable credentials" case so timing is uniform.
    const storedHash = userDoc?.exists && typeof userDoc.data().password === 'string'
      ? userDoc.data().password
      : null;
    const isPasswordValid = await bcrypt.compare(password, storedHash || DUMMY_PASSWORD_HASH);

    if (!userDoc?.exists || !storedHash || !isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid registration number or password' });
    }

    const user = userDoc.data();

    if (user.is_active === false) {
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }

    // Update last login
    await userDoc.ref.update({ last_login: new Date() });

    // Remove password from response
    delete user.password;
    user.id = userDoc.id;

    // Generate Firebase custom token
    const customToken = await auth.createCustomToken(user.id, { role: user.role });

    // SUSPENDED: Portal auto-sync is disabled
    // Users will go directly to dashboard after login
    // The portal fetching feature has been temporarily suspended
    let portalSyncResult = null;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken: customToken,
        appAccessToken: createAppSessionToken(user, {
          authMode: 'firebase-custom-token'
        }),
        refreshToken: null,
        portalSync: portalSyncResult
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/register-student
 * Register a new student
 */
router.post('/register-student', registerLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }).withMessage('Name is too long'),
  body('registration_number').trim()
    .matches(REGISTRATION_NUMBER_PATTERN)
    .withMessage('Registration number must be 3-40 letters, digits, hyphens or underscores'),
  body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
  body('year').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 6 }).withMessage('Year must be a number between 1 and 6'),
  body('department').optional({ nullable: true }).isString().trim().isLength({ max: 60 }),
  body('section').optional({ nullable: true }).isString().trim().isLength({ max: 10 })
], async (req, res, next) => {
  try {
    // The validators above only collect errors; they reject nothing until checked.
    if (sendValidationErrors(req, res)) return;

    if (!isFirebaseAdminReady) {
      if (!allowLocalDemoAuth) {
        return res.status(503).json({
          success: false,
          message: 'Student registration requires Firebase Admin configuration.'
        });
      }

      const { name, registration_number, email, password, department, year, section } = req.body;
      const user = registerLocalDemoStudent({
        name,
        registration_number,
        email,
        password,
        department,
        year,
        section
      });

      return res.status(201).json({
        success: true,
        message: 'Student registered successfully in local demo mode',
        data: {
          user,
          accessToken: `demo-local-${user.registration_number || user.id}-${Date.now()}`,
          appAccessToken: createAppSessionToken(user, {
            demoMode: true,
            authMode: 'local-demo'
          }),
          refreshToken: null,
          demoMode: true,
          authMode: 'local-demo'
        }
      });
    }

    const { name, registration_number, email, password, department, year, section } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const parsedYear = Number.parseInt(year, 10);
    const newUser = {
      name,
      registration_number,
      email,
      password: hashedPassword,
      department: department || null,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      section: section || null,
      role: 'student',
      is_active: true,
      created_at: new Date(),
      last_login: null
    };

    const userRef = db.collection('users').doc(registration_number);
    try {
      await userRef.create(newUser);
    } catch (createError) {
      if (createError?.code === 6 || /ALREADY_EXISTS/i.test(createError?.message || '')) {
        return res.status(409).json({ success: false, message: 'User already exists' });
      }
      throw createError;
    }

    // Create Firebase Auth user too?
    // Ideally yes, but for now we are just storing in Firestore to match existing logic.
    // If we want them to login via Firebase Auth, we should create an Auth user.
    try {
      await auth.createUser({
        uid: registration_number,
        email: email,
        password: password,
        displayName: name
      });
    } catch (e) {
      console.warn('Failed to create Firebase Auth user (might already exist):', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: {
        user: {
          id: registration_number,
          name: newUser.name,
          registration_number: newUser.registration_number,
          email: newUser.email,
          department: newUser.department,
          year: newUser.year,
          section: newUser.section,
          role: newUser.role,
          is_active: newUser.is_active
        },
        appAccessToken: createAppSessionToken({
          id: registration_number,
          name: newUser.name,
          registration_number: newUser.registration_number,
          email: newUser.email,
          department: newUser.department,
          year: newUser.year,
          section: newUser.section,
          role: newUser.role,
          is_active: newUser.is_active
        }, {
          authMode: 'app-session'
        }),
        refreshToken: null
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // authMiddleware always sets req.user.id (document id / registration number).
    // `uid` only exists on Firebase-token sessions, so it cannot be the primary key.
    const userId = req.user.id || req.user.uid;

    let userDoc = isValidDocId(userId)
      ? await db.collection('users').doc(String(userId)).get()
      : { exists: false };

    if (!userDoc.exists) {
      // Try finding by email if ID doesn't match
      if (req.user.email) {
        const snapshot = await db.collection('users').where('email', '==', req.user.email).limit(1).get();
        if (!snapshot.empty) {
          userDoc = snapshot.docs[0];
        } else {
          return res.status(404).json({ success: false, message: 'User not found' });
        }
      } else {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    const userData = userDoc.data();
    delete userData.password;

    res.json({
      success: true,
      data: { ...userData, id: userDoc.id }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/validate-session
 * Validates the current session and updates activity
 */
router.post('/validate-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId, lastActivity } = req.body;
    const userId = req.user.id;
    
    // Validate session
    const validation = sessionModule.validateSession(
      userId, 
      sessionId, 
      lastActivity ? parseInt(lastActivity, 10) : null
    );

    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
        code: 'SESSION_EXPIRED',
        reason: validation.reason
      });
    }

    // Update session activity
    sessionModule.updateSessionActivity(userId, sessionId, Date.now());

    res.json({
      success: true,
      message: 'Session is valid',
      data: {
        serverLastActivity: validation.serverLastActivity,
        remainingTime: validation.remainingTime
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate session'
    });
  }
});

/**
 * POST /api/auth/refresh-session
 * Refreshes the session activity timestamp
 */
router.post('/refresh-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Update session activity
    const now = Date.now();
    sessionModule.updateSessionActivity(userId, sessionId, now);

    res.json({
      success: true,
      message: 'Session refreshed',
      data: {
        serverLastActivity: now,
        remainingTime: sessionModule.SESSION_TIMEOUT_MS
      }
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh session'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Invalidate every session (all devices) issued to the current user before now.
 */
router.post('/logout-all', authMiddleware, async (req, res, next) => {
  try {
    if (!isFirebaseAdminReady || !isValidDocId(req.user.id)) {
      return res.status(503).json({
        success: false,
        message: 'Signing out of all devices requires the server database to be available.'
      });
    }

    const revokedAt = await revokeUserSessions(req.user.id);
    res.json({
      success: true,
      message: 'Signed out of all devices. Please sign in again.',
      data: { revokedAt }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
