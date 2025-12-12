/**
 * Portal Scraper Service - Axios/HTTP Implementation
 * 
 * Features:
 * - HTTP-based scraping using axios
 * - CAPTCHA solving using Tesseract.js OCR
 * - Session cookie management with tough-cookie
 * - Comprehensive data extraction from SOA portal API
 * 
 * This implementation uses direct HTTP requests instead of Puppeteer
 * for better performance and lower memory usage.
 */

const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';

// Portal configuration
const PORTAL_BASE_URL = process.env.PORTAL_URL || 'https://soaportals.com';
const API_BASE_URL = `${PORTAL_BASE_URL}/api`;
const TIMEOUT = 30000; // 30 seconds
const CAPTCHA_MAX_ATTEMPTS = 3;

/**
 * CAPTCHA Solver using Tesseract.js
 */
class CaptchaSolver {
    constructor() {
        this.worker = null;
    }

    /**
     * Initialize Tesseract worker
     */
    async initialize() {
        if (!this.worker) {
            try {
                this.worker = await Tesseract.createWorker({
                    logger: m => console.log('[Tesseract]', m.status, m.progress)
                });
                await this.worker.loadLanguage('eng');
                await this.worker.initialize('eng');
                await this.worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                });
                console.log('[CAPTCHA] Tesseract initialized successfully');
            } catch (error) {
                console.error('[CAPTCHA] Failed to initialize Tesseract:', error);
                this.worker = null;
            }
        }
    }

    /**
     * Preprocess CAPTCHA image for better OCR accuracy
     */
    async preprocessImage(imageBuffer) {
        try {
            return await sharp(imageBuffer)
                .greyscale()
                .normalize()
                .threshold(128)
                .sharpen()
                .toBuffer();
        } catch (error) {
            console.error('[CAPTCHA] Image preprocessing error:', error);
            return imageBuffer;
        }
    }

    /**
     * Solve CAPTCHA from image buffer
     */
    async solve(imageBuffer) {
        try {
            if (!this.worker) {
                await this.initialize();
            }
            
            if (!this.worker) {
                console.error('[CAPTCHA] Worker not available');
                return null;
            }
            
            // Preprocess image
            const processedImage = await this.preprocessImage(imageBuffer);
            
            // Perform OCR
            const { data: { text } } = await this.worker.recognize(processedImage);
            
            // Clean up the text
            const captchaText = text.replace(/[^a-zA-Z0-9]/g, '').trim();
            
            console.log('[CAPTCHA] Detected text:', captchaText);
            return captchaText;
        } catch (error) {
            console.error('[CAPTCHA] Solving error:', error);
            return null;
        }
    }

    /**
     * Cleanup worker
     */
    async cleanup() {
        if (this.worker) {
            try {
                await this.worker.terminate();
            } catch (e) {
                // Ignore cleanup errors
            }
            this.worker = null;
        }
    }
}

/**
 * Portal Scraper using Axios
 */
