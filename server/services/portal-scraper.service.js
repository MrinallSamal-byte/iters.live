/**
 * Portal Scraper Service - Node.js/Puppeteer Implementation
 * Replaces Python/Selenium scraper with native Node.js solution
 * 
 * Features:
 * - Uses Puppeteer for browser automation
 * - Implements CAPTCHA solving using multiple methods:
 *   1. Google Vision API (primary OCR)
 *   2. Gemini AI Vision (AI-powered recognition)
 *   3. Tesseract.js (local fallback)
 * - Enhanced image preprocessing for better OCR accuracy
 * - Scrapes student data from SOA Portal
 * - Falls back to dummy data on failure
 */

const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Portal configuration
const PORTAL_URL = process.env.PORTAL_URL || 'https://soaportals.com/StudentPortalSOA/#/';
// Google Vision API key - MUST be set via environment variable for security
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || '';
// Gemini API key for AI-powered CAPTCHA solving
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';

/**
 * Enhanced CAPTCHA Solver using multiple methods:
 * 1. Google Vision API (primary - cloud OCR)
 * 2. Gemini AI Vision (AI-powered recognition with multimodal capability)
 * 3. Tesseract.js (local fallback)
 * 
 * Enhanced with advanced image preprocessing for better accuracy
 */
class CaptchaSolver {
    constructor() {
        this.visionApiKey = GOOGLE_VISION_API_KEY;
        this.geminiApiKey = GEMINI_API_KEY;
        this.visionApiEndpoint = 'https://vision.googleapis.com/v1/images:annotate';
        this.genAI = this.geminiApiKey ? new GoogleGenerativeAI(this.geminiApiKey) : null;
        
        // Log available CAPTCHA solving methods
        const methods = [];
        if (this.visionApiKey) methods.push('Google Vision API');
        if (this.geminiApiKey) methods.push('Gemini AI Vision');
        methods.push('Tesseract.js (local)');
        console.log(`CAPTCHA Solver initialized with methods: ${methods.join(', ')}`);
    }

    /**
     * Clean CAPTCHA text - remove non-alphanumeric and standardize
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
     * Advanced image preprocessing for better OCR accuracy
     * Applies multiple techniques to enhance text visibility
     */
    async preprocessImage(imageBuffer) {
        try {
            // Get image metadata to determine processing approach
            const metadata = await sharp(imageBuffer).metadata();
            
            // Apply comprehensive preprocessing
            let processedBuffer = await sharp(imageBuffer)
                // Resize if too small (better OCR on larger images)
                .resize({
                    width: Math.max(metadata.width, 200),
                    height: Math.max(metadata.height, 80),
                    fit: 'fill'
                })
                // Convert to grayscale
                .grayscale()
                // Increase contrast
                .normalize()
                // Apply linear contrast enhancement
                .linear(1.5, -30) // Enhance contrast
                // Apply sharpening
                .sharpen({
                    sigma: 1.5,
                    m1: 1.0,
                    m2: 0.5
                })
                .toBuffer();
            
            return processedBuffer;
        } catch (error) {
            console.warn('Image preprocessing warning:', error.message);
            return imageBuffer; // Return original if preprocessing fails
        }
    }

    /**
     * Solve CAPTCHA using Google Vision API
     */
    async solveWithGoogleVision(imageBase64) {
        if (!this.visionApiKey) {
            console.warn('Google Vision API key not configured');
            return null;
        }

        try {
            const requestBody = {
                requests: [{
                    image: { content: imageBase64 },
                    features: [
                        { type: 'TEXT_DETECTION' },
                        { type: 'DOCUMENT_TEXT_DETECTION' } // Better for structured text
                    ]
                }]
            };

            const response = await axios.post(
                `${this.visionApiEndpoint}?key=${this.visionApiKey}`,
                requestBody,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );

            // Try to get text from both detection methods
            let text = '';
            if (response.data?.responses?.[0]?.textAnnotations?.length > 0) {
                text = response.data.responses[0].textAnnotations[0].description;
            } else if (response.data?.responses?.[0]?.fullTextAnnotation?.text) {
                text = response.data.responses[0].fullTextAnnotation.text;
            }

            if (text) {
                const cleaned = this.cleanCaptchaText(text);
                console.log(`Google Vision OCR result: "${text}" -> cleaned: "${cleaned}"`);
                return cleaned;
            }
        } catch (error) {
            console.error('Google Vision API error:', error.message);
        }
        return null;
    }

