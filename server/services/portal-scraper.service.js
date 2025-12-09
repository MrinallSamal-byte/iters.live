/**
 * Portal Scraper Service - Node.js/Puppeteer Implementation
 * Replaces Python/Selenium scraper with native Node.js solution
 * 
 * Features:
 * - Uses Puppeteer for browser automation
 * - Implements CAPTCHA solving using OCR (Tesseract.js + Google Vision API)
 * - Scrapes student data from SOA Portal
 * - Falls back to dummy data on failure
 */

const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const axios = require('axios');

// Portal configuration
const PORTAL_URL = process.env.PORTAL_URL || 'https://soaportals.com/StudentPortalSOA/#/';
// Google Vision API key - MUST be set via environment variable for security
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || '';

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';

/**
 * CAPTCHA Solver using Google Vision API and Tesseract.js
 */
class CaptchaSolver {
    constructor() {
        this.apiKey = GOOGLE_VISION_API_KEY;
        this.visionApiEndpoint = 'https://vision.googleapis.com/v1/images:annotate';
    }

    /**
     * Clean CAPTCHA text
     */
    cleanCaptchaText(text) {
        if (!text) return '';
        // Remove whitespace and special characters
        let cleaned = text.replace(/\s+/g, '');
        // Keep only alphanumeric
        cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '');
        // Limit to 6 characters (typical CAPTCHA length)
        if (cleaned.length > 6) {
            cleaned = cleaned.substring(0, 6);
        }
        return cleaned.toUpperCase();
    }

    /**
     * Solve CAPTCHA using Google Vision API
     */
    async solveWithGoogleVision(imageBase64) {
        if (!this.apiKey) {
            console.warn('Google Vision API key not configured');
            return null;
        }

        try {
            const requestBody = {
                requests: [{
                    image: { content: imageBase64 },
                    features: [{ type: 'TEXT_DETECTION' }]
                }]
            };

            const response = await axios.post(
                `${this.visionApiEndpoint}?key=${this.apiKey}`,
                requestBody,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );

            if (response.data?.responses?.[0]?.textAnnotations?.length > 0) {
                const text = response.data.responses[0].textAnnotations[0].description;
                const cleaned = this.cleanCaptchaText(text);
                console.log(`Google Vision OCR: ${cleaned}`);
                return cleaned;
            }
        } catch (error) {
            console.error('Google Vision API error:', error.message);
        }
        return null;
    }

    /**
     * Solve CAPTCHA using Tesseract.js (fallback)
     */
    async solveWithTesseract(imageBuffer) {
        try {
            // Try multiple preprocessing strategies for better accuracy
            const strategies = [
                // Strategy 1: Basic grayscale + threshold
                async () => {
                    return await sharp(imageBuffer)
                        .grayscale()
                        .normalize()
                        .threshold(128)
                        .toBuffer();
                },
                // Strategy 2: Enhanced contrast
                async () => {
                    return await sharp(imageBuffer)
                        .grayscale()
                        .normalize()
                        .linear(1.5, -(128 * 1.5) + 128) // Increase contrast
                        .toBuffer();
                },
                // Strategy 3: Sharpen and threshold
                async () => {
                    return await sharp(imageBuffer)
                        .grayscale()
                        .sharpen()
                        .normalize()
                        .threshold(140)
                        .toBuffer();
                },
                // Strategy 4: Median filter + threshold (reduce noise)
                async () => {
                    return await sharp(imageBuffer)
                        .grayscale()
                        .median(3)
                        .normalize()
                        .threshold(120)
                        .toBuffer();
                }
            ];

            // Try each strategy until we get a good result
            for (let i = 0; i < strategies.length; i++) {
                try {
                    const processedBuffer = await strategies[i]();
                    
                    const { data: { text } } = await Tesseract.recognize(
                        processedBuffer,
                        'eng',
                        {
                            logger: () => {}, // Suppress logs
                            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', // Only alphanumeric
                            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE
                        }
                    );

                    const cleaned = this.cleanCaptchaText(text);
                    if (cleaned && cleaned.length >= 4) {
                        console.log(`Tesseract OCR (strategy ${i + 1}): ${cleaned}`);
                        return cleaned;
                    }
                } catch (err) {
                    console.warn(`Strategy ${i + 1} failed:`, err.message);
                    continue;
                }
            }

            console.log('All Tesseract strategies failed');
            return null;
        } catch (error) {
            console.error('Tesseract OCR error:', error.message);
            return null;
        }
    }

    /**
     * Preprocess image for better OCR accuracy
     */
    async preprocessImage(imageBuffer) {
        try {
            // Apply multiple preprocessing techniques
            return await sharp(imageBuffer)
                .resize(200, 100, { // Upscale for better recognition
                    kernel: sharp.kernel.mitchell,
                    fit: 'fill'
                })
                .grayscale()
                .normalize() // Auto-adjust contrast
                .sharpen() // Sharpen edges
                .threshold(128) // Binary threshold
                .toBuffer();
        } catch (error) {
            console.error('Image preprocessing error:', error.message);
            return imageBuffer; // Return original if preprocessing fails
        }
    }

    /**
     * Solve CAPTCHA with multiple methods
     */
    async solve(imageBuffer) {
        try {
            // Preprocess image first
            const preprocessedBuffer = await this.preprocessImage(imageBuffer);
            
            // Convert to base64
            const imageBase64 = preprocessedBuffer.toString('base64');

            // Try Google Vision first (most accurate)
            let captchaText = await this.solveWithGoogleVision(imageBase64);
            
            // Fallback to Tesseract with original image if Google Vision fails
            if (!captchaText || captchaText.length < 4) {
                console.log('Google Vision failed, trying Tesseract with preprocessed image');
                captchaText = await this.solveWithTesseract(preprocessedBuffer);
            }
            
            // Final fallback: Try Tesseract with original unprocessed image
            if (!captchaText || captchaText.length < 4) {
                console.log('Trying Tesseract with original image');
                captchaText = await this.solveWithTesseract(imageBuffer);
            }

            return captchaText && captchaText.length >= 4 ? captchaText : null;
        } catch (error) {
            console.error('CAPTCHA solving error:', error.message);
            return null;
        }
    }
}

