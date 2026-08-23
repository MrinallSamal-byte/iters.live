(function() {
    'use strict';

    const ENABLE_LINK_ENCODING = false;

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
        return ENABLE_LINK_ENCODING && !LOCAL_HOSTNAMES.has(window.location.hostname);
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

    function isEncoded(str) {
        if (!str || typeof str !== 'string') return false;
        if (str.length < 4) return false;
        if (str.includes('.') || str.includes('/')) return false;
        if (!/^[A-Za-z0-9\-_]+$/.test(str)) return false;

        const decoded = tryDecodeBase64Url(str);
        return typeof decoded === 'string'
            && decoded.startsWith('/')
            && !/[\u0000-\u001f]/.test(decoded);
    }

    function encodeLink(raw) {
        if (!raw || typeof raw !== 'string') return '';
        return raw;
    }

    function decodeLink(encoded) {
        if (!encoded || typeof encoded !== 'string') return '';
        if (!isEncoded(encoded)) return encoded;

        try {
            return tryDecodeBase64Url(encoded) || encoded;
        } catch (error) {
            return encoded;
        }
    }

    function isExternalLink(url) {
        if (!url || typeof url !== 'string') return false;

        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const linkUrl = new URL(url);
                return linkUrl.hostname !== window.location.hostname;
            } catch (e) {
                return true;
            }
        }

        if (url.startsWith('mailto:') ||
            url.startsWith('tel:') ||
            url.startsWith('ftp://') ||
            url.startsWith('//')) {
            return true;
        }

        return false;
    }

    function isStaticAsset(url) {
        if (!url || typeof url !== 'string') return false;

        const staticPaths = ['/css/', '/js/', '/assets/', '/images/', '/fonts/', '/uploads/', '/static/'];
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.json', '.xml'];

        const lowerUrl = url.toLowerCase();

        for (const path of staticPaths) {
            if (lowerUrl.includes(path)) return true;
        }

        for (const ext of staticExtensions) {
            if (lowerUrl.endsWith(ext)) return true;
        }

        return false;
    }

    function unwrapLegacyRedirect(canonicalUrl) {
        if (canonicalUrl && canonicalUrl.startsWith('/r/')) {
            return canonicalUrl.slice(3);
        }
        if (canonicalUrl && !canonicalUrl.startsWith('/') && isEncoded(canonicalUrl)) {
            return canonicalUrl;
        }
        return null;
    }

    function resolvePlainPath(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return '';

        const canonicalUrl = toCanonicalPath(rawUrl);
        const legacySegment = unwrapLegacyRedirect(canonicalUrl);
        if (legacySegment === null) {
            return canonicalUrl;
        }

        const decoded = decodeLink(legacySegment);
        if (decoded && decoded.startsWith('/')) {
            return toCanonicalPath(decoded);
        }
        return canonicalUrl;
    }

    function getEncodedRedirectUrl(raw) {
        return resolvePlainPath(raw);
    }

    function navigateTo(rawUrl) {
        const target = resolvePlainPath(rawUrl);
        if (!target) return;
        window.location.href = target;
    }

    function openLink(url, target = '_blank') {
        const destination = resolvePlainPath(url);
        if (!destination) return;
        window.open(destination, target);
    }

    function encodeAllLinks() {}

    function setupLinkObserver() {}

    function init() {}

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

})();
