/**
 * URL Router Utility
 * Provides URL obfuscation and session-based routing
 * Hides actual page URLs and shows obfuscated paths like /web/srv-xxx
 */

const crypto = require('crypto');

// In-memory store for URL mappings (in production, use Redis or similar)
const urlMappings = new Map();
const reverseUrlMappings = new Map();

// URL mapping timeout (24 hours in milliseconds)
const URL_MAPPING_TTL = 24 * 60 * 60 * 1000;

/**
 * Page mapping configuration
 * Maps page identifiers to actual file paths
 */
const PAGE_CONFIG = {
    // Landing/Public pages
    'home': '/index.html',
    'about': '/index.html#about',
    'features': '/index.html#features',
    'academics': '/index.html#academics',
    'contact': '/index.html#contact',
    'login': '/login.html',
    'register': '/register.html',
    'creator': '/creator.html',
    
    // Student Dashboard pages
    'student': '/dashboard/student.html',
    'student-attendance': '/dashboard/student-attendance.html',
    'student-marks': '/dashboard/student-marks.html',
    'student-timetable': '/dashboard/student-timetable.html',
    'student-admit-card': '/dashboard/student-admit-card.html',
    'student-notes': '/dashboard/student-notes.html',
    'student-events': '/dashboard/student-events.html',
    'student-clubs': '/dashboard/student-clubs.html',
    'student-hostel-menu': '/dashboard/student-hostel-menu.html',
    'student-forum': '/dashboard/student-forum.html',
    
    // Teacher Dashboard pages
    'teacher': '/dashboard/teacher.html',
    'teacher-attendance': '/dashboard/teacher-attendance.html',
    'teacher-marks': '/dashboard/teacher-marks.html',
    'teacher-assignments': '/dashboard/teacher-assignments.html',
    'teacher-students': '/dashboard/teacher-students.html',
    'teacher-notes': '/dashboard/teacher-notes.html',
    'teacher-question-bank': '/dashboard/teacher-question-bank.html',
    'teacher-rubric-creator': '/dashboard/teacher-rubric-creator.html',
    
    // Admin Dashboard pages
    'admin': '/dashboard/admin.html',
    'admin-users': '/dashboard/admin-users.html',
    'admin-departments': '/dashboard/admin-departments.html',
    'admin-approvals': '/dashboard/admin-approvals.html',
    'admin-announcements': '/dashboard/admin-announcements.html',
    'admin-analytics': '/dashboard/admin-analytics.html',
    'admin-settings': '/dashboard/admin-settings.html'
};

/**
 * Generate a unique session ID for URL obfuscation
 * Format: srv-{random string}
 * @returns {string} Unique session ID
 */
function generateSessionId() {
    const randomBytes = crypto.randomBytes(12);
    const sessionId = 'srv-' + randomBytes.toString('hex').substring(0, 20);
    return sessionId;
}

/**
 * Create an obfuscated URL mapping for a page
 * @param {string} pageKey - Page identifier from PAGE_CONFIG
 * @param {string} [existingSessionId] - Optional existing session ID to reuse
 * @returns {Object} URL mapping with sessionId and actualPath
 */
function createUrlMapping(pageKey, existingSessionId = null) {
    const actualPath = PAGE_CONFIG[pageKey];
    
    if (!actualPath) {
        return null;
    }
    
    // Check if mapping already exists for this session
    if (existingSessionId && urlMappings.has(existingSessionId)) {
        const existing = urlMappings.get(existingSessionId);
        if (existing.pageKey === pageKey) {
            return existing;
        }
    }
    
    const sessionId = existingSessionId || generateSessionId();
    const mapping = {
        sessionId,
        pageKey,
        actualPath,
        createdAt: Date.now(),
        expiresAt: Date.now() + URL_MAPPING_TTL
    };
    
    urlMappings.set(sessionId, mapping);
    reverseUrlMappings.set(actualPath, sessionId);
    
    return mapping;
}

/**
 * Get actual path from session ID
 * @param {string} sessionId - The obfuscated session ID
 * @returns {Object|null} The mapping object or null if not found/expired
 */
function resolveSessionId(sessionId) {
    const mapping = urlMappings.get(sessionId);
    
    if (!mapping) {
        return null;
    }
    
    // Check if mapping has expired
    if (Date.now() > mapping.expiresAt) {
        urlMappings.delete(sessionId);
        reverseUrlMappings.delete(mapping.actualPath);
        return null;
    }
    
    return mapping;
}

/**
 * Get or create obfuscated URL for a page
 * @param {string} pageKey - Page identifier
 * @returns {string} Obfuscated URL path
 */
function getObfuscatedUrl(pageKey) {
    const actualPath = PAGE_CONFIG[pageKey];
    
    if (!actualPath) {
        return null;
    }
    
    // Check if we already have a mapping for this path
    const existingSessionId = reverseUrlMappings.get(actualPath);
    if (existingSessionId) {
        const mapping = urlMappings.get(existingSessionId);
        if (mapping && Date.now() < mapping.expiresAt) {
            return `/web/${existingSessionId}`;
        }
    }
    
    // Create new mapping
    const mapping = createUrlMapping(pageKey);
    return `/web/${mapping.sessionId}`;
}

/**
 * Get all page mappings with their obfuscated URLs
 * @returns {Object} Object with page keys and their obfuscated URLs
 */
function getAllObfuscatedUrls() {
    const urls = {};
    for (const pageKey of Object.keys(PAGE_CONFIG)) {
        urls[pageKey] = getObfuscatedUrl(pageKey);
    }
    return urls;
}

/**
 * Clean up expired mappings
 */
function cleanupExpiredMappings() {
    const now = Date.now();
    for (const [sessionId, mapping] of urlMappings.entries()) {
        if (now > mapping.expiresAt) {
            urlMappings.delete(sessionId);
            reverseUrlMappings.delete(mapping.actualPath);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupExpiredMappings, 60 * 60 * 1000);

/**
 * Get page key from actual path
 * @param {string} actualPath - The actual file path
 * @returns {string|null} Page key or null
 */
function getPageKeyFromPath(actualPath) {
    for (const [key, path] of Object.entries(PAGE_CONFIG)) {
        if (path === actualPath) {
            return key;
        }
    }
    return null;
}

/**
 * Check if a path should be obfuscated
 * @param {string} path - The path to check
 * @returns {boolean}
 */
function shouldObfuscatePath(path) {
    // Don't obfuscate API routes, static assets, etc.
    if (path.startsWith('/api/') || 
        path.startsWith('/static/') || 
        path.startsWith('/uploads/') ||
        path.startsWith('/css/') ||
        path.startsWith('/js/') ||
        path.startsWith('/assets/') ||
        path.startsWith('/releases/') ||
        path.startsWith('/web/') ||
        path === '/health' ||
        path === '/manifest.json' ||
        path === '/service-worker.js') {
        return false;
    }
    return true;
}

module.exports = {
    PAGE_CONFIG,
    generateSessionId,
    createUrlMapping,
    resolveSessionId,
    getObfuscatedUrl,
    getAllObfuscatedUrls,
    cleanupExpiredMappings,
    getPageKeyFromPath,
    shouldObfuscatePath
};
