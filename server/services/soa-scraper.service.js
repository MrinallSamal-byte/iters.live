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

const fs = require('fs');
const { chromium } = require('playwright');
const dns = require('dns');
const https = require('https');
const { normalizeSoaPortalData } = require('./soa-data.service');
const { featureFlags } = require('../config/featureFlags');
const {
    detectBrowserRuntimeIssue,
    resolveChromiumExecutablePath
} = require('../utils/playwright-runtime.util');

// Status constants
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_AUTH_FAILED = 'AUTH_FAILED';
const STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR';
const STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE';
const STATUS_CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED';
const STATUS_SESSION_EXPIRED = 'SESSION_EXPIRED';
const STATUS_RUNTIME_UNAVAILABLE = 'SCRAPER_UNAVAILABLE';
const STATUS_SCRAPER_BUSY = 'SCRAPER_BUSY';
const STATUS_BLOCKED_BY_SITE = 'BLOCKED_BY_SITE';

// Portal configuration
const PORTAL_URL = 'https://soaportals.com/StudentPortalSOA/#/';
const PORTAL_ENTRY_URLS = [
    'https://soaportals.com/StudentPortalSOA/',
    PORTAL_URL,
    'https://soaportals.com/'
];
const PORTAL_HOSTNAME = 'soaportals.com';
const PORTAL_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];
const TIMEOUT = 60000; // 60 seconds
const NAVIGATION_TIMEOUT = 30000;
const PORTAL_READY_TIMEOUT = 15000;
// Single source of truth for the browser/probe user agent. Override with SOA_USER_AGENT.
const DEFAULT_SOA_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const SOA_USER_AGENT = process.env.SOA_USER_AGENT || DEFAULT_SOA_USER_AGENT;
// DNS pinning (--host-resolver-rules) backfires behind Cloudflare, so it is opt-in via SOA_PIN_DNS=1.
const SOA_PIN_DNS_ENABLED = process.env.SOA_PIN_DNS === '1';
const CHALLENGE_CLEAR_TIMEOUT = parsePositiveInteger(process.env.SOA_CHALLENGE_WAIT_MS, 20000);
// Hard ceiling for a logged-in crawl. When exceeded the session browser is killed so a stuck
// scrape cannot pin a session slot until the full session TTL elapses.
const CRAWL_DEADLINE_MS = parsePositiveInteger(process.env.SOA_CRAWL_DEADLINE_MS, 90000);
const CLOUDFLARE_CHALLENGE_PATTERN = /just a moment|attention required|verify you are human|confirm you are human|cf-chl|challenge-platform|cf-browser-verification|cf-please-wait|checking your browser/i;

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
// Heuristic weights tuned for the current SOA/CampusLynx login UI:
// explicit "captcha" hints are strongest, "verify" and expected dimensions are supporting signals.
const CAPTCHA_HEURISTIC_SCORE = {
    HAS_CAPTCHA_HINT: 6,
    HAS_VERIFY_HINT: 4,
    HAS_INLINE_IMAGE: 8,
    CAPTCHA_LIKE_DIMENSIONS: 2,
    NEAR_CAPTCHA_INPUT: 5
};
// Typical CAPTCHA image bounds observed in the SOA portal login form.
const CAPTCHA_IMAGE_DIMENSIONS = {
    minWidth: 80,
    maxWidth: 400,
    minHeight: 25,
    maxHeight: 120
};
const MAX_CAPTCHA_INPUT_VERTICAL_DISTANCE = 220;

// In-memory session storage for browser contexts
// Key: sessionId, Value: { browser, context, page, captchaImage, createdAt, lastActivity }
const activeSessions = new Map();

// Session cleanup interval (5 minutes)
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000;
// Session expiry time (10 minutes)
const SESSION_EXPIRY = 10 * 60 * 1000;
// Idle sessions (no captcha fetch / refresh / login attempt) are evicted sooner so abandoned
// captcha sessions do not lock the small session pool for the full TTL.
const SESSION_IDLE_EXPIRY = 4 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = parsePositiveInteger(process.env.SOA_MAX_ACTIVE_SESSIONS, 2);
// Browsers that are mid-launch (navigating + extracting the CAPTCHA) but are not
// stored in activeSessions yet. Counted against capacity to prevent concurrent
// requests from racing past MAX_ACTIVE_SESSIONS.
let pendingSessionLaunches = 0;
const resolvedPortalIpCache = {
    value: null,
    resolvedAt: 0
};
// Cache a successful ready=true check for 10 minutes; cache failures for only 2 minutes so
// a transient launch error does not permanently block the feature for the whole server lifetime.
const RUNTIME_DIAGNOSTICS_TTL = 10 * 60 * 1000;
const RUNTIME_DIAGNOSTICS_FAILURE_TTL = 2 * 60 * 1000;
let runtimeDiagnosticsCache = {
    ready: null,
    checkedAt: 0,
    executablePath: null,
    executableSource: null,
    message: null,
    code: null
};
let runtimeDiagnosticsPromise = null;
let memoryGuardWarningLogged = false;

// Soft memory guard: on memory-constrained runtimes we keep the portal usable but cap it at a
// single concurrent browser session instead of hard-disabling it.
function getEffectiveMaxActiveSessions() {
    if (featureFlags.memoryConstrained && MAX_ACTIVE_SESSIONS > 1) {
        if (!memoryGuardWarningLogged) {
            memoryGuardWarningLogged = true;
            console.warn('[SOA Scraper] Memory-constrained runtime detected: limiting SOA portal to 1 concurrent browser session.');
        }
        return 1;
    }

    return MAX_ACTIVE_SESSIONS;
}

function getSessionCapacitySnapshot() {
    const maxActiveSessions = getEffectiveMaxActiveSessions();
    const activeSessionCount = activeSessions.size;
    const usedSlots = activeSessionCount + pendingSessionLaunches;
    return {
        activeSessionCount,
        pendingSessionLaunches,
        maxActiveSessions,
        hasCapacity: usedSlots < maxActiveSessions
    };
}

function getSessionPoolStats() {
    return {
        active: activeSessions.size,
        pending: pendingSessionLaunches,
        max: getEffectiveMaxActiveSessions()
    };
}

function decorateRuntimeDiagnostics(runtime) {
    const sessionCapacity = getSessionCapacitySnapshot();
    if (!runtime || typeof runtime !== 'object') {
        return {
            ready: false,
            checkedAt: Date.now(),
            executablePath: null,
            executableSource: null,
            message: 'SOA import is temporarily unavailable on this server. Please try again shortly.',
            code: 'UNKNOWN',
            ...sessionCapacity
        };
    }

    if (!runtime.ready || sessionCapacity.hasCapacity) {
        return {
            ...runtime,
            ...sessionCapacity
        };
    }

    return {
        ...runtime,
        ...sessionCapacity,
        message: `SOA import is temporarily busy. ${sessionCapacity.activeSessionCount}/${sessionCapacity.maxActiveSessions} browser sessions are already active. Please wait a minute and try again.`,
        code: 'SESSION_LIMIT_REACHED'
    };
}

const SECTION_NAVIGATION = [
    {
        key: 'personalInfo',
        route: '#/student/studentsPersonalInfo',
        path: [
            ['Student Personal Info.', 'Student Personal Info', 'Student Personal Information', 'Personal Information']
        ],
        labels: ['Student Personal Info', 'Student Personal Information', 'Personal Information', 'Personal Info', 'Profile', 'Student Profile']
    },
    {
        key: 'contactInfo',
        route: '#/student/studentsPersonalInfo',
        path: [
            ['Students Contact Info', 'Student Contact Info', 'Contact Information', 'Contact Info', 'Contact Details']
        ],
        labels: ['Students Contact Info', 'Student Contact Info', 'Contact Information', 'Contact Info', 'Contact Details', 'Address Details']
    },
    {
        key: 'qualifications',
        route: '#/student/studentsPersonalInfo',
        path: [
            ['Students Qualifications', 'Student Qualifications', 'Qualifications', 'Qualification']
        ],
        labels: ['Students Qualifications', 'Student Qualifications', 'Qualifications', 'Qualification', 'Academic Qualification']
    },
    {
        key: 'attendance',
        route: '#/student/myclassattendance',
        path: [
            ['Class Attendance', 'Attendance View', 'Attendance']
        ],
        labels: ['Class Attendance', 'Attendance View', 'Attendance']
    },
    {
        key: 'marks',
        route: '#/student/studentresult',
        path: [
            ['Student Result', 'My Result', 'Results', 'Result']
        ],
        labels: ['Student Result', 'My Result', 'Marks', 'Result', 'Results', 'Semester Result']
    },
    { key: 'internalAssessments', labels: ['Internal Assessment', 'Internal Assessments', 'IA Marks', 'Internal Marks'] },
    {
        key: 'timetable',
        route: '#/student/myclasstimetable',
        path: [
            ['Class Time Table', 'Class Timetable', 'Time Table', 'Timetable', 'Class Schedule']
        ],
        labels: ['Class Time Table', 'Class Timetable', 'Time Table', 'Timetable', 'Class Schedule', 'Schedule']
    },
    {
        key: 'subjects',
        route: '#/student/studentregisteredfaculty',
        path: [
            ['Registered Subjects', 'Registered Subject', 'Subjects', 'Courses']
        ],
        labels: ['Registered Subjects', 'Registered Subject', 'Subjects', 'Courses']
    },
    {
        key: 'admitCard',
        route: '#/student/studentadmitcard',
        path: [
            ['Exam Info', 'Examination Info'],
            ['My Admit Card', 'Admit Card']
        ],
        labels: ['My Admit Card', 'Admit Card']
    },
    { key: 'notifications', labels: ['Notifications', 'Notices', 'Notice Board'] },
    { key: 'fees', labels: ['Fees', 'Fee Details'] }
];

