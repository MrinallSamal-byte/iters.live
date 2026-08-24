/**
 * Portal Routes
 * API routes for portal sync operations with 3-attempt login system
 * 
 * Endpoints:
 * - POST /api/portal/login - 3-attempt login with structured response
 * - POST /api/portal/sync - Legacy sync endpoint (uses login logic)
 * - POST /api/portal/fetch - Fetch all portal data
 * - POST /api/portal/backup - Save backup to Google Drive
 * - GET /api/portal/recover - Recover data from backup or demo
 * - GET /api/portal/status - Get portal connection status
 * - GET /api/portal/data - Get stored portal data
 * - POST /api/portal/disconnect - Disconnect portal
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const portalController = require('../controllers/portal.controller');
const rateLimit = require('express-rate-limit');

// Strict limiter for credential endpoints (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many portal login attempts. Please try again later.' }
});

/**
 * POST /api/portal/login
 * 3-Attempt Login System
 * 
 * Request body:
 * {
 *   "reg_number": "string",
 *   "password": "string"
 * }
 * 
 * Response (Attempt 1-2 failure):
 * { success: false, status: "AUTH_FAILED", attempt: 1, attemptsRemaining: 2, message: "..." }
 * 
 * Response (Attempt 3 failure - triggers fallback):
 * { success: true, status: "BACKUP_LOADED" | "DEMO_LOADED", data: {...}, message: "..." }
 * 
 * Response (Success):
 * { success: true, status: "SUCCESS", data: {...} }
 */
router.post('/login', loginLimiter, optionalAuth, portalController.portalLogin);

/**
 * GET /api/portal/demo
 * Get demo/sample data - ALWAYS AVAILABLE
 * This endpoint works regardless of portal feature status
 * No authentication required - returns static demo data for exploration
 */
router.get('/demo', portalController.getDemoData);

/**
 * POST /api/portal/sync
 * Sync portal data (legacy endpoint, uses login logic)
 * 
 * Request body:
 * {
 *   "reg_number": "string",
 *   "password": "string",
 *   "useDemoData": boolean (optional)
 * }
 */
router.post('/sync', authMiddleware, portalController.syncPortalData);

/**
 * POST /api/portal/fetch
 * Fetch all portal data (bypasses attempt tracking)
 * Use this when you want to force a fresh data fetch
 */
router.post('/fetch', authMiddleware, portalController.fetchPortalData);

/**
 * POST /api/portal/backup
 * Manually save backup to Google Drive
 * 
 * Request body:
 * {
 *   "reg_number": "string",
 *   "data": {...} (optional - if not provided, loads from Firestore)
 * }
 */
router.post('/backup', authMiddleware, portalController.saveBackup);

/**
 * GET /api/portal/recover
 * Recover data from backup or return demo data
 * 
 * Query params:
 * - reg_number: string (optional if authenticated)
 */
router.get('/recover', authMiddleware, portalController.recoverPortalData);

/**
 * POST /api/portal/load-backup
 * Load backup data from available sources (Drive, Sheets, Firestore)
 * 
 * Request body:
 * {
 *   "reg_number": "string"
 * }
 */
router.post('/load-backup', authMiddleware, portalController.loadBackupData);

/**
 * GET /api/portal/status
 * Get portal connection status
 * Requires authentication; status is always scoped to req.user
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
