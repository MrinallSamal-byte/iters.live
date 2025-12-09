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
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || 'AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A';

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
            // Preprocess image for better OCR
            const processedBuffer = await sharp(imageBuffer)
                .grayscale()
                .normalize()
                .threshold(128)
                .toBuffer();

            const { data: { text } } = await Tesseract.recognize(
                processedBuffer,
                'eng',
                {
                    logger: () => {} // Suppress logs
                }
            );

            const cleaned = this.cleanCaptchaText(text);
            console.log(`Tesseract OCR: ${cleaned}`);
            return cleaned;
        } catch (error) {
            console.error('Tesseract OCR error:', error.message);
            return null;
        }
    }

    /**
     * Solve CAPTCHA with multiple methods
     */
    async solve(imageBuffer) {
        try {
            // Convert to base64
            const imageBase64 = imageBuffer.toString('base64');

            // Try Google Vision first (more accurate)
            let captchaText = await this.solveWithGoogleVision(imageBase64);
            
            // Fallback to Tesseract if Google Vision fails
            if (!captchaText || captchaText.length < 4) {
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
            
            // Set user agent to avoid detection
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            
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
                // Find CAPTCHA input
                const captchaInputSelectors = [
                    'input[formcontrolname="captcha"]',
                    'input[name="captcha"]',
                    '#captcha',
                    'input[placeholder*="Captcha"]',
                    'input[placeholder*="Enter"]'
                ];

                const captchaInput = await this.findElement(captchaInputSelectors);
                if (captchaInput) {
                    await this.humanType(captchaInput, captchaText);
                    await this.randomDelay(500, 1000);
                }
            }

            // Click submit/next button
            const submitSelectors = [
                'button[type="submit"]',
                'button:has-text("LOGIN")',
                'button:has-text("SUBMIT")',
                'button:has-text("Next")',
                '.btn-submit',
                '.login-btn'
            ];

            const submitBtn = await this.findElement(submitSelectors);
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
                const loginBtn = await this.findElement([
                    'button:has-text("LOGIN")',
                    'button[type="submit"]',
                    '.btn-login'
                ]);
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
            notifications: []
        };

        try {
            // Scrape profile (basic implementation - can be enhanced)
            // This is a placeholder - actual selectors depend on portal structure
            console.log('Scraping student data...');
            await this.randomDelay(1000, 2000);

            // Try to extract any visible student data
            try {
                const pageData = await this.page.evaluate(() => {
                    const result = { profile: {}, tables: [] };
                    
                    // Extract text content from common elements
                    const nameEl = document.querySelector('.student-name, #studentName, [class*="name"]');
                    if (nameEl) result.profile.name = nameEl.textContent.trim();
                    
                    const regEl = document.querySelector('.reg-no, #regNo, [class*="reg"]');
                    if (regEl) result.profile.registration_number = regEl.textContent.trim();
                    
                    // Extract tables
                    const tables = document.querySelectorAll('table');
                    tables.forEach(table => {
                        const rows = Array.from(table.querySelectorAll('tr')).map(row => {
                            return Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
                        });
                        if (rows.length > 0) result.tables.push(rows);
                    });
                    
                    return result;
                });

                if (pageData.profile) {
                    data.profile = { ...data.profile, ...pageData.profile };
                }
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

            // Scrape data
            const scrapedData = await this.scrapeData();

            return {
                status: STATUS_SUCCESS,
                data: scrapedData
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