const REGISTRATION_SELECTORS = [
    'input[formcontrolname="userid"]',
    'input[formcontrolname*="user"]',
    'input[formcontrolname*="reg"]',
    'input[name*="reg"]',
    'input[id*="reg"]',
    'input[placeholder*="USER ID"]',
    'input[placeholder*="User ID"]',
    'input[placeholder*="Registration"]',
    'input[placeholder*="registration"]',
    'input[ng-model*="reg"]',
    'input[ng-model*="user"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[type="userid"]',
    'input[type="text"]'
];

const PASSWORD_SELECTORS = [
    'input[formcontrolname="password"]',
    'input[formcontrolname*="pass"]',
    'input[autocomplete="current-password"]',
    'input[type="password"]',
    'input[name*="password"]',
    'input[id*="password"]',
    'input[placeholder*="PASSWORD"]',
    'input[placeholder*="Password"]',
    'input[placeholder*="Pass"]',
    'input[ng-model*="password"]',
    'input[ng-reflect-name*="password"]'
];

const CAPTCHA_SELECTORS = [
    'input[formcontrolname="captcha"]',
    'input[formcontrolname*="captcha"]',
    'input[name*="captcha"]',
    'input[id*="captcha"]',
    'input[placeholder*="Captcha"]',
    'input[placeholder*="CAPTCHA"]',
    'input[placeholder*="text as shown"]',
    'input[placeholder*="Enter"]',
    'input[ng-model*="captcha"]'
];

const LOGIN_ACTION_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[id*="login"]',
    'button[class*="login"]',
    'button[aria-label*="LOGIN" i]',
    'button[ng-click*="login"]',
    'button:has-text("Login")',
    'button:has-text("LOGIN")',
    'button:has-text("Sign In")',
    'button:has-text("Submit")',
    '.btn-primary[type="submit"]',
    '.submit-button',
    '#loginBtn'
];

function isPortalUnreachableError(message = '') {
    return message.includes('net::ERR') ||
        message.includes('Navigation timeout') ||
        message.includes('page.goto: Timeout') ||
        /^Timeout \d+ms exceeded/i.test(message) ||
        message.includes('ECONNREFUSED') ||
        message.includes('ERR_NAME_NOT_RESOLVED') ||
        message.includes('ERR_CONNECTION_TIMED_OUT');
}

function resolveBrowserExecutable() {
    const configuredPath = resolveChromiumExecutablePath(process.env);
    if (configuredPath) {
        return {
            path: configuredPath,
            source: 'env'
        };
    }

    try {
        const bundledPath = chromium.executablePath();
        if (bundledPath && fs.existsSync(bundledPath)) {
            return {
                path: bundledPath,
                source: 'playwright'
            };
        }

        return {
            path: bundledPath || null,
            source: bundledPath ? 'playwright-missing' : 'unknown'
        };
    } catch (_) {
        return {
            path: null,
            source: 'unknown'
        };
    }
}

function buildLaunchArgs(resolvedPortalIp = null) {
    const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--disable-blink-features=AutomationControlled'
    ];

    if (resolvedPortalIp) {
        launchArgs.push(`--host-resolver-rules=MAP ${PORTAL_HOSTNAME} ${resolvedPortalIp},EXCLUDE localhost`);
    }

    return launchArgs;
}

function buildLaunchOptions({ executablePath = null, resolvedPortalIp = null } = {}) {
    return {
        executablePath: executablePath || undefined,
        headless: true,
        args: buildLaunchArgs(resolvedPortalIp),
        ignoreDefaultArgs: ['--enable-automation']
    };
}

async function getRuntimeDiagnostics({ force = false } = {}) {
    const cacheAge = Date.now() - runtimeDiagnosticsCache.checkedAt;
    // Use a shorter TTL for failure states so a transient crash doesn't block the
    // feature for the whole 10-minute window.
    const ttl = runtimeDiagnosticsCache.ready === false
        ? RUNTIME_DIAGNOSTICS_FAILURE_TTL
        : RUNTIME_DIAGNOSTICS_TTL;
    if (!force && runtimeDiagnosticsCache.ready !== null && cacheAge < ttl) {
        return decorateRuntimeDiagnostics(runtimeDiagnosticsCache);
    }

    if (!force && runtimeDiagnosticsPromise) {
        const runtime = await runtimeDiagnosticsPromise;
        return decorateRuntimeDiagnostics(runtime);
    }

    runtimeDiagnosticsPromise = (async () => {
        const executable = resolveBrowserExecutable();

        if (!executable.path) {
            runtimeDiagnosticsCache = {
                ready: false,
                checkedAt: Date.now(),
                executablePath: null,
                executableSource: executable.source,
                message: 'SOA import is temporarily unavailable on this server because Chromium is not installed in the deployment runtime.',
                code: 'MISSING_EXECUTABLE'
            };
            return runtimeDiagnosticsCache;
        }

        let browser = null;

        try {
            browser = await chromium.launch(buildLaunchOptions({
                executablePath: executable.path
            }));

            const page = await browser.newPage();
            await page.setContent('<html><body>runtime-ok</body></html>');

            runtimeDiagnosticsCache = {
                ready: true,
                checkedAt: Date.now(),
                executablePath: executable.path,
                executableSource: executable.source,
                message: 'SOA browser runtime is ready.',
                code: null
            };
            return runtimeDiagnosticsCache;
        } catch (error) {
            const runtimeIssue = detectBrowserRuntimeIssue(error?.message || '');
            runtimeDiagnosticsCache = {
                ready: false,
                checkedAt: Date.now(),
                executablePath: executable.path,
                executableSource: executable.source,
                message: runtimeIssue.userMessage || 'SOA import is temporarily unavailable on this server. Please try again shortly.',
                code: runtimeIssue.code || 'UNKNOWN'
            };
            return runtimeDiagnosticsCache;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
            runtimeDiagnosticsPromise = null;
        }
    })();

    const runtime = await runtimeDiagnosticsPromise;
    return decorateRuntimeDiagnostics(runtime);
}

function buildScraperErrorResponse(error, fallbackMessage) {
    const message = String(error?.message || '');
    const runtimeIssue = detectBrowserRuntimeIssue(message);

    if (error?.code === 'BLOCKED_BY_SITE' || /cf-mitigated|challenges\.cloudflare\.com|just a moment/i.test(message)) {
        return {
            status: STATUS_BLOCKED_BY_SITE,
            message: 'The SOA portal is currently blocking automated access (bot protection). Please try again later or use demo data.'
        };
    }

    if (message.includes('page.goto: Timeout') || /^Timeout \d+ms exceeded/i.test(message)) {
        return {
            status: STATUS_PORTAL_UNREACHABLE,
            message: 'SOA website is currently offline or taking too long to respond. Please try again later.'
        };
    }

    if (isPortalUnreachableError(message)) {
        return {
            status: STATUS_PORTAL_UNREACHABLE,
            message: 'SOA website is currently offline. Please try again later.'
        };
    }

    if (runtimeIssue.isRuntimeError) {
        return {
            status: STATUS_RUNTIME_UNAVAILABLE,
            message: runtimeIssue.userMessage || 'SOA import is temporarily unavailable on this server. Please try again shortly.'
        };
    }

    return {
        status: STATUS_SCRAPE_ERROR,
        message: fallbackMessage
    };
}

