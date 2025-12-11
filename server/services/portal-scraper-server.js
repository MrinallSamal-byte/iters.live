/**
 * Portal Scraper Microservice Server
 * 
 * ===============================================================================
 * ALL CODE IN THIS FILE HAS BEEN COMMENTED OUT
 * ===============================================================================
 * This Express server provides endpoints for scraping external student portals.
 * All scraping functionality has been permanently disabled.
 * ===============================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.SCRAPER_PORT || 5001;

// Status constants - kept for compatibility
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_DISABLED = 'PORTAL_DISABLED';

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'disabled',
        service: 'student-portal-scraper-nodejs',
        message: 'Scraping service is disabled',
        version: '2.0.0-disabled'
    });
});

/**
 * Main scraping endpoint - DISABLED
 */
app.post('/api/scrape', async (req, res) => {
    res.status(503).json({
        status: STATUS_PORTAL_DISABLED,
        message: 'Portal scraping is permanently disabled'
    });
});

/**
 * CAPTCHA test endpoint - DISABLED
 */
app.post('/api/test-captcha', async (req, res) => {
    res.status(503).json({
        status: STATUS_PORTAL_DISABLED,
        message: 'CAPTCHA solving is permanently disabled'
    });
});

// Error handlers
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        status: STATUS_SCRAPE_ERROR,
        message: 'Internal server error'
    });
});

// Start server only if this file is run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Portal scraper server (DISABLED) listening on port ${PORT}`);
        console.warn('WARNING: All scraping functionality has been disabled');
    });
}

module.exports = app;

// ============================================================================
// ALL SCRAPING CODE BELOW HAS BEEN COMMENTED OUT - DO NOT USE
// ============================================================================
// [Original scraper server code removed]
// This file is kept for reference only.
