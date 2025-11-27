/**
 * Portal Controller
 * Handles portal sync operations with the Flask scraper microservice
 */
const axios = require('axios');
const { db } = require('../database/firebase');

// Flask Scraper Service URL (configurable via environment)
const FLASK_SERVICE_URL = process.env.FLASK_SCRAPER_URL || 'http://localhost:5001';

// Status constants matching Python scraper
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';

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
  ]
};

/**
 * Sync portal data for a user
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const syncPortalData = async (req, res) => {
  try {
    const { reg_number, password, useDemoData } = req.body;
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

        return res.json({
          success: true,
          status: STATUS_SUCCESS,
          message: 'Portal data synced successfully',
          data: {
            profile: data.profile,
            marks: data.marks,
            attendance: data.attendance,
            isVerified: true,
            portalConnected: true
          }
        });
      } else if (status === STATUS_AUTH_FAILED) {
        return res.status(401).json({
          success: false,
          status: STATUS_AUTH_FAILED,
          message: message || 'Invalid portal credentials'
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

      // Handle different error responses from scraper
      if (scraperError.response) {
        const { status, data } = scraperError.response;
        
        if (status === 401 || (data && data.status === STATUS_AUTH_FAILED)) {
          return res.status(401).json({
            success: false,
            status: STATUS_AUTH_FAILED,
            message: data?.message || 'Invalid portal credentials'
          });
        }
        
        return res.status(500).json({
          success: false,
          status: data?.status || STATUS_SCRAPE_ERROR,
          message: data?.message || 'Portal scraper service error'
        });
      }

      // Connection error or timeout
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

module.exports = {
  syncPortalData,
  getPortalStatus,
  disconnectPortal,
  getPortalData,
  DUMMY_DATA
};
