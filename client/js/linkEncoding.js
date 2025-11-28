/**
 * Link Encoding Utility
 * Provides Base64 URL-safe encoding/decoding for all visible links
 * This ensures links are encoded at render time and decoded only when navigating
 */

(function() {
    'use strict';

    // Configuration flag - can be toggled to disable link encoding globally
    const ENABLE_LINK_ENCODING = true;

    /**
     * Check if a string is already Base64 URL-safe encoded
     * @param {string} str - String to check
     * @returns {boolean} True if the string appears to be encoded
     */
    function isEncoded(str) {
        if (!str || typeof str !== 'string') return false;
        // Base64 URL-safe chars are alphanumeric, hyphen, underscore
        // Minimum length check to avoid false positives with short strings
        return /^[A-Za-z0-9\-_]+$/.test(str) && str.length > 8;
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
        
        // Don't encode if already encoded
        if (isEncoded(raw)) return raw;
        
        // Don't encode empty or hash-only links
        if (raw === '' || raw === '#' || raw.startsWith('#')) return raw;
        
        // Don't encode external links (http://, https://, mailto:, tel:, etc.)
        if (isExternalLink(raw)) return raw;
        
        // Don't encode javascript: links
        if (raw.toLowerCase().startsWith('javascript:')) return raw;
        
        // Don't encode data: URLs
        if (raw.toLowerCase().startsWith('data:')) return raw;
        
        // Don't encode API endpoints
        if (raw.startsWith('/api/') || raw.includes('/api/')) return raw;
        
        // Don't encode static assets
        if (isStaticAsset(raw)) return raw;

        try {
            const bytes = new TextEncoder().encode(raw);
            let binary = '';
            bytes.forEach(b => binary += String.fromCharCode(b));

            const b64 = btoa(binary)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            return b64;
        } catch (error) {
            console.error('Error encoding link:', error);
            return raw;
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
            let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';

            const binary = atob(b64);
            const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
            return new TextDecoder().decode(bytes);
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
        if (!ENABLE_LINK_ENCODING) return raw;
        if (!raw || isExternalLink(raw) || isStaticAsset(raw)) return raw;
        
        const encoded = encodeLink(raw);
        // Only wrap in /r/ handler if actually encoded
        if (encoded !== raw && isEncoded(encoded)) {
            return '/r/' + encoded;
        }
        return raw;
    }

    /**
     * Navigate to an encoded link (decode and navigate)
     * @param {string} url - URL to navigate to (possibly encoded)
     */
    function navigateTo(url) {
        if (!url) return;
        
        const decoded = decodeLink(url);
        window.location.href = decoded;
    }

    /**
     * Open an encoded link in a new window/tab
     * @param {string} url - URL to open (possibly encoded)
     * @param {string} target - Window target (default '_blank')
     */
    function openLink(url, target = '_blank') {
        if (!url) return;
        
        const decoded = decodeLink(url);
        window.open(decoded, target);
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
            
            // Skip if already processed, external, or hash-only
            if (link.hasAttribute('data-encoded') || 
                link.hasAttribute('data-external') ||
                isExternalLink(href) ||
                href === '#' ||
                href.startsWith('#') ||
                isStaticAsset(href)) {
                return;
            }

            const encoded = encodeLink(href);
            if (encoded !== href) {
                link.setAttribute('data-original-href', href);
                link.setAttribute('data-encoded', encoded);
                // Use redirect handler
                link.setAttribute('href', '/r/' + encoded);
            }
        });

        // Encode data-href attributes
        document.querySelectorAll('[data-href]').forEach(el => {
            const href = el.getAttribute('data-href');
            if (!el.hasAttribute('data-encoded') && !isExternalLink(href) && !isStaticAsset(href)) {
                const encoded = encodeLink(href);
                if (encoded !== href) {
                    el.setAttribute('data-original-href', href);
                    el.setAttribute('data-encoded', encoded);
                    el.setAttribute('data-href', '/r/' + encoded);
                }
            }
        });

        // Encode data-url attributes
        document.querySelectorAll('[data-url]').forEach(el => {
            const url = el.getAttribute('data-url');
            if (!el.hasAttribute('data-encoded') && !isExternalLink(url) && !isStaticAsset(url)) {
                const encoded = encodeLink(url);
                if (encoded !== url) {
                    el.setAttribute('data-original-url', url);
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
        if (!href || isExternalLink(href) || href === '#' || href.startsWith('#') || isStaticAsset(href)) return;

        const encoded = encodeLink(href);
        if (encoded !== href) {
            link.setAttribute('data-original-href', href);
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
        if (!href || isExternalLink(href) || isStaticAsset(href)) return;

        const encoded = encodeLink(href);
        if (encoded !== href) {
            el.setAttribute('data-original-href', href);
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
        if (!url || isExternalLink(url) || isStaticAsset(url)) return;

        const encoded = encodeLink(url);
        if (encoded !== url) {
            el.setAttribute('data-original-url', url);
            el.setAttribute('data-encoded', encoded);
            el.setAttribute('data-url', '/r/' + encoded);
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
                encodeAllLinks();
                setupLinkObserver();
                setupClickHandler();
                setupNavigationInterceptors();
            });
        } else {
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
        isStaticAsset,
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
