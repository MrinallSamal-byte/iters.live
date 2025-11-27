/**
 * Portal Controller
 * Handles student portal scraping and data synchronization
 */

const axios = require('axios');

// Scraper service URL (Flask scraper running on port 5001)
const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:5001';

/**
 * Scrape student portal data
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function scrapePortalData(req, res) {
    const { registration_number, password } = req.body;

    // Validate input
    if (!registration_number || !password) {
        return res.status(400).json({
            status: 'error',
            error: 'Registration number and password are required',
            error_type: 'validation_error'
        });
    }

    try {
        // Call the Flask scraper service
        const response = await axios.post(`${SCRAPER_URL}/api/scrape`, {
            user_id: registration_number,
            password: password
        }, {
            timeout: 120000, // 2 minute timeout for scraping
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const scraperData = response.data;

        if (scraperData.status === 'success') {
            // Transform and return the data
            return res.json({
                status: 'success',
                student_data: scraperData.student_data,
                metadata: scraperData.metadata
            });
        } else {
            // Handle scraper errors
            const errorType = scraperData.error_type || 'unknown';
            
            if (errorType === 'auth_failed' || 
                (scraperData.error && scraperData.error.toLowerCase().includes('credential'))) {
                return res.status(401).json({
                    status: 'AUTH_FAILED',
                    error: 'Invalid registration number or password',
                    error_type: 'auth_failed'
                });
            }

            return res.status(500).json({
                status: 'SCRAPE_ERROR',
                error: scraperData.error || 'Failed to scrape portal data',
                error_type: errorType
            });
        }
    } catch (error) {
        console.error('Portal scrape error:', error.message);

        // Handle different error types
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                status: 'SCRAPE_ERROR',
                error: 'Scraper service is not available. Please try again later.',
                error_type: 'service_unavailable'
            });
        }

        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            return res.status(504).json({
                status: 'SCRAPE_ERROR',
                error: 'Request timed out. The portal may be slow or unavailable.',
                error_type: 'timeout'
            });
        }

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401) {
                return res.status(401).json({
                    status: 'AUTH_FAILED',
                    error: 'Invalid credentials',
                    error_type: 'auth_failed'
                });
            }

            return res.status(status).json({
                status: 'SCRAPE_ERROR',
                error: data?.error || 'Scraper returned an error',
                error_type: data?.error_type || 'scraper_error'
            });
        }

        return res.status(500).json({
            status: 'SCRAPE_ERROR',
            error: 'An unexpected error occurred',
            error_type: 'internal_error'
        });
    }
}

/**
 * Check scraper service health
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function checkScraperHealth(req, res) {
    try {
        const response = await axios.get(`${SCRAPER_URL}/health`, {
            timeout: 5000
        });

        return res.json({
            status: 'healthy',
            scraper: response.data
        });
    } catch (error) {
        return res.status(503).json({
            status: 'unhealthy',
            error: 'Scraper service is not available',
            details: error.message
        });
    }
}

/**
 * Update user verification status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function updateVerificationStatus(req, res) {
    const { db } = require('../database/firebase');
    const userId = req.user?.uid;

    if (!userId) {
        return res.status(401).json({
            status: 'error',
            error: 'User not authenticated'
        });
    }

    const { isVerified, portalConnected, studentData } = req.body;

    try {
        const userRef = db.collection('users').doc(userId);
        const updateData = {
            isVerified: isVerified || false,
            portalConnected: portalConnected || false,
            updatedAt: new Date()
        };

        if (studentData) {
            updateData.studentPortalData = studentData;
            updateData.lastSynced = new Date();
        }

        await userRef.update(updateData);

        return res.json({
            status: 'success',
            message: 'Verification status updated'
        });
    } catch (error) {
        console.error('Update verification error:', error);
        return res.status(500).json({
            status: 'error',
            error: 'Failed to update verification status'
        });
    }
}

/**
 * Get user portal connection status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getPortalStatus(req, res) {
    const { db } = require('../database/firebase');
    const userId = req.user?.uid;

    if (!userId) {
        return res.status(401).json({
            status: 'error',
            error: 'User not authenticated'
        });
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                status: 'error',
                error: 'User not found'
            });
        }

        const userData = userDoc.data();

        return res.json({
            status: 'success',
            data: {
                isVerified: userData.isVerified || false,
                portalConnected: userData.portalConnected || false,
                lastSynced: userData.lastSynced || null,
                usingDummyData: userData.usingDummyData || false
            }
        });
    } catch (error) {
        console.error('Get portal status error:', error);
        return res.status(500).json({
            status: 'error',
            error: 'Failed to get portal status'
        });
    }
}

module.exports = {
    scrapePortalData,
    checkScraperHealth,
    updateVerificationStatus,
    getPortalStatus
};
