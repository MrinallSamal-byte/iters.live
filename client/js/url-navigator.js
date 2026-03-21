/**
 * URL Navigator - Client-side URL obfuscation handler
 * Handles navigation using obfuscated URLs like /web/srv-xxx
 */

(function() {
    'use strict';

    // Cache for URL mappings
    let urlCache = null;
    let cacheTimestamp = null;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Fetch obfuscated URLs from server
     * @returns {Promise<Object>} URL mappings
     */
    async function fetchUrlMappings() {
        try {
            const response = await fetch('/web/urls');
            const data = await response.json();
            if (data.success) {
                urlCache = data.data;
                cacheTimestamp = Date.now();
                return urlCache;
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch URL mappings:', error);
            return null;
        }
    }

    /**
     * Get cached or fresh URL mappings
     * @returns {Promise<Object>} URL mappings
     */
    async function getUrlMappings() {
        if (urlCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
            return urlCache;
        }
        return await fetchUrlMappings();
    }

    /**
     * Validate that a URL is safe to navigate to
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is safe
     */
    function isValidNavigationUrl(url) {
        // Only allow relative URLs starting with /web/ or specific safe paths
        if (!url || typeof url !== 'string') return false;
        
        // Allow obfuscated URLs
        if (url.startsWith('/web/srv-')) return true;
        
        // Allow safe relative paths (fallback navigation)
        const safePatterns = ['/login', '/register', '/home', '/creator', '/dashboard/'];
        return safePatterns.some(pattern => url.startsWith(pattern));
    }

    /**
     * Navigate to a page using obfuscated URL
     * @param {string} pageKey - Page identifier (e.g., 'login', 'register', 'home')
     */
    async function navigateTo(pageKey) {
        try {
            const response = await fetch('/web/navigate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pageKey })
            });
            
            const data = await response.json();
            
            if (data.success && data.data.url && isValidNavigationUrl(data.data.url)) {
                window.location.href = data.data.url;
            } else {
                console.error('Failed to get navigation URL:', data.message);
                // Fallback to page key as path - validate it first
                const fallbackUrl = '/' + pageKey;
                if (isValidNavigationUrl(fallbackUrl)) {
                    window.location.href = fallbackUrl;
                }
            }
        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback to page key as path - validate it first
            const fallbackUrl = '/' + pageKey;
            if (isValidNavigationUrl(fallbackUrl)) {
                window.location.href = fallbackUrl;
            }
        }
    }

    /**
     * Get obfuscated URL for a page without navigating
     * @param {string} pageKey - Page identifier
     * @returns {Promise<string|null>} Obfuscated URL or null
     */
    async function getObfuscatedUrl(pageKey) {
        const mappings = await getUrlMappings();
        if (mappings && mappings[pageKey]) {
            return mappings[pageKey];
        }
        return null;
    }

    /**
     * Update all links on the page to use obfuscated URLs
     */
    async function updatePageLinks() {
        const mappings = await getUrlMappings();
        if (!mappings) return;

        // Keep public routes direct; only map dashboard entry links if needed.
        const pathToKey = {
            '/dashboard/student.html': 'student',
            '/dashboard/teacher.html': 'teacher',
            '/dashboard/admin.html': 'admin'
        };

        // Update all anchor tags
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            
            // Check if this href should be obfuscated
            const pageKey = pathToKey[href];
            if (pageKey && mappings[pageKey]) {
                link.setAttribute('href', mappings[pageKey]);
                link.setAttribute('data-original-href', href);
            }
        });
    }

    /**
     * Handle history state for obfuscated URLs
     * This prevents the browser from showing the actual page URL in history
     */
    function initHistoryHandler() {
        // Replace state on page load to use clean URL
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/web/')) {
            // Already using obfuscated URL, good
        } else {
            // Check if we should be using an obfuscated URL
            // This handles cases where user directly types the URL
        }
    }

    /**
     * Initialize the URL navigator
     */
    function init() {
        // Update links when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updatePageLinks);
        } else {
            updatePageLinks();
        }

        initHistoryHandler();
    }

    // Export to global scope
    window.URLNavigator = {
        navigateTo,
        getObfuscatedUrl,
        getUrlMappings,
        updatePageLinks,
        init
    };

    // Auto-initialize
    init();

})();
