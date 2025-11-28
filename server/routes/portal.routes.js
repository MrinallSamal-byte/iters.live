/**
 * Portal Routes
 * API routes for portal sync operations
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const portalController = require('../controllers/portal.controller');
const googleSheetsService = require('../services/googleSheets.service');
const { db } = require('../database/firebase');

// Constants for cache duration
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * POST /api/portal/sync
 * Sync portal data - forwards credentials to Flask scraper
 * 
 * Request body:
 * {
 *   "reg_number": "string",
 *   "password": "string",
 *   "useDemoData": boolean (optional)
 * }
 * 
 * Response:
 * Success: { success: true, status: "SUCCESS", data: {...} }
 * Auth Failed: { success: false, status: "AUTH_FAILED", message: "..." }
 * Error: { success: false, status: "SCRAPE_ERROR", message: "..." }
 * Backup Loaded: { success: true, status: "BACKUP_LOADED", data: {...}, warning: "..." }
 */
router.post('/sync', optionalAuth, portalController.syncPortalData);

/**
 * POST /api/portal/backup
 * Load backup data from Google Sheets or Firestore
 */
router.post('/backup', optionalAuth, portalController.loadBackupData);

/**
 * GET /api/portal/status
 * Get portal connection status for authenticated user
 */
router.get('/status', authMiddleware, portalController.getPortalStatus);

/**
 * GET /api/portal/data
 * Get scraped portal data for authenticated user
 */
router.get('/data', authMiddleware, portalController.getPortalData);

/**
 * POST /api/portal/disconnect
 * Disconnect portal (reset to demo data)
 */
router.post('/disconnect', authMiddleware, portalController.disconnectPortal);

/**
 * POST /api/scrape-and-sync
 * Alias for /api/portal/sync - runs scraper, returns dataset, writes to Firestore + Google Sheets
 */
router.post('/scrape-and-sync', optionalAuth, portalController.syncPortalData);

/**
 * GET /api/student/:regNo/live
 * Get live/fresh data for a student (triggers scrape if needed)
 */
router.get('/student/:regNo/live', optionalAuth, async (req, res) => {
  try {
    const regNo = req.params.regNo;
    const userId = req.user ? (req.user.id || req.user.uid) : null;
    
    // Check if we have recent data in Firestore (within last hour)
    const userRef = db.collection('users').doc(userId || regNo);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const lastSync = userData.portal_last_synced;
      
      // If synced within last hour, return cached data
      if (lastSync) {
        const cacheExpiry = new Date(Date.now() - CACHE_DURATION_MS);
        const syncDate = lastSync.toDate ? lastSync.toDate() : new Date(lastSync);
        
        if (syncDate > cacheExpiry) {
          return res.json({
            success: true,
            data: {
              profile: userData.profile || portalController.DUMMY_DATA.profile,
              marks: userData.marks_data || portalController.DUMMY_DATA.marks,
              attendance: userData.attendance_data || portalController.DUMMY_DATA.attendance,
              timetable: userData.timetable_data || [],
              courses: userData.courses_data || [],
              results: userData.results_data || [],
              notifications: userData.notifications_data || [],
              isVerified: userData.isVerified || false,
              portalConnected: userData.portalConnected || false,
              dataSource: 'firestore_cached',
              lastSynced: syncDate
            }
          });
        }
      }
    }
    
    // No recent data - return demo data with note to sync
    res.json({
      success: true,
      data: {
        ...portalController.DUMMY_DATA,
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo',
        message: 'No recent live data. Please sync from SOA portal.'
      }
    });
  } catch (error) {
    console.error('Get live data error:', error.message);
    res.json({
      success: true,
      data: {
        ...portalController.DUMMY_DATA,
        isVerified: false,
        portalConnected: false,
        dataSource: 'demo'
      }
    });
  }
});

/**
 * GET /api/student/:regNo/drive-backup
 * Get data from Google Drive Sheets backup
 */
router.get('/student/:regNo/drive-backup', optionalAuth, async (req, res) => {
  try {
    const regNo = req.params.regNo;
    
    const isAvailable = await googleSheetsService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        success: false,
        message: 'Google Sheets service not available'
      });
    }
    
    const sheetsData = await googleSheetsService.loadUserData(regNo);
    
    if (sheetsData && (sheetsData.profile || sheetsData.attendance?.length || sheetsData.marks?.length)) {
      return res.json({
        success: true,
        data: {
          profile: sheetsData.profile || portalController.DUMMY_DATA.profile,
          marks: sheetsData.marks || portalController.DUMMY_DATA.marks,
          attendance: sheetsData.attendance || portalController.DUMMY_DATA.attendance,
          timetable: sheetsData.timetable || [],
          courses: sheetsData.courses || [],
          results: sheetsData.results || [],
          notifications: sheetsData.notifications || [],
          isVerified: false,
          portalConnected: false,
          dataSource: 'google_sheets',
          lastUpdated: sheetsData.lastUpdated
        }
      });
    }
    
    res.status(404).json({
      success: false,
      message: 'No backup data found in Google Sheets'
    });
  } catch (error) {
    console.error('Get drive backup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Google Sheets backup'
    });
  }
});

/**
 * GET /api/student/:regNo/firestore
 * Get data from Firestore backup
 */
router.get('/student/:regNo/firestore', optionalAuth, async (req, res) => {
  try {
    const regNo = req.params.regNo;
    const userId = req.user ? (req.user.id || req.user.uid) : null;
    
    const docId = userId || regNo;
    const userRef = db.collection('users').doc(docId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      if (userData.marks_data?.length || userData.attendance_data?.length || userData.profile) {
        return res.json({
          success: true,
          data: {
            profile: userData.profile || portalController.DUMMY_DATA.profile,
            marks: userData.marks_data || portalController.DUMMY_DATA.marks,
            attendance: userData.attendance_data || portalController.DUMMY_DATA.attendance,
            timetable: userData.timetable_data || [],
            courses: userData.courses_data || [],
            results: userData.results_data || [],
            notifications: userData.notifications_data || [],
            isVerified: userData.isVerified || false,
            portalConnected: userData.portalConnected || false,
            dataSource: 'firestore',
            lastUpdated: userData.portal_last_synced
          }
        });
      }
    }
    
    res.status(404).json({
      success: false,
      message: 'No data found in Firestore'
    });
  } catch (error) {
    console.error('Get firestore data error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Firestore data'
    });
  }
});

module.exports = router;
