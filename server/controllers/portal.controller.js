/**
 * Portal Controller
 * Handles portal sync operations with the Flask scraper microservice
 * Includes Google Sheets/Drive backup integration and multi-layer fallback
 * 
 * Features:
 * - 3-attempt login system with structured response
 * - Google Drive JSON backup per user
 * - Recovery system (Drive backup → Dummy data)
 * - Comprehensive error handling
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * All portal-related functionality has been temporarily suspended.
 * The feature flag check at the start of each function will return
 * a disabled response until PORTAL_FEATURES_ENABLED=true is set.
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { db } = require('../database/firebase');
const googleSheetsService = require('../services/googleSheets.service');
const googleDriveBackup = require('../services/googleDriveBackup.service');

// TEMPORARILY DISABLED — DO NOT REMOVE
// Import feature flags to check if portal features are enabled
const { isPortalEnabled, getPortalDisabledResponse, PORTAL_DISABLED_MESSAGE } = require('../config/featureFlags');

// Scraper Service URL (Node.js/Puppeteer or Flask/Selenium)
// Defaults to Node.js service on port 5001
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || process.env.FLASK_SCRAPER_URL || 'http://localhost:5001';

// Maximum login attempts before fallback
const MAX_LOGIN_ATTEMPTS = 3;

// Status constants matching Python scraper
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';
const STATUS_BACKUP_LOADED = 'BACKUP_LOADED';
const STATUS_DEMO_LOADED = 'DEMO_LOADED';
const STATUS_MAX_ATTEMPTS_REACHED = 'MAX_ATTEMPTS_REACHED';

// Load comprehensive dummy data from JSON file
let DUMMY_DATA;
try {
  const dummyDataPath = path.join(__dirname, '../data/dummyStudentData.json');
  DUMMY_DATA = JSON.parse(fs.readFileSync(dummyDataPath, 'utf8'));
} catch (e) {
  console.warn('Could not load dummyStudentData.json, using basic dummy data');
  // Fallback dummy data
  DUMMY_DATA = {
    mode: 'demo',
    profile: {
      name: 'Demo Student',
      email: 'demo.student@iter.ac.in',
      department: 'Computer Science & Engineering',
      year: 3,
      section: 'A',
      semester: 5,
      phone: '9876543210'
    },
    marks: [
      { subject: 'Data Structures', marks: '85', grade: 'A' },
      { subject: 'Database Management', marks: '78', grade: 'B+' },
      { subject: 'Operating Systems', marks: '82', grade: 'A' },
      { subject: 'Computer Networks', marks: '75', grade: 'B' },
      { subject: 'Software Engineering', marks: '88', grade: 'A' }
    ],
    attendance: [
      { subject: 'Data Structures', attended: '42', total: '45', percentage: '93%' },
      { subject: 'Database Management', attended: '38', total: '45', percentage: '84%' },
      { subject: 'Operating Systems', attended: '40', total: '45', percentage: '89%' },
      { subject: 'Computer Networks', attended: '35', total: '45', percentage: '78%' },
      { subject: 'Software Engineering', attended: '43', total: '45', percentage: '96%' }
    ],
    timetable: [],
    courses: [],
    results: [],
    notifications: [],
    backlogs: [],
    internal_assessments: []
  };
}

// In-memory attempt tracking (for session-based tracking)
// NOTE: This is a simple implementation for single-server deployments.
// For production multi-instance deployments, replace with Redis or database storage.
// The 15-minute expiry provides reasonable UX without permanent lockouts.
const loginAttempts = new Map();

/**
 * Get attempt key for a user
 */
function getAttemptKey(regNumber, userId) {
  return userId || regNumber || 'unknown';
}

/**
 * Get current attempt count for a user
 */
function getAttemptCount(regNumber, userId) {
  const key = getAttemptKey(regNumber, userId);
  const attemptData = loginAttempts.get(key);
  if (!attemptData) return 0;
  
  // Reset if last attempt was more than 15 minutes ago
  const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
  if (attemptData.lastAttempt < fifteenMinutesAgo) {
    loginAttempts.delete(key);
    return 0;
  }
  
  return attemptData.count;
}

/**
 * Increment attempt count for a user
 */
function incrementAttemptCount(regNumber, userId) {
  const key = getAttemptKey(regNumber, userId);
  const currentCount = getAttemptCount(regNumber, userId);
  loginAttempts.set(key, {
    count: currentCount + 1,
    lastAttempt: Date.now()
  });
  return currentCount + 1;
}

/**
 * Clear attempt count for a user (on success)
 */
function clearAttemptCount(regNumber, userId) {
  const key = getAttemptKey(regNumber, userId);
  loginAttempts.delete(key);
}

