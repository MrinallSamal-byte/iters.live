const express = require('express');
const router = express.Router();
const { db, auth } = require('../database/firebase');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');

/**
 * POST /api/auth/google-login
 * Verify Google ID token and create/return session
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
    const userRef = db.collection('users').doc(uid); // Use UID as doc ID for Google users? 
    // Actually, for consistency with existing dummy data which uses Registration Number, 
    // we might want to query by email first.

    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    let user;
    let userId;

    if (usersSnapshot.empty) {
      // New user? For now, let's assume we auto-register them or reject if not allowed.
      // The prompt says "add google based logins", implying we should allow it.
      // But we need a registration number. Let's generate a temp one or ask user to complete profile.
      // For simplicity, we'll create a basic record.

      userId = uid; // Use Firebase UID as ID
      const newUser = {
        name: name || 'Google User',
        email,
        role: 'student', // Default role
        profile_picture: picture,
        is_active: true,
        created_at: new Date(),
        last_login: new Date(),
        registration_number: 'GOOGLE_' + uid.substring(0, 8).toUpperCase()
      };

      await db.collection('users').doc(userId).set(newUser);
      user = newUser;
      user.id = userId;
    } else {
      const userDoc = usersSnapshot.docs[0];
      user = userDoc.data();
      user.id = userDoc.id;

      // Update last login
      await userDoc.ref.update({ last_login: new Date() });
    }

    // Create a custom session token or just return the user data
    // Since the frontend uses the ID token for Firebase Auth, we might not need our own JWT 
    // if we switch fully to Firebase Auth on client. 
    // BUT, the existing app uses JWTs. To minimize frontend changes, let's issue our own JWT 
    // OR just return the user and let frontend use Firebase Token.
    // The user request says "use firebase for all database related queries".
    // It doesn't explicitly say "replace JWT with Firebase Auth tokens everywhere".
    // However, "add google based logins" usually implies using Firebase Auth.

    // Let's return the user data. The frontend will likely use the Firebase User object.

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token: idToken // Client can use this or the one they already have
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

    const { registration_number, password } = req.body;

    // Get user from Firestore
    const userDoc = await db.collection('users').doc(registration_number).get();

    if (!userDoc.exists) {
      return res.status(401).json({ success: false, message: 'Invalid registration number or password' });
    }

    const user = userDoc.data();

    // Verify password (using bcrypt as these are dummy accounts seeded with hashed passwords)
    // Note: In a real Firebase app, we wouldn't handle passwords manually like this, 
    // but we need to support the dummy data.
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

    // Remove password
    delete user.password;
    user.id = userDoc.id;

    // We need to return a token because the frontend expects it.
    // Since we are migrating, we can generate a custom JWT signed by us, 
    // OR we can create a custom Firebase Token.
    // Let's generate a custom Firebase Token so the frontend can sign in to Firebase with it!

    const customToken = await auth.createCustomToken(user.id, { role: user.role });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken: customToken, // Frontend should use signInWithCustomToken
        refreshToken: null // Firebase handles refresh
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

