/**
 * Link Encoding Utility
 * Provides Base64 URL-safe encoding/decoding for all visible links
 * This ensures links are encoded at render time and decoded only when navigating
 */

(function() {
    'use strict';

    // Configuration flag - can be toggled to disable link encoding globally
    const ENABLE_LINK_ENCODING = true;
    const ALWAYS_DIRECT_PUBLIC_ROUTES = new Set([
        '/',
        '/index.html',
        '/home',
        '/about',
        '/features',
        '/academics',
        '/contact'
    ]);
    const DEV_DIRECT_PUBLIC_ROUTES = new Set([
        '/login',
        '/login.html',
        '/register',
        '/register.html',
        '/creator',
        '/creator.html',
        '/connect-portal',
        '/connect-portal.html',
        '/soa-scraper',
        '/soa-scraper.html'
    ]);
    const DIRECT_APP_ROUTE_PREFIXES = [
        '/dashboard/'
    ];
    const CANONICAL_PUBLIC_ROUTE_MAP = new Map([
        ['/index.html', '/'],
        ['/home', '/'],
        ['/login.html', '/login'],
        ['/register.html', '/register'],
        ['/creator.html', '/creator'],
        ['/connect-portal.html', '/connect-portal'],
        ['/soa-scraper.html', '/soa-scraper']
    ]);
    const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

    function splitUrlSuffix(url) {
        const hashIndex = url.indexOf('#');
        const queryIndex = url.indexOf('?');
        let cutIndex = url.length;

        if (hashIndex !== -1) cutIndex = Math.min(cutIndex, hashIndex);
        if (queryIndex !== -1) cutIndex = Math.min(cutIndex, queryIndex);

        return {
            path: url.slice(0, cutIndex) || '/',
            suffix: url.slice(cutIndex)
        };
    }

    function toCanonicalPath(url) {
        if (!url || typeof url !== 'string') return '';
        if (url === '#' || url.startsWith('#')) return url;
        if (isExternalLink(url) || isStaticAsset(url)) return url;

        const { path, suffix } = splitUrlSuffix(url);
        const mappedRoute = CANONICAL_PUBLIC_ROUTE_MAP.get(path);
        if (mappedRoute) {
            return `${mappedRoute}${suffix}`;
        }

        const dashboardMatch = path.match(/^\/dashboard\/([a-z0-9-]+)\.html$/i);
        if (dashboardMatch) {
            return `/dashboard/${dashboardMatch[1]}${suffix}`;
        }

        return url;
    }

    function stripHashAndQuery(url) {
        if (!url || typeof url !== 'string') return '';
        const canonicalUrl = toCanonicalPath(url);
        return splitUrlSuffix(canonicalUrl).path;
    }

    function shouldObfuscateVisibleRoutes() {
        return !LOCAL_HOSTNAMES.has(window.location.hostname);
    }

    function isHomeFragmentRoute(basePath) {
        return ALWAYS_DIRECT_PUBLIC_ROUTES.has(basePath);
    }

    function isDirectRoute(url) {
        if (!url || typeof url !== 'string') return false;
        if (url === '#' || url.startsWith('#')) return true;
        if (isExternalLink(url) || isStaticAsset(url)) return false;

        const basePath = stripHashAndQuery(url) || '/';
        if (isHomeFragmentRoute(basePath)) return true;

        if (shouldObfuscateVisibleRoutes()) {
            return false;
        }

        if (DEV_DIRECT_PUBLIC_ROUTES.has(basePath)) return true;
        if (basePath === '/dashboard') return true;

        return DIRECT_APP_ROUTE_PREFIXES.some(prefix => basePath.startsWith(prefix));
    }

    function isDirectPublicRoute(url) {
        if (!url || typeof url !== 'string') return false;
        if (url === '#' || url.startsWith('#')) return true;
        if (isExternalLink(url) || isStaticAsset(url)) return false;

        const basePath = stripHashAndQuery(url) || '/';
        return isHomeFragmentRoute(basePath) || (!shouldObfuscateVisibleRoutes() && DEV_DIRECT_PUBLIC_ROUTES.has(basePath));
    }

    function tryDecodeBase64Url(str) {
        if (!str || typeof str !== 'string') return null;

        try {
            let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';

            const binary = atob(b64);
            const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
            return new TextDecoder().decode(bytes);
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if a string is already Base64 URL-safe encoded
     * @param {string} str - String to check
     * @returns {boolean} True if the string appears to be encoded
     */
    function isEncoded(str) {
        if (!str || typeof str !== 'string') return false;
        // Base64 URL-safe chars are alphanumeric, hyphen, underscore.
        // Exclude obvious raw paths and only treat the value as encoded if
        // decoding yields a valid internal application path.
        if (str.length < 4) return false;
        if (str.includes('.') || str.includes('/')) return false;
        if (!/^[A-Za-z0-9\-_]+$/.test(str)) return false;

        const decoded = tryDecodeBase64Url(str);
        return typeof decoded === 'string'
            && decoded.startsWith('/')
            && !/[\u0000-\u001f]/.test(decoded);
    }

    /**
     * Encode a link using Base64 URL-safe encoding
     * Idempotent: will not double-encode already encoded links
     * @param {string} raw - Raw URL to encode
     * @returns {string} Encoded URL or empty string if invalid
     */
    function encodeLink(raw) {
        if (!ENABLE_LINK_ENCODING) return raw || '';
        if (!raw || typeof raw !== 'string') return '';

        const canonicalRaw = toCanonicalPath(raw);
        
        // Don't encode if already encoded
        if (isEncoded(canonicalRaw)) return canonicalRaw;
        
        // Don't encode empty or hash-only links
        if (canonicalRaw === '' || canonicalRaw === '#' || canonicalRaw.startsWith('#')) return canonicalRaw;
        
        // Don't encode external links (http://, https://, mailto:, tel:, etc.)
        if (isExternalLink(canonicalRaw)) return canonicalRaw;

        // Keep public routes human-readable.
        if (isDirectRoute(canonicalRaw)) return canonicalRaw;
        
        // Don't encode javascript:, vbscript:, or data: URLs (security-sensitive)
        const lowerRaw = canonicalRaw.toLowerCase();
        if (lowerRaw.startsWith('javascript:') || 
            lowerRaw.startsWith('vbscript:') || 
            lowerRaw.startsWith('data:')) {
            return canonicalRaw;
        }
        
        // Don't encode API endpoints
        if (canonicalRaw.startsWith('/api/') || canonicalRaw.includes('/api/')) return canonicalRaw;
        
        // Don't encode static assets
        if (isStaticAsset(canonicalRaw)) return canonicalRaw;

        try {
            const bytes = new TextEncoder().encode(canonicalRaw);
            let binary = '';
            bytes.forEach(b => binary += String.fromCharCode(b));

            const b64 = btoa(binary)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            return b64;
        } catch (error) {
            console.error('Error encoding link:', error);
            return canonicalRaw;
        }
    }

    /**
     * Decode a Base64 URL-safe encoded link
     * @param {string} encoded - Encoded URL
     * @returns {string} Decoded URL or empty string if invalid
     */
    function decodeLink(encoded) {
        if (!encoded || typeof encoded !== 'string') return '';
        
        // If encoding is disabled, return as-is
        if (!ENABLE_LINK_ENCODING) return encoded;
        
        // If it doesn't look encoded, return as-is
        if (!isEncoded(encoded)) return encoded;

        try {
            return tryDecodeBase64Url(encoded) || encoded;
        } catch (error) {
            console.error('Error decoding link:', error);
            return encoded;
        }
    }

    /**
     * Check if a URL is an external link
     * @param {string} url - URL to check
     * @returns {boolean} True if external
     */
    function isExternalLink(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Check for explicit external protocols
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const linkUrl = new URL(url);
                // Compare with current domain
                return linkUrl.hostname !== window.location.hostname;
            } catch (e) {
                return true; // Malformed URL, treat as external for safety
            }
        }
        
        // Check for other external protocols
        if (url.startsWith('mailto:') || 
            url.startsWith('tel:') || 
            url.startsWith('ftp://') ||
            url.startsWith('//')) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if a URL points to a static asset
     * @param {string} url - URL to check
     * @returns {boolean} True if static asset
     */
    function isStaticAsset(url) {
        if (!url || typeof url !== 'string') return false;
        
        const staticPaths = ['/css/', '/js/', '/assets/', '/images/', '/fonts/', '/uploads/', '/static/'];
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.json', '.xml'];
        
        const lowerUrl = url.toLowerCase();
        
        // Check paths
        for (const path of staticPaths) {
            if (lowerUrl.includes(path)) return true;
        }
        
        // Check extensions
        for (const ext of staticExtensions) {
            if (lowerUrl.endsWith(ext)) return true;
        }
        
        return false;
    }

    /**
     * Get encoded redirect URL for navigation
     * @param {string} raw - Raw URL to encode
     * @returns {string} URL for the redirect handler
     */
    function getEncodedRedirectUrl(raw) {
        const canonicalRaw = toCanonicalPath(raw);
        if (!ENABLE_LINK_ENCODING) return canonicalRaw;
        if (!canonicalRaw || isExternalLink(canonicalRaw) || isStaticAsset(canonicalRaw) || isDirectRoute(canonicalRaw)) return canonicalRaw;
        
        const encoded = encodeLink(canonicalRaw);
        // Only wrap in /r/ handler if actually encoded
        if (encoded !== canonicalRaw && isEncoded(encoded)) {
            return '/r/' + encoded;
        }
        return canonicalRaw;
    }

    /**
     * Navigate to a page using encoded URL (preserves encoded URL in browser)
     * @param {string} rawUrl - Raw URL to navigate to
     */
    function navigateTo(rawUrl) {
        if (!rawUrl) return;
        const canonicalUrl = toCanonicalPath(rawUrl);
        
        if (!ENABLE_LINK_ENCODING) {
            window.location.href = canonicalUrl;
            return;
        }

        if (isDirectRoute(canonicalUrl)) {
            window.location.href = canonicalUrl;
            return;
        }
        
        // If the URL is already encoded (starts with /r/), use it directly
        if (canonicalUrl.startsWith('/r/')) {
            window.location.href = canonicalUrl;
            return;
        }
        
        // Get the encoded URL
        const encodedUrl = getEncodedRedirectUrl(canonicalUrl);
        window.location.href = encodedUrl;
    }

    /**
     * Open an encoded link in a new window/tab
     * @param {string} url - URL to open (possibly encoded)
     * @param {string} target - Window target (default '_blank')
     */
    function openLink(url, target = '_blank') {
        if (!url) return;

        const canonicalUrl = toCanonicalPath(url);
        const destination = canonicalUrl.startsWith('/r/')
            ? canonicalUrl
            : getEncodedRedirectUrl(canonicalUrl);
        window.open(destination, target);
    }

    /**
     * Encode all visible links on the page
     * This should be called after the DOM is loaded
     */
    function encodeAllLinks() {
        if (!ENABLE_LINK_ENCODING) return;

        // Encode anchor hrefs
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            const canonicalHref = toCanonicalPath(href);

            if (canonicalHref && canonicalHref !== href) {
                link.setAttribute('href', canonicalHref);
            }
            
            // Skip if already processed, external, or hash-only
            if (link.hasAttribute('data-encoded') || 
                link.hasAttribute('data-external') ||
                isExternalLink(canonicalHref) ||
                canonicalHref === '#' ||
                canonicalHref.startsWith('#') ||
                isDirectRoute(canonicalHref) ||
                isStaticAsset(canonicalHref)) {
                return;
            }

            const encoded = encodeLink(canonicalHref);
            if (encoded !== canonicalHref) {
                link.setAttribute('data-original-href', canonicalHref);
                link.setAttribute('data-encoded', encoded);
                // Use redirect handler
                link.setAttribute('href', '/r/' + encoded);
            }
        });

        // Encode data-href attributes
        document.querySelectorAll('[data-href]').forEach(el => {
            const href = el.getAttribute('data-href');
            const canonicalHref = toCanonicalPath(href);
            if (canonicalHref && canonicalHref !== href) {
                el.setAttribute('data-href', canonicalHref);
            }
            if (!el.hasAttribute('data-encoded') && !isExternalLink(canonicalHref) && !isStaticAsset(canonicalHref)) {
                if (isDirectRoute(canonicalHref)) return;
                const encoded = encodeLink(canonicalHref);
                if (encoded !== canonicalHref) {
                    el.setAttribute('data-original-href', canonicalHref);
                    el.setAttribute('data-encoded', encoded);
                    el.setAttribute('data-href', '/r/' + encoded);
                }
            }
        });

        // Encode data-url attributes
        document.querySelectorAll('[data-url]').forEach(el => {
            const url = el.getAttribute('data-url');
            const canonicalUrl = toCanonicalPath(url);
            if (canonicalUrl && canonicalUrl !== url) {
                el.setAttribute('data-url', canonicalUrl);
            }
            if (!el.hasAttribute('data-encoded') && !isExternalLink(canonicalUrl) && !isStaticAsset(canonicalUrl)) {
                if (isDirectRoute(canonicalUrl)) return;
                const encoded = encodeLink(canonicalUrl);
                if (encoded !== canonicalUrl) {
                    el.setAttribute('data-original-url', canonicalUrl);
                    el.setAttribute('data-encoded', encoded);
                    el.setAttribute('data-url', '/r/' + encoded);
                }
            }
        });
    }

    /**
     * Setup mutation observer to encode dynamically added links
     */
    function setupLinkObserver() {
        if (!ENABLE_LINK_ENCODING) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the node itself is a link
                        if (node.tagName === 'A' && node.getAttribute('href')) {
                            encodeSingleLink(node);
                        }
                        
                        // Check for links within the added node
                        if (node.querySelectorAll) {
                            node.querySelectorAll('a[href]').forEach(encodeSingleLink);
                            node.querySelectorAll('[data-href]').forEach(encodeSingleDataHref);
                            node.querySelectorAll('[data-url]').forEach(encodeSingleDataUrl);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Encode a single anchor element
     * @param {Element} link - Anchor element to encode
     */
    function encodeSingleLink(link) {
        if (!link || link.hasAttribute('data-encoded') || link.hasAttribute('data-external')) return;
        
        const href = link.getAttribute('href');
        const canonicalHref = toCanonicalPath(href);
        if (canonicalHref && canonicalHref !== href) {
            link.setAttribute('href', canonicalHref);
        }
        if (!canonicalHref || isExternalLink(canonicalHref) || canonicalHref === '#' || canonicalHref.startsWith('#') || isDirectRoute(canonicalHref) || isStaticAsset(canonicalHref)) return;

        const encoded = encodeLink(canonicalHref);
        if (encoded !== canonicalHref) {
            link.setAttribute('data-original-href', canonicalHref);
            link.setAttribute('data-encoded', encoded);
            link.setAttribute('href', '/r/' + encoded);
        }
    }

    /**
     * Encode a single element with data-href
     * @param {Element} el - Element to encode
     */
    function encodeSingleDataHref(el) {
        if (!el || el.hasAttribute('data-encoded')) return;
        
        const href = el.getAttribute('data-href');
        const canonicalHref = toCanonicalPath(href);
        if (canonicalHref && canonicalHref !== href) {
            el.setAttribute('data-href', canonicalHref);
        }
        if (!canonicalHref || isExternalLink(canonicalHref) || isDirectRoute(canonicalHref) || isStaticAsset(canonicalHref)) return;

        const encoded = encodeLink(canonicalHref);
        if (encoded !== canonicalHref) {
            el.setAttribute('data-original-href', canonicalHref);
            el.setAttribute('data-encoded', encoded);
            el.setAttribute('data-href', '/r/' + encoded);
        }
    }

    /**
     * Encode a single element with data-url
     * @param {Element} el - Element to encode
     */
    function encodeSingleDataUrl(el) {
        if (!el || el.hasAttribute('data-encoded')) return;
        
        const url = el.getAttribute('data-url');
        const canonicalUrl = toCanonicalPath(url);
        if (canonicalUrl && canonicalUrl !== url) {
            el.setAttribute('data-url', canonicalUrl);
        }
        if (!canonicalUrl || isExternalLink(canonicalUrl) || isDirectRoute(canonicalUrl) || isStaticAsset(canonicalUrl)) return;

        const encoded = encodeLink(canonicalUrl);
        if (encoded !== canonicalUrl) {
            el.setAttribute('data-original-url', canonicalUrl);
            el.setAttribute('data-encoded', encoded);
            el.setAttribute('data-url', '/r/' + encoded);
        }
    }

    function syncCurrentLocationToCanonical() {
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentUrl.startsWith('/r/')) {
            return;
        }

        const canonicalUrl = toCanonicalPath(currentUrl);

        if (!canonicalUrl || !canonicalUrl.startsWith('/')) {
            return;
        }

        if (shouldObfuscateVisibleRoutes() && !isDirectRoute(canonicalUrl)) {
            const encodedUrl = getEncodedRedirectUrl(canonicalUrl);
            if (encodedUrl && encodedUrl !== currentUrl) {
                window.history.replaceState(window.history.state, document.title, encodedUrl);
            }
            return;
        }

        if (canonicalUrl !== currentUrl) {
            window.history.replaceState(window.history.state, document.title, canonicalUrl);
        }
    }

    /**
     * Intercept navigation methods to decode links before navigating
     */
    function setupNavigationInterceptors() {
        if (!ENABLE_LINK_ENCODING) return;

        // Store original methods
        const originalLocationHref = Object.getOwnPropertyDescriptor(window.location.__proto__, 'href');
        const originalWindowOpen = window.open;

        // Intercept window.open
        window.open = function(url, target, features) {
            const decodedUrl = decodeLink(url);
            return originalWindowOpen.call(this, decodedUrl, target, features);
        };

        // Note: location.href setter cannot be reliably intercepted in all browsers
        // Instead, we handle this via click event listeners on links
    }

    /**
     * Handle link clicks to decode before navigation
     */
    function setupClickHandler() {
        if (!ENABLE_LINK_ENCODING) return;

        document.addEventListener('click', function(e) {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            
            // If it's a redirect URL (/r/...), let it go through
            if (href && href.startsWith('/r/')) return;
            
            // If there's an encoded value, use it
            const encoded = link.getAttribute('data-encoded');
            if (encoded && !href.startsWith('/r/')) {
                e.preventDefault();
                window.location.href = '/r/' + encoded;
            }
        }, true);
    }

    /**
     * Initialize the link encoding system
     */
    function init() {
        if (!ENABLE_LINK_ENCODING) {
            console.log('Link encoding is disabled');
            return;
        }

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                syncCurrentLocationToCanonical();
                encodeAllLinks();
                setupLinkObserver();
                setupClickHandler();
                setupNavigationInterceptors();
            });
        } else {
            syncCurrentLocationToCanonical();
            encodeAllLinks();
            setupLinkObserver();
            setupClickHandler();
            setupNavigationInterceptors();
        }
    }

    // Export to global scope
    window.LinkEncoding = {
        ENABLE_LINK_ENCODING,
        encodeLink,
        decodeLink,
        isEncoded,
        isExternalLink,
        isDirectRoute,
        isDirectPublicRoute,
        isStaticAsset,
        shouldObfuscateVisibleRoutes,
        toCanonicalPath,
        getEncodedRedirectUrl,
        navigateTo,
        openLink,
        encodeAllLinks,
        setupLinkObserver,
        init
    };

    // Auto-initialize
    init();

})();