/**
 * Portal Login - 3-Attempt System
 * POST /api/portal/login
 * 
 * Implements the 3-attempt login system with structured response:
 * - Attempt 1-2: Returns failure with attempts remaining
 * - Attempt 3: After final failure, triggers fallback to backup/demo
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * This endpoint is disabled when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const portalLogin = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Check if portal features are enabled
  if (!isPortalEnabled()) {
    console.log('Portal login attempted but feature is disabled');
    return res.status(503).json(getPortalDisabledResponse());
  }

  try {
    const { reg_number, password } = req.body;
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    // Validate required fields
    if (!reg_number || !password) {
      return res.status(400).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: 'Registration number and password are required'
      });
    }

    // Get current attempt count
    const currentAttempt = getAttemptCount(reg_number, userId);
    
    // If max attempts already reached, return recovery data
    if (currentAttempt >= MAX_LOGIN_ATTEMPTS) {
      console.log(`Max attempts reached for: ${reg_number}, returning recovery data`);
      return await handleMaxAttemptsReached(reg_number, userId, res);
    }

    // Increment attempt count before trying
    const attemptNumber = incrementAttemptCount(reg_number, userId);
    const attemptsRemaining = MAX_LOGIN_ATTEMPTS - attemptNumber;

    console.log(`Portal login attempt ${attemptNumber}/${MAX_LOGIN_ATTEMPTS} for: ${reg_number}`);

    // Use Node.js scraper service directly
    const { createScraper } = require('../services/portal-scraper.service');
    const scraper = createScraper();
    
    try {
      // Scrape portal data using Node.js scraper
      const scraperResponse = await scraper.scrape(reg_number, password);
      
      const { status, data, message } = scraperResponse;

      if (status === STATUS_SUCCESS) {
        // Clear attempt count on success
        clearAttemptCount(reg_number, userId);

        // Save to Firestore
        await savePortalDataToFirestore(userId, reg_number, data, true);

        // Save to Google Drive as backup (non-blocking)
        saveToGoogleDriveBackup(reg_number, data).catch(err => {
          console.warn('Google Drive backup failed (non-critical)');
        });

        // Also save to Google Sheets for compatibility
        saveToGoogleSheetsBackup(reg_number, data).catch(err => {
          console.warn('Google Sheets backup failed (non-critical)');
        });

        return res.json({
          success: true,
          status: STATUS_SUCCESS,
          message: 'Portal login successful',
          attempt: attemptNumber,
          attemptsRemaining: MAX_LOGIN_ATTEMPTS,
          data: formatPortalData(data, true, true, 'live_portal')
        });
      }

      // Handle failure cases
      if (status === STATUS_AUTH_FAILED) {
        // Check if this was the final attempt
        if (attemptNumber >= MAX_LOGIN_ATTEMPTS) {
          return await handleMaxAttemptsReached(reg_number, userId, res);
        }

        return res.status(401).json({
          success: false,
          status: STATUS_AUTH_FAILED,
          message: message || 'Invalid portal credentials',
          attempt: attemptNumber,
          attemptsRemaining
        });
      }

      if (status === STATUS_PORTAL_UNREACHABLE) {
        // Portal unreachable doesn't count against attempts
        // Decrement the attempt since it's not the user's fault
        const key = getAttemptKey(reg_number, userId);
        const attemptData = loginAttempts.get(key);
        if (attemptData && attemptData.count > 0) {
          attemptData.count--;
          loginAttempts.set(key, attemptData);
        }

        // Try to load backup data
        const backupData = await tryLoadBackupData(reg_number, userId);
        if (backupData) {
          return res.json({
            success: true,
            status: STATUS_BACKUP_LOADED,
            message: 'Portal unreachable. Showing previously saved data.',
            data: {
              ...backupData,
              isVerified: false,
              portalConnected: false,
              warning: 'Student portal is currently unreachable.'
            }
          });
        }

        return res.status(503).json({
          success: false,
          status: STATUS_PORTAL_UNREACHABLE,
          message: message || 'Student portal is currently unreachable'
        });
      }

      // Other scrape errors
      if (attemptNumber >= MAX_LOGIN_ATTEMPTS) {
        return await handleMaxAttemptsReached(reg_number, userId, res);
      }

      return res.status(500).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: message || 'Failed to fetch portal data',
        attempt: attemptNumber,
        attemptsRemaining
      });

    } catch (scraperError) {
      console.error('Scraper service error:', scraperError.message);
      
      // Check if max attempts reached
      if (attemptNumber >= MAX_LOGIN_ATTEMPTS) {
        return await handleMaxAttemptsReached(reg_number, userId, res);
      }

      const errorData = scraperError.response?.data;
      const errorStatus = scraperError.response?.status;

      if (errorStatus === 401 || errorData?.status === STATUS_AUTH_FAILED) {
        return res.status(401).json({
          success: false,
          status: STATUS_AUTH_FAILED,
          message: errorData?.message || 'Invalid portal credentials',
          attempt: attemptNumber,
          attemptsRemaining
        });
      }

      return res.status(500).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: scraperError.code === 'ECONNREFUSED' 
          ? 'Portal scraper service unavailable' 
          : 'Failed to connect to portal scraper service',
        attempt: attemptNumber,
        attemptsRemaining
      });
    }
  } catch (error) {
    console.error('Portal login error:', error.message);
    return res.status(500).json({
      success: false,
      status: STATUS_SCRAPE_ERROR,
      message: 'Internal server error'
    });
  }
};

/**
 * Handle max attempts reached - trigger fallback
 * @param {string} regNumber - Registration number
 * @param {string} userId - User ID
 * @param {Object} res - Express response
 */
