/**
 * Portal Scraper Service - Node.js/Puppeteer Implementation
 * 
 * Features:
 * - Puppeteer-based web scraping
 * - CAPTCHA solving using Tesseract.js OCR
 * - Session cookie management
 * - Comprehensive data extraction from SOA portal
 */

const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';

// Portal configuration
const PORTAL_URL = process.env.PORTAL_URL || 'https://soaportals.com/StudentPortalSOA/#/';
const LOGIN_TIMEOUT = 60000; // 60 seconds
const PAGE_TIMEOUT = 30000; // 30 seconds
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
            this.worker = await Tesseract.createWorker({
                logger: m => console.log('[Tesseract]', m)
            });
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            });
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
                .toBuffer();
        } catch (error) {
            console.error('Image preprocessing error:', error);
            return imageBuffer;
        }
    }

    /**
     * Solve CAPTCHA from image buffer
     */
    async solve(imageBuffer) {
        try {
            await this.initialize();
            
            // Preprocess image
            const processedImage = await this.preprocessImage(imageBuffer);
            
            // Perform OCR
            const { data: { text } } = await this.worker.recognize(processedImage);
            
            // Clean up the text
            const captchaText = text.replace(/[^a-zA-Z0-9]/g, '').trim();
            
            console.log('[CAPTCHA] Detected text:', captchaText);
            return captchaText;
        } catch (error) {
            console.error('CAPTCHA solving error:', error);
            return null;
        }
    }

    /**
     * Cleanup worker
     */
    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
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
        this.sessionCookies = null;
    }

    /**
     * Initialize browser
     */
    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });
        }
    }

    /**
     * Check if portal is reachable
     */
    async checkPortalReachability() {
        try {
            await this.initBrowser();
            this.page = await this.browser.newPage();
            
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            const response = await this.page.goto(PORTAL_URL, {
                waitUntil: 'networkidle2',
                timeout: PAGE_TIMEOUT
            });
            
            return response && response.ok();
        } catch (error) {
            console.error('Portal reachability check failed:', error);
            return false;
        }
    }

    /**
     * Solve CAPTCHA on the login page
     */
    async solveCaptcha() {
        for (let attempt = 1; attempt <= CAPTCHA_MAX_ATTEMPTS; attempt++) {
            try {
                console.log(`[CAPTCHA] Solving attempt ${attempt}/${CAPTCHA_MAX_ATTEMPTS}`);
                
                // Wait for CAPTCHA image to load
                await this.page.waitForSelector('img[id*="captcha"], img[alt*="captcha"], img.captcha', { timeout: 5000 });
                
                // Find CAPTCHA image
                const captchaElement = await this.page.$('img[id*="captcha"], img[alt*="captcha"], img.captcha');
                if (!captchaElement) {
                    console.warn('[CAPTCHA] CAPTCHA image not found');
                    continue;
                }
                
                // Get CAPTCHA image as buffer
                const imageBuffer = await captchaElement.screenshot();
                
                // Solve CAPTCHA
                const captchaText = await this.captchaSolver.solve(imageBuffer);
                
                if (captchaText && captchaText.length >= 4) {
                    console.log(`[CAPTCHA] Solved: ${captchaText}`);
                    return captchaText;
                }
                
                // Refresh CAPTCHA if available
                const refreshButton = await this.page.$('button[id*="refresh"], a[id*="refresh"], .captcha-refresh');
                if (refreshButton) {
                    await refreshButton.click();
                    await this.page.waitForTimeout(1000);
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
            console.log('[Login] Starting login process...');
            
            // Navigate to portal
            await this.page.goto(PORTAL_URL, {
                waitUntil: 'networkidle2',
                timeout: PAGE_TIMEOUT
            });
            
            // Wait for login form
            await this.page.waitForSelector('input[name="username"], input[id*="user"], input[type="text"]', { timeout: 10000 });
            
            // Fill in registration number
            await this.page.type('input[name="username"], input[id*="user"], input[type="text"]', regNo, { delay: 100 });
            
            // Fill in password
            await this.page.type('input[name="password"], input[id*="pass"], input[type="password"]', password, { delay: 100 });
            
            // Solve CAPTCHA
            const captchaText = await this.solveCaptcha();
            if (!captchaText) {
                throw new Error('Failed to solve CAPTCHA after multiple attempts');
            }
            
            // Enter CAPTCHA
            await this.page.type('input[name="captcha"], input[id*="captcha"], input.captcha-input', captchaText, { delay: 100 });
            
            // Click login button
            await this.page.click('button[type="submit"], input[type="submit"], .login-btn');
            
            // Wait for navigation or error
            await Promise.race([
                this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
                this.page.waitForSelector('.dashboard, .home, #dashboard', { timeout: LOGIN_TIMEOUT })
            ]);
            
            // Check for login errors
            const errorElement = await this.page.$('.error-message, .alert-danger, .login-error');
            if (errorElement) {
                const errorText = await this.page.evaluate(el => el.textContent, errorElement);
                console.error('[Login] Error:', errorText);
                
                if (errorText.toLowerCase().includes('invalid') || errorText.toLowerCase().includes('incorrect')) {
                    return { success: false, status: STATUS_AUTH_FAILED, message: 'Invalid credentials' };
                }
            }
            
            // Store session cookies
            this.sessionCookies = await this.page.cookies();
            console.log('[Login] Login successful, session cookies stored');
            
            return { success: true, status: STATUS_SUCCESS };
        } catch (error) {
            console.error('[Login] Login error:', error);
            return { success: false, status: STATUS_SCRAPE_ERROR, message: error.message };
        }
    }

    /**
     * Fetch profile data
     */
    async fetchProfile() {
        try {
            await this.page.goto(PORTAL_URL + 'profile', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
            
            const profile = await this.page.evaluate(() => {
                const getTextContent = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : '';
                };
                
                return {
                    name: getTextContent('.student-name, .profile-name, #studentName'),
                    email: getTextContent('.student-email, .profile-email, #studentEmail'),
                    regNo: getTextContent('.student-regno, .profile-regno, #regNo'),
                    department: getTextContent('.student-dept, .profile-dept, #department'),
                    year: getTextContent('.student-year, .profile-year, #year'),
                    section: getTextContent('.student-section, .profile-section, #section'),
                    semester: getTextContent('.student-semester, .profile-semester, #semester'),
                    phone: getTextContent('.student-phone, .profile-phone, #phone')
                };
            });
            
            return profile;
        } catch (error) {
            console.error('[Profile] Fetch error:', error);
            return null;
        }
    }

    /**
     * Fetch attendance data
     */
    async fetchAttendance() {
        try {
            await this.page.goto(PORTAL_URL + 'attendance', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
            
            const attendance = await this.page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('.attendance-table tbody tr, table tbody tr'));
                return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        return {
                            subject: cells[0]?.textContent.trim() || '',
                            attended: cells[1]?.textContent.trim() || '0',
                            total: cells[2]?.textContent.trim() || '0',
                            percentage: cells[3]?.textContent.trim() || '0%'
                        };
                    }
                    return null;
                }).filter(Boolean);
            });
            
            return attendance;
        } catch (error) {
            console.error('[Attendance] Fetch error:', error);
            return [];
        }
    }

    /**
     * Fetch marks data
     */
    async fetchMarks() {
        try {
            await this.page.goto(PORTAL_URL + 'marks', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
            
            const marks = await this.page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('.marks-table tbody tr, table tbody tr'));
                return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        return {
                            subject: cells[0]?.textContent.trim() || '',
                            marks: cells[1]?.textContent.trim() || '0',
                            grade: cells[2]?.textContent.trim() || 'N/A'
                        };
                    }
                    return null;
                }).filter(Boolean);
            });
            
            return marks;
        } catch (error) {
            console.error('[Marks] Fetch error:', error);
            return [];
        }
    }

    /**
     * Scrape all data from portal
     */
    async scrape(regNo, password) {
        try {
            console.log('[Scraper] Starting scrape for:', regNo);
            
            // Initialize browser
            await this.initBrowser();
            this.page = await this.browser.newPage();
            
            // Set viewport
            await this.page.setViewport({ width: 1366, height: 768 });
            
            // Check portal reachability
            const isReachable = await this.checkPortalReachability();
            if (!isReachable) {
                return {
                    status: STATUS_PORTAL_UNREACHABLE,
                    message: 'Student portal is currently unreachable'
                };
            }
            
            // Login
            const loginResult = await this.login(regNo, password);
            if (!loginResult.success) {
                return loginResult;
            }
            
            // Fetch all data
            const [profile, attendance, marks] = await Promise.all([
                this.fetchProfile(),
                this.fetchAttendance(),
                this.fetchMarks()
            ]);
            
            return {
                status: STATUS_SUCCESS,
                message: 'Data fetched successfully',
                data: {
                    profile: profile || {},
                    attendance: attendance || [],
                    marks: marks || [],
                    timetable: [],
                    courses: [],
                    results: [],
                    notifications: [],
                    backlogs: [],
                    internal_assessments: [],
                    fees: {}
                }
            };
        } catch (error) {
            console.error('[Scraper] Error:', error);
            return {
                status: STATUS_SCRAPE_ERROR,
                message: error.message
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
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
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
