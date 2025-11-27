/**
 * Web Routes
 * Handles obfuscated URL routing - serves pages via session IDs
 * URLs like /web/srv-xxx resolve to actual pages
 */

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const urlRouter = require('../utils/url-router.util');

// Rate limiter for web routes - prevents abuse
const webRouteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: { success: false, message: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all web routes
router.use(webRouteLimiter);

/**
 * GET /web/urls
 * Returns all available obfuscated URLs for the client
 */
router.get('/urls', (req, res) => {
    try {
        const urls = urlRouter.getAllObfuscatedUrls();
        res.json({
            success: true,
            data: urls
        });
    } catch (error) {
        console.error('Error getting obfuscated URLs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get URLs'
        });
    }
});

/**
 * GET /web/:sessionId
 * Resolves obfuscated session ID to actual page and serves it
 */
router.get('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Resolve the session ID to get actual path
        const mapping = urlRouter.resolveSessionId(sessionId);
        
        if (!mapping) {
            // Session ID not found or expired - redirect to home with new session
            const homeUrl = urlRouter.getObfuscatedUrl('home');
            return res.redirect(homeUrl);
        }
        
        // Extract the actual file path (without hash fragments)
        let actualPath = mapping.actualPath;
        
        if (actualPath.includes('#')) {
            const parts = actualPath.split('#');
            actualPath = parts[0];
        }
        
        // Construct full file path
        const clientDir = path.join(__dirname, '../../client');
        const filePath = path.join(clientDir, actualPath);
        
        // Security check: ensure the resolved path is within client directory
        const resolvedPath = path.resolve(filePath);
        const resolvedClientDir = path.resolve(clientDir);
        
        if (!resolvedPath.startsWith(resolvedClientDir)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Serve the file - use callback only for error logging
        // Don't redirect in callback as response may already be sent
        res.sendFile(resolvedPath, (err) => {
            if (err && !res.headersSent) {
                console.error('Error serving file:', err);
                res.status(404).json({
                    success: false,
                    message: 'Page not found'
                });
            }
        });
        
    } catch (error) {
        console.error('Error resolving session ID:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /web/navigate
 * Creates or retrieves obfuscated URL for navigation
 */
router.post('/navigate', express.json(), (req, res) => {
    try {
        const { pageKey } = req.body;
        
        if (!pageKey) {
            return res.status(400).json({
                success: false,
                message: 'Page key is required'
            });
        }
        
        const obfuscatedUrl = urlRouter.getObfuscatedUrl(pageKey);
        
        if (!obfuscatedUrl) {
            return res.status(404).json({
                success: false,
                message: 'Page not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                url: obfuscatedUrl,
                pageKey
            }
        });
        
    } catch (error) {
        console.error('Error creating navigation URL:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create navigation URL'
        });
    }
});

module.exports = router;