async function handleMaxAttemptsReached(regNumber, userId, res) {
  console.log(`Handling max attempts reached for: ${regNumber}`);

  // Step 1: Try Google Drive backup
  try {
    const driveBackup = await googleDriveBackup.loadUserBackup(regNumber);
    if (driveBackup && (driveBackup.profile || driveBackup.marks?.length || driveBackup.attendance?.length)) {
      console.log(`Loaded backup from Google Drive for: ${regNumber}`);
      clearAttemptCount(regNumber, userId);
      
      return res.json({
        success: true,
        status: STATUS_BACKUP_LOADED,
        message: 'Login failed 3 times. Loaded your previously saved data from backup.',
        data: {
          ...driveBackup,
          isVerified: false,
          portalConnected: false,
          dataSource: 'google_drive_backup',
          warning: 'Displaying cached data after failed login attempts.'
        }
      });
    }
  } catch (e) {
    console.warn('Google Drive backup load failed:', e.message);
  }

  // Step 2: Try Google Sheets backup
  try {
    const sheetsBackup = await tryLoadBackupData(regNumber, userId);
    if (sheetsBackup) {
      console.log(`Loaded backup from alternative source for: ${regNumber}`);
      clearAttemptCount(regNumber, userId);
      
      return res.json({
        success: true,
        status: STATUS_BACKUP_LOADED,
        message: 'Login failed 3 times. Loaded your previously saved data.',
        data: {
          ...sheetsBackup,
          isVerified: false,
          portalConnected: false,
          warning: 'Displaying cached data after failed login attempts.'
        }
      });
    }
  } catch (e) {
    console.warn('Alternative backup load failed:', e.message);
  }

  // Step 3: Return dummy data
  console.log(`No backup found, returning demo data for: ${regNumber}`);
  clearAttemptCount(regNumber, userId);
  
  return res.json({
    success: true,
    status: STATUS_DEMO_LOADED,
    message: 'Login failed 3 times. No backup found. Showing demo data.',
    data: {
      mode: 'demo',
      ...DUMMY_DATA,
      isVerified: false,
      portalConnected: false,
      dataSource: 'demo',
      warning: 'Displaying demo data. Your real data will appear after successful portal login.'
    }
  });
}

/**
 * Format portal data for response
 */
function formatPortalData(data, isVerified, portalConnected, dataSource) {
  return {
    profile: data.profile || DUMMY_DATA.profile,
    marks: data.marks || [],
    attendance: data.attendance || [],
    timetable: data.timetable || [],
    courses: data.courses || [],
    results: data.results || [],
    notifications: data.notifications || [],
    backlogs: data.backlogs || [],
    internal_assessments: data.internal_assessments || [],
    fees: data.fees || {},
    raw_api_data: data.raw_api_data || {},
    isVerified,
    portalConnected,
    dataSource
  };
}

