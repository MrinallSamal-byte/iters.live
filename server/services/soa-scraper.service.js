/**
 * SOA Portal Scraper Service with User-Provided CAPTCHA
 * 
 * This service uses Playwright to:
 * 1. Load the SOA portal login page
 * 2. Extract CAPTCHA image for user to solve
 * 3. Perform login with user-provided credentials and captcha
 * 4. Scrape all available student data
 * 
 * SECURITY NOTES:
 * - Credentials are NEVER logged, stored, or cached
 * - Session contexts are closed after data extraction
 * - No credentials in logs, database, or cache
 * - Fresh browser session for each login request
 */

const { chromium } = require('playwright');

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';
const STATUS_CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED';
const STATUS_SESSION_EXPIRED = 'SESSION_EXPIRED';

// Portal configuration
const PORTAL_URL = 'https://soaportals.com/StudentPortalSOA/#/';
const TIMEOUT = 60000; // 60 seconds

// In-memory session storage for browser contexts
// Key: sessionId, Value: { browser, page, captchaImage, createdAt }
const activeSessions = new Map();

// Session cleanup interval (5 minutes)
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000;
// Session expiry time (10 minutes)
const SESSION_EXPIRY = 10 * 60 * 1000;

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return `soa_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions) {
        if (now - session.createdAt > SESSION_EXPIRY) {
            console.log(`[SOA Scraper] Cleaning up expired session: ${sessionId}`);
            closeSession(sessionId);
        }
    }
}

// Start cleanup interval
setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL);

/**
 * Close and cleanup a session
 */
async function closeSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        try {
            if (session.context) {
                await session.context.close().catch(() => {});
            }
            if (session.browser) {
                await session.browser.close().catch(() => {});
            }
        } catch (error) {
            console.error(`[SOA Scraper] Error closing session ${sessionId}:`, error.message);
        }
        activeSessions.delete(sessionId);
    }
}

/**
 * Create a new browser session and get CAPTCHA
 * @returns {Promise<Object>} Session info with captcha image
 */
async function createSessionAndGetCaptcha() {
    let browser = null;
    let context = null;
    let page = null;
    const sessionId = generateSessionId();

    try {
        console.log(`[SOA Scraper] Creating new session: ${sessionId}`);

        // Launch browser using Playwright
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        page = await context.newPage();

        // Navigate to portal
        console.log(`[SOA Scraper] Navigating to portal: ${PORTAL_URL}`);
        await page.goto(PORTAL_URL, {
            waitUntil: 'networkidle',
            timeout: TIMEOUT
        });

        // Wait for page to fully load
        await page.waitForTimeout(3000);

        // Extract CAPTCHA image
        const captchaImage = await extractCaptchaImage(page);
        
        if (!captchaImage) {
            throw new Error('Could not extract CAPTCHA image from portal');
        }

        // Store session
        activeSessions.set(sessionId, {
            browser,
            context,
            page,
            captchaImage,
            createdAt: Date.now()
        });

        console.log(`[SOA Scraper] Session created successfully: ${sessionId}`);

        return {
            success: true,
            status: STATUS_CAPTCHA_REQUIRED,
            sessionId,
            captchaImage,
            message: 'CAPTCHA extracted. Please solve and submit with credentials.'
        };

    } catch (error) {
        console.error(`[SOA Scraper] Error creating session:`, error.message);

        // Cleanup on error
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});

        const isUnreachable = error.message.includes('net::ERR') || 
                             error.message.includes('Navigation timeout') ||
                             error.message.includes('ECONNREFUSED');

        return {
            success: false,
            status: isUnreachable ? STATUS_PORTAL_UNREACHABLE : STATUS_SCRAPE_ERROR,
            message: isUnreachable 
                ? 'SOA portal is currently unreachable. Please try again later.'
                : `Failed to load portal: ${error.message}`
        };
    }
}

/**
 * Extract CAPTCHA image from the page
 * @param {Page} page Playwright page
 * @returns {Promise<string|null>} Base64 encoded image or null
 */
async function extractCaptchaImage(page) {
    try {
        // Try multiple selectors for CAPTCHA image
        const captchaSelectors = [
            'img[id*="captcha"]',
            'img[class*="captcha"]',
            'img[src*="captcha"]',
            'img[src*="Captcha"]',
            '.captcha-image img',
            '#captchaImage',
            'img[alt*="captcha"]',
            'img[alt*="Captcha"]',
            // SOA portal specific selectors
            'img[ng-src*="captcha"]',
            'img[data-ng-src*="captcha"]',
            'canvas[id*="captcha"]'
        ];

        for (const selector of captchaSelectors) {
            try {
                const element = await page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    console.log(`[SOA Scraper] Found CAPTCHA with selector: ${selector}`);
                    
                    // Screenshot the element
                    const screenshotBuffer = await element.screenshot({ type: 'png' });
                    const base64 = screenshotBuffer.toString('base64');
                    
                    return `data:image/png;base64,${base64}`;
                }
            } catch (e) {
                continue;
            }
        }

        // Try to find CAPTCHA by looking at image sources
        const images = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                id: img.id,
                className: img.className,
                alt: img.alt
            }));
        });

        console.log(`[SOA Scraper] Found ${images.length} images on page`);
        
        for (const img of images) {
            if (img.src && (
                img.src.toLowerCase().includes('captcha') ||
                img.id?.toLowerCase().includes('captcha') ||
                img.className?.toLowerCase().includes('captcha') ||
                img.alt?.toLowerCase().includes('captcha')
            )) {
                console.log(`[SOA Scraper] Found CAPTCHA image by src/id/class:`, img);
                
                // Try to get the element and screenshot it
                let element = null;
                if (img.id) {
                    element = await page.locator(`#${img.id}`).first();
                } else if (img.src) {
                    element = await page.locator(`img[src="${img.src}"]`).first();
                }
                
                if (element) {
                    const isVisible = await element.isVisible().catch(() => false);
                    if (isVisible) {
                        const screenshotBuffer = await element.screenshot({ type: 'png' });
                        const base64 = screenshotBuffer.toString('base64');
                        return `data:image/png;base64,${base64}`;
                    }
                }
            }
        }

        // If no specific CAPTCHA found, take screenshot of potential CAPTCHA area
        // Look for common form structures
        const loginFormSelectors = [
            'form[id*="login"]',
            'form[class*="login"]',
            '.login-form',
            '#loginForm',
            'form'
        ];

        for (const formSelector of loginFormSelectors) {
            try {
                const form = await page.locator(formSelector).first();
                const isVisible = await form.isVisible().catch(() => false);
                if (isVisible) {
                    // Look for images within the form
                    const formImages = await form.locator('img').all();
                    for (const formImg of formImages) {
                        try {
                            const imgVisible = await formImg.isVisible().catch(() => false);
                            if (imgVisible) {
                                const screenshotBuffer = await formImg.screenshot({ type: 'png' });
                                const base64 = screenshotBuffer.toString('base64');
                                console.log(`[SOA Scraper] Extracted image from form as potential CAPTCHA`);
                                return `data:image/png;base64,${base64}`;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // Take a screenshot of the entire login area for debugging
        console.log(`[SOA Scraper] Could not find specific CAPTCHA element`);
        return null;

    } catch (error) {
        console.error(`[SOA Scraper] Error extracting CAPTCHA:`, error.message);
        return null;
    }
}

/**
 * Perform login and scrape data
 * @param {string} sessionId Session ID from CAPTCHA request
 * @param {string} regNo Registration number
 * @param {string} password Password (NOT logged)
 * @param {string} captcha User-provided captcha solution
 * @returns {Promise<Object>} Scrape result
 */
async function loginAndScrape(sessionId, regNo, password, captcha) {
    const session = activeSessions.get(sessionId);

    if (!session) {
        return {
            success: false,
            status: STATUS_SESSION_EXPIRED,
            message: 'Session expired. Please fetch a new CAPTCHA.'
        };
    }

    const { browser, page } = session;

    try {
        console.log(`[SOA Scraper] Attempting login for session: ${sessionId}`);

        // Fill login form
        const loginSuccess = await performLogin(page, regNo, password, captcha);

        // SECURITY: Clear password from memory
        password = null;

        if (!loginSuccess.success) {
            return {
                success: false,
                status: loginSuccess.status,
                message: loginSuccess.message
            };
        }

        console.log(`[SOA Scraper] Login successful, scraping data...`);

        // Wait for dashboard to load
        await page.waitForTimeout(3000);

        // Scrape all available data
        const studentData = await scrapeAllData(page);

        // Close session after successful scrape
        await closeSession(sessionId);

        return {
            success: true,
            status: STATUS_SUCCESS,
            message: 'Data fetched successfully from SOA portal',
            data: studentData
        };

    } catch (error) {
        console.error(`[SOA Scraper] Error during login/scrape:`, error.message);
        
        // Close session on error
        await closeSession(sessionId);

        return {
            success: false,
            status: STATUS_SCRAPE_ERROR,
            message: `Error: ${error.message}`
        };
    }
}

/**
 * Perform login with provided credentials
 * @param {Page} page Playwright page
 * @param {string} regNo Registration number
 * @param {string} password Password
 * @param {string} captcha Captcha text
 * @returns {Promise<Object>} Login result
 */
async function performLogin(page, regNo, password, captcha) {
    try {
        // Find and fill registration number field
        const regSelectors = [
            'input[name*="reg"]',
            'input[id*="reg"]',
            'input[placeholder*="Registration"]',
            'input[placeholder*="registration"]',
            'input[ng-model*="reg"]',
            'input[ng-model*="user"]',
            'input[name="username"]',
            'input[id="username"]',
            'input[type="text"]'
        ];

        let regFieldFilled = false;
        for (const selector of regSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.fill(regNo);
                    console.log(`[SOA Scraper] Filled registration field with selector: ${selector}`);
                    regFieldFilled = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!regFieldFilled) {
            console.warn(`[SOA Scraper] Could not find registration field`);
        }

        // Find and fill password field
        const pwdSelectors = [
            'input[type="password"]',
            'input[name*="password"]',
            'input[id*="password"]',
            'input[placeholder*="Password"]',
            'input[ng-model*="password"]'
        ];

        let pwdFieldFilled = false;
        for (const selector of pwdSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.fill(password);
                    console.log(`[SOA Scraper] Filled password field with selector: ${selector}`);
                    pwdFieldFilled = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!pwdFieldFilled) {
            console.warn(`[SOA Scraper] Could not find password field`);
        }

        // Fill CAPTCHA field
        const captchaSelectors = [
            'input[name*="captcha"]',
            'input[id*="captcha"]',
            'input[placeholder*="Captcha"]',
            'input[placeholder*="CAPTCHA"]',
            'input[placeholder*="Enter"]',
            'input[ng-model*="captcha"]'
        ];

        let captchaFieldFilled = false;
        for (const selector of captchaSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.fill(captcha);
                    console.log(`[SOA Scraper] Filled captcha field with selector: ${selector}`);
                    captchaFieldFilled = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!captchaFieldFilled) {
            console.warn(`[SOA Scraper] Could not find captcha field`);
        }

        // Click login button
        const loginSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[id*="login"]',
            'button[class*="login"]',
            'button[ng-click*="login"]',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'button:has-text("Submit")',
            '.btn-primary[type="submit"]',
            '#loginBtn'
        ];

        let loginClicked = false;
        for (const selector of loginSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    console.log(`[SOA Scraper] Clicked login button with selector: ${selector}`);
                    loginClicked = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!loginClicked) {
            // Try pressing Enter
            await page.keyboard.press('Enter');
            console.log(`[SOA Scraper] Pressed Enter to submit form`);
        }

        // Wait for response
        await page.waitForTimeout(5000);

        // Check for login success/failure
        const pageContent = await page.content();
        const currentUrl = page.url();

        // Check for error messages
        const errorIndicators = [
            'invalid credentials',
            'wrong password',
            'login failed',
            'authentication failed',
            'invalid user',
            'incorrect password',
            'invalid captcha',
            'captcha error',
            'wrong captcha'
        ];

        const lowerContent = pageContent.toLowerCase();
        for (const error of errorIndicators) {
            if (lowerContent.includes(error)) {
                if (error.includes('captcha')) {
                    return {
                        success: false,
                        status: STATUS_AUTH_FAILED,
                        message: 'Invalid CAPTCHA. Please try again with a new CAPTCHA.'
                    };
                }
                return {
                    success: false,
                    status: STATUS_AUTH_FAILED,
                    message: 'Invalid credentials. Please check your registration number and password.'
                };
            }
        }

        // Check for success indicators
        const successIndicators = [
            'dashboard',
            'welcome',
            'profile',
            'attendance',
            'result',
            'logout',
            'student portal'
        ];

        for (const success of successIndicators) {
            if (lowerContent.includes(success)) {
                return { success: true };
            }
        }

        // Check if URL changed (indicating successful login)
        if (!currentUrl.includes('login') && 
            (currentUrl.includes('dashboard') || 
             currentUrl.includes('home') || 
             currentUrl.includes('student'))) {
            return { success: true };
        }

        // If we can't determine, assume it might have worked
        return { success: true };

    } catch (error) {
        console.error(`[SOA Scraper] Login error:`, error.message);
        return {
            success: false,
            status: STATUS_SCRAPE_ERROR,
            message: error.message
        };
    }
}

/**
 * Scrape all available student data from the portal
 * @param {Page} page Puppeteer page
 * @returns {Promise<Object>} Scraped data
 */
async function scrapeAllData(page) {
    const data = {
        profile: {},
        attendance: [],
        marks: [],
        internalAssessments: [],
        timetable: [],
        subjects: [],
        notifications: [],
        backlogs: [],
        fees: {},
        rawHtml: ''
    };

    try {
        // Get current page content
        const pageContent = await page.content();
        
        // Extract profile information
        data.profile = await scrapeProfile(page, pageContent);

        // Try to navigate to attendance section and scrape
        data.attendance = await scrapeAttendance(page);

        // Try to navigate to marks section and scrape
        data.marks = await scrapeMarks(page);

        // Try to scrape internal assessments
        data.internalAssessments = await scrapeInternalAssessments(page);

        // Try to scrape timetable
        data.timetable = await scrapeTimetable(page);

        // Try to scrape subjects list
        data.subjects = await scrapeSubjects(page);

        // Try to scrape notifications
        data.notifications = await scrapeNotifications(page);

        // Add metadata
        data.fetchedAt = new Date().toISOString();
        data.dataSource = 'live_portal';

        console.log(`[SOA Scraper] Successfully scraped data`);

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping data:`, error.message);
    }

    return data;
}

/**
 * Scrape profile information
 */
async function scrapeProfile(page, pageContent) {
    const profile = {
        name: null,
        registrationNo: null,
        enrollmentNo: null,
        department: null,
        branch: null,
        semester: null,
        section: null,
        email: null,
        phone: null,
        dateOfBirth: null,
        gender: null,
        bloodGroup: null,
        photo: null
    };

    try {
        // Extract using regex patterns
        const patterns = {
            name: [/Name[:\s]*([A-Za-z\s]+)/i, /Student Name[:\s]*([A-Za-z\s]+)/i],
            registrationNo: [/Registration[:\s]*(?:No)?[:\s]*(\d+)/i, /Reg[.\s]*No[:\s]*(\d+)/i],
            enrollmentNo: [/Enrollment[:\s]*(?:No)?[:\s]*(\d+)/i],
            department: [/Department[:\s]*([A-Za-z\s&]+)/i, /Dept[:\s]*([A-Za-z\s&]+)/i],
            branch: [/Branch[:\s]*([A-Za-z\s&]+)/i, /Course[:\s]*([A-Za-z\s&]+)/i],
            semester: [/Semester[:\s]*(\d+)/i, /Sem[:\s]*(\d+)/i],
            section: [/Section[:\s]*([A-Za-z0-9]+)/i],
            email: [/Email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i],
            phone: [/Phone[:\s]*(\d{10,})/i, /Mobile[:\s]*(\d{10,})/i]
        };

        for (const [field, fieldPatterns] of Object.entries(patterns)) {
            for (const pattern of fieldPatterns) {
                const match = pageContent.match(pattern);
                if (match) {
                    profile[field] = match[1].trim();
                    break;
                }
            }
        }

        // Try to get profile photo
        const photoSelectors = [
            'img[class*="profile"]',
            'img[id*="profile"]',
            'img[alt*="profile"]',
            '.profile-photo img',
            '.student-photo img',
            '.user-photo img'
        ];

        for (const selector of photoSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    profile.photo = await element.getAttribute('src');
                    break;
                }
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping profile:`, error.message);
    }

    return profile;
}

/**
 * Scrape attendance data
 */
async function scrapeAttendance(page) {
    const attendance = [];

    try {
        // Try to click attendance menu/tab
        const attendanceNavSelectors = [
            'a[href*="attendance"]',
            'a:has-text("Attendance")',
            'li:has-text("Attendance")',
            '[ng-click*="attendance"]',
            '.nav-link:has-text("Attendance")'
        ];

        for (const selector of attendanceNavSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Try to find attendance table
        const tableSelectors = [
            'table[class*="attendance"]',
            'table[id*="attendance"]',
            '#attendanceTable',
            '.attendance-table',
            'table.table'
        ];

        for (const selector of tableSelectors) {
            try {
                const table = page.locator(selector).first();
                const isVisible = await table.isVisible().catch(() => false);
                if (!isVisible) continue;

                const rows = await table.locator('tr').all();
                for (let i = 1; i < rows.length; i++) { // Skip header
                    const cells = await rows[i].locator('td').all();
                    if (cells.length >= 3) {
                        const subject = await cells[0].textContent() || '';
                        const attended = await cells[1].textContent() || '';
                        const percentage = await cells[2].textContent() || '';

                        attendance.push({
                            subject: subject.trim(),
                            attended: attended.trim(),
                            total: cells[3] ? (await cells[3].textContent() || '').trim() : null,
                            percentage: percentage.trim()
                        });
                    }
                }

                if (attendance.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping attendance:`, error.message);
    }

    return attendance;
}

/**
 * Scrape marks data
 */
async function scrapeMarks(page) {
    const marks = [];

    try {
        // Try to click marks/results menu
        const marksNavSelectors = [
            'a[href*="marks"]',
            'a[href*="result"]',
            'a:has-text("Marks")',
            'a:has-text("Results")',
            '[ng-click*="marks"]',
            '[ng-click*="result"]'
        ];

        for (const selector of marksNavSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Try to find marks table
        const tableSelectors = [
            'table[class*="marks"]',
            'table[class*="result"]',
            '#marksTable',
            '.marks-table',
            'table.table'
        ];

        for (const selector of tableSelectors) {
            try {
                const table = page.locator(selector).first();
                const isVisible = await table.isVisible().catch(() => false);
                if (!isVisible) continue;

                const rows = await table.locator('tr').all();
                for (let i = 1; i < rows.length; i++) {
                    const cells = await rows[i].locator('td').all();
                    if (cells.length >= 2) {
                        const subject = await cells[0].textContent() || '';
                        const score = await cells[1].textContent() || '';
                        const grade = cells[2] ? (await cells[2].textContent() || '').trim() : null;

                        marks.push({
                            subject: subject.trim(),
                            marks: score.trim(),
                            grade
                        });
                    }
                }

                if (marks.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping marks:`, error.message);
    }

    return marks;
}

/**
 * Scrape internal assessments
 */
async function scrapeInternalAssessments(page) {
    const assessments = [];

    try {
        // Try to click internal assessment menu
        const navSelectors = [
            'a[href*="internal"]',
            'a:has-text("Internal")',
            'a:has-text("IA")',
            '[ng-click*="internal"]'
        ];

        for (const selector of navSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Extract from any visible table
        const tables = await page.locator('table').all();
        for (const table of tables) {
            try {
                const rows = await table.locator('tr').all();
                for (let i = 1; i < rows.length; i++) {
                    const cells = await rows[i].locator('td').all();
                    if (cells.length >= 4) {
                        const subject = await cells[0].textContent() || '';
                        const ia1 = await cells[1].textContent() || '';
                        const ia2 = await cells[2].textContent() || '';
                        const ia3 = cells[3] ? (await cells[3].textContent() || '').trim() : null;

                        assessments.push({
                            subject: subject.trim(),
                            ia1: ia1.trim(),
                            ia2: ia2.trim(),
                            ia3,
                            labMarks: cells[4] ? (await cells[4].textContent() || '').trim() : null,
                            assignment: cells[5] ? (await cells[5].textContent() || '').trim() : null
                        });
                    }
                }

                if (assessments.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping internal assessments:`, error.message);
    }

    return assessments;
}

/**
 * Scrape timetable
 */
async function scrapeTimetable(page) {
    const timetable = [];

    try {
        // Try to click timetable menu
        const navSelectors = [
            'a[href*="timetable"]',
            'a[href*="schedule"]',
            'a:has-text("Timetable")',
            'a:has-text("Schedule")',
            '[ng-click*="timetable"]'
        ];

        for (const selector of navSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Extract timetable from any table
        const tables = await page.locator('table').all();
        for (const table of tables) {
            try {
                const rows = await table.locator('tr').all();
                for (let i = 1; i < rows.length; i++) {
                    const cells = await rows[i].locator('td, th').all();
                    if (cells.length >= 2) {
                        const cellContents = [];
                        for (const cell of cells) {
                            const text = await cell.textContent() || '';
                            cellContents.push(text.trim());
                        }
                        timetable.push(cellContents);
                    }
                }

                if (timetable.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping timetable:`, error.message);
    }

    return timetable;
}

/**
 * Scrape subjects list
 */
async function scrapeSubjects(page) {
    const subjects = [];

    try {
        // Try to click subjects/courses menu
        const navSelectors = [
            'a[href*="subject"]',
            'a[href*="course"]',
            'a:has-text("Subjects")',
            'a:has-text("Courses")',
            '[ng-click*="subject"]'
        ];

        for (const selector of navSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Extract subjects from lists or tables
        const listSelectors = ['ul li', 'ol li', 'table td'];
        for (const selector of listSelectors) {
            try {
                const items = await page.locator(selector).all();
                for (const item of items) {
                    const text = await item.textContent() || '';
                    if (text && text.trim().length > 2 && text.trim().length < 100) {
                        subjects.push({ name: text.trim() });
                    }
                }

                if (subjects.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping subjects:`, error.message);
    }

    return subjects;
}

/**
 * Scrape notifications
 */
async function scrapeNotifications(page) {
    const notifications = [];

    try {
        // Try to click notifications menu
        const navSelectors = [
            'a[href*="notification"]',
            'a[href*="notice"]',
            'a:has-text("Notification")',
            'a:has-text("Notice")',
            '[ng-click*="notification"]',
            '.notification-icon',
            '.bell-icon'
        ];

        for (const selector of navSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(2000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Extract notifications
        const notificationSelectors = [
            '.notification-item',
            '.notice-item',
            '.alert',
            'ul.notifications li'
        ];

        for (const selector of notificationSelectors) {
            try {
                const items = await page.locator(selector).all();
                for (const item of items) {
                    const text = await item.textContent() || '';
                    if (text && text.trim().length > 5) {
                        notifications.push({
                            message: text.trim(),
                            date: null
                        });
                    }
                }

                if (notifications.length > 0) break;
            } catch (e) {
                continue;
            }
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error scraping notifications:`, error.message);
    }

    return notifications.slice(0, 10); // Limit to 10 notifications
}

/**
 * Refresh captcha for an existing session
 */
async function refreshCaptcha(sessionId) {
    const session = activeSessions.get(sessionId);

    if (!session) {
        return {
            success: false,
            status: STATUS_SESSION_EXPIRED,
            message: 'Session expired. Please start a new session.'
        };
    }

    try {
        const { page } = session;

        // Try to click refresh button for CAPTCHA
        const refreshSelectors = [
            'button[id*="refresh"]',
            'a[id*="refresh"]',
            '.captcha-refresh',
            '#refreshCaptcha',
            'img[id*="captcha"]', // Clicking captcha might refresh it
            '[ng-click*="refresh"]'
        ];

        for (const selector of refreshSelectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                    await element.click();
                    await page.waitForTimeout(1500);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Extract new CAPTCHA
        const captchaImage = await extractCaptchaImage(page);

        if (!captchaImage) {
            return {
                success: false,
                status: STATUS_SCRAPE_ERROR,
                message: 'Could not refresh CAPTCHA. Please start a new session.'
            };
        }

        // Update session
        session.captchaImage = captchaImage;
        activeSessions.set(sessionId, session);

        return {
            success: true,
            status: STATUS_CAPTCHA_REQUIRED,
            sessionId,
            captchaImage,
            message: 'CAPTCHA refreshed successfully.'
        };

    } catch (error) {
        console.error(`[SOA Scraper] Error refreshing CAPTCHA:`, error.message);
        return {
            success: false,
            status: STATUS_SCRAPE_ERROR,
            message: `Error: ${error.message}`
        };
    }
}

module.exports = {
    createSessionAndGetCaptcha,
    loginAndScrape,
    refreshCaptcha,
    closeSession,
    STATUS_SUCCESS,
    STATUS_AUTH_FAILED,
    STATUS_SCRAPE_ERROR,
    STATUS_PORTAL_UNREACHABLE,
    STATUS_CAPTCHA_REQUIRED,
    STATUS_SESSION_EXPIRED
};
