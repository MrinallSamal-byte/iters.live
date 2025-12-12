/**
 * SOA Portal Scraper Routes
 * 
 * API routes for SOA portal scraping with user-provided CAPTCHA
 * 
 * Endpoints:
 * - GET /api/soa/captcha - Fetches fresh captcha from SOA portal
 * - POST /api/soa/login - Performs login with user credentials and captcha
 * - POST /api/soa/refresh-captcha - Refreshes captcha for existing session
 * - GET /api/soa/status - Check if scraper service is available
 * 
 * Security:
 * - Credentials are NEVER stored or logged
 * - Sessions expire after 10 minutes
 * - Fresh browser session for each captcha request
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const soaScraperService = require('../services/soa-scraper.service');

/**
 * GET /api/soa/status
 * Check if SOA scraper service is available
 */
router.get('/status', async (req, res) => {
    try {
        return res.json({
            success: true,
            status: 'available',
            message: 'SOA Portal Scraper is available',
            features: {
                captchaExtraction: true,
                userProvidedCaptcha: true,
                dataScrapingSupported: [
                    'profile',
                    'attendance',
                    'marks',
                    'internalAssessments',
                    'timetable',
                    'subjects',
                    'notifications'
                ]
            }
        });
    } catch (error) {
        console.error('[SOA Routes] Status check error:', error.message);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'SOA Portal Scraper status check failed'
        });
    }
});

/**
 * GET /api/soa/captcha
 * Create a new session and fetch CAPTCHA from SOA portal
 * 
 * Response:
 * {
 *   success: true,
 *   status: "CAPTCHA_REQUIRED",
 *   sessionId: "soa_...",
 *   captchaImage: "data:image/png;base64,...",
 *   message: "..."
 * }
 */
router.get('/captcha', optionalAuth, async (req, res) => {
    try {
        console.log('[SOA Routes] Captcha request received');
        
        const result = await soaScraperService.createSessionAndGetCaptcha();
        
        if (!result.success) {
            return res.status(result.status === 'PORTAL_UNREACHABLE' ? 503 : 500).json(result);
        }
        
        return res.json(result);
        
    } catch (error) {
        console.error('[SOA Routes] Captcha error:', error.message);
        return res.status(500).json({
            success: false,
            status: 'SCRAPE_ERROR',
            message: `Failed to get CAPTCHA: ${error.message}`
        });
    }
});

/**
 * POST /api/soa/refresh-captcha
 * Refresh CAPTCHA for an existing session
 * 
 * Request body:
 * {
 *   sessionId: "soa_..."
 * }
 */
router.post('/refresh-captcha', optionalAuth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                status: 'INVALID_REQUEST',
                message: 'Session ID is required'
            });
        }
        
        console.log('[SOA Routes] Captcha refresh request for session:', sessionId);
        
        const result = await soaScraperService.refreshCaptcha(sessionId);
        
        if (!result.success) {
            return res.status(result.status === 'SESSION_EXPIRED' ? 410 : 500).json(result);
        }
        
        return res.json(result);
        
    } catch (error) {
        console.error('[SOA Routes] Captcha refresh error:', error.message);
        return res.status(500).json({
            success: false,
            status: 'SCRAPE_ERROR',
            message: `Failed to refresh CAPTCHA: ${error.message}`
        });
    }
});

/**
 * POST /api/soa/login
 * Perform login with user-provided credentials and CAPTCHA
 * 
 * Request body:
 * {
 *   sessionId: "soa_...",
 *   regNo: "1234567890",
 *   password: "user_password",
 *   captcha: "ABC123"
 * }
 * 
 * Response (Success):
 * {
 *   success: true,
 *   status: "SUCCESS",
 *   data: {
 *     profile: {...},
 *     attendance: [...],
 *     marks: [...],
 *     ...
 *   }
 * }
 * 
 * Response (Failure):
 * {
 *   success: false,
 *   status: "AUTH_FAILED" | "SESSION_EXPIRED" | "SCRAPE_ERROR",
 *   message: "..."
 * }
 */
router.post('/login', optionalAuth, async (req, res) => {
    try {
        const { sessionId, regNo, password, captcha } = req.body;
        
        // Validate required fields
        if (!sessionId || !regNo || !password || !captcha) {
            return res.status(400).json({
                success: false,
                status: 'INVALID_REQUEST',
                message: 'Session ID, Registration Number, Password, and CAPTCHA are required'
            });
        }
        
        console.log('[SOA Routes] Login request for session:', sessionId, 'regNo:', regNo);
        
        // Perform login and scrape
        const result = await soaScraperService.loginAndScrape(
            sessionId,
            regNo,
            password,
            captcha
        );
        
        // Clear password from memory
        req.body.password = null;
        
        if (!result.success) {
            const statusCode = result.status === 'AUTH_FAILED' ? 401 
                             : result.status === 'SESSION_EXPIRED' ? 410 
                             : 500;
            return res.status(statusCode).json(result);
        }
        
        // Format successful response
        return res.json({
            success: true,
            status: 'success',
            message: result.message,
            data: {
                profile: result.data.profile || {},
                attendance: result.data.attendance || [],
                marks: result.data.marks || [],
                internalAssessments: result.data.internalAssessments || [],
                timetable: result.data.timetable || [],
                subjects: result.data.subjects || [],
                notifications: result.data.notifications || [],
                backlogs: result.data.backlogs || [],
                fees: result.data.fees || {},
                fetchedAt: result.data.fetchedAt,
                dataSource: 'live_soa_portal'
            }
        });
        
    } catch (error) {
        console.error('[SOA Routes] Login error:', error.message);
        return res.status(500).json({
            success: false,
            status: 'SCRAPE_ERROR',
            message: `Login failed: ${error.message}`
        });
    }
});

/**
 * DELETE /api/soa/session/:sessionId
 * Close an active session
 */
router.delete('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }
        
        await soaScraperService.closeSession(sessionId);
        
        return res.json({
            success: true,
            message: 'Session closed successfully'
        });
        
    } catch (error) {
        console.error('[SOA Routes] Session close error:', error.message);
        return res.status(500).json({
            success: false,
            message: `Failed to close session: ${error.message}`
        });
    }
});

module.exports = router;