/**
 * Get Demo Data - ALWAYS AVAILABLE
 * GET /api/portal/demo
 * 
 * Returns static demo data for users to explore the system.
 * This endpoint ALWAYS works regardless of portal feature status.
 * No authentication required.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getDemoData = async (req, res) => {
  try {
    console.log('Demo data requested - returning static demo data');
    
    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: 'Demo data loaded successfully',
      data: {
        mode: 'demo',
        profile: DUMMY_DATA.profile,
        marks: DUMMY_DATA.marks,
        attendance: DUMMY_DATA.attendance,
        timetable: DUMMY_DATA.timetable || [],
        courses: DUMMY_DATA.courses || [],
        results: DUMMY_DATA.results || [],
        notifications: DUMMY_DATA.notifications || [],
        backlogs: DUMMY_DATA.backlogs || [],
        internal_assessments: DUMMY_DATA.internal_assessments || [],
        fees: DUMMY_DATA.fees || {},
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo',
        portalEnabled: isPortalEnabled()
      }
    });
  } catch (error) {
    console.error('Error loading demo data:', error.message);
    // INTENTIONAL: Return minimal demo data even on error
    // This ensures users can always access the system for exploration
    // even if the demo data file is corrupted or missing
    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: 'Demo data loaded successfully (minimal fallback)',
      data: {
        mode: 'demo',
        profile: {
          name: 'Demo Student',
          email: 'demo.student@iter.ac.in',
          department: 'Computer Science & Engineering',
          year: 3,
          section: 'A',
          semester: 5
        },
        marks: [],
        attendance: [],
        timetable: [],
        courses: [],
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo_fallback',
        portalEnabled: isPortalEnabled(),
        warning: 'Using minimal demo data due to data loading error'
      }
    });
  }
};

/**
 * Sync portal data for a user (legacy endpoint, redirects to login)
 * Enhanced with Google Sheets backup and multi-layer fallback
 * 
 * MODIFIED: Now handles demo data requests even when portal is disabled
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const syncPortalData = async (req, res) => {
  try {
    const { reg_number, password, useDemoData } = req.body;
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    // If explicitly requesting demo data OR portal is disabled, return demo data
    if (useDemoData === true || !isPortalEnabled()) {
      if (!isPortalEnabled()) {
        console.log('Portal sync attempted but feature is disabled - redirecting to demo data');
      }
      return await saveDemoData(userId, reg_number, res);
    }

    // Use the new login function with 3-attempt logic for live portal sync
    return await portalLogin(req, res);
  } catch (error) {
    console.error('Portal sync error:', error.message);
    return res.status(500).json({
      success: false,
      status: STATUS_SCRAPE_ERROR,
      message: 'Internal server error'
    });
  }
};

/**
 * Save portal data to Firestore
 * @param {string} userId - User document ID
 * @param {string} regNumber - Registration number
 * @param {Object} data - Scraped data
 * @param {boolean} isVerified - Whether data is verified from portal
 */
const savePortalData = async (userId, regNumber, data, isVerified) => {
  const updateData = {
    profile: data.profile || {},
    marks_data: data.marks || [],
    attendance_data: data.attendance || [],
    timetable_data: data.timetable || [],
    courses_data: data.courses || [],
    results_data: data.results || [],
    notifications_data: data.notifications || [],
    isVerified: isVerified,
    portalConnected: true,
    portal_last_synced: new Date(),
    updated_at: new Date()
  };

  // Update by userId if available, otherwise by registration number
  const docId = userId || regNumber;

  if (!docId) {
    console.warn('savePortalData: No docId available, cannot save data');
    return false;
  }

  try {
    const userRef = db.collection('users').doc(docId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update(updateData);
      console.log(`Portal data saved for user: ${docId}`);
      return true;
    } else if (regNumber && regNumber !== docId) {
      // Try with registration number as fallback
      const regRef = db.collection('users').doc(regNumber);
      const regDoc = await regRef.get();
      if (regDoc.exists) {
        await regRef.update(updateData);
        console.log(`Portal data saved for registration: ${regNumber}`);
        return true;
      }
    }
    
    console.warn(`savePortalData: No document found for ${docId} or ${regNumber}`);
    return false;
  } catch (error) {
    console.error(`savePortalData error for ${docId}:`, error.message);
    return false;
  }
};

/**
 * Save demo/dummy data for a user
 * Returns consistent response format matching getDemoData()
 * 
 * @param {string} userId - User document ID
 * @param {string} regNumber - Registration number
 * @param {Object} res - Express response
 */