class PortalScraper {
    constructor() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            validateStatus: () => true // Don't throw on any status
        }));
        this.captchaSolver = new CaptchaSolver();
        this.sessionToken = null;
    }

    /**
     * Check if portal is reachable
     */
    async checkPortalReachability() {
        try {
            const response = await this.client.get(PORTAL_BASE_URL, { timeout: 10000 });
            return response.status === 200 || response.status === 302;
        } catch (error) {
            console.error('[Portal] Reachability check failed:', error.message);
            return false;
        }
    }

    /**
     * Get CAPTCHA image
     */
    async getCaptchaImage() {
        try {
            const response = await this.client.get(`${API_BASE_URL}/captcha`, {
                responseType: 'arraybuffer'
            });
            
            if (response.status === 200 && response.data) {
                return Buffer.from(response.data);
            }
            return null;
        } catch (error) {
            console.error('[CAPTCHA] Failed to get captcha image:', error.message);
            return null;
        }
    }

    /**
     * Solve CAPTCHA
     */
    async solveCaptcha() {
        for (let attempt = 1; attempt <= CAPTCHA_MAX_ATTEMPTS; attempt++) {
            try {
                console.log(`[CAPTCHA] Solving attempt ${attempt}/${CAPTCHA_MAX_ATTEMPTS}`);
                
                const imageBuffer = await this.getCaptchaImage();
                if (!imageBuffer) {
                    console.warn('[CAPTCHA] No image received');
                    continue;
                }
                
                const captchaText = await this.captchaSolver.solve(imageBuffer);
                
                if (captchaText && captchaText.length >= 4) {
                    console.log(`[CAPTCHA] Solved: ${captchaText}`);
                    return captchaText;
                }
            } catch (error) {
                console.error(`[CAPTCHA] Attempt ${attempt} failed:`, error.message);
            }
        }
        
        return null;
    }

    /**
     * Login to the portal
     */
    async login(regNo, password) {
        try {
            console.log('[Login] Starting login process for:', regNo);
            
            // Solve CAPTCHA
            const captchaText = await this.solveCaptcha();
            if (!captchaText) {
                console.warn('[Login] Could not solve CAPTCHA, attempting login without it');
            }
            
            // Prepare login payload
            const loginData = {
                username: regNo,
                password: password,
                captcha: captchaText || '',
                rememberMe: false
            };
            
            // Attempt login
            const response = await this.client.post(`${API_BASE_URL}/login`, loginData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': PORTAL_BASE_URL,
                    'Referer': `${PORTAL_BASE_URL}/login`
                }
            });
            
            console.log('[Login] Response status:', response.status);
            
            // Check for successful login
            if (response.status === 200 && response.data) {
                if (response.data.token || response.data.success) {
                    this.sessionToken = response.data.token;
                    console.log('[Login] Login successful');
                    return { success: true, status: STATUS_SUCCESS };
                }
                
                if (response.data.error || response.data.message) {
                    const errorMsg = response.data.error || response.data.message;
                    if (errorMsg.toLowerCase().includes('invalid') || 
                        errorMsg.toLowerCase().includes('incorrect') ||
                        errorMsg.toLowerCase().includes('wrong')) {
                        return { success: false, status: STATUS_AUTH_FAILED, message: 'Invalid credentials' };
                    }
                    if (errorMsg.toLowerCase().includes('captcha')) {
                        return { success: false, status: STATUS_SCRAPE_ERROR, message: 'CAPTCHA verification failed' };
                    }
                }
            }
            
            if (response.status === 401 || response.status === 403) {
                return { success: false, status: STATUS_AUTH_FAILED, message: 'Invalid credentials' };
            }
            
            return { success: false, status: STATUS_SCRAPE_ERROR, message: 'Login failed - unexpected response' };
        } catch (error) {
            console.error('[Login] Error:', error.message);
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                return { success: false, status: STATUS_PORTAL_UNREACHABLE, message: 'Portal is unreachable' };
            }
            
            return { success: false, status: STATUS_SCRAPE_ERROR, message: error.message };
        }
    }

    /**
     * Fetch data from portal API
     */
    async fetchData(endpoint) {
        try {
            const headers = {
                'Authorization': this.sessionToken ? `Bearer ${this.sessionToken}` : undefined
            };
            
            const response = await this.client.get(`${API_BASE_URL}${endpoint}`, { headers });
            
            if (response.status === 200 && response.data) {
                return response.data;
            }
            
            return null;
        } catch (error) {
            console.error(`[Fetch] Error fetching ${endpoint}:`, error.message);
            return null;
        }
    }

    /**
     * Scrape all data from portal
     */
    async scrape(regNo, password) {
        try {
            console.log('[Scraper] Starting scrape for:', regNo);
            
            // Check portal reachability
            const isReachable = await this.checkPortalReachability();
            if (!isReachable) {
                return {
                    status: STATUS_PORTAL_UNREACHABLE,
                    message: 'Student portal is currently unreachable. The portal may be down for maintenance.'
                };
            }
            
            // Login
            const loginResult = await this.login(regNo, password);
            if (!loginResult.success) {
                return loginResult;
            }
            
            // Fetch all data in parallel
            console.log('[Scraper] Fetching portal data...');
            const [profile, attendance, marks, backlogs, internal] = await Promise.all([
                this.fetchData('/StudentProfile/Get'),
                this.fetchData('/StudentAttendance/Get'),
                this.fetchData('/StudentMarks/Get'),
                this.fetchData('/StudentBacklogs/Get'),
                this.fetchData('/StudentSubjects/GetInternalMarks')
            ]);
            
            return {
                status: STATUS_SUCCESS,
                message: 'Data fetched successfully from SOA portal',
                data: {
                    profile: profile || {},
                    attendance: attendance || [],
                    marks: marks || [],
                    backlogs: backlogs || [],
                    internal_assessments: internal || [],
                    timetable: [],
                    courses: [],
                    results: [],
                    notifications: [],
                    fees: {}
                }
            };
        } catch (error) {
            console.error('[Scraper] Error:', error);
            return {
                status: STATUS_SCRAPE_ERROR,
                message: `Scraping failed: ${error.message}`
            };
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.captchaSolver.cleanup();
        } catch (error) {
            console.error('[Cleanup] Error:', error);
        }
    }
}

/**
 * Create a new scraper instance
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