/**
 * Portal Scraper using Puppeteer
 */
class PortalScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.captchaSolver = new CaptchaSolver();
        this.maxCaptchaRetries = 3;
        this.bearerToken = null;
        this.networkRequests = [];
    }

    /**
     * Launch browser
     */
    async launchBrowser() {
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            });
            this.page = await this.browser.newPage();
            
            // Set viewport
            await this.page.setViewport({ width: 1366, height: 768 });
            
            // Set user agent to avoid detection (configurable via env)
            const userAgent = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            await this.page.setUserAgent(userAgent);
            
            // Enable request interception to capture network traffic
            await this.page.setRequestInterception(true);
            
            // Listen to network requests to capture Authorization headers
            this.page.on('request', request => {
                const headers = request.headers();
                const url = request.url();
                
                // Capture requests with Authorization header
                if (headers['authorization']) {
                    const authHeader = headers['authorization'];
                    if (authHeader.startsWith('Bearer') && authHeader.length > 20) {
                        console.log('Bearer token found in request');
                        this.bearerToken = authHeader;
                    }
                }
                
                // Store request info for debugging
                this.networkRequests.push({
                    url,
                    method: request.method(),
                    headers: headers,
                    timestamp: Date.now()
                });
                
                // Continue the request
                request.continue();
            });
            
            // Also listen to responses to capture tokens from response headers
            this.page.on('response', async response => {
                const headers = response.headers();
                
                // Check for Authorization in response headers
                if (headers['authorization']) {
                    const authHeader = headers['authorization'];
                    if (authHeader.startsWith('Bearer') && authHeader.length > 20) {
                        console.log('Bearer token found in response');
                        this.bearerToken = authHeader;
                    }
                }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to launch browser:', error.message);
            return false;
        }
    }

    /**
     * Human-like delay
     */
    async randomDelay(min = 500, max = 1500) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Human-like typing
     */
    async humanType(element, text) {
        await element.click();
        await this.randomDelay(100, 300);
        for (const char of text) {
            await element.type(char, { delay: Math.random() * 100 + 30 });
        }
        await this.randomDelay(200, 400);
    }

    /**
     * Check if portal is reachable
     */
    async isPortalReachable() {
        try {
            const response = await axios.head(PORTAL_URL, {
                timeout: 10000,
                validateStatus: status => status < 500
            });
            return response.status < 500;
        } catch (error) {
            console.error('Portal unreachable:', error.message);
            return false;
        }
    }

    /**
     * Find element with multiple selectors
     */
    async findElement(selectors, timeout = 10000) {
        for (const selector of selectors) {
            try {
                await this.page.waitForSelector(selector, { timeout: 2000, visible: true });
                const element = await this.page.$(selector);
                if (element) return element;
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    /**
     * Solve CAPTCHA with retries
     */
    async solveCaptcha() {
        for (let attempt = 1; attempt <= this.maxCaptchaRetries; attempt++) {
            console.log(`CAPTCHA attempt ${attempt}/${this.maxCaptchaRetries}`);

            try {
                // Find CAPTCHA image
                const captchaSelectors = [
                    'img[src*="base64"]',
                    'img[src*="captcha"]',
                    'img[src*="Captcha"]',
                    'img[alt*="captcha"]',
                    'img[alt*="Captcha"]',
                    '#captchaImage',
                    '.captcha-image'
                ];

                const captchaImg = await this.findElement(captchaSelectors);
                if (!captchaImg) {
                    console.log('CAPTCHA image not found');
                    return null;
                }

                // Get CAPTCHA image as screenshot
                const imageBuffer = await captchaImg.screenshot();

                // Solve CAPTCHA
                const captchaText = await this.captchaSolver.solve(imageBuffer);

                if (captchaText && captchaText.length >= 4) {
                    console.log(`CAPTCHA solved: ${captchaText}`);
                    return captchaText;
                }

                console.log(`CAPTCHA attempt ${attempt} failed`);
                
                // Try to refresh CAPTCHA if available
                if (attempt < this.maxCaptchaRetries) {
                    const refreshSelectors = [
                        'button[onclick*="captcha"]',
                        '.captcha-refresh',
                        '[class*="refresh"]'
                    ];
                    const refreshBtn = await this.findElement(refreshSelectors, 2000);
                    if (refreshBtn) {
                        await refreshBtn.click();
                        await this.randomDelay(1000, 2000);
                    }
                }
            } catch (error) {
                console.error(`CAPTCHA attempt ${attempt} error:`, error.message);
            }
        }

        return null;
    }

    /**
     * Attempt login
     */
    async attemptLogin(regNumber, password) {
        try {
            // Check portal reachability first
            const reachable = await this.isPortalReachable();
            if (!reachable) {
                return { success: false, error: 'Portal is currently unreachable', type: STATUS_PORTAL_UNREACHABLE };
            }

            // Launch browser
            const launched = await this.launchBrowser();
            if (!launched) {
                return { success: false, error: 'Failed to launch browser', type: STATUS_SCRAPE_ERROR };
            }

            // Navigate to portal
            console.log(`Navigating to ${PORTAL_URL}`);
            await this.page.goto(PORTAL_URL, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            await this.randomDelay(2000, 3000);

            // Wait for Angular to load
            await this.page.waitForTimeout(2000);

            // Find USER ID field
            const userIdSelectors = [
                'input[formcontrolname="userid"]',
                'input[formcontrolname="userId"]',
                'input[name="userid"]',
                'input[name="userId"]',
                '#userId',
                '#username',
                'input[placeholder*="User"]',
                'input[placeholder*="ID"]'
            ];

            const userIdField = await this.findElement(userIdSelectors);
            if (!userIdField) {
                return { success: false, error: 'USER ID field not found', type: STATUS_SCRAPE_ERROR };
            }

            // Fill USER ID
            await this.humanType(userIdField, regNumber);
            await this.randomDelay(500, 1000);

            // Check for CAPTCHA
            const captchaText = await this.solveCaptcha();
            if (captchaText) {
                console.log(`Entering CAPTCHA: ${captchaText}`);
                // Find CAPTCHA input - matching Python selectors
                const captchaInputSelectors = [
                    'input[formcontrolname="captcha"]',
                    'input[name="captcha"]',
                    '#captcha',
                    '#captchaText',
                    '#txtCaptcha',
                    'input[placeholder*="Captcha"]',
                    'input[placeholder*="captcha"]',
                    'input[placeholder*="Enter"]'
                ];

                const captchaInput = await this.findElement(captchaInputSelectors);
                if (captchaInput) {
                    await this.humanType(captchaInput, captchaText);
                    await this.randomDelay(500, 1000);
                } else {
                    console.warn('CAPTCHA input field not found, but CAPTCHA was solved');
                }
            } else {
                console.warn('CAPTCHA not solved or not found');
            }

            // Click submit/next button
            const submitSelectors = [
                'button[type="submit"]',
                '.btn-submit',
                '.login-btn'
            ];

            let submitBtn = await this.findElement(submitSelectors);
            
            // If not found by class/type, try finding by text using XPath
            if (!submitBtn) {
                const xpathSelectors = [
                    '//button[contains(text(), "LOGIN")]',
                    '//button[contains(text(), "SUBMIT")]',
                    '//button[contains(text(), "Next")]'
                ];
                
                for (const xpath of xpathSelectors) {
                    try {
                        const elements = await this.page.$x(xpath);
                        if (elements.length > 0) {
                            submitBtn = elements[0];
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            if (submitBtn) {
                await submitBtn.click();
                await this.randomDelay(3000, 5000);
            }

            // Check for password field (two-step login)
            const passwordSelectors = [
                'input[formcontrolname="password"]',
                'input[name="password"]',
                'input[type="password"]',
                '#password'
            ];

            const passwordField = await this.findElement(passwordSelectors, 5000);
            if (passwordField) {
                await this.humanType(passwordField, password);
                await this.randomDelay(500, 1000);

                // Click final login button
                let loginBtn = await this.findElement([
                    'button[type="submit"]',
                    '.btn-login'
                ]);
                
                // Try finding by text using XPath if not found
                if (!loginBtn) {
                    try {
                        const elements = await this.page.$x('//button[contains(text(), "LOGIN")]');
                        if (elements.length > 0) {
                            loginBtn = elements[0];
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
                
                if (loginBtn) {
                    await loginBtn.click();
                    await this.randomDelay(3000, 5000);
                }
            }

            // Check login success
            const currentUrl = this.page.url();
            
            // Check for error messages
            const errorSelectors = [
                '.error-message',
                '.alert-danger',
                '.login-error',
                '[class*="error"]'
            ];

            for (const selector of errorSelectors) {
                try {
                    const errorEl = await this.page.$(selector);
                    if (errorEl) {
                        const errorText = await this.page.evaluate(el => el.textContent, errorEl);
                        if (errorText && errorText.toLowerCase().includes('invalid')) {
                            return { success: false, error: 'Invalid credentials', type: STATUS_AUTH_FAILED };
                        }
                    }
                } catch (e) {
                    // Ignore
                }
            }

            // Check for success indicators
            const successSelectors = [
                '.dashboard',
                '.student-dashboard',
                '.profile',
                '[class*="dashboard"]'
            ];

            for (const selector of successSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log('Login successful');
                        return { success: true };
                    }
                } catch (e) {
                    // Ignore
                }
            }

            // Check URL for success
            if (currentUrl.toLowerCase().includes('dashboard') || 
                currentUrl.toLowerCase().includes('home') ||
                currentUrl.toLowerCase().includes('profile')) {
                console.log('Login successful (URL check)');
                return { success: true };
            }

            // If still on login page, assume failure
            if (currentUrl.toLowerCase().includes('login') || currentUrl === PORTAL_URL) {
                return { success: false, error: 'Login failed', type: STATUS_AUTH_FAILED };
            }

            return { success: true };

        } catch (error) {
            console.error('Login attempt error:', error.message);
            return { success: false, error: error.message, type: STATUS_SCRAPE_ERROR };
        }
    }

    /**
     * Scrape student data
     */
    async scrapeData() {
        const data = {
            profile: {},
            marks: [],
            attendance: [],
            timetable: [],
            courses: [],
            results: [],
            notifications: [],
            backlogs: [],
            internal_assessments: [],
            fees: {}
        };

        try {
            // Scrape profile (basic implementation - can be enhanced)
            // This is a placeholder - actual selectors depend on portal structure
            console.log('Scraping student data...');
            await this.randomDelay(1000, 2000);

            // Try to extract any visible student data
            try {
                const pageData = await this.page.evaluate(() => {
                    const result = { 
                        profile: {}, 
                        tables: [],
                        marks: [],
                        attendance: []
                    };
                    
                    // Extract text content from common profile elements
                    const selectors = {
                        name: ['.student-name', '#studentName', '[class*="name"]', '[data-field="name"]'],
                        registration_number: ['.reg-no', '#regNo', '[class*="reg"]', '#registrationNumber'],
                        email: ['#email', '.email', 'a[href^="mailto:"]'],
                        department: ['#department', '.department', '#branch', '.branch'],
                        year: ['#year', '.year'],
                        section: ['#section', '.section'],
                        semester: ['#semester', '.semester'],
                        phone: ['#phone', '.phone', '#mobile', '.mobile']
                    };
                    
                    // Try to find and extract profile fields
                    Object.keys(selectors).forEach(field => {
                        for (const selector of selectors[field]) {
                            const el = document.querySelector(selector);
                            if (el && el.textContent.trim()) {
                                result.profile[field] = el.textContent.trim();
                                break;
                            }
                        }
                    });
                    
                    // Extract tables - try to identify which table is which
                    const tables = document.querySelectorAll('table');
                    tables.forEach((table, index) => {
                        const tableData = {
                            index,
                            headers: [],
                            rows: []
                        };
                        
                        // Extract headers
                        const headerRow = table.querySelector('thead tr, tr:first-child');
                        if (headerRow) {
                            tableData.headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
                                cell.textContent.trim().toLowerCase()
                            );
                        }
                        
                        // Extract rows
                        const bodyRows = table.querySelectorAll('tbody tr, tr');
                        tableData.rows = Array.from(bodyRows).slice(headerRow ? 1 : 0).map(row => {
                            return Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
                        });
                        
                        if (tableData.rows.length > 0) {
                            result.tables.push(tableData);
                            
                            // Try to identify table type by headers
                            const headerText = tableData.headers.join(' ');
                            if (headerText.includes('mark') || headerText.includes('grade') || headerText.includes('score')) {
                                // This is likely a marks table
                                tableData.rows.forEach(row => {
                                    if (row.length >= 2 && row[0]) {
                                        result.marks.push({
                                            subject: row[0],
                                            marks: row[1] || '',
                                            grade: row[2] || ''
                                        });
                                    }
                                });
                            } else if (headerText.includes('attendance') || headerText.includes('present') || headerText.includes('absent')) {
                                // This is likely an attendance table
                                tableData.rows.forEach(row => {
                                    if (row.length >= 2 && row[0]) {
                                        result.attendance.push({
                                            subject: row[0],
                                            attended: row[1] || '',
                                            total: row[2] || '',
                                            percentage: row[3] || ''
                                        });
                                    }
                                });
                            }
                        }
                    });
                    
                    return result;
                });

                if (pageData.profile && Object.keys(pageData.profile).length > 0) {
                    data.profile = { ...data.profile, ...pageData.profile };
                }
                
                if (pageData.marks && pageData.marks.length > 0) {
                    data.marks = pageData.marks;
                }
                
                if (pageData.attendance && pageData.attendance.length > 0) {
                    data.attendance = pageData.attendance;
                }
                
                console.log(`Extracted ${pageData.tables.length} tables from page`);
            } catch (error) {
                console.error('Data extraction error:', error.message);
            }

        } catch (error) {
            console.error('Scraping error:', error.message);
        }

        return data;
    }

    /**
     * Main scrape method
     */
    async scrape(regNumber, password) {
        console.log(`Starting scrape for: ${regNumber}`);

        try {
            // Attempt login
            const loginResult = await this.attemptLogin(regNumber, password);

            if (!loginResult.success) {
                return {
                    status: loginResult.type || STATUS_SCRAPE_ERROR,
                    message: loginResult.error || 'Login failed'
                };
            }

            // Wait a bit more to ensure all network requests complete
            await this.randomDelay(2000, 3000);

            // Scrape data
            const scrapedData = await this.scrapeData();

            // Add bearer token to the response if found
            if (this.bearerToken) {
                scrapedData.bearer_token = this.bearerToken;
                console.log('Bearer token extracted and included in response');
            } else {
                console.warn('No bearer token found in network requests');
            }

            // Add raw API data if available
            scrapedData.raw_api_data = {
                bearer_token: this.bearerToken,
                network_requests_count: this.networkRequests.length
            };

            return {
                status: STATUS_SUCCESS,
                data: scrapedData,
                message: 'Successfully scraped portal data'
            };

        } catch (error) {
            console.error('Scrape error:', error.message);
            return {
                status: STATUS_SCRAPE_ERROR,
                message: error.message
            };
        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }
}

/**
 * Factory function to create scraper
 */
function createScraper() {
    return new PortalScraper();
}

module.exports = {
    createScraper,
    PortalScraper,
    CaptchaSolver,
    STATUS_SUCCESS,
    STATUS_AUTH_FAILED,
    STATUS_SCRAPE_ERROR,
    STATUS_PORTAL_UNREACHABLE
};