const saveDemoData = async (userId, regNumber, res) => {
  try {
    const docId = userId || regNumber;

    if (docId) {
      const userRef = db.collection('users').doc(docId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        await userRef.update({
          profile: DUMMY_DATA.profile,
          marks_data: DUMMY_DATA.marks,
          attendance_data: DUMMY_DATA.attendance,
          timetable_data: DUMMY_DATA.timetable || [],
          courses_data: DUMMY_DATA.courses || [],
          results_data: DUMMY_DATA.results || [],
          notifications_data: DUMMY_DATA.notifications || [],
          backlogs_data: DUMMY_DATA.backlogs || [],
          internal_assessments_data: DUMMY_DATA.internal_assessments || [],
          fees_data: DUMMY_DATA.fees || {},
          isVerified: false,
          portalConnected: false,
          portal_last_synced: new Date(),
          updated_at: new Date()
        });
      }
    }

    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: 'Demo data loaded successfully',
      data: {
        mode: 'demo',
        profile: DUMMY_DATA.profile,
        marks: DUMMY_DATA.marks,
        attendance: DUMMY_DATA.attendance,
        timetable: DUMMY_DATA.timetable || [],
        courses: DUMMY_DATA.courses || [],
        results: DUMMY_DATA.results || [],
        notifications: DUMMY_DATA.notifications || [],
        backlogs: DUMMY_DATA.backlogs || [],
        internal_assessments: DUMMY_DATA.internal_assessments || [],
        fees: DUMMY_DATA.fees || {},
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo',
        portalEnabled: isPortalEnabled()
      }
    });
  } catch (error) {
    console.error('Error saving demo data:', error.message);
    return res.status(500).json({
      success: false,
      status: STATUS_SCRAPE_ERROR,
      message: 'Failed to save demo data'
    });
  }
};

/**
 * Get portal connection status
 * 
 * Returns portal feature status (enabled/disabled) and user's connection status
 * Allows unauthenticated access to check if portal features are enabled
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPortalStatus = async (req, res) => {
  // Always return portal enabled status first
  const portalStatusEnabled = isPortalEnabled();
  
  // If portal is disabled, return that status
  if (!portalStatusEnabled) {
    return res.json({
      success: true,
      data: {
        portalConnected: false,
        isVerified: false,
        lastSynced: null,
        portalEnabled: false,
        message: PORTAL_DISABLED_MESSAGE
      }
    });
  }

  // If no user is authenticated, just return portal enabled status
  if (!req.user) {
    return res.json({
      success: true,
      data: {
        portalConnected: false,
        isVerified: false,
        lastSynced: null,
        portalEnabled: true
      }
    });
  }

  try {
    const userId = req.user.id || req.user.uid;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // User is authenticated but document doesn't exist yet
      // Return default unconnected status (user doc will be created on first sync)
      return res.json({
        success: true,
        data: {
          portalConnected: false,
          isVerified: false,
          lastSynced: null,
          portalEnabled: true,
          message: 'User profile not yet created. Portal data will be stored on first sync.'
        }
      });
    }

    const userData = userDoc.data();

    return res.json({
      success: true,
      data: {
        portalConnected: userData.portalConnected || false,
        isVerified: userData.isVerified || false,
        lastSynced: userData.portal_last_synced || null,
        portalEnabled: true
      }
    });
  } catch (error) {
    console.error('Get portal status error:', error.message);
    // Return basic status even on error
    return res.json({
      success: true,
      data: {
        portalConnected: false,
        isVerified: false,
        lastSynced: null,
        portalEnabled: portalStatusEnabled
      }
    });
  }
};

/**
 * Disconnect portal (reset to demo data)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const disconnectPortal = async (req, res) => {
  try {
    const userId = req.user.id || req.user.uid;
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      portalConnected: false,
      isVerified: false,
      portal_last_synced: null,
      updated_at: new Date()
    });

    return res.json({
      success: true,
      message: 'Portal disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect portal error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get scraped portal data
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * Returns demo data when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPortalData = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Return demo data when portal features are suspended
  if (!isPortalEnabled()) {
    console.log('Portal data requested but feature is disabled - returning demo data');
    return res.json({
      success: true,
      data: {
        profile: DUMMY_DATA.profile,
        marks: DUMMY_DATA.marks,
        attendance: DUMMY_DATA.attendance,
        timetable: DUMMY_DATA.timetable,
        courses: DUMMY_DATA.courses,
        isVerified: false,
        portalConnected: false,
        portalEnabled: false,
        message: PORTAL_DISABLED_MESSAGE
      }
    });
  }

  try {
    const userId = req.user.id || req.user.uid;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();

    // If portal is not connected, return demo data
    if (!userData.portalConnected) {
      return res.json({
        success: true,
        data: {
          profile: DUMMY_DATA.profile,
          marks: DUMMY_DATA.marks,
          attendance: DUMMY_DATA.attendance,
          timetable: DUMMY_DATA.timetable,
          courses: DUMMY_DATA.courses,
          isVerified: false,
          portalConnected: false
        }
      });
    }

    return res.json({
      success: true,
      data: {
        profile: userData.profile || DUMMY_DATA.profile,
        marks: userData.marks_data || DUMMY_DATA.marks,
        attendance: userData.attendance_data || DUMMY_DATA.attendance,
        timetable: userData.timetable_data || DUMMY_DATA.timetable,
        courses: userData.courses_data || DUMMY_DATA.courses,
        isVerified: userData.isVerified || false,
        portalConnected: userData.portalConnected || false,
        lastSynced: userData.portal_last_synced || null
      }
    });
  } catch (error) {
    console.error('Get portal data error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Save portal data to Firestore (renamed to avoid conflict)
 * @param {string} userId - User document ID
 * @param {string} regNumber - Registration number
 * @param {Object} data - Scraped data
 * @param {boolean} isVerified - Whether data is verified from portal
 */
