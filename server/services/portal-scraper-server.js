/**
 * Portal Scraper Microservice Server
 * Node.js/Express replacement for Flask scraper service
 * 
 * Endpoints:
 * - POST /api/scrape - Main scraping endpoint
 * - GET /health - Health check
 * - POST /api/test-captcha - Test CAPTCHA solving
 */

const express = require('express');
const cors = require('cors');
const { createScraper, STATUS_SUCCESS, STATUS_AUTH_FAILED, STATUS_SCRAPE_ERROR, STATUS_PORTAL_UNREACHABLE } = require('./portal-scraper.service');

const app = express();
const PORT = process.env.SCRAPER_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting storage (simple in-memory implementation)
const rateLimitStorage = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute

/**
 * Rate limiting middleware
 */
function rateLimit(req, res, next) {
    const clientIp = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitStorage.has(clientIp)) {
        rateLimitStorage.set(clientIp, []);
    }
    
    const requests = rateLimitStorage.get(clientIp);
    
    // Clean old requests
    const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= RATE_LIMIT_MAX) {
        return res.status(429).json({
            status: 'RATE_LIMITED',
            message: `Too many requests. Please wait ${Math.ceil(RATE_LIMIT_WINDOW / 1000)} seconds.`
        });
    }
    
    validRequests.push(now);
    rateLimitStorage.set(clientIp, validRequests);
    
    next();
}

/**
 * Validate scrape request
 */
function validateScrapeRequest(data) {
    if (!data) {
        return { valid: false, error: 'Request body is required' };
    }
    
    if (!data.reg_number) {
        return { valid: false, error: 'reg_number is required' };
    }
    
    if (!data.password) {
        return { valid: false, error: 'password is required' };
    }
    
    if (typeof data.reg_number !== 'string' || data.reg_number.length < 3) {
        return { valid: false, error: 'Invalid registration number' };
    }
    
    if (typeof data.password !== 'string' || data.password.length < 3) {
        return { valid: false, error: 'Invalid password' };
    }
    
    return { valid: true };
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'student-portal-scraper-nodejs',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

/**
 * Main scraping endpoint
 */
app.post('/api/scrape', rateLimit, async (req, res) => {
    try {
        // Validate request
        const validation = validateScrapeRequest(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                status: STATUS_SCRAPE_ERROR,
                message: validation.error
            });
        }
        
        const { reg_number, password } = req.body;
        
        // Log request (without password)
        console.log(`Scrape request received for: ${reg_number}`);
        
        // Create scraper and run
        const scraper = createScraper();
        const result = await scraper.scrape(reg_number, password);
        
        // Return appropriate response
        const status = result.status || STATUS_SCRAPE_ERROR;
        
        if (status === STATUS_SUCCESS) {
            return res.status(200).json(result);
        } else if (status === STATUS_AUTH_FAILED) {
            return res.status(401).json({
                status: STATUS_AUTH_FAILED,
                message: result.message || 'Invalid credentials'
            });
        } else if (status === STATUS_PORTAL_UNREACHABLE) {
            return res.status(503).json({
                status: STATUS_PORTAL_UNREACHABLE,
                message: result.message || 'Student portal is currently unreachable'
            });
        } else {
            return res.status(500).json({
                status: STATUS_SCRAPE_ERROR,
                message: result.message || 'Failed to scrape portal data'
            });
        }
        
    } catch (error) {
        console.error('Scrape endpoint error:', error.message);
        return res.status(500).json({
            status: STATUS_SCRAPE_ERROR,
            message: 'Internal server error'
        });
    }
});

/**
 * Test CAPTCHA solving endpoint
 */
app.post('/api/test-captcha', async (req, res) => {
    try {
        const { CaptchaSolver } = require('./portal-scraper.service');
        const solver = new CaptchaSolver();
        
        const response = {
            status: 'ok',
            api_key_configured: !!solver.apiKey,
            api_key_length: solver.apiKey ? solver.apiKey.length : 0
        };
        
        // If image URL provided, test it
        if (req.body.image_url) {
            try {
                const axios = require('axios');
                const imageResponse = await axios.get(req.body.image_url, {
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                const imageBuffer = Buffer.from(imageResponse.data);
                const captchaText = await solver.solve(imageBuffer);
                response.captcha_text = captchaText;
            } catch (error) {
                response.error = error.message;
            }
        }
        
        return res.json(response);
        
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * Error handlers
 */
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: STATUS_SCRAPE_ERROR,
        message: 'Internal server error'
    });
});

/**
 * Start server
 */
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Portal Scraper Service running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
    });
}

module.exports = app;
