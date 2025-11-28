/**
 * Portal Controller
 * Handles portal sync operations with the Flask scraper microservice
 * Includes Google Sheets backup integration and multi-layer fallback
 */
const axios = require('axios');
const { db } = require('../database/firebase');
const googleSheetsService = require('../services/googleSheets.service');

// Flask Scraper Service URL (configurable via environment)
const FLASK_SERVICE_URL = process.env.FLASK_SCRAPER_URL || 'http://localhost:5001';

// Status constants matching Python scraper
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';
const STATUS_BACKUP_LOADED = 'BACKUP_LOADED';

// Dummy data for fallback when scraping fails
const DUMMY_DATA = {
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
  notifications: []
};

/**
 * Sync portal data for a user
 * Enhanced with Google Sheets backup and multi-layer fallback
 * Flow: Live Portal → Google Sheets Backup → Firestore → Demo Data
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const syncPortalData = async (req, res) => {
  try {
    const { reg_number, password, useDemoData, forceBackup } = req.body;
    // Get userId from req.user if authenticated, supports both id and uid
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    // If explicitly requesting demo data
    if (useDemoData === true) {
      return await saveDemoData(userId, reg_number, res);
    }

    // Validate required fields
    if (!reg_number || !password) {
      return res.status(400).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: 'Registration number and password are required'
      });
    }

    // Call Flask scraper service - DO NOT log password
    console.log(`Portal sync request for: ${reg_number}, userId: ${userId || 'anonymous'}`);

    try {
      const scraperResponse = await axios.post(
        `${FLASK_SERVICE_URL}/api/scrape`,
        { reg_number, password },
        {
          timeout: 90000, // 90 second timeout for slow CAPTCHA solving
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const { status, data, message } = scraperResponse.data;

      if (status === STATUS_SUCCESS) {
        // Save scraped data to Firestore
        await savePortalData(userId, reg_number, data, true);

        // Also save to Google Sheets as backup (non-blocking)
        saveToGoogleSheetsBackup(reg_number, data).catch(err => {
          // Generic error logging without exposing sensitive details
          console.warn('Google Sheets backup failed (non-critical)');
        });

        return res.json({
          success: true,
          status: STATUS_SUCCESS,
          message: 'Portal data synced successfully',
          data: {
            profile: data.profile,
            marks: data.marks,
            attendance: data.attendance,
            timetable: data.timetable || [],
            courses: data.courses || [],
            results: data.results || [],
            notifications: data.notifications || [],
            isVerified: true,
            portalConnected: true,
            dataSource: 'live_portal'
          }
        });
      } else if (status === STATUS_AUTH_FAILED) {
        // Try loading backup data on auth failure (user might have correct data stored)
        const backupData = await tryLoadBackupData(reg_number, userId);
        if (backupData) {
          return res.json({
            success: true,
            status: STATUS_BACKUP_LOADED,
            message: 'Authentication failed. Showing previously saved data.',
            data: {
              ...backupData,
              isVerified: false,
              portalConnected: false,
              dataSource: backupData.dataSource,
              warning: 'Portal authentication failed. Displaying cached data.'
            }
          });
        }
        return res.status(401).json({
          success: false,
          status: STATUS_AUTH_FAILED,
          message: message || 'Invalid portal credentials'
        });
      } else if (status === STATUS_PORTAL_UNREACHABLE) {
        // Portal unreachable - try backup
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
              dataSource: backupData.dataSource,
              warning: 'Student portal is currently unreachable. Displaying cached data.'
            }
          });
        }
        return res.status(503).json({
          success: false,
          status: STATUS_PORTAL_UNREACHABLE,
          message: message || 'Student portal is currently unreachable. Please try again later.'
        });
      } else {
        return res.status(500).json({
          success: false,
          status: STATUS_SCRAPE_ERROR,
          message: message || 'Failed to fetch portal data'
        });
      }
    } catch (scraperError) {
      console.error('Scraper service error:', scraperError.message);

      // Try to load backup data on any scraper error
      const backupData = await tryLoadBackupData(reg_number, userId);

      // Handle different error responses from scraper
      if (scraperError.response) {
        const { status, data } = scraperError.response;
        
        if (status === 401 || (data && data.status === STATUS_AUTH_FAILED)) {
          if (backupData) {
            return res.json({
              success: true,
              status: STATUS_BACKUP_LOADED,
              message: 'Authentication failed. Showing previously saved data.',
              data: {
                ...backupData,
                isVerified: false,
                portalConnected: false,
                dataSource: backupData.dataSource,
                warning: 'Portal authentication failed. Displaying cached data.'
              }
            });
          }
          return res.status(401).json({
            success: false,
            status: STATUS_AUTH_FAILED,
            message: data?.message || 'Invalid portal credentials'
          });
        }
        
        if (status === 503 || (data && data.status === STATUS_PORTAL_UNREACHABLE)) {
          if (backupData) {
            return res.json({
              success: true,
              status: STATUS_BACKUP_LOADED,
              message: 'Portal unreachable. Showing previously saved data.',
              data: {
                ...backupData,
                isVerified: false,
                portalConnected: false,
                dataSource: backupData.dataSource,
                warning: 'Student portal is currently unreachable. Displaying cached data.'
              }
            });
          }
          return res.status(503).json({
            success: false,
            status: STATUS_PORTAL_UNREACHABLE,
            message: data?.message || 'Student portal is currently unreachable. Please try again later.'
          });
        }

        if (backupData) {
          return res.json({
            success: true,
            status: STATUS_BACKUP_LOADED,
            message: 'Scraping failed. Showing previously saved data.',
            data: {
              ...backupData,
              isVerified: false,
              portalConnected: false,
              dataSource: backupData.dataSource,
              warning: 'Could not fetch live data. Displaying cached data.'
            }
          });
        }
        
        return res.status(500).json({
          success: false,
          status: data?.status || STATUS_SCRAPE_ERROR,
          message: data?.message || 'Portal scraper service error'
        });
      }

      // Connection error or timeout - try backup
      if (backupData) {
        return res.json({
          success: true,
          status: STATUS_BACKUP_LOADED,
          message: 'Scraper service unavailable. Showing previously saved data.',
          data: {
            ...backupData,
            isVerified: false,
            portalConnected: false,
            dataSource: backupData.dataSource,
            warning: 'Portal service unavailable. Displaying cached data.'
          }
        });
      }

      return res.status(500).json({
        success: false,
        status: STATUS_SCRAPE_ERROR,
        message: scraperError.code === 'ECONNREFUSED' 
          ? 'Portal scraper service unavailable' 
          : 'Failed to connect to portal scraper service'
      });
    }
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
          isVerified: false,
          portalConnected: false,
          portal_last_synced: new Date(),
          updated_at: new Date()
        });
      }
    }

    return res.json({
      success: true,
      status: STATUS_SUCCESS,
      message: 'Demo data loaded',
      data: {
        profile: DUMMY_DATA.profile,
        marks: DUMMY_DATA.marks,
        attendance: DUMMY_DATA.attendance,
        isVerified: false,
        portalConnected: false
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
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPortalStatus = async (req, res) => {
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

    return res.json({
      success: true,
      data: {
        portalConnected: userData.portalConnected || false,
        isVerified: userData.isVerified || false,
        lastSynced: userData.portal_last_synced || null
      }
    });
  } catch (error) {
    console.error('Get portal status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
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
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPortalData = async (req, res) => {
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
 * Priority: Google Sheets → Firestore → null
 * @param {string} regNumber - Registration number
 * @param {string} userId - User ID
 * @returns {Object|null} - Backup data or null
 */
async function tryLoadBackupData(regNumber, userId) {
  // Try Google Sheets first
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
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const loadBackupData = async (req, res) => {
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

module.exports = {
  syncPortalData,
  getPortalStatus,
  disconnectPortal,
  getPortalData,
  loadBackupData,
  DUMMY_DATA,
  STATUS_SUCCESS,
  STATUS_AUTH_FAILED,
  STATUS_SCRAPE_ERROR,
  STATUS_PORTAL_UNREACHABLE,
  STATUS_BACKUP_LOADED
};