const savePortalDataToFirestore = async (userId, regNumber, data, isVerified) => {
  const updateData = {
    profile: data.profile || {},
    marks_data: data.marks || [],
    attendance_data: data.attendance || [],
    timetable_data: data.timetable || [],
    courses_data: data.courses || [],
    results_data: data.results || [],
    notifications_data: data.notifications || [],
    backlogs_data: data.backlogs || [],
    internal_assessments_data: data.internal_assessments || [],
    fees_data: data.fees || {},
    isVerified: isVerified,
    portalConnected: true,
    portal_last_synced: new Date(),
    updated_at: new Date()
  };

  const docId = userId || regNumber;

  if (!docId) {
    console.warn('savePortalDataToFirestore: No docId available, cannot save data');
    return false;
  }

  try {
    const userRef = db.collection('users').doc(docId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update(updateData);
      console.log(`Portal data saved for user: ${docId}`);
      return true;
    } else if (regNumber && regNumber !== docId) {
      const regRef = db.collection('users').doc(regNumber);
      const regDoc = await regRef.get();
      if (regDoc.exists) {
        await regRef.update(updateData);
        console.log(`Portal data saved for registration: ${regNumber}`);
        return true;
      }
    }
    
    console.warn(`savePortalDataToFirestore: No document found for ${docId} or ${regNumber}`);
    return false;
  } catch (error) {
    console.error(`savePortalDataToFirestore error for ${docId}:`, error.message);
    return false;
  }
};

/**
 * Save data to Google Drive as JSON backup (non-blocking)
 * @param {string} regNumber - Registration number
 * @param {Object} data - Data to save
 */
async function saveToGoogleDriveBackup(regNumber, data) {
  try {
    const isAvailable = await googleDriveBackup.isAvailable();
    if (!isAvailable) {
      console.log('Google Drive Backup service not available, skipping backup');
      return false;
    }
    return await googleDriveBackup.saveUserBackup(regNumber, data);
  } catch (error) {
    console.error('Error saving to Google Drive:', error.message);
    return false;
  }
}

/**
 * Save data to Google Sheets as backup (non-blocking)
 * @param {string} regNumber - Registration number
 * @param {Object} data - Data to save
 */
async function saveToGoogleSheetsBackup(regNumber, data) {
  try {
    const isAvailable = await googleSheetsService.isAvailable();
    if (!isAvailable) {
      console.log('Google Sheets service not available, skipping backup');
      return false;
    }
    return await googleSheetsService.saveUserData(regNumber, data);
  } catch (error) {
    console.error('Error saving to Google Sheets:', error.message);
    return false;
  }
}

/**
 * Try to load backup data from multiple sources
 * Priority: Google Drive → Google Sheets → Firestore → null
 * @param {string} regNumber - Registration number
 * @param {string} userId - User ID
 * @returns {Object|null} - Backup data or null
 */