    /**
     * Detect MIME type from image buffer
     */
    detectMimeType(imageBuffer) {
        // Check magic bytes for common image formats
        if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
            return 'image/png';
        } else if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
            return 'image/jpeg';
        } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
            return 'image/gif';
        } else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && 
                   imageBuffer[8] === 0x57 && imageBuffer[9] === 0x45) {
            return 'image/webp';
        }
        // Default to PNG as it's most common for screenshots
        return 'image/png';
    }

    /**
     * Solve CAPTCHA using Gemini AI Vision (multimodal AI)
     * This uses Google's Gemini model for visual understanding
     */
    async solveWithGeminiVision(imageBase64, mimeType = 'image/png') {
        if (!this.genAI) {
            console.warn('Gemini API key not configured');
            return null;
        }

        try {
            // Use gemini-1.5-flash for vision tasks
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            // Craft a specific prompt for CAPTCHA recognition
            const prompt = `You are a CAPTCHA text recognition expert. Look at this CAPTCHA image and extract ONLY the alphanumeric characters shown. 

Rules:
- Return ONLY the characters you see, nothing else
- Do not include any explanation or additional text
- The CAPTCHA is typically 4-6 alphanumeric characters
- Characters may be distorted, rotated, or have noise
- If you see letters, use UPPERCASE
- Be precise - each character matters

What are the exact characters in this CAPTCHA image?`;

            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text().trim();
            
            const cleaned = this.cleanCaptchaText(text);
            console.log(`Gemini AI Vision result: "${text}" -> cleaned: "${cleaned}"`);
            return cleaned;
        } catch (error) {
            console.error('Gemini AI Vision error:', error.message);
        }
        return null;
    }

    /**
     * Solve CAPTCHA using Tesseract.js (local fallback)
     * Enhanced with multiple preprocessing attempts
     */
    async solveWithTesseract(imageBuffer) {
        try {
            // Try multiple threshold values for better results
            const thresholds = [100, 128, 150, 180];
            let bestResult = '';
            
            for (const threshold of thresholds) {
                // Preprocess image with current threshold
                const processedBuffer = await sharp(imageBuffer)
                    .grayscale()
                    .normalize()
                    .threshold(threshold)
                    // Invert colors if needed (white text on black background)
                    .toBuffer();

                const { data: { text, confidence } } = await Tesseract.recognize(
                    processedBuffer,
                    'eng',
                    {
                        logger: () => {} // Suppress logs
                    }
                );

                const cleaned = this.cleanCaptchaText(text);
                console.log(`Tesseract OCR (threshold=${threshold}): "${text}" -> cleaned: "${cleaned}" (confidence: ${confidence}%)`);
                
                // Keep the best result based on length and confidence
                if (cleaned.length >= 4 && cleaned.length <= 6) {
                    if (!bestResult || cleaned.length > bestResult.length) {
                        bestResult = cleaned;
                    }
                }
            }

            return bestResult || null;
        } catch (error) {
            console.error('Tesseract OCR error:', error.message);
            return null;
        }
    }

    /**
     * Solve CAPTCHA with multiple methods - cascading fallback
     * Order: Google Vision -> Gemini AI -> Tesseract
     */
    async solve(imageBuffer) {
        try {
            // Detect MIME type from original buffer
            const mimeType = this.detectMimeType(imageBuffer);
            
            // Preprocess image for better results
            const preprocessedBuffer = await this.preprocessImage(imageBuffer);
            
            // Convert to base64
            const imageBase64 = preprocessedBuffer.toString('base64');

            // Method 1: Try Google Vision first (fastest and most accurate for standard text)
            console.log('Attempting CAPTCHA solve with Google Vision API...');
            let captchaText = await this.solveWithGoogleVision(imageBase64);
            
            if (captchaText && captchaText.length >= 4 && captchaText.length <= 6) {
                console.log(`CAPTCHA solved with Google Vision: ${captchaText}`);
                return captchaText;
            }

            // Method 2: Try Gemini AI Vision (better for distorted/complex CAPTCHAs)
            console.log('Attempting CAPTCHA solve with Gemini AI Vision...');
            captchaText = await this.solveWithGeminiVision(imageBase64, mimeType);
            
            if (captchaText && captchaText.length >= 4 && captchaText.length <= 6) {
                console.log(`CAPTCHA solved with Gemini AI: ${captchaText}`);
                return captchaText;
            }

            // Method 3: Fallback to Tesseract (local, no API needed)
            console.log('Attempting CAPTCHA solve with Tesseract.js...');
            captchaText = await this.solveWithTesseract(preprocessedBuffer);

            if (captchaText && captchaText.length >= 4 && captchaText.length <= 6) {
                console.log(`CAPTCHA solved with Tesseract: ${captchaText}`);
                return captchaText;
            }

            console.log('All CAPTCHA solving methods failed');
            return null;
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
            
            // Set user agent to avoid detection (configurable via env)
            const userAgent = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            await this.page.setUserAgent(userAgent);
            
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
     * 
     * COMMENTED OUT - Portal scraping disabled
     */
    async attemptLogin(regNumber, password) {
        // COMMENTED OUT - Login functionality disabled
        return { success: false, error: 'Portal scraping is disabled', type: STATUS_PORTAL_UNREACHABLE };
        
        // try {
        //     // Check portal reachability first
        //     const reachable = await this.isPortalReachable();
        //     if (!reachable) {
        //         return { success: false, error: 'Portal is currently unreachable', type: STATUS_PORTAL_UNREACHABLE };
        //     }
        //
        //     // Launch browser
        //     const launched = await this.launchBrowser();
        //     if (!launched) {
        //         return { success: false, error: 'Failed to launch browser', type: STATUS_SCRAPE_ERROR };
        //     }
        //
        //     // Navigate to portal
        //     console.log(`Navigating to ${PORTAL_URL}`);
        //     await this.page.goto(PORTAL_URL, {
        //         waitUntil: 'networkidle2',
        //         timeout: 30000
        //     });
        //     await this.randomDelay(2000, 3000);
        //
        //     // Wait for Angular to load
        //     await this.page.waitForTimeout(2000);
        //
        //     // Find USER ID field
        //     const userIdSelectors = [
        //         'input[formcontrolname="userid"]',
        //         'input[formcontrolname="userId"]',
        //         'input[name="userid"]',
        //         'input[name="userId"]',
        //         '#userId',
        //         '#username',
        //         'input[placeholder*="User"]',
        //         'input[placeholder*="ID"]'
        //     ];
        //
        //     const userIdField = await this.findElement(userIdSelectors);
        //     if (!userIdField) {
        //         return { success: false, error: 'USER ID field not found', type: STATUS_SCRAPE_ERROR };
        //     }
        //
        //     // Fill USER ID
        //     await this.humanType(userIdField, regNumber);
        //     await this.randomDelay(500, 1000);
        //
        //     // Check for CAPTCHA
        //     const captchaText = await this.solveCaptcha();
        //     if (captchaText) {
        //         // Find CAPTCHA input
        //         const captchaInputSelectors = [
        //             'input[formcontrolname="captcha"]',
        //             'input[name="captcha"]',
        //             '#captcha',
        //             'input[placeholder*="Captcha"]',
        //             'input[placeholder*="Enter"]'
        //         ];
        //
        //         const captchaInput = await this.findElement(captchaInputSelectors);
        //         if (captchaInput) {
        //             await this.humanType(captchaInput, captchaText);
        //             await this.randomDelay(500, 1000);
        //         }
        //     }
        //
        //     // Click submit/next button
        //     const submitSelectors = [
        //         'button[type="submit"]',
        //         '.btn-submit',
        //         '.login-btn'
        //     ];
        //
        //     let submitBtn = await this.findElement(submitSelectors);
        //     
        //     // If not found by class/type, try finding by text using XPath
        //     if (!submitBtn) {
        //         const xpathSelectors = [
        //             '//button[contains(text(), "LOGIN")]',
        //             '//button[contains(text(), "SUBMIT")]',
        //             '//button[contains(text(), "Next")]'
        //         ];
        //         
        //         for (const xpath of xpathSelectors) {
        //             try {
        //                 const elements = await this.page.$x(xpath);
        //                 if (elements.length > 0) {
        //                     submitBtn = elements[0];
        //                     break;
        //                 }
        //             } catch (e) {
        //                 continue;
        //             }
        //         }
        //     }
        //     
        //     if (submitBtn) {
        //         await submitBtn.click();
        //         await this.randomDelay(3000, 5000);
        //     }
        //
        //     // Check for password field (two-step login)
        //     const passwordSelectors = [
        //         'input[formcontrolname="password"]',
        //         'input[name="password"]',
        //         'input[type="password"]',
        //         '#password'
        //     ];
        //
        //     const passwordField = await this.findElement(passwordSelectors, 5000);
        //     if (passwordField) {
        //         await this.humanType(passwordField, password);
        //         await this.randomDelay(500, 1000);
        //
        //         // Click final login button
        //         let loginBtn = await this.findElement([
        //             'button[type="submit"]',
        //             '.btn-login'
        //         ]);
        //         
        //         // Try finding by text using XPath if not found
        //         if (!loginBtn) {
        //             try {
        //                 const elements = await this.page.$x('//button[contains(text(), "LOGIN")]');
        //                 if (elements.length > 0) {
        //                     loginBtn = elements[0];
        //                 }
        //             } catch (e) {
        //                 // Ignore
        //             }
        //         }
        //         
        //         if (loginBtn) {
        //             await loginBtn.click();
        //             await this.randomDelay(3000, 5000);
        //         }
        //     }
        //
        //     // Check login success
        //     const currentUrl = this.page.url();
        //     
        //     // Check for error messages
        //     const errorSelectors = [
        //         '.error-message',
        //         '.alert-danger',
        //         '.login-error',
        //         '[class*="error"]'
        //     ];
        //
        //     for (const selector of errorSelectors) {
        //         try {
        //             const errorEl = await this.page.$(selector);
        //             if (errorEl) {
        //                 const errorText = await this.page.evaluate(el => el.textContent, errorEl);
        //                 if (errorText && errorText.toLowerCase().includes('invalid')) {
        //                     return { success: false, error: 'Invalid credentials', type: STATUS_AUTH_FAILED };
        //                 }
        //             }
        //         } catch (e) {
        //             // Ignore
        //         }
        //     }
        //
        //     // Check for success indicators
        //     const successSelectors = [
        //         '.dashboard',
        //         '.student-dashboard',
        //         '.profile',
        //         '[class*="dashboard"]'
        //     ];
        //
        //     for (const selector of successSelectors) {
        //         try {
        //             const element = await this.page.$(selector);
        //             if (element) {
        //                 console.log('Login successful');
        //                 return { success: true };
        //             }
        //         } catch (e) {
        //             // Ignore
        //         }
        //     }
        //
        //     // Check URL for success
        //     if (currentUrl.toLowerCase().includes('dashboard') || 
        //         currentUrl.toLowerCase().includes('home') ||
        //         currentUrl.toLowerCase().includes('profile')) {
        //         console.log('Login successful (URL check)');
        //         return { success: true };
        //     }
        //
        //     // If still on login page, assume failure
        //     if (currentUrl.toLowerCase().includes('login') || currentUrl === PORTAL_URL) {
        //         return { success: false, error: 'Login failed', type: STATUS_AUTH_FAILED };
        //     }
        //
        //     return { success: true };
        //
        // } catch (error) {
        //     console.error('Login attempt error:', error.message);
        //     return { success: false, error: error.message, type: STATUS_SCRAPE_ERROR };
        // }
    }

    /**
     * Scrape student data
     */
    async scrapeData() {
        // COMMENTED OUT - Data scraping disabled
        return {
            profile: {},
            marks: [],
            attendance: [],
            timetable: [],
            courses: [],
            results: [],
            notifications: []
        };
        
        /* 
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
        */
    }

    /**
     * Main scrape method
     * 
     * COMMENTED OUT - Portal scraping disabled
     */
    async scrape(regNumber, password) {
        console.log(`Scrape request for: ${regNumber} - SCRAPING DISABLED`);

        // COMMENTED OUT - All portal scraping functionality is disabled
        // Return disabled status immediately
        return {
            status: STATUS_PORTAL_UNREACHABLE,
            message: 'Portal scraping is currently disabled. Please try again later or use demo data.'
        };

        // try {
        //     // Attempt login
        //     const loginResult = await this.attemptLogin(regNumber, password);
        //
        //     if (!loginResult.success) {
        //         return {
        //             status: loginResult.type || STATUS_SCRAPE_ERROR,
        //             message: loginResult.error || 'Login failed'
        //         };
        //     }
        //
        //     // Scrape data
        //     const scrapedData = await this.scrapeData();
        //
        //     return {
        //         status: STATUS_SUCCESS,
        //         data: scrapedData
        //     };
        //
        // } catch (error) {
        //     console.error('Scrape error:', error.message);
        //     return {
        //         status: STATUS_SCRAPE_ERROR,
        //         message: error.message
        //     };
        // } finally {
        //     // Cleanup
        //     await this.cleanup();
        // }
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