function hasTextValue(value) {
    const text = String(value || '').trim();
    return Boolean(text) && !/^(-+|n\/a|na|null|undefined)$/i.test(text);
}

function hasSnapshotContent(snapshot) {
    return Boolean(
        snapshot &&
        ((Array.isArray(snapshot.tables) && snapshot.tables.length) ||
            (snapshot.fields && Object.keys(snapshot.fields).length))
    );
}

function rawSectionsHaveContent(rawSections) {
    if (!rawSections || typeof rawSections !== 'object') return false;
    return Object.values(rawSections).some((snapshot) => hasSnapshotContent(snapshot));
}

function hasMeaningfulPortalData(normalized) {
    if (!normalized || typeof normalized !== 'object') return false;

    return Boolean(
        hasTextValue(normalized.profile?.studentName) ||
        hasTextValue(normalized.profile?.registrationNumber) ||
        hasTextValue(normalized.profile?.enrollmentNumber) ||
        hasTextValue(normalized.profile?.branch) ||
        hasTextValue(normalized.profile?.program) ||
        (Array.isArray(normalized.qualifications) && normalized.qualifications.length) ||
        (Array.isArray(normalized.attendance?.records) && normalized.attendance.records.length) ||
        (Array.isArray(normalized.marks?.records) && normalized.marks.records.length) ||
        rawSectionsHaveContent(normalized.rawSections)
    );
}

async function isLoginFormStillVisible(page) {
    const selectors = [
        ...PASSWORD_SELECTORS,
        ...CAPTCHA_SELECTORS,
        ...REGISTRATION_SELECTORS
    ];

    for (const selector of selectors) {
        try {
            const element = page.locator(selector).first();
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) return true;
        } catch (_) {
            // Keep checking.
        }
    }

    return false;
}

async function fillFirstVisibleField(page, selectors, value, label) {
    for (const selector of selectors) {
        try {
            const element = page.locator(selector).first();
            const isVisible = await element.isVisible().catch(() => false);
            if (!isVisible) continue;
            await element.fill(value);
            console.log(`[SOA Scraper] Filled ${label} field with selector: ${selector}`);
            return selector;
        } catch (_) {
            // Try next selector.
        }
    }

    return null;
}

async function clickFirstVisibleAction(page, selectors, label) {
    for (const selector of selectors) {
        try {
            const element = page.locator(selector).first();
            const isVisible = await element.isVisible().catch(() => false);
            if (!isVisible) continue;
            const isDisabled = await element.isDisabled().catch(() => false);
            if (isDisabled) continue;
            await element.click();
            console.log(`[SOA Scraper] Clicked ${label} with selector: ${selector}`);
            return selector;
        } catch (_) {
            // Try next selector.
        }
    }

    return null;
}

