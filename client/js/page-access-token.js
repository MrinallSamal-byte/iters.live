/**
 * Page Access Token System
 * Generates and validates unique tokens for dashboard page access.
 * Each page load generates a new token, preventing direct URL access.
 */

(function() {
    'use strict';

    // Configuration
    const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const TOKEN_STORAGE_KEY = 'pageAccessToken';
    const TOKEN_TIMESTAMP_KEY = 'pageAccessTokenTimestamp';
    const TOKEN_PATH_KEY = 'pageAccessTokenPath';

    /**
     * Generate a cryptographically secure random token
     * @returns {string} A random hex string
     */
    function generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Create a page access token with metadata
     * @param {string} targetPath - The path the token is valid for
     * @returns {Object} Token object with token, timestamp, and path
     */
    function createPageAccessToken(targetPath) {
        const token = generateToken();
        const timestamp = Date.now();
        
        const tokenData = {
            token: token,
            timestamp: timestamp,
            path: targetPath,
            expiresAt: timestamp + TOKEN_EXPIRY_MS
        };
        
        // Store in sessionStorage for security (cleared when browser closes)
        try {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
            sessionStorage.setItem(TOKEN_TIMESTAMP_KEY, timestamp.toString());
            sessionStorage.setItem(TOKEN_PATH_KEY, targetPath);
        } catch (e) {
            console.error('Failed to store page access token:', e);
        }
        
        return tokenData;
    }

    /**
     * Validate the current page access token
     * @returns {Object} Validation result with valid flag and reason
     */
    function validatePageAccessToken() {
        const currentPath = window.location.pathname;
        
        // Check if user is authenticated first
        if (!isUserAuthenticated()) {
            return {
                valid: false,
                reason: 'not_authenticated',
                message: 'User is not logged in'
            };
        }
        
        try {
            const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
            const storedTimestamp = sessionStorage.getItem(TOKEN_TIMESTAMP_KEY);
            const storedPath = sessionStorage.getItem(TOKEN_PATH_KEY);
            
            // Check if token exists
            if (!storedToken || !storedTimestamp) {
                return {
                    valid: false,
                    reason: 'no_token',
                    message: 'No valid access token found'
                };
            }
            
            // Check if token has expired
            const tokenTimestamp = parseInt(storedTimestamp, 10);
            if (Date.now() - tokenTimestamp > TOKEN_EXPIRY_MS) {
                clearPageAccessToken();
                return {
                    valid: false,
                    reason: 'token_expired',
                    message: 'Access token has expired'
                };
            }
            
            // Check if token is for current path (allow flexible matching for dashboard pages)
            if (!isPathMatch(storedPath, currentPath)) {
                return {
                    valid: false,
                    reason: 'path_mismatch',
                    message: 'Token not valid for this page'
                };
            }
            
            return {
                valid: true,
                reason: 'valid',
                message: 'Token is valid'
            };
        } catch (e) {
            console.error('Error validating page access token:', e);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Token validation failed'
            };
        }
    }

    /**
     * Check if paths match (allowing for dashboard navigation)
     * @param {string} storedPath - The stored token path
     * @param {string} currentPath - The current page path
     * @returns {boolean} True if paths match
     */
    function isPathMatch(storedPath, currentPath) {
        // Exact match
        if (storedPath === currentPath) return true;
        
        // Both are dashboard pages - allow internal navigation
        if (storedPath && currentPath) {
            const isDashboardStored = storedPath.startsWith('/dashboard/');
            const isDashboardCurrent = currentPath.startsWith('/dashboard/');
            
            // Allow navigation within the same dashboard type
            if (isDashboardStored && isDashboardCurrent) {
                // Extract the dashboard type (student, teacher, admin)
                const storedType = getDashboardType(storedPath);
                const currentType = getDashboardType(currentPath);
                return storedType === currentType;
            }
        }
        
        return false;
    }

    /**
     * Extract dashboard type from path
     * @param {string} path - Dashboard path
     * @returns {string} Dashboard type (student, teacher, admin)
     */
    function getDashboardType(path) {
        if (path.includes('student')) return 'student';
        if (path.includes('teacher')) return 'teacher';
        if (path.includes('admin')) return 'admin';
        return 'unknown';
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user has valid auth data
     */
    function isUserAuthenticated() {
        try {
            // Check localStorage first
            const accessToken = localStorage.getItem('accessToken');
            const user = localStorage.getItem('user');
            
            if (accessToken && user) {
                const userData = JSON.parse(user);
                return userData && userData.role;
            }
            
            // Check sessionStorage as fallback
            const sessionToken = sessionStorage.getItem('accessToken');
            const sessionUser = sessionStorage.getItem('user');
            
            if (sessionToken && sessionUser) {
                const userData = JSON.parse(sessionUser);
                return userData && userData.role;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get user role from storage
     * @returns {string|null} User role or null
     */
    function getUserRole() {
        try {
            const user = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (user) {
                const userData = JSON.parse(user);
                return userData.role || null;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Clear the page access token
     */
    function clearPageAccessToken() {
        try {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            sessionStorage.removeItem(TOKEN_TIMESTAMP_KEY);
            sessionStorage.removeItem(TOKEN_PATH_KEY);
        } catch (e) {
            console.error('Failed to clear page access token:', e);
        }
    }

    /**
     * Regenerate token for the current page (for internal navigation)
     * @param {string} newPath - The new path to navigate to
     * @returns {Object} New token data
     */
    function regenerateToken(newPath) {
        return createPageAccessToken(newPath);
    }

    /**
     * Get encoded URL with fresh token for navigation
     * @param {string} targetPath - Target path to navigate to
     * @returns {string} URL-safe encoded path with token
     */
    function getSecureNavigationUrl(targetPath) {
        // Regenerate token for the target path
        const tokenData = regenerateToken(targetPath);
        
        // Encode the path for the URL
        if (window.LinkEncoding && typeof window.LinkEncoding.encodeLink === 'function') {
            return window.LinkEncoding.getEncodedRedirectUrl(targetPath);
        }
        
        return targetPath;
    }

    /**
     * Navigate securely to a dashboard page
     * @param {string} targetPath - Target dashboard path
     */
    function navigateSecurely(targetPath) {
        // Validate user has access to target dashboard type
        const userRole = getUserRole();
        const targetType = getDashboardType(targetPath);
        
        if (!userRole) {
            redirectToLogin('Please log in to access this page');
            return;
        }
        
        // Check role-based access
        if (!hasRoleAccess(userRole, targetType)) {
            // Access denied - silently return without navigating
            return;
        }
        
        // Create token for new path
        regenerateToken(targetPath);
        
        // Navigate
        window.location.href = targetPath;
    }

    /**
     * Check if role has access to dashboard type
     * @param {string} userRole - User's role
     * @param {string} dashboardType - Dashboard type
     * @returns {boolean} True if access allowed
     */
    function hasRoleAccess(userRole, dashboardType) {
        const accessMap = {
            'student': ['student'],
            'teacher': ['teacher'],
            'admin': ['admin', 'student', 'teacher'] // Admin can access all
        };
        
        const allowedTypes = accessMap[userRole] || [];
        return allowedTypes.includes(dashboardType);
    }

    /**
     * Redirect to login page with optional message
     * @param {string} message - Optional message to show
     */
    function redirectToLogin(message) {
        clearPageAccessToken();
        
        // Store the intended destination for post-login redirect
        try {
            sessionStorage.setItem('loginRedirect', window.location.pathname);
            if (message) {
                sessionStorage.setItem('loginMessage', message);
            }
        } catch (e) {
            // Ignore storage errors
        }
        
        window.location.href = '/login.html';
    }

    /**
     * Setup secure link handlers for all dashboard navigation links
     */
    function setupSecureLinks() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Check if it's a dashboard link
            if (href.startsWith('/dashboard/') || href.includes('/dashboard/')) {
                e.preventDefault();
                navigateSecurely(href);
            }
        }, true);
    }

    /**
     * Initialize page access token validation on page load
     * This is the main entry point for dashboard pages
     */
    function initPageAccessGuard() {
        const currentPath = window.location.pathname;
        
        // Only apply to dashboard pages
        if (!currentPath.startsWith('/dashboard/')) {
            return;
        }
        
        // Validate the token
        const validation = validatePageAccessToken();
        
        if (!validation.valid) {
            // Redirect to login
            redirectToLogin(validation.message);
            return;
        }
        
        // Token is valid - regenerate for this page load
        regenerateToken(currentPath);
        
        // Setup secure navigation for internal links
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupSecureLinks);
        } else {
            setupSecureLinks();
        }
    }

    // Export functions to global scope
    window.PageAccessToken = {
        createPageAccessToken,
        validatePageAccessToken,
        clearPageAccessToken,
        regenerateToken,
        getSecureNavigationUrl,
        navigateSecurely,
        isUserAuthenticated,
        getUserRole,
        hasRoleAccess,
        redirectToLogin,
        initPageAccessGuard,
        TOKEN_EXPIRY_MS
    };

    // Auto-initialize guard on script load
    initPageAccessGuard();

})();
