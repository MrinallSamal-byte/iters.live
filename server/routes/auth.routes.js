const express = require('express');
const router = express.Router();
const { db, auth } = require('../database/firebase');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');

// Flask Scraper Service URL
const FLASK_SERVICE_URL = process.env.FLASK_SCRAPER_URL || 'http://localhost:5001';

/**
 * POST /api/auth/google-login
 * Verify Google ID token and create/return session
 * 
 * Case A - Existing user with portal connected → Redirect to Dashboard
 * Case B - New user (never connected portal) → Redirect to /connect-portal
 */
router.post('/google-login', async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'ID Token is required' });
    }

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists in Firestore
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    let user;
    let userId;
    let isNewUser = false;
    let needsPortalConnection = false;

    if (usersSnapshot.empty) {
      // Case B: New user - needs portal connection
      isNewUser = true;
      needsPortalConnection = true;
      
      userId = uid; // Use Firebase UID as ID
      const newUser = {
        name: name || 'Google User',
        email,
        role: 'student', // Default role
        profile_picture: picture,
        is_active: true,
        created_at: new Date(),
        last_login: new Date(),
        registration_number: 'GOOGLE_' + uid.substring(0, 8).toUpperCase(),
        // New fields for portal connection
        portalConnected: false,
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

      // Check if portal is connected
      // Case A: Existing user with portal connected
      // Case B: Existing user but never connected portal
      if (!user.portalConnected) {
        needsPortalConnection = true;
      }

      // Update last login
      await userDoc.ref.update({ last_login: new Date() });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token: idToken,
        isNewUser,
        needsPortalConnection,
        redirectUrl: needsPortalConnection ? '/connect-portal.html' : null
      }
    });

  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(401).json({ success: false, message: 'Invalid ID Token' });
  }
});

/**
 * POST /api/auth/login
 * Login with registration_number and password (Legacy/Dummy Accounts)
 * 
 * Case C - Direct login with reg+pass automatically triggers portal sync
 * User never sees /connect-portal unless using Google OAuth first time
 */
router.post('/login', [
  body('registration_number').trim().notEmpty().withMessage('Registration number is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { registration_number, password, skipPortalSync } = req.body;

    // Get user from Firestore
    const userDoc = await db.collection('users').doc(registration_number).get();

    if (!userDoc.exists) {
      return res.status(401).json({ success: false, message: 'Invalid registration number or password' });
    }

    const user = userDoc.data();

    // Verify password (using bcrypt as these are dummy accounts seeded with hashed passwords)
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid registration number or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }

    // Update last login
    await userDoc.ref.update({ last_login: new Date() });

    // Remove password from response
    delete user.password;
    user.id = userDoc.id;

    // Generate Firebase custom token
    const customToken = await auth.createCustomToken(user.id, { role: user.role });

    // Case C: If portal not connected and not explicitly skipping, trigger auto-sync
    // The frontend will handle the sync result and retry logic
    let portalSyncResult = null;
    let shouldAutoSync = !user.portalConnected && !skipPortalSync && user.role === 'student';

    if (shouldAutoSync) {
      try {
        // Attempt to sync with portal using the same credentials
        // NOTE: We do NOT log the password
        console.log(`Auto-sync triggered for: ${registration_number}`);
        
        const scraperResponse = await axios.post(
          `${FLASK_SERVICE_URL}/api/scrape`,
          { reg_number: registration_number, password },
          {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const { status, data } = scraperResponse.data;

        if (status === 'SUCCESS') {
          // Update user with portal data
          await userDoc.ref.update({
            profile: data.profile || {},
            marks_data: data.marks || [],
            attendance_data: data.attendance || [],
            isVerified: true,
            portalConnected: true,
            portal_last_synced: new Date()
          });

          portalSyncResult = {
            status: 'SUCCESS',
            isVerified: true,
            portalConnected: true
          };
        } else {
          portalSyncResult = {
            status: status,
            isVerified: false,
            portalConnected: false
          };
        }
      } catch (syncError) {
        console.error('Auto-sync error:', syncError.message);
        // Don't fail login, just report sync status
        portalSyncResult = {
          status: syncError.response?.status === 401 ? 'AUTH_FAILED' : 'SCRAPE_ERROR',
          isVerified: false,
          portalConnected: false
        };
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken: customToken,
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
router.post('/register-student', [
  body('name').trim().notEmpty(),
  body('registration_number').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res, next) => {
  try {
    const { name, registration_number, email, password, department, year, section } = req.body;

    const userRef = db.collection('users').doc(registration_number);
    const doc = await userRef.get();

    if (doc.exists) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = {
      name,
      registration_number,
      email,
      password: hashedPassword,
      department,
      year: parseInt(year),
      section,
      role: 'student',
      is_active: true,
      created_at: new Date(),
      last_login: null
    };

    await userRef.set(newUser);

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
      data: { user: { ...newUser, id: registration_number } }
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
    // authMiddleware should now populate req.user from Firebase Token
    const userId = req.user.uid; // or user_id

    // If it's a google login, uid is the doc id (maybe). 
    // If it's a dummy login, uid is the registration number.

    // We need to find the user doc.
    // If we used custom token, uid is set correctly.

    let userDoc = await db.collection('users').doc(userId).get();

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

module.exports = router;

