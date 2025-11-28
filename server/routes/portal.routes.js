/**
 * Portal Routes
 * API routes for portal sync operations
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const portalController = require('../controllers/portal.controller');

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

module.exports = router;