async function collectVisibleInputDiagnostics(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('input,button'))
        .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .slice(0, 20)
        .map((element) => ({
            tag: element.tagName,
            type: element.getAttribute('type'),
            formcontrolname: element.getAttribute('formcontrolname'),
            id: element.getAttribute('id'),
            name: element.getAttribute('name'),
            placeholder: element.getAttribute('placeholder'),
            ariaLabel: element.getAttribute('aria-label'),
            text: element.tagName === 'BUTTON' ? element.innerText.trim().slice(0, 80) : null
        })));
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return `soa_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cleanup expired sessions
 */
async function cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessionIds = [];
    for (const [sessionId, session] of activeSessions) {
        if (now - session.createdAt > SESSION_EXPIRY) {
            console.log(`[SOA Scraper] Cleaning up expired session: ${sessionId}`);
            expiredSessionIds.push(sessionId);
            continue;
        }

        const lastActive = session.lastActivity || session.createdAt;
        if (now - lastActive > SESSION_IDLE_EXPIRY) {
            console.log(`[SOA Scraper] Cleaning up idle session: ${sessionId}`);
            expiredSessionIds.push(sessionId);
        }
    }

    await Promise.allSettled(expiredSessionIds.map((sessionId) => closeSession(sessionId)));
    return expiredSessionIds.length;
}

// Start cleanup interval
const sessionCleanupTimer = setInterval(() => {
    cleanupExpiredSessions().catch((error) => {
        console.error('[SOA Scraper] Error cleaning up expired sessions:', error.message);
    });
}, SESSION_CLEANUP_INTERVAL);
if (typeof sessionCleanupTimer?.unref === 'function') {
    sessionCleanupTimer.unref();
}

/**
 * Close and cleanup a session
 */
async function closeSession(sessionId, { userId } = {}) {
    const session = activeSessions.get(sessionId);
    if (!session) {
        return { closed: false };
    }

    // Sessions created without a bound user (or internal cleanup calls) always close.
    if (userId !== undefined && userId !== null && session.userId && session.userId !== userId) {
        console.warn(`[SOA Scraper] Refusing to close session ${sessionId}: owned by a different user`);
        return { closed: false, reason: 'not_owner' };
    }

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
    return { closed: true };
}

async function waitForPortalUpdate(page, delay = 1200) {
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(delay);
}

function createBlockedBySiteError() {
    const error = new Error('The SOA portal blocked this session behind Cloudflare bot protection (cf-mitigated managed challenge).');
    error.code = 'BLOCKED_BY_SITE';
    return error;
}

function isCloudflareResponse(response) {
    if (!response || typeof response.status !== 'function') return false;
    try {
        const headers = typeof response.headers === 'function' ? response.headers() : null;
        const cfMitigated = String(headers?.['cf-mitigated'] || '').toLowerCase();
        return response.status() === 403 || cfMitigated.includes('challenge');
    } catch (_) {
        return false;
    }
}

async function detectCloudflareChallenge(page) {
    try {
        const evidence = await page.evaluate(() => {
            const markers = [];
            if (document.querySelector('iframe[src*="challenges.cloudflare.com"], #challenge-form, #challenge-stage, #challenge-error-text, .cf-turnstile, #cf-turnstile, #cf-challenge-running')) {
                markers.push('challenge-dom');
            }
            if (typeof window._cf_chl_opt === 'object' && window._cf_chl_opt !== null) {
                markers.push('chl-opt');
            }
            return {
                title: document.title || '',
                body: document.body ? String(document.body.innerText || '').slice(0, 4000) : '',
                markers
            };
        });

        if (!evidence) {
            return false;
        }

        if (Array.isArray(evidence.markers) && evidence.markers.length) {
            return true;
        }

        return CLOUDFLARE_CHALLENGE_PATTERN.test(`${evidence.title} ${evidence.body}`);
    } catch (_) {
        return false;
    }
}

async function waitForCloudflareClearance(page) {
    console.warn('[SOA Scraper] Cloudflare challenge detected; waiting for automatic clearance');
    const deadline = Date.now() + CHALLENGE_CLEAR_TIMEOUT;
    let reloaded = false;

    while (Date.now() < deadline) {
        await page.waitForTimeout(2500);
        if (!(await detectCloudflareChallenge(page))) {
            console.log('[SOA Scraper] Cloudflare challenge cleared');
            return true;
        }
        if (!reloaded && Date.now() >= deadline - CHALLENGE_CLEAR_TIMEOUT / 2) {
            reloaded = true;
            console.log('[SOA Scraper] Reloading portal once to retry Cloudflare clearance');
            await page.reload({
                waitUntil: 'domcontentloaded',
                timeout: NAVIGATION_TIMEOUT
            }).catch(() => {});
        }
    }

    return !(await detectCloudflareChallenge(page));
}

async function waitForPortalShell(page, timeout = PORTAL_READY_TIMEOUT) {
    const loginShellSelector = [
        REGISTRATION_SELECTORS[0],
        'input[placeholder*="USER ID"]',
        CAPTCHA_SELECTORS[0],
        'input[placeholder*="text as shown"]',
        'form',
        'button',
        'img'
    ].join(',');

    await Promise.race([
        page.waitForSelector(loginShellSelector, { timeout }),
        page.waitForFunction(() => {
            const bodyText = document.body?.innerText || '';
            return (
                document.readyState !== 'loading' &&
                (
                    document.querySelector('input, form, button, img') ||
                    /campusportal|student portal|welcome to soa|welcome to student portal/i.test(bodyText)
                )
            );
        }, { timeout })
    ]).catch(() => {});

    await page.waitForFunction(({ minWidth, minHeight }) => {
        const isVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const registrationInput = Array.from(document.querySelectorAll('input')).find((input) => {
            const joined = [
                input.id,
                input.name,
                input.placeholder,
                input.getAttribute('formcontrolname'),
                input.getAttribute('aria-label')
            ].join(' ');
            return /userid|user id|registration/i.test(joined);
        });

        const captchaInput = Array.from(document.querySelectorAll('input')).find((input) => {
            const joined = [
                input.id,
                input.name,
                input.placeholder,
                input.getAttribute('formcontrolname'),
                input.getAttribute('aria-label')
            ].join(' ');
            return /captcha|text as shown|verification/i.test(joined);
        });

        const inlineCaptchaImage = Array.from(document.querySelectorAll('img')).find((img) => {
            const src = String(img.currentSrc || img.src || '');
            const rect = img.getBoundingClientRect();
            return (
                isVisible(img) &&
                src.startsWith('data:image') &&
                rect.width >= minWidth &&
                rect.height >= minHeight
            );
        });

        return Boolean(registrationInput && captchaInput && inlineCaptchaImage);
    }, {
        minWidth: CAPTCHA_IMAGE_DIMENSIONS.minWidth,
        minHeight: CAPTCHA_IMAGE_DIMENSIONS.minHeight
    }, { timeout }).catch(() => {});

    await page.waitForTimeout(1200);
}

async function probePortalUrl(url, timeout = 12000) {
    const portalLookup = await createPortalLookup();

    return new Promise((resolve) => {
        const request = https.get(url, {
            timeout,
            lookup: portalLookup,
            headers: {
                'User-Agent': SOA_USER_AGENT
            }
        }, (response) => {
            response.resume();
            const cfMitigated = String(response.headers['cf-mitigated'] || '').toLowerCase();
            const blockedByBotProtection = response.statusCode === 403 || cfMitigated.includes('challenge');
            if (blockedByBotProtection) {
                console.warn(`[SOA Scraper] Probe of ${url} returned status ${response.statusCode} behind bot protection${cfMitigated ? ` (${cfMitigated})` : ''}`);
            }
            resolve({
                reachable: true,
                statusCode: response.statusCode,
                url,
                blockedByBotProtection
            });
        });

        request.on('timeout', () => {
            request.destroy(new Error('timeout'));
        });

        request.on('error', (error) => {
            resolve({
                reachable: false,
                statusCode: null,
                url,
                error: error.message
            });
        });
    });
}

async function checkPortalReachability() {
    for (const url of PORTAL_ENTRY_URLS) {
        const result = await probePortalUrl(url);
        if (result.reachable) {
            return result;
        }
    }

    return {
        reachable: false,
        url: PORTAL_ENTRY_URLS[0],
        error: 'timeout'
    };
}

async function resolvePortalIpAddress() {
    const cacheAge = Date.now() - resolvedPortalIpCache.resolvedAt;
    if (resolvedPortalIpCache.value && cacheAge < 15 * 60 * 1000) {
        return resolvedPortalIpCache.value;
    }

    const resolver = new dns.Resolver();
    resolver.setServers(PORTAL_DNS_SERVERS);

    const addresses = await new Promise((resolve, reject) => {
        resolver.resolve4(PORTAL_HOSTNAME, (error, records) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(records || []);
        });
    }).catch(() => []);

    const address = Array.isArray(addresses) && addresses.length ? addresses[0] : null;
    if (address) {
        resolvedPortalIpCache.value = address;
        resolvedPortalIpCache.resolvedAt = Date.now();
    }

    return address;
}

async function createPortalLookup() {
    // DNS pinning backfires behind Cloudflare (stale IPs poison the session),
    // so it only applies when explicitly opted in via SOA_PIN_DNS=1.
    if (!SOA_PIN_DNS_ENABLED) {
        return (hostname, options, callback) => dns.lookup(hostname, options, callback);
    }

    const fallbackAddress = await resolvePortalIpAddress();
    return (hostname, options, callback) => {
        if (hostname !== PORTAL_HOSTNAME || !fallbackAddress) {
            return dns.lookup(hostname, options, callback);
        }

        const family = typeof options === 'number' ? options : options?.family || 4;
        callback(null, fallbackAddress, family || 4);
    };
}

async function navigateToPortal(page) {
    let lastError = null;
    const attempts = [
        { waitUntil: 'commit', timeout: 15000, label: 'commit' },
        { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT, label: 'domcontentloaded' },
        { waitUntil: 'load', timeout: TIMEOUT, label: 'load' }
    ];

    for (const url of PORTAL_ENTRY_URLS.slice(0, 2)) {
        for (const attempt of attempts) {
            try {
                console.log(`[SOA Scraper] Portal navigation attempt to ${url} with waitUntil=${attempt.label}`);
                const response = await page.goto(url, {
                    waitUntil: attempt.waitUntil,
                    timeout: attempt.timeout
                });
                await waitForPortalShell(page);
                if (isCloudflareResponse(response) || await detectCloudflareChallenge(page)) {
                    if (!(await waitForCloudflareClearance(page))) {
                        throw createBlockedBySiteError();
                    }
                    await waitForPortalShell(page, 10000);
                }
                return true;
            } catch (error) {
                lastError = error;
                console.warn(`[SOA Scraper] Portal navigation attempt (${attempt.label}) for ${url} failed: ${error.message}`);
            }
        }
    }

    throw lastError || new Error('SOA portal did not load');
}

async function getCaptchaWithRetry(page) {
    await waitForPortalShell(page, 12000);

    let captchaImage = await extractCaptchaImage(page);
    if (captchaImage) {
        return captchaImage;
    }

    console.warn('[SOA Scraper] CAPTCHA not found after initial portal load, waiting for portal shell');
    await waitForPortalShell(page, 10000);
    captchaImage = await extractCaptchaImage(page);
    if (captchaImage) {
        return captchaImage;
    }

    console.warn('[SOA Scraper] CAPTCHA not found yet, waiting briefly for delayed image rendering');
    await page.waitForTimeout(1500).catch(() => {});
    captchaImage = await extractCaptchaImage(page);
    if (captchaImage) {
        return captchaImage;
    }

    if (await detectCloudflareChallenge(page)) {
        if (!(await waitForCloudflareClearance(page))) {
            throw createBlockedBySiteError();
        }
        await waitForPortalShell(page, 10000);
        return extractCaptchaImage(page);
    }

    console.warn('[SOA Scraper] CAPTCHA still not found, reloading portal once');
    await page.reload({
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT
    }).catch(() => {});
    await waitForPortalShell(page, 10000);

    return extractCaptchaImage(page);
}

async function clickPortalLabel(page, labels = []) {
    const selectors = [
        ['tab', page.getByRole.bind(page, 'tab')],
        ['link', page.getByRole.bind(page, 'link')],
        ['button', page.getByRole.bind(page, 'button')]
    ];

    for (const label of labels) {
        const exactExpression = new RegExp(`^\\s*${escapeRegex(label)}\\s*$`, 'i');
        const looseExpression = new RegExp(escapeRegex(label), 'i');

        for (const [, getByRole] of selectors) {
            try {
                const locator = getByRole({ name: exactExpression }).first();
                const isVisible = await locator.isVisible().catch(() => false);
                if (!isVisible) continue;
                await locator.click({ timeout: 5000 });
                await waitForPortalUpdate(page);
                return true;
            } catch (_) {
                // Try the next selector.
            }
        }

        try {
            const locator = page
                .locator('a,button,[role="tab"],[role="button"],li,span,div,.mat-list-item,.mat-expansion-panel-header,.mat-menu-item')
                .filter({ hasText: looseExpression })
                .first();
            const isVisible = await locator.isVisible().catch(() => false);
            if (!isVisible) continue;
            await locator.click({ timeout: 5000 });
            await waitForPortalUpdate(page);
            return true;
        } catch (_) {
            // Try the next label.
        }
    }

    return false;
}

async function openPortalSection(page, section) {
    let openedAny = false;

    if (section?.route) {
        const targetUrl = section.route.startsWith('http')
            ? section.route
            : `https://soaportals.com/StudentPortalSOA/${section.route.replace(/^\/+/, '')}`;

        try {
            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: NAVIGATION_TIMEOUT
            });
            await waitForPortalUpdate(page, 1200);
            const fragment = section.route.replace(/^#\/?/, '').split('/').pop().toLowerCase();
            if (fragment) {
                await page.waitForFunction((frag) => (location.hash || '').toLowerCase().includes(frag), fragment, { timeout: 4000 }).catch(() => {});
            }
            openedAny = true;
        } catch (_) {
            // Fall back to label-based navigation below.
        }
    }

    if (Array.isArray(section?.path) && section.path.length) {
        for (const step of section.path) {
            const labels = Array.isArray(step) ? step : [step];
            const opened = await clickPortalLabel(page, labels);
            if (!opened) {
                return openedAny;
            }
            openedAny = true;
        }

        return openedAny;
    }

    const opened = await clickPortalLabel(page, section?.labels || []);
    return openedAny || opened;
}

