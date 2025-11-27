/**
 * Portal Routes
 * Endpoints for student portal scraping and connection management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const portalController = require('../controllers/portal.controller');

/**
 * POST /api/portal/scrape
 * Scrape student portal data
 * Requires authentication
 */
router.post('/scrape', authMiddleware, portalController.scrapePortalData);

/**
 * GET /api/portal/health
 * Check scraper service health
 */
router.get('/health', portalController.checkScraperHealth);

/**
 * POST /api/portal/verify
 * Update user verification status
 * Requires authentication
 */
router.post('/verify', authMiddleware, portalController.updateVerificationStatus);

/**
 * GET /api/portal/status
 * Get user's portal connection status
 * Requires authentication
 */
router.get('/status', authMiddleware, portalController.getPortalStatus);

module.exports = router;