async function tryLoadBackupData(regNumber, userId) {
  // Try Google Drive JSON backup first
  try {
    const driveAvailable = await googleDriveBackup.isAvailable();
    if (driveAvailable) {
      const driveData = await googleDriveBackup.loadUserBackup(regNumber);
      if (driveData && (driveData.profile || driveData.attendance?.length || driveData.marks?.length)) {
        console.log(`Loaded backup data from Google Drive for ${regNumber}`);
        return {
          profile: driveData.profile || DUMMY_DATA.profile,
          marks: driveData.marks || DUMMY_DATA.marks,
          attendance: driveData.attendance || DUMMY_DATA.attendance,
          timetable: driveData.timetable || DUMMY_DATA.timetable,
          courses: driveData.courses || DUMMY_DATA.courses,
          results: driveData.results || [],
          notifications: driveData.notifications || [],
          backlogs: driveData.backlogs || [],
          internal_assessments: driveData.internal_assessments || [],
          dataSource: 'google_drive',
          lastUpdated: driveData.backupMetadata?.savedAt || null
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load from Google Drive:', error.message);
  }

  // Try Google Sheets next
  try {
    const isAvailable = await googleSheetsService.isAvailable();
    if (isAvailable) {
      const sheetsData = await googleSheetsService.loadUserData(regNumber);
      if (sheetsData && (sheetsData.profile || sheetsData.attendance?.length || sheetsData.marks?.length)) {
        console.log(`Loaded backup data from Google Sheets for ${regNumber}`);
        return {
          profile: sheetsData.profile || DUMMY_DATA.profile,
          marks: sheetsData.marks || DUMMY_DATA.marks,
          attendance: sheetsData.attendance || DUMMY_DATA.attendance,
          timetable: sheetsData.timetable || DUMMY_DATA.timetable,
          courses: sheetsData.courses || DUMMY_DATA.courses,
          results: sheetsData.results || [],
          notifications: sheetsData.notifications || [],
          dataSource: 'google_sheets',
          lastUpdated: sheetsData.lastUpdated
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load from Google Sheets:', error.message);
  }

  // Try Firestore next
  try {
    const docId = userId || regNumber;
    if (docId) {
      const userRef = db.collection('users').doc(docId);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.marks_data?.length || userData.attendance_data?.length || userData.profile) {
          console.log(`Loaded backup data from Firestore for ${docId}`);
          return {
            profile: userData.profile || DUMMY_DATA.profile,
            marks: userData.marks_data || DUMMY_DATA.marks,
            attendance: userData.attendance_data || DUMMY_DATA.attendance,
            timetable: userData.timetable_data || DUMMY_DATA.timetable,
            courses: userData.courses_data || DUMMY_DATA.courses,
            results: userData.results_data || [],
            notifications: userData.notifications_data || [],
            dataSource: 'firestore',
            lastUpdated: userData.portal_last_synced
          };
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load from Firestore:', error.message);
  }

  return null;
}

/**
 * Load backup data endpoint - explicit backup loading
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * Returns demo data when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const loadBackupData = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Return demo data when portal features are suspended
  if (!isPortalEnabled()) {
    console.log('Portal backup load attempted but feature is disabled - returning demo data');
    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: PORTAL_DISABLED_MESSAGE + ' Showing demo data.',
      data: {
        mode: 'demo',
        ...DUMMY_DATA,
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo',
        warning: PORTAL_DISABLED_MESSAGE
      }
    });
  }

  try {
    const { reg_number } = req.body;
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    if (!reg_number && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required'
      });
    }

    const backupData = await tryLoadBackupData(reg_number, userId);
    
    if (backupData) {
      return res.json({
        success: true,
        status: STATUS_BACKUP_LOADED,
        message: `Data loaded from ${backupData.dataSource}`,
        data: {
          ...backupData,
          isVerified: false,
          portalConnected: false
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: 'No backup data found'
    });
  } catch (error) {
    console.error('Load backup data error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Recovery endpoint - GET /api/portal/recover
 * Attempts to load backup data for a user, falls back to demo data
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * This endpoint returns demo data when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const recoverPortalData = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // When portal is disabled, always return demo data instead
  if (!isPortalEnabled()) {
    console.log('Portal recover attempted but feature is disabled - returning demo data');
    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: PORTAL_DISABLED_MESSAGE + ' Showing demo data.',
      data: {
        mode: 'demo',
        ...DUMMY_DATA,
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo',
        warning: PORTAL_DISABLED_MESSAGE
      }
    });
  }

  try {
    const { reg_number } = req.query;
    const userId = req.user ? (req.user.id || req.user.uid) : null;
    const regNumber = reg_number || (req.user ? req.user.registration_number : null);

    if (!regNumber && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Registration number or authentication is required'
      });
    }

    // Try Google Drive backup first
    try {
      const driveAvailable = await googleDriveBackup.isAvailable();
      if (driveAvailable) {
        const driveData = await googleDriveBackup.loadUserBackup(regNumber);
        if (driveData && (driveData.profile || driveData.marks?.length || driveData.attendance?.length)) {
          console.log(`Recovered data from Google Drive for: ${regNumber}`);
          return res.json({
            success: true,
            status: STATUS_BACKUP_LOADED,
            message: 'Data recovered from Google Drive backup',
            data: {
              ...driveData,
              isVerified: false,
              portalConnected: false,
              dataSource: 'google_drive'
            }
          });
        }
      }
    } catch (e) {
      console.warn('Google Drive recovery failed:', e.message);
    }

    // Try Google Sheets backup
    const backupData = await tryLoadBackupData(regNumber, userId);
    if (backupData) {
      return res.json({
        success: true,
        status: STATUS_BACKUP_LOADED,
        message: `Data recovered from ${backupData.dataSource}`,
        data: {
          ...backupData,
          isVerified: false,
          portalConnected: false
        }
      });
    }

    // Return demo data as fallback
    return res.json({
      success: true,
      status: STATUS_DEMO_LOADED,
      message: 'No backup found. Returning demo data.',
      data: {
        mode: 'demo',
        ...DUMMY_DATA,
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo'
      }
    });
  } catch (error) {
    console.error('Recovery error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Fetch all portal data endpoint - POST /api/portal/fetch
 * Fetches all available student data after login
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * This endpoint is disabled when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const fetchPortalData = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Check if portal features are enabled
  if (!isPortalEnabled()) {
    console.log('Portal fetch attempted but feature is disabled');
    return res.status(503).json(getPortalDisabledResponse());
  }

  try {
    const { reg_number, password } = req.body;
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    if (!reg_number || !password) {
      return res.status(400).json({
        success: false,
        message: 'Registration number and password are required'
      });
    }

    // This endpoint directly calls the scraper without attempt tracking
    // Use it when you specifically want to refresh data
    
    // Use Node.js scraper service directly
    const { createScraper } = require('../services/portal-scraper.service');
    const scraper = createScraper();
    
    try {
      // Scrape portal data using Node.js scraper
      const scraperResponse = await scraper.scrape(reg_number, password);
      
      const { status, data, message } = scraperResponse;

      if (status === STATUS_SUCCESS) {
        // Save to Firestore
        await savePortalDataToFirestore(userId, reg_number, data, true);

        // Save to Google Drive backup
        await saveToGoogleDriveBackup(reg_number, data);

        // Save to Google Sheets backup
        await saveToGoogleSheetsBackup(reg_number, data);

        return res.json({
          success: true,
          status: STATUS_SUCCESS,
          message: 'All portal data fetched and saved successfully',
          data: formatPortalData(data, true, true, 'live_portal')
        });
      }

      return res.status(status === STATUS_AUTH_FAILED ? 401 : 500).json({
        success: false,
        status,
        message: message || 'Failed to fetch portal data'
      });

    } catch (scraperError) {
      console.error('Fetch portal data error:', scraperError.message);
      return res.status(500).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: scraperError.response?.data?.message || 'Failed to fetch portal data'
      });
    }
  } catch (error) {
    console.error('Fetch portal data error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Save backup endpoint - POST /api/portal/backup
 * Manually triggers backup save to Google Drive
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * This endpoint is disabled when portal features are suspended.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const saveBackup = async (req, res) => {
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Check if portal features are enabled
  if (!isPortalEnabled()) {
    console.log('Portal backup attempted but feature is disabled');
    return res.status(503).json(getPortalDisabledResponse());
  }

  try {
    const { reg_number, data } = req.body;
    const userId = req.user ? (req.user.id || req.user.uid) : null;
    const regNumber = reg_number || (req.user ? req.user.registration_number : null);

    if (!regNumber) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required'
      });
    }

    // If data provided, save it; otherwise, try to get from Firestore
    let dataToSave = data;
    if (!dataToSave) {
      const docId = userId || regNumber;
      if (docId) {
        const userRef = db.collection('users').doc(docId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          dataToSave = {
            profile: userData.profile,
            marks: userData.marks_data,
            attendance: userData.attendance_data,
            timetable: userData.timetable_data,
            courses: userData.courses_data,
            results: userData.results_data,
            notifications: userData.notifications_data
          };
        }
      }
    }

    if (!dataToSave) {
      return res.status(400).json({
        success: false,
        message: 'No data to backup'
      });
    }

    // Save to Google Drive
    const driveSuccess = await saveToGoogleDriveBackup(regNumber, dataToSave);

    // Also save to Google Sheets
    const sheetsSuccess = await saveToGoogleSheetsBackup(regNumber, dataToSave);

    if (driveSuccess || sheetsSuccess) {
      return res.json({
        success: true,
        message: 'Backup saved successfully',
        savedTo: {
          googleDrive: driveSuccess,
          googleSheets: sheetsSuccess
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to save backup'
    });
  } catch (error) {
    console.error('Save backup error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  syncPortalData,
  portalLogin,
  fetchPortalData,
  saveBackup,
  recoverPortalData,
  getPortalStatus,
  disconnectPortal,
  getPortalData,
  loadBackupData,
  getDemoData,
  DUMMY_DATA,
  STATUS_SUCCESS,
  STATUS_AUTH_FAILED,
  STATUS_SCRAPE_ERROR,
  STATUS_PORTAL_UNREACHABLE,
  STATUS_BACKUP_LOADED,
  STATUS_DEMO_LOADED,
  STATUS_MAX_ATTEMPTS_REACHED,
  MAX_LOGIN_ATTEMPTS,
  // TEMPORARILY DISABLED — DO NOT REMOVE
  // Export feature flag check function for use in routes
  isPortalEnabled,
  getPortalDisabledResponse
};