async function selectNativeOptions(page) {
    const selects = await page.locator('select').all();
    let selectedAny = false;

    for (const select of selects) {
        const isVisible = await select.isVisible().catch(() => false);
        if (!isVisible) continue;

        const options = await select.locator('option').evaluateAll((nodes) => nodes.map((option) => ({
            value: option.value,
            text: option.textContent?.trim() || ''
        }))).catch(() => []);

        const choice = options.find((option) => option.value && !/select|choose/i.test(option.text));
        if (!choice) continue;

        await select.selectOption(choice.value).catch(() => {});
        selectedAny = true;
    }

    return selectedAny;
}

async function selectMaterialOptions(page) {
    const triggers = await page.locator('.mat-select-trigger,[role="combobox"]').all();
    let selectedAny = false;

    for (const trigger of triggers) {
        const isVisible = await trigger.isVisible().catch(() => false);
        if (!isVisible) continue;

        try {
            await trigger.click({ timeout: 3000 });
            await page.waitForTimeout(400);

            const options = page.locator('mat-option,[role="option"],.mat-option');
            const optionCount = await options.count().catch(() => 0);
            if (!optionCount) {
                await page.keyboard.press('Escape').catch(() => {});
                continue;
            }

            let clicked = false;
            for (let index = 0; index < optionCount; index += 1) {
                const option = options.nth(index);
                const text = await option.textContent().catch(() => '');
                if (!text || /select|choose/i.test(text)) continue;
                await option.click({ timeout: 3000 }).catch(() => {});
                clicked = true;
                selectedAny = true;
                break;
            }

            if (!clicked) {
                await page.keyboard.press('Escape').catch(() => {});
            } else {
                await page.waitForTimeout(300);
            }
        } catch (_) {
            await page.keyboard.press('Escape').catch(() => {});
        }
    }

    return selectedAny;
}

async function prepareSectionForCapture(page, section) {
    if (!section?.key || !['attendance', 'timetable', 'admitCard'].includes(section.key)) {
        return;
    }

    const selectedNative = await selectNativeOptions(page);
    const selectedMaterial = await selectMaterialOptions(page);

    if (!selectedNative && !selectedMaterial) {
        return;
    }

    const submitted = await clickFirstVisibleAction(page, [
        'button:has-text("Submit")',
        'button[aria-label*="Submit" i]',
        'button[type="submit"]',
        '.submit-button'
    ], `${section.key} submit button`);

    if (submitted) {
        await waitForPortalUpdate(page, 2500);
    }
}

async function captureSectionSnapshot(page, sectionName) {
    return page.evaluate((key) => {
        const clean = (value) => {
            if (value === null || value === undefined) return null;
            const text = String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
            return text || null;
        };

        const isVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0
            );
        };

        const fields = {};
        const addField = (label, value) => {
            const cleanedLabel = clean(label);
            const cleanedValue = clean(value);
            if (!cleanedLabel || !cleanedValue) return;
            if (cleanedLabel.length > 80 || cleanedValue.length > 300) return;
            if (!fields[cleanedLabel]) {
                fields[cleanedLabel] = cleanedValue;
                return;
            }

            if (fields[cleanedLabel] === cleanedValue) return;

            let duplicateIndex = 2;
            while (fields[`${cleanedLabel} ${duplicateIndex}`]) {
                duplicateIndex += 1;
            }
            fields[`${cleanedLabel} ${duplicateIndex}`] = cleanedValue;
        };

        const getFormFieldLabel = (input) => {
            if (!input) return null;

            const inputId = input.getAttribute('id');
            if (inputId) {
                const directLabel = document.querySelector(`label[for="${inputId}"]`);
                if (directLabel && isVisible(directLabel)) {
                    return clean(directLabel.textContent);
                }
            }

            const matField = input.closest('.mat-form-field, mat-form-field, .form-group, .form-field, td, th, .row, .col, .card, .panel');
            if (matField) {
                const candidateSelectors = [
                    '.mat-form-field-label',
                    'mat-label',
                    'label',
                    '.control-label',
                    '.form-label',
                    'th',
                    'strong',
                    'span'
                ];

                for (const selector of candidateSelectors) {
                    const candidates = Array.from(matField.querySelectorAll(selector)).filter(isVisible);
                    for (const candidate of candidates) {
                        if (candidate === input || candidate.contains(input)) continue;
                        const candidateText = clean(candidate.textContent);
                        if (candidateText && candidateText.length <= 80) {
                            return candidateText;
                        }
                    }
                }
            }

            const previous = input.previousElementSibling;
            if (previous && isVisible(previous)) {
                const previousText = clean(previous.textContent);
                if (previousText && previousText.length <= 80) {
                    return previousText;
                }
            }

            return clean(input.getAttribute('placeholder'));
        };

        const getFieldValue = (input) => {
            if (!input) return null;

            if (input.tagName === 'SELECT') {
                const selectedOption = input.selectedOptions?.[0];
                return clean(selectedOption?.textContent || input.value);
            }

            if (input.type === 'checkbox' || input.type === 'radio') {
                return input.checked ? 'Yes' : null;
            }

            return clean(input.value || input.textContent);
        };

        Array.from(document.querySelectorAll('label')).forEach((label) => {
            if (!isVisible(label)) return;
            const forId = label.getAttribute('for');
            if (forId) {
                const target = document.getElementById(forId);
                const value = target?.value || target?.textContent;
                addField(label.textContent, value);
            }
        });

        Array.from(document.querySelectorAll('dt')).forEach((dt) => {
            if (!isVisible(dt)) return;
            const dd = dt.nextElementSibling;
            addField(dt.textContent, dd?.textContent);
        });

        Array.from(document.querySelectorAll('tr')).forEach((row) => {
            if (!isVisible(row)) return;
            const cells = Array.from(row.querySelectorAll('th,td')).filter(isVisible);
            if (cells.length !== 2) return;
            addField(cells[0].innerText, cells[1].innerText);
        });

        Array.from(document.querySelectorAll('strong,b')).forEach((node) => {
            if (!isVisible(node)) return;
            const parent = node.parentElement;
            if (!parent || !isVisible(parent)) return;
            const label = clean(node.textContent);
            const parentText = clean(parent.innerText);
            if (!label || !parentText || parentText === label) return;
            addField(label, parentText.replace(label, '').replace(/^[:\s-]+/, ''));
        });

        Array.from(document.querySelectorAll('div,p,span,li')).forEach((element) => {
            if (!isVisible(element)) return;
            const text = clean(element.innerText);
            if (!text) return;
            const match = text.match(/^([^:]{2,80}):\s*(.+)$/);
            if (match) {
                addField(match[1], match[2]);
            }

            if (element.closest('table')) return;

            const lines = String(element.innerText || '')
                .split(/\n+/)
                .map((line) => clean(line))
                .filter(Boolean);

            if (lines.length < 2 || lines.length > 4) return;

            const label = lines[0];
            const value = lines.slice(1).join(' ');
            if (!label || !value) return;
            if (label.length > 80 || value.length > 220) return;
            if (/^(welcome|note|powered by|student|personal information|class time table|attendance view|my result|my admit card)$/i.test(label)) {
                return;
            }

            addField(label, value);
        });

        Array.from(document.querySelectorAll('input,textarea,select')).forEach((input) => {
            if (!isVisible(input)) return;
            const value = getFieldValue(input);
            const label = getFormFieldLabel(input);
            addField(label, value);
        });

        const tables = Array.from(document.querySelectorAll('table'))
            .filter(isVisible)
            .map((table) => {
                const rows = Array.from(table.querySelectorAll('tr')).filter(isVisible);
                if (!rows.length) return null;

                const headers = Array.from(rows[0].querySelectorAll('th,td'))
                    .map((cell) => clean(cell.innerText) || '')
                    .filter(Boolean);

                const bodyRows = rows.slice(1).map((row) =>
                    Array.from(row.querySelectorAll('td,th'))
                        .map((cell) => clean(cell.innerText) || '')
                        .filter((cell) => cell !== '')
                ).filter((row) => row.length);

                if (!headers.length && !bodyRows.length) {
                    return null;
                }

                const titleNode = table.closest('.card,.panel,.tab-pane,section,div')?.querySelector('h1,h2,h3,h4,h5,h6');

                return {
                    title: clean(titleNode?.innerText),
                    headers,
                    rows: bodyRows
                };
            })
            .filter(Boolean);

        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
            .filter(isVisible)
            .slice(0, 12)
            .map((heading) => clean(heading.innerText))
            .filter(Boolean);

        return {
            sectionName: key,
            url: window.location.href,
            title: clean(document.title),
            headings,
            fields,
            tables,
            pageText: clean(document.body.innerText)?.slice(0, 40000) || ''
        };
    }, sectionName);
}

