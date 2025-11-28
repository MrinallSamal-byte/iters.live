/**
 * Link Redirect Routes
 * Handles the /r/:encoded redirect mechanism for encoded links
 * Decodes Base64 URL-safe encoded links and redirects to the original URL
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiter for redirect routes
const redirectLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per IP
    message: { success: false, message: 'Too many requests, please try again later.' }
});

router.use(redirectLimiter);

/**
 * Decode a Base64 URL-safe encoded string
 * @param {string} encoded - Encoded string
 * @returns {string|null} Decoded string or null on error
 */
function decodeLink(encoded) {
    if (!encoded || typeof encoded !== 'string') return null;
    
    try {
        let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        return decoded;
    } catch (error) {
        console.error('Error decoding link:', error);
        return null;
    }
}

/**
 * Validate that a decoded URL is safe to redirect to
 * Only allows relative URLs to prevent open redirect vulnerabilities
 * @param {string} url - URL to validate
 * @returns {boolean} True if the URL is safe
 */
function isValidRedirectUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Must start with / (relative URL)
    if (!url.startsWith('/')) return false;
    
    // Prevent protocol-relative URLs
    if (url.startsWith('//')) return false;
    
    // Prevent URLs with protocol schemes
    if (url.includes('://')) return false;
    
    // Prevent directory traversal
    if (url.includes('..')) return false;
    
    // Parse URL to separate path, query string, and hash fragment
    let path = url;
    let queryString = '';
    let hashFragment = '';
    
    const queryStart = url.indexOf('?');
    const hashStart = url.indexOf('#');
    
    // Handle both query and hash - find earliest separator
    if (queryStart !== -1 && (hashStart === -1 || queryStart < hashStart)) {
        // Query comes first (or only query exists)
        path = url.substring(0, queryStart);
        const afterQuery = url.substring(queryStart);
        const hashInQuery = afterQuery.indexOf('#');
        if (hashInQuery !== -1) {
            queryString = afterQuery.substring(0, hashInQuery);
            hashFragment = afterQuery.substring(hashInQuery);
        } else {
            queryString = afterQuery;
        }
    } else if (hashStart !== -1) {
        // Only hash exists (or hash comes first - unusual but handle it)
        path = url.substring(0, hashStart);
        hashFragment = url.substring(hashStart);
    }
    
    // Validate query string (only allow safe characters)
    // Format: ?key=value&key2=value2
    if (queryString) {
        // Allow alphanumeric, hyphen, underscore, equals, ampersand, percent, plus, dot
        if (!/^\?[a-z0-9\-_=&%+.]*$/i.test(queryString)) return false;
    }
    
    // Validate hash fragment (only allow safe characters)
    // Format: #section-name or #id_value
    if (hashFragment) {
        // Allow alphanumeric, hyphen, underscore only in hash (no query chars like = or &)
        if (!/^#[a-z0-9\-_]*$/i.test(hashFragment)) return false;
    }
    
    // Root path
    if (path === '/') return true;
    
    // HTML files in root (login.html, register.html, etc.)
    if (/^\/[a-z0-9\-_]+\.html$/i.test(path)) return true;
    
    // Dashboard pages
    if (/^\/dashboard\/[a-z0-9\-_]+\.html$/i.test(path)) return true;
    
    // Simple paths without extensions (like /login, /register)
    if (/^\/[a-z0-9\-_]+$/i.test(path)) return true;
    
    // Obfuscated URLs (/web/srv-xxx)
    if (/^\/web\/[a-z0-9\-_]+$/i.test(path)) return true;
    
    return false;
}

/**
 * GET /r/:encoded
 * Decodes the encoded link and redirects to the original URL
 */
router.get('/:encoded', (req, res) => {
    try {
        const { encoded } = req.params;
        
        if (!encoded) {
            console.warn('Redirect request with empty encoded parameter');
            return res.redirect('/');
        }
        
        const decoded = decodeLink(encoded);
        
        if (!decoded) {
            console.warn('Failed to decode redirect link:', encoded);
            return res.redirect('/');
        }
        
        // Validate the decoded URL for security
        if (!isValidRedirectUrl(decoded)) {
            console.warn('Invalid redirect URL attempted:', decoded);
            return res.redirect('/');
        }
        
        // Redirect to the decoded URL
        res.redirect(decoded);
        
    } catch (error) {
        console.error('Error in redirect handler:', error);
        res.redirect('/');
    }
});

module.exports = router;
