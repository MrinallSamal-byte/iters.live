/**
 * Page Access Token System
 * Generates and validates unique tokens for dashboard page access.
 * Each page load generates a new token, preventing direct URL access.
 * 
 * SECURITY: This module implements strict session validation to ensure
 * no protected page can be accessed without proper authentication.
 */

(function() {
    'use strict';

    // Configuration
    const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
    const TOKEN_STORAGE_KEY = 'pageAccessToken';
    const TOKEN_TIMESTAMP_KEY = 'pageAccessTokenTimestamp';
    const TOKEN_PATH_KEY = 'pageAccessTokenPath';
    const POST_LOGOUT_REDIRECT_KEY = 'postLogoutRedirectTarget';
    const POST_LOGOUT_REDIRECT_AT_KEY = 'postLogoutRedirectTimestamp';
    const POST_LOGOUT_REDIRECT_REASON_KEY = 'postLogoutRedirectReason';
    const AUTH_STORAGE_KEYS = [
        'accessToken',
        'refreshToken',
        'user',
        'token',
        'prototypeMode',
        'demoRole',
        'rememberedUser',
        'lastActivityTimestamp',
        'sessionId',
        'sessionStartTimestamp',
        TOKEN_STORAGE_KEY,
        TOKEN_TIMESTAMP_KEY,
        TOKEN_PATH_KEY,
        'loginRedirect',
        'loginMessage'
    ];

    function getStorageItem(storageObject, key) {
        if (!storageObject) return null;

        try {
            return storageObject.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function removeStorageItem(storageObject, key) {
        if (!storageObject) return;

        try {
            storageObject.removeItem(key);
        } catch (e) {
            // Ignore storage errors
        }
    }

    function clearMatchingStorageKeys(storageObject, predicate) {
        if (!storageObject) return;

        try {
            Object.keys(storageObject).forEach((key) => {
                if (predicate(key)) {
                    storageObject.removeItem(key);
                }
            });
        } catch (e) {
            // Ignore storage errors
        }
    }

    function getLastActivityTimestamp() {
        const sessionActivity = parseInt(getStorageItem(sessionStorage, 'lastActivityTimestamp') || '0', 10);
        const localActivity = parseInt(getStorageItem(localStorage, 'lastActivityTimestamp') || '0', 10);
        return Math.max(sessionActivity, localActivity, 0);
    }

    function hasStoredAuthState() {
        return Boolean(
            getStorageItem(localStorage, 'accessToken') ||
            getStorageItem(localStorage, 'user') ||
            getStorageItem(sessionStorage, 'accessToken') ||
            getStorageItem(sessionStorage, 'user')
        );
    }

    function hasExpiredSessionByInactivity() {
        const lastActivity = getLastActivityTimestamp();
        if (!lastActivity) return false;
        return Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
    }

    function setPostLogoutRedirect(reason = 'session_timeout') {
        try {
            localStorage.setItem(POST_LOGOUT_REDIRECT_KEY, '/index.html');
            localStorage.setItem(POST_LOGOUT_REDIRECT_AT_KEY, Date.now().toString());
            localStorage.setItem(POST_LOGOUT_REDIRECT_REASON_KEY, reason);
        } catch (e) {
            // Ignore storage errors
        }
    }

    function clearClientStateFallback() {
        AUTH_STORAGE_KEYS.forEach((key) => {
            removeStorageItem(localStorage, key);
            if (key !== 'logoutReason') {
                removeStorageItem(sessionStorage, key);
            }
        });

        clearMatchingStorageKeys(
            localStorage,
            (key) => key.startsWith('portal') || key.startsWith('soa') || key.includes('retry')
        );
        clearMatchingStorageKeys(
            sessionStorage,
            (key) => key.startsWith('portal') || key.startsWith('soa') || key.includes('retry')
        );

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            } catch (e) {
                // Ignore service worker errors
            }
        }

        if ('caches' in window) {
            caches.keys()
                .then((cacheNames) => Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName.startsWith('iter-'))
                        .map((cacheName) => caches.delete(cacheName))
                ))
                .catch(() => {});
        }
    }

    function redirectToPublicHome(reason = 'session_timeout') {
        try {
            sessionStorage.setItem('logoutReason', reason);
        } catch (e) {
            // Ignore storage errors
        }

        setPostLogoutRedirect(reason);
        clearPageAccessToken();

        if (window.APP && typeof window.APP.clearClientState === 'function') {
            window.APP.clearClientState({
                preserveTheme: true,
                preserveLogoutReason: true,
                preservePostLogoutRedirect: true
            });
        } else {
            clearClientStateFallback();
        }

        window.location.replace('/index.html');
    }

    /**
     * SECURITY: Immediately hide the page body while checking authentication
     * This prevents any flash of protected content for unauthenticated users
     */
    function hidePageContent() {
        // Add a style to hide the body immediately
        // Use body-level rule only (avoids performance impact of universal selector)
        const style = document.createElement('style');
        style.id = 'page-access-guard-style';
        style.textContent = `
            body.page-access-checking {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            body.page-access-checking .dashboard-main,
            body.page-access-checking .dashboard-sidebar,
            body.page-access-checking main,
            body.page-access-checking nav,
            body.page-access-checking header,
            body.page-access-checking footer {
                visibility: hidden !important;
                opacity: 0 !important;
            }
        `;
        document.head.appendChild(style);
        document.body.classList.add('page-access-checking');
    }

    /**
     * SECURITY: Show the page content after authentication is verified
     */
    function showPageContent() {
        document.body.classList.remove('page-access-checking');
        const style = document.getElementById('page-access-guard-style');
        if (style) {
            style.remove();
        }
    }

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

        if (hasStoredAuthState() && hasExpiredSessionByInactivity()) {
            return {
                valid: false,
                reason: 'session_timeout',
                message: 'Your session expired due to inactivity.'
            };
        }
        
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
            if (hasStoredAuthState() && hasExpiredSessionByInactivity()) {
                return false;
            }

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
        
        // Use encoded URL for navigation
        if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
            window.LinkEncoding.navigateTo('/login.html');
        } else {
            window.location.href = '/login.html';
        }
    }

    /**
     * Initialize page access token validation on page load
     * This is the main entry point for dashboard pages
     *
     * SECURITY: This function immediately hides page content while
     * verifying authentication to prevent any flash of protected content.
     */
    function initPageAccessGuard() {
        const currentPath = window.location.pathname;
        
        // Only apply to dashboard pages
        if (!currentPath.startsWith('/dashboard/')) {
            return;
        }
        
        // SECURITY: Immediately hide the page content while checking auth
        // This runs synchronously before any content renders
        hidePageContent();
        
        // Perform authentication check
        const validation = validatePageAccessToken();
        
        if (!validation.valid) {
            // Clear any stored tokens to ensure clean state
            clearPageAccessToken();

            if (validation.reason === 'session_timeout' || validation.reason === 'session_invalid') {
                redirectToPublicHome(validation.reason);
                return;
            }

            // Redirect to login immediately - don't show any content
            redirectToLogin(validation.message);
            return;
        }
        
        // SECURITY: Additional role-based access check
        // Verify user has permission to access this specific dashboard type
        const userRole = getUserRole();
        const dashboardType = getDashboardType(currentPath);
        
        if (!userRole || !hasRoleAccess(userRole, dashboardType)) {
            clearPageAccessToken();
            redirectToLogin('Access denied. Please log in with an authorized account.');
            return;
        }
        
        // Authentication verified - show the page content
        showPageContent();
        
        // Token is valid - regenerate for this page load
        regenerateToken(currentPath);
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
        hidePageContent,
        showPageContent,
        TOKEN_EXPIRY_MS
    };

    // Auto-initialize guard on script load
    initPageAccessGuard();

})();