async function collectSectionSnapshots(page, onProgress = null) {
    const sections = {
        default: await captureSectionSnapshot(page, 'default')
    };

    for (const section of SECTION_NAVIGATION) {
        emitScrapeProgress(onProgress, 'fetching-sections', section.key);
        const opened = await openPortalSection(page, section);
        if (!opened) continue;
        await prepareSectionForCapture(page, section);
        let snapshot = await captureSectionSnapshot(page, section.key);

        if (!hasSnapshotContent(snapshot)) {
            // The SPA sometimes needs a second navigation pass before the section
            // actually renders; keep the richer of the two captures.
            const reopened = await openPortalSection(page, section);
            if (reopened) {
                await prepareSectionForCapture(page, section);
                await waitForPortalUpdate(page, 1500);
                const retried = await captureSectionSnapshot(page, section.key);
                if (hasSnapshotContent(retried)) {
                    snapshot = retried;
                }
            }
        }

        sections[section.key] = snapshot;
    }

    return sections;
}

/**
 * Create a new browser session and get CAPTCHA
 * @param {Object} [options] Optional options object
 * @param {string} [options.userId] Owner of the created session
 * @returns {Promise<Object>} Session info with captcha image
 */
async function createSessionAndGetCaptcha(options = {}) {
    const userId = options?.userId || null;
    let browser = null;
    let context = null;
    let page = null;
    const sessionId = generateSessionId();

    try {
        console.log(`[SOA Scraper] Creating new session: ${sessionId}`);

        await cleanupExpiredSessions();
        const sessionCapacity = getSessionCapacitySnapshot();
        if (!sessionCapacity.hasCapacity) {
            return {
                success: false,
                status: STATUS_SCRAPER_BUSY,
                message: `SOA import is temporarily busy. ${sessionCapacity.activeSessionCount}/${sessionCapacity.maxActiveSessions} browser sessions are already active. Please wait a minute and try again.`,
                retryAfterSeconds: 60,
                ...sessionCapacity
            };
        }

        // Reserve a pool slot for the whole launch sequence so concurrent requests
        // cannot race past the cap while browsers are still spinning up.
        pendingSessionLaunches += 1;
        try {
            const runtimeDiagnostics = await getRuntimeDiagnostics();
            if (!runtimeDiagnostics.ready) {
                return {
                    success: false,
                    status: STATUS_RUNTIME_UNAVAILABLE,
                    message: runtimeDiagnostics.message,
                    runtime: runtimeDiagnostics
                };
            }

            // Run the lightweight HTTPS reachability probe in the background so it never
            // adds visible latency to the user's "Start SOA session" action.
            checkPortalReachability()
                .then((reachability) => {
                    if (!reachability.reachable) {
                        console.warn(`[SOA Scraper] Portal reachability check failed: ${reachability.error || 'unknown error'}`);
                        console.warn('[SOA Scraper] Continuing with browser attempt despite failed reachability check');
                    } else if (reachability.blockedByBotProtection) {
                        console.warn(`[SOA Scraper] Portal responded at ${reachability.url} (status ${reachability.statusCode}) behind Cloudflare bot protection; continuing with browser attempt`);
                    } else {
                        console.log(`[SOA Scraper] Portal reachable via ${reachability.url} (status ${reachability.statusCode || 'unknown'})`);
                    }
                })
                .catch((error) => {
                    console.warn(`[SOA Scraper] Portal reachability check error: ${error.message}`);
                });

            // Opt-in only: pinning the portal IP breaks sessions behind Cloudflare
            // when the edge IP rotates (default OFF, enable with SOA_PIN_DNS=1).
            const resolvedPortalIp = SOA_PIN_DNS_ENABLED ? await resolvePortalIpAddress() : null;
            if (resolvedPortalIp) {
                console.log(`[SOA Scraper] Resolved ${PORTAL_HOSTNAME} via public DNS (pinning enabled): ${resolvedPortalIp}`);
            }

            browser = await chromium.launch(buildLaunchOptions({
                executablePath: runtimeDiagnostics.executablePath,
                resolvedPortalIp
            }));

            context = await browser.newContext({
                viewport: { width: 1366, height: 768 },
                userAgent: SOA_USER_AGENT,
                locale: 'en-US',
                timezoneId: 'Asia/Kolkata'
            });

            page = await context.newPage();
            page.setDefaultTimeout(15000);
            page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

            // Navigate to portal
            console.log(`[SOA Scraper] Navigating to portal: ${PORTAL_URL}`);
            await navigateToPortal(page);

            // Extract CAPTCHA image
            const captchaImage = await getCaptchaWithRetry(page);

            if (!captchaImage) {
                if (page && await detectCloudflareChallenge(page)) {
                    throw createBlockedBySiteError();
                }
                throw new Error('Could not extract CAPTCHA image from portal');
            }

            // Store session
            activeSessions.set(sessionId, {
                browser,
                context,
                page,
                captchaImage,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                userId
            });

            console.log(`[SOA Scraper] Session created successfully: ${sessionId}`);

            return {
                success: true,
                status: STATUS_CAPTCHA_REQUIRED,
                sessionId,
                captchaImage,
                message: 'CAPTCHA extracted. Please solve and submit with credentials.'
            };
        } finally {
            pendingSessionLaunches -= 1;
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error creating session:`, error.message);

        // Cleanup on error
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        const failure = buildScraperErrorResponse(
            error,
            'We could not start the SOA portal session. Please try again.'
        );

        return {
            success: false,
            status: failure.status,
            message: failure.message,
            runtime: failure.status === STATUS_RUNTIME_UNAVAILABLE ? await getRuntimeDiagnostics({ force: true }) : undefined
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
            'img[src^="data:image"]',
            'img[class*="verify"]',
            'img[aria-label*="captcha" i]',
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

        // Try to infer CAPTCHA image by attributes, dimensions, and proximity to captcha input
        const imageSearch = await page.evaluate(() => {
            const isVisible = (element) => {
                if (!element) return false;
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            };

            const containsVerificationHint = (text) => /captcha|text as shown|verification/i.test(String(text || ''));

            const inputs = Array.from(document.querySelectorAll('input'));
            const captchaInput = inputs.find((input) => {
                const joinedText = [
                    input.id,
                    input.name,
                    input.placeholder,
                    input.getAttribute('formcontrolname'),
                    input.getAttribute('aria-label')
                ].join(' ');
                return containsVerificationHint(joinedText);
            });
            const captchaRect = captchaInput?.getBoundingClientRect?.() || null;

            const images = Array.from(document.querySelectorAll('img')).map((img, index) => ({
                index,
                src: img.src,
                id: img.id,
                className: img.className,
                alt: img.alt,
                visible: isVisible(img),
                width: Math.round(img.getBoundingClientRect().width || img.width || 0),
                height: Math.round(img.getBoundingClientRect().height || img.height || 0),
                top: Math.round(img.getBoundingClientRect().top || 0),
                left: Math.round(img.getBoundingClientRect().left || 0)
            }));

            return {
                hasCaptchaInput: Boolean(captchaInput),
                captchaRect: captchaRect
                    ? {
                        top: Math.round(captchaRect.top || 0),
                        left: Math.round(captchaRect.left || 0),
                        right: Math.round(captchaRect.right || 0)
                    }
                    : null,
                images
            };
        });

        const images = Array.isArray(imageSearch?.images) ? imageSearch.images : [];
        console.log(`[SOA Scraper] Found ${images.length} images on page`);

        const prioritized = images
            .filter((img) => img.visible)
            .map((img) => {
                const mergedText = `${img.src || ''} ${img.id || ''} ${img.className || ''} ${img.alt || ''}`.toLowerCase();
                const hasCaptchaHint = mergedText.includes('captcha');
                const hasVerifyHint = mergedText.includes('verify');
                const hasInlineImage = mergedText.startsWith('data:image');
                const looksLikeKnownLogo = /campuslynx|campuslynx-loader|campuslynx-logo|soa\.png|jilit/.test(mergedText);
                let score = 0;

                if (hasCaptchaHint) score += CAPTCHA_HEURISTIC_SCORE.HAS_CAPTCHA_HINT;
                if (hasVerifyHint) score += CAPTCHA_HEURISTIC_SCORE.HAS_VERIFY_HINT;
                if (hasInlineImage) score += CAPTCHA_HEURISTIC_SCORE.HAS_INLINE_IMAGE;
                if (
                    img.width >= CAPTCHA_IMAGE_DIMENSIONS.minWidth &&
                    img.width <= CAPTCHA_IMAGE_DIMENSIONS.maxWidth &&
                    img.height >= CAPTCHA_IMAGE_DIMENSIONS.minHeight &&
                    img.height <= CAPTCHA_IMAGE_DIMENSIONS.maxHeight
                ) {
                    score += CAPTCHA_HEURISTIC_SCORE.CAPTCHA_LIKE_DIMENSIONS;
                }

                if (imageSearch?.captchaRect) {
                    const imageLeft = img.left || 0;
                    const imageRight = imageLeft + (img.width || 0);
                    const verticalDistance = Math.abs((img.top || 0) - imageSearch.captchaRect.top);
                    const nearCaptchaInput = verticalDistance <= MAX_CAPTCHA_INPUT_VERTICAL_DISTANCE;
                    // Require both vertical proximity and horizontal overlap to avoid unrelated banner/logo images.
                    const horizontalOverlap = imageLeft <= imageSearch.captchaRect.right && imageRight >= imageSearch.captchaRect.left;
                    if (nearCaptchaInput && horizontalOverlap) {
                        score += CAPTCHA_HEURISTIC_SCORE.NEAR_CAPTCHA_INPUT;
                    }
                }

                if (looksLikeKnownLogo) {
                    score -= CAPTCHA_HEURISTIC_SCORE.HAS_INLINE_IMAGE;
                }

                return {
                    ...img,
                    score
                };
            })
            .filter((img) => img.score > 0)
            .sort((left, right) => right.score - left.score);

        for (const candidate of prioritized) {
            try {
                const element = page.locator('img').nth(candidate.index);
                const isVisible = await element.isVisible().catch(() => false);
                if (!isVisible) {
                    continue;
                }

                const screenshotBuffer = await element.screenshot({ type: 'png' });
                const base64 = screenshotBuffer.toString('base64');
                console.log(`[SOA Scraper] Extracted CAPTCHA candidate (score=${candidate.score}, idx=${candidate.index})`);
                return `data:image/png;base64,${base64}`;
            } catch (error) {
                console.debug(`[SOA Scraper] Candidate extraction failed (idx=${candidate.index}): ${error.message}`);
                continue;
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
        console.log(`[SOA Scraper] CAPTCHA input detected: ${Boolean(imageSearch?.hasCaptchaInput)}`);
        return null;

    } catch (error) {
        console.error(`[SOA Scraper] Error extracting CAPTCHA:`, error.message);
        return null;
    }
}

function emitScrapeProgress(onProgress, stage, detail) {
    if (typeof onProgress !== 'function') return;
    try {
        onProgress({ stage, detail: detail === undefined ? null : detail });
    } catch (_) {
        return;
    }
}

/**
 * Perform login and scrape data
 * @param {string} sessionId Session ID from CAPTCHA request
 * @param {string} regNo Registration number
 * @param {string} password Password (NOT logged)
 * @param {string} captcha User-provided captcha solution
 * @param {Object} [options] Optional options object
 * @param {Function} [options.onProgress] Fire-and-forget stage callback
 * @param {string} [options.userId] Authenticated owner of the session
 * @returns {Promise<Object>} Scrape result
 */
async function loginAndScrape(sessionId, regNo, password, captcha, options = {}) {
    const onProgress = options && typeof options.onProgress === 'function' ? options.onProgress : null;
    const requestUserId = options?.userId || null;
    const session = activeSessions.get(sessionId);

    if (!session) {
        return {
            success: false,
            status: STATUS_SESSION_EXPIRED,
            message: 'Session expired. Please fetch a new CAPTCHA.'
        };
    }

    if (Date.now() - (session.lastActivity || session.createdAt) > SESSION_EXPIRY) {
        await closeSession(sessionId);
        return {
            success: false,
            status: STATUS_SESSION_EXPIRED,
            message: 'Session expired. Please fetch a new CAPTCHA.'
        };
    }

    if (session.userId && requestUserId && session.userId !== requestUserId) {
        await closeSession(sessionId);
        return {
            success: false,
            status: STATUS_AUTH_FAILED,
            message: 'This SOA session belongs to a different user. Please start a new session.'
        };
    }

    const { browser, page } = session;

    try {
        console.log(`[SOA Scraper] Attempting login for session: ${sessionId}`);

        emitScrapeProgress(onProgress, 'login-start');

        // Fill login form
        const loginSuccess = await performLogin(page, regNo, password, captcha);

        // SECURITY: Clear password from memory
        password = null;

        if (!loginSuccess.success) {
            emitScrapeProgress(onProgress, 'login-failed', loginSuccess.status);
            return {
                success: false,
                status: loginSuccess.status,
                message: loginSuccess.message
            };
        }

        console.log(`[SOA Scraper] Login successful, scraping data...`);
        emitScrapeProgress(onProgress, 'login-ok');

        // Kill the session browser when the crawl exceeds the deadline so stuck scrapes
        // free their pool slot instead of hanging until the full session TTL elapses.
        const deadlineTimer = setTimeout(() => {
            console.warn('[SOA Scraper] Crawl deadline exceeded; killing session browser');
            closeSession(sessionId);
        }, CRAWL_DEADLINE_MS);
        if (typeof deadlineTimer.unref === 'function') deadlineTimer.unref();

        try {
            // Wait for dashboard to load
            await page.waitForTimeout(3000);

            // Scrape all available data
            const studentData = await scrapeAllData(page, onProgress);
            const normalizedData = normalizeSoaPortalData({
                ...studentData,
                loginUserId: regNo,
                portalRegistrationNumber: regNo
            });
            const hasUsableData = hasMeaningfulPortalData(normalizedData);

            if (!hasUsableData) {
                await closeSession(sessionId);
                return {
                    success: false,
                    status: loginSuccess.uncertain ? STATUS_AUTH_FAILED : STATUS_SCRAPE_ERROR,
                    message: loginSuccess.uncertain
                        ? 'SOA login could not be confirmed. Please check your registration number, password, and CAPTCHA, then try again.'
                        : 'SOA login completed but no student data was returned. Please fetch a new CAPTCHA and try again.'
                };
            }

            // Close session after successful scrape
            emitScrapeProgress(onProgress, 'saving');
            await closeSession(sessionId);

            return {
                success: true,
                status: STATUS_SUCCESS,
                message: 'Data fetched successfully from SOA portal',
                data: normalizedData
            };
        } finally {
            clearTimeout(deadlineTimer);
        }

    } catch (error) {
        console.error(`[SOA Scraper] Error during login/scrape:`, error.message);

        // Close session on error
        await closeSession(sessionId);

        const rawMessage = String(error?.message || '');
        if (rawMessage.includes('Target closed') || rawMessage.includes('Session closed')) {
            return {
                success: false,
                status: STATUS_PORTAL_UNREACHABLE,
                message: 'The SOA import took too long and was stopped. Please try again.'
            };
        }

        const failure = buildScraperErrorResponse(
            error,
            'We could not complete the SOA import. Please fetch a new CAPTCHA and try again.'
        );

        return {
            success: false,
            status: failure.status,
            message: failure.message
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
        const initialRegSelector = await fillFirstVisibleField(page, REGISTRATION_SELECTORS, regNo, 'registration');
        const initialPasswordSelector = await fillFirstVisibleField(page, PASSWORD_SELECTORS, password, 'password');
        const initialCaptchaSelector = await fillFirstVisibleField(page, CAPTCHA_SELECTORS, captcha, 'captcha');

        if (!initialRegSelector) {
            console.warn(`[SOA Scraper] Could not find registration field`);
        }
        if (!initialPasswordSelector) {
            console.warn(`[SOA Scraper] Could not find password field`);
        }
        if (!initialCaptchaSelector) {
            console.warn(`[SOA Scraper] Could not find captcha field`);
        }

        let loginClicked = await clickFirstVisibleAction(page, LOGIN_ACTION_SELECTORS, 'login button');

        if (!loginClicked) {
            // Try pressing Enter
            await page.keyboard.press('Enter');
            console.log(`[SOA Scraper] Pressed Enter to submit form`);
            loginClicked = 'keyboard:Enter';
        }

        // Wait for response
        await waitForPortalUpdate(page, 2500);

        let passwordStepSelector = null;
        if (!initialPasswordSelector) {
            passwordStepSelector = await fillFirstVisibleField(page, PASSWORD_SELECTORS, password, 'password');
            if (passwordStepSelector) {
                console.log('[SOA Scraper] Detected password step after initial SOA submit');

                const captchaStillVisible = await fillFirstVisibleField(page, CAPTCHA_SELECTORS, captcha, 'captcha');
                if (captchaStillVisible) {
                    console.log('[SOA Scraper] CAPTCHA field remained visible during password step');
                }

                const passwordStepSubmit = await clickFirstVisibleAction(page, LOGIN_ACTION_SELECTORS, 'password-step submit button');
                if (!passwordStepSubmit) {
                    await page.keyboard.press('Enter');
                    console.log('[SOA Scraper] Pressed Enter to submit password step');
                }

                await waitForPortalUpdate(page, 3000);
            }
        }

        // Check for login success/failure
        const pageContent = await page.content();
        const currentUrl = page.url();
        const loginFormVisible = await isLoginFormStillVisible(page);
        const visibleInputs = await collectVisibleInputDiagnostics(page);
        console.log(`[SOA Scraper] Visible inputs after submit: ${JSON.stringify(visibleInputs)}`);

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
            'wrong captcha',
            'invalid captcha code',
            'captcha is invalid',
            'incorrect captcha',
            'wrong user',
            'user not found',
            'account is locked',
            'account locked',
            'too many attempts',
            'attempts remaining',
            'please try again after'
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
            'welcome',
            'personal information',
            'contact information',
            'qualifications',
            'attendance',
            'marks & results',
            'exam result',
            'logout',
            'log out',
            'sign out',
            'dashboard',
            'my dashboard',
            'class attendance',
            'student result',
            'time table',
            'timetable',
            'registered subjects',
            'personal info'
        ];

        for (const success of successIndicators) {
            if (lowerContent.includes(success) && !loginFormVisible) {
                return { success: true };
            }
        }

        // DOM probe: a visible logout control is the strongest signal the SPA
        // actually authenticated, even when the text checks above miss it.
        const logoutVisible = await page.locator('a,button').filter({ hasText: /log\s?out|sign\s?out/i }).first().isVisible().catch(() => false);
        if (logoutVisible && !loginFormVisible) {
            return { success: true };
        }

        const isBaseLoginRoute = /StudentPortalSOA\/#\/?$/.test(currentUrl);

        // Check if URL changed away from the initial login route.
        if (!loginFormVisible && !isBaseLoginRoute && !currentUrl.includes('login')) {
            return { success: true };
        }

        if (passwordStepSelector && !loginFormVisible) {
            return { success: true };
        }

        if (loginFormVisible) {
            return {
                success: false,
                status: STATUS_AUTH_FAILED,
                message: 'SOA login could not be confirmed. Please check your registration number, password, and CAPTCHA.'
            };
        }

        // If we can't determine login status, return uncertain result
        // The scraper will attempt to extract data and validate success from that
        console.log('[SOA Scraper] Login status uncertain, proceeding to check data extraction');
        return { success: true, uncertain: true };

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
 * @param {Page} page Playwright page
 * @param {Function} [onProgress] Fire-and-forget stage callback
 * @returns {Promise<Object>} Scraped data
 */
async function scrapeAllData(page, onProgress = null) {
    const data = {
        profile: {},
        personalInfo: {},
        contactInfo: {},
        qualifications: [],
        attendance: [],
        marks: [],
        results: [],
        internalAssessments: [],
        timetable: [],
        subjects: [],
        notifications: [],
        backlogs: [],
        fees: {},
        rawHtml: '',
        rawSections: {}
    };

    try {
        // Get current page content
        const pageContent = await page.content();
        emitScrapeProgress(onProgress, 'fetching-sections');
        data.rawSections = await collectSectionSnapshots(page, onProgress);
        data.rawHtml = pageContent;

        // Extract profile information
        emitScrapeProgress(onProgress, 'fetching-profile', 'profile');
        data.profile = await scrapeProfile(page, pageContent);

        // Try to navigate to attendance section and scrape
        emitScrapeProgress(onProgress, 'fetching-attendance', 'attendance');
        data.attendance = await scrapeAttendance(page);

        // Try to navigate to marks section and scrape
        emitScrapeProgress(onProgress, 'fetching-marks', 'marks');
        data.marks = await scrapeMarks(page);

        // Try to scrape internal assessments
        data.internalAssessments = await scrapeInternalAssessments(page);

        // Try to scrape timetable
        emitScrapeProgress(onProgress, 'fetching-timetable', 'timetable');
        data.timetable = await scrapeTimetable(page);

        // Try to scrape subjects list
        data.subjects = await scrapeSubjects(page);

        // Try to scrape notifications
        data.notifications = await scrapeNotifications(page);

        // Add metadata
        data.fetchedAt = new Date().toISOString();
        data.dataSource = 'live_soa_portal';

        const normalized = normalizeSoaPortalData(data);
        data.profile = normalized.profile || data.profile;
        data.personalInfo = normalized.personalInfo || {};
        data.contactInfo = normalized.contactInfo || {};
        data.qualifications = normalized.qualifications || [];
        data.attendance = normalized.attendance?.summary || data.attendance;
        data.marks = normalized.marks?.records || data.marks;
        data.results = normalized.results || [];

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

        if (!profile.photo) {
            profile.photo = await page.evaluate(() => {
                const isVisible = (element) => {
                    if (!element) return false;
                    const style = window.getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width >= 60 && rect.height >= 60;
                };

                const candidates = Array.from(document.querySelectorAll('img'))
                    .filter(isVisible)
                    .map((img) => {
                        const rect = img.getBoundingClientRect();
                        const src = img.getAttribute('src') || '';
                        const alt = (img.getAttribute('alt') || '').toLowerCase();
                        const cls = (img.getAttribute('class') || '').toLowerCase();
                        const id = (img.getAttribute('id') || '').toLowerCase();
                        const haystack = `${src} ${alt} ${cls} ${id}`.toLowerCase();

                        if (haystack.includes('captcha') || haystack.includes('logo') || haystack.includes('icon')) {
                            return null;
                        }

                        if (rect.width > 420 || rect.height > 420) {
                            return null;
                        }

                        return {
                            src: img.src || src,
                            score: rect.width * rect.height
                        };
                    })
                    .filter(Boolean)
                    .sort((left, right) => right.score - left.score);

                return candidates[0]?.src || null;
            }).catch(() => null);
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

        // Update session; the refreshed CAPTCHA must not be instantly evicted as idle.
        session.captchaImage = captchaImage;
        session.lastActivity = Date.now();
        session.createdAt = Date.now();
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
        const failure = buildScraperErrorResponse(
            error,
            'Could not refresh CAPTCHA. Please start a new SOA session.'
        );
        return {
            success: false,
            status: failure.status,
            message: failure.message
        };
    }
}

module.exports = {
    createSessionAndGetCaptcha,
    loginAndScrape,
    refreshCaptcha,
    closeSession,
    getRuntimeDiagnostics,
    getSessionPoolStats,
    STATUS_SUCCESS,
    STATUS_AUTH_FAILED,
    STATUS_SCRAPE_ERROR,
    STATUS_PORTAL_UNREACHABLE,
    STATUS_CAPTCHA_REQUIRED,
    STATUS_SESSION_EXPIRED,
    STATUS_RUNTIME_UNAVAILABLE,
    STATUS_SCRAPER_BUSY,
    __private: {
        activeSessions,
        cleanupExpiredSessions,
        extractCaptchaImage,
        getSessionCapacitySnapshot,
        detectCloudflareChallenge,
        waitForCloudflareClearance,
        createBlockedBySiteError,
        buildScraperErrorResponse,
        performLogin,
        hasSnapshotContent,
        hasMeaningfulPortalData,
        collectSectionSnapshots,
        waitForPortalUpdate,
        getSessionPoolStats
    }
};
