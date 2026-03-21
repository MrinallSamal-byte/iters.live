/**
 * Tests for Link Encoding Utilities
 * Tests the Base64 URL-safe encoding/decoding functionality
 */

describe('Link Encoding Module', () => {
  // Simulate the LinkEncoding functions (since this is a client-side module)
  const LinkEncoding = {
    ALWAYS_DIRECT_PUBLIC_ROUTES: new Set([
      '/',
      '/index.html',
      '/home',
      '/about',
      '/features',
      '/academics',
      '/contact'
    ]),
    DEV_DIRECT_PUBLIC_ROUTES: new Set([
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
    ]),
    DIRECT_APP_ROUTE_PREFIXES: [
      '/dashboard/'
    ],
    CANONICAL_PUBLIC_ROUTE_MAP: new Map([
      ['/index.html', '/'],
      ['/home', '/'],
      ['/login.html', '/login'],
      ['/register.html', '/register'],
      ['/creator.html', '/creator'],
      ['/connect-portal.html', '/connect-portal'],
      ['/soa-scraper.html', '/soa-scraper']
    ]),
    shouldObfuscateVisibleRoutes() {
      return true;
    },

    splitUrlSuffix(url) {
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      let cutIndex = url.length;

      if (hashIndex !== -1) cutIndex = Math.min(cutIndex, hashIndex);
      if (queryIndex !== -1) cutIndex = Math.min(cutIndex, queryIndex);

      return {
        path: url.slice(0, cutIndex) || '/',
        suffix: url.slice(cutIndex)
      };
    },

    toCanonicalPath(url) {
      if (!url || typeof url !== 'string') return '';
      if (url === '#' || url.startsWith('#')) return url;
      if (this.isExternalLink(url) || this.isStaticAsset(url)) return url;

      const { path, suffix } = this.splitUrlSuffix(url);
      const mappedRoute = this.CANONICAL_PUBLIC_ROUTE_MAP.get(path);
      if (mappedRoute) {
        return `${mappedRoute}${suffix}`;
      }

      const dashboardMatch = path.match(/^\/dashboard\/([a-z0-9-]+)\.html$/i);
      if (dashboardMatch) {
        return `/dashboard/${dashboardMatch[1]}${suffix}`;
      }

      return url;
    },

    stripHashAndQuery(url) {
      if (!url || typeof url !== 'string') return '';
      const canonicalUrl = this.toCanonicalPath(url);
      return this.splitUrlSuffix(canonicalUrl).path;
    },

    isDirectRoute(url) {
      if (!url || typeof url !== 'string') return false;
      if (url === '#' || url.startsWith('#')) return true;
      if (this.isExternalLink(url) || this.isStaticAsset(url)) return false;

      const basePath = this.stripHashAndQuery(url) || '/';
      if (this.ALWAYS_DIRECT_PUBLIC_ROUTES.has(basePath)) return true;

      if (this.shouldObfuscateVisibleRoutes()) return false;

      if (this.DEV_DIRECT_PUBLIC_ROUTES.has(basePath)) return true;
      if (basePath === '/dashboard') return true;
      return this.DIRECT_APP_ROUTE_PREFIXES.some(prefix => basePath.startsWith(prefix));
    },

    tryDecodeBase64Url(str) {
      if (!str || typeof str !== 'string') return null;

      try {
        let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return Buffer.from(b64, 'base64').toString('utf-8');
      } catch (error) {
        return null;
      }
    },

    isEncoded(str) {
      if (!str || typeof str !== 'string') return false;
      if (str.length < 4) return false;
      if (str.includes('.') || str.includes('/')) return false;
      if (!/^[A-Za-z0-9\-_]+$/.test(str)) return false;

      const decoded = this.tryDecodeBase64Url(str);
      return typeof decoded === 'string'
        && decoded.startsWith('/')
        && !/[\u0000-\u001f]/.test(decoded);
    },

    encodeLink(raw) {
      if (!raw || typeof raw !== 'string') return '';
      const canonicalRaw = this.toCanonicalPath(raw);
      if (this.isEncoded(canonicalRaw)) return canonicalRaw;
      if (canonicalRaw === '' || canonicalRaw === '#' || canonicalRaw.startsWith('#')) return canonicalRaw;
      if (this.isExternalLink(canonicalRaw)) return canonicalRaw;
      if (this.isDirectRoute(canonicalRaw)) return canonicalRaw;
      // Don't encode javascript:, vbscript:, or data: URLs (security-sensitive)
      const lowerRaw = canonicalRaw.toLowerCase();
      if (lowerRaw.startsWith('javascript:') || 
          lowerRaw.startsWith('vbscript:') || 
          lowerRaw.startsWith('data:')) {
        return canonicalRaw;
      }
      if (canonicalRaw.startsWith('/api/') || canonicalRaw.includes('/api/')) return canonicalRaw;
      if (this.isStaticAsset(canonicalRaw)) return canonicalRaw;

      try {
        const bytes = Buffer.from(canonicalRaw, 'utf-8');
        const b64 = bytes.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        return b64;
      } catch (error) {
        return canonicalRaw;
      }
    },

    decodeLink(encoded) {
      if (!encoded || typeof encoded !== 'string') return '';
      if (!this.isEncoded(encoded)) return encoded;

      try {
        return this.tryDecodeBase64Url(encoded) || encoded;
      } catch (error) {
        return encoded;
      }
    },

    isExternalLink(url) {
      if (!url || typeof url !== 'string') return false;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // For testing, assume localhost is internal
        if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
        return true;
      }
      if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('ftp://') || url.startsWith('//')) {
        return true;
      }
      return false;
    },

    isStaticAsset(url) {
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
  };

  describe('isEncoded', () => {
    it('should return false for empty string', () => {
      expect(LinkEncoding.isEncoded('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(LinkEncoding.isEncoded(null)).toBe(false);
    });

    it('should return false for short random strings', () => {
      expect(LinkEncoding.isEncoded('abc')).toBe(false);
      expect(LinkEncoding.isEncoded('12345678')).toBe(false);
      expect(LinkEncoding.isEncoded('abcdefghijk')).toBe(false); // 11 chars
    });

    it('should return true for valid Base64 URL-safe encoded strings', () => {
      // These are encoded versions of paths (no dots or slashes in encoded form)
      expect(LinkEncoding.isEncoded('L2xvZ2luLmh0bWw')).toBe(true);  // /login.html encoded
      expect(LinkEncoding.isEncoded('L2Rhc2hib2FyZC9zdHVkZW50')).toBe(true);  // /dashboard/student encoded
    });

    it('should return false for strings with dots or slashes', () => {
      expect(LinkEncoding.isEncoded('/dashboard/student.html')).toBe(false);
      expect(LinkEncoding.isEncoded('hello.world1234')).toBe(false);
      expect(LinkEncoding.isEncoded('path/to/file123')).toBe(false);
    });

    it('should return false for strings with spaces or invalid characters', () => {
      expect(LinkEncoding.isEncoded('hello world ab')).toBe(false);
    });
  });

  describe('encodeLink', () => {
    it('should encode a simple URL path', () => {
      const raw = '/search.html?q=test';
      const encoded = LinkEncoding.encodeLink(raw);
      expect(encoded).not.toBe(raw);
      expect(LinkEncoding.isEncoded(encoded)).toBe(true);
    });

    it('should return empty string for null/undefined', () => {
      expect(LinkEncoding.encodeLink(null)).toBe('');
      expect(LinkEncoding.encodeLink(undefined)).toBe('');
    });

    it('should not double-encode already encoded strings', () => {
      const raw = '/login.html';
      const encoded = LinkEncoding.encodeLink(raw);
      const doubleEncoded = LinkEncoding.encodeLink(encoded);
      expect(doubleEncoded).toBe(encoded);
    });

    it('should not encode hash-only links', () => {
      expect(LinkEncoding.encodeLink('#')).toBe('#');
      expect(LinkEncoding.encodeLink('#section')).toBe('#section');
    });

    it('should not encode external links', () => {
      expect(LinkEncoding.encodeLink('https://google.com')).toBe('https://google.com');
      expect(LinkEncoding.encodeLink('mailto:test@example.com')).toBe('mailto:test@example.com');
      expect(LinkEncoding.encodeLink('tel:+1234567890')).toBe('tel:+1234567890');
    });

    it('should not encode direct public routes', () => {
      expect(LinkEncoding.encodeLink('/index.html#about')).toBe('/#about');
      expect(LinkEncoding.encodeLink('/contact')).toBe('/contact');
    });

    it('should encode internal page routes in obfuscated mode', () => {
      expect(LinkEncoding.isEncoded(LinkEncoding.encodeLink('/connect-portal.html'))).toBe(true);
      expect(LinkEncoding.isEncoded(LinkEncoding.encodeLink('/dashboard/student.html'))).toBe(true);
    });

    it('should not encode API endpoints', () => {
      expect(LinkEncoding.encodeLink('/api/users')).toBe('/api/users');
      expect(LinkEncoding.encodeLink('/api/auth/login')).toBe('/api/auth/login');
    });

    it('should not encode static assets', () => {
      expect(LinkEncoding.encodeLink('/css/style.css')).toBe('/css/style.css');
      expect(LinkEncoding.encodeLink('/js/main.js')).toBe('/js/main.js');
      expect(LinkEncoding.encodeLink('/assets/logo.png')).toBe('/assets/logo.png');
    });

    it('should not encode javascript: links', () => {
      expect(LinkEncoding.encodeLink('javascript:void(0)')).toBe('javascript:void(0)');
    });

    it('should not encode vbscript: links', () => {
      expect(LinkEncoding.encodeLink('vbscript:msgbox("test")')).toBe('vbscript:msgbox("test")');
    });

    it('should not encode data: URLs', () => {
      expect(LinkEncoding.encodeLink('data:text/html,<h1>test</h1>')).toBe('data:text/html,<h1>test</h1>');
    });
  });

  describe('decodeLink', () => {
    it('should decode an encoded URL path', () => {
      const raw = '/dashboard/student.html';
      const encoded = LinkEncoding.encodeLink(raw);
      const decoded = LinkEncoding.decodeLink(encoded);
      expect(decoded).toBe('/dashboard/student');
    });

    it('should return empty string for null/undefined', () => {
      expect(LinkEncoding.decodeLink(null)).toBe('');
      expect(LinkEncoding.decodeLink(undefined)).toBe('');
    });

    it('should return original string if not encoded', () => {
      expect(LinkEncoding.decodeLink('/login.html')).toBe('/login.html');
      expect(LinkEncoding.decodeLink('#section')).toBe('#section');
    });

    it('should handle URLs with query parameters', () => {
      const raw = '/search?q=test&page=1';
      const encoded = LinkEncoding.encodeLink(raw);
      const decoded = LinkEncoding.decodeLink(encoded);
      expect(decoded).toBe(raw);
    });

    it('should handle URLs with hash fragments', () => {
      const raw = '/index.html#about';
      const encoded = LinkEncoding.encodeLink(raw);
      const decoded = LinkEncoding.decodeLink(encoded);
      expect(decoded).toBe('/#about');
    });

    it('should handle special characters', () => {
      const raw = '/path/with spaces/and&special=chars';
      const encoded = LinkEncoding.encodeLink(raw);
      const decoded = LinkEncoding.decodeLink(encoded);
      expect(decoded).toBe(raw);
    });
  });

  describe('isExternalLink', () => {
    it('should identify external HTTP links', () => {
      expect(LinkEncoding.isExternalLink('https://google.com')).toBe(true);
      expect(LinkEncoding.isExternalLink('http://example.com')).toBe(true);
    });

    it('should identify mailto links as external', () => {
      expect(LinkEncoding.isExternalLink('mailto:test@example.com')).toBe(true);
    });

    it('should identify tel links as external', () => {
      expect(LinkEncoding.isExternalLink('tel:+1234567890')).toBe(true);
    });

    it('should not identify relative paths as external', () => {
      expect(LinkEncoding.isExternalLink('/login.html')).toBe(false);
      expect(LinkEncoding.isExternalLink('/dashboard/student.html')).toBe(false);
    });

    it('should identify protocol-relative URLs as external', () => {
      expect(LinkEncoding.isExternalLink('//cdn.example.com/file.js')).toBe(true);
    });
  });

  describe('isStaticAsset', () => {
    it('should identify CSS files', () => {
      expect(LinkEncoding.isStaticAsset('/css/style.css')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/path/to/file.css')).toBe(true);
    });

    it('should identify JavaScript files', () => {
      expect(LinkEncoding.isStaticAsset('/js/main.js')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/path/to/script.js')).toBe(true);
    });

    it('should identify image files', () => {
      expect(LinkEncoding.isStaticAsset('/assets/logo.png')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/images/photo.jpg')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/img/icon.svg')).toBe(true);
    });

    it('should identify font files', () => {
      expect(LinkEncoding.isStaticAsset('/fonts/arial.woff2')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/path/font.ttf')).toBe(true);
    });

    it('should not identify HTML pages as static', () => {
      expect(LinkEncoding.isStaticAsset('/login.html')).toBe(false);
      expect(LinkEncoding.isStaticAsset('/dashboard/student.html')).toBe(false);
    });
  });

  describe('isDirectRoute', () => {
    it('should keep homepage routes and anchors direct', () => {
      expect(LinkEncoding.isDirectRoute('/')).toBe(true);
      expect(LinkEncoding.isDirectRoute('/index.html#about')).toBe(true);
    });

    it('should obfuscate internal app pages in production mode', () => {
      expect(LinkEncoding.isDirectRoute('/connect-portal.html')).toBe(false);
      expect(LinkEncoding.isDirectRoute('/dashboard/student.html')).toBe(false);
    });

    it('should not treat arbitrary application pages as direct', () => {
      expect(LinkEncoding.isDirectRoute('/search.html?q=test')).toBe(false);
    });
  });

  describe('toCanonicalPath', () => {
    it('should canonicalize root html routes', () => {
      expect(LinkEncoding.toCanonicalPath('/login.html')).toBe('/login');
      expect(LinkEncoding.toCanonicalPath('/register.html')).toBe('/register');
      expect(LinkEncoding.toCanonicalPath('/index.html')).toBe('/');
    });

    it('should canonicalize dashboard html routes and preserve query/hash', () => {
      expect(LinkEncoding.toCanonicalPath('/dashboard/student.html')).toBe('/dashboard/student');
      expect(LinkEncoding.toCanonicalPath('/dashboard/student-marks.html?tab=internal#top')).toBe('/dashboard/student-marks?tab=internal#top');
    });
  });

  describe('Encode/Decode Round Trip', () => {
    const testUrls = [
      '/login.html',
      '/register.html',
      '/dashboard/student.html',
      '/dashboard/teacher.html',
      '/dashboard/admin.html',
      '/index.html#about',
      '/index.html#features',
      '/creator.html',
      '/dashboard/student-attendance.html',
      '/dashboard/student-marks.html',
      '/dashboard/student-notes.html?type=pyqs',
      '/dashboard/student-notes.html?type=pyqs&page=1',
      '/dashboard/student-events.html',
      '/dashboard/student-timetable.html',
      '/search.html?q=test+query',
    ];

    testUrls.forEach(url => {
      it(`should correctly encode and decode: ${url}`, () => {
        const encoded = LinkEncoding.encodeLink(url);
        const decoded = LinkEncoding.decodeLink(encoded);
        expect(decoded).toBe(LinkEncoding.toCanonicalPath(url));
      });
    });
  });
});

describe('Server-side Redirect Handler', () => {
  // Simulate the server-side decodeLink function
  function decodeLink(encoded) {
    if (!encoded || typeof encoded !== 'string') return null;
    
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      
      return Buffer.from(b64, 'base64').toString('utf-8');
    } catch (error) {
      return null;
    }
  }

  function isValidRedirectUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith('/')) return false;
    if (url.startsWith('//')) return false;
    if (url.includes('://')) return false;
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
    
    // Dashboard pages, with or without the legacy .html suffix
    if (/^\/dashboard\/[a-z0-9\-_]+(?:\.html)?$/i.test(path)) return true;
    
    // Simple paths without extensions (like /login, /register)
    if (/^\/[a-z0-9\-_]+$/i.test(path)) return true;
    
    // Obfuscated URLs (/web/srv-xxx)
    if (/^\/web\/[a-z0-9\-_]+$/i.test(path)) return true;
    
    return false;
  }

  describe('decodeLink', () => {
    it('should decode valid encoded strings', () => {
      const encoded = Buffer.from('/login.html').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const decoded = decodeLink(encoded);
      expect(decoded).toBe('/login.html');
    });

    it('should return null for invalid input', () => {
      expect(decodeLink(null)).toBe(null);
      expect(decodeLink(undefined)).toBe(null);
      expect(decodeLink('')).toBe(null);
    });
  });

  describe('isValidRedirectUrl', () => {
    it('should allow root path', () => {
      expect(isValidRedirectUrl('/')).toBe(true);
    });

    it('should allow HTML pages in root', () => {
      expect(isValidRedirectUrl('/login.html')).toBe(true);
      expect(isValidRedirectUrl('/register.html')).toBe(true);
    });

    it('should allow dashboard pages', () => {
      expect(isValidRedirectUrl('/dashboard/student.html')).toBe(true);
      expect(isValidRedirectUrl('/dashboard/teacher.html')).toBe(true);
      expect(isValidRedirectUrl('/dashboard/student')).toBe(true);
      expect(isValidRedirectUrl('/dashboard/student-marks')).toBe(true);
    });

    it('should reject external URLs', () => {
      expect(isValidRedirectUrl('https://evil.com')).toBe(false);
      expect(isValidRedirectUrl('http://malicious.com/hack')).toBe(false);
    });

    it('should reject protocol-relative URLs', () => {
      expect(isValidRedirectUrl('//evil.com')).toBe(false);
    });

    it('should reject directory traversal', () => {
      expect(isValidRedirectUrl('/../../etc/passwd')).toBe(false);
      expect(isValidRedirectUrl('/path/../../../secret')).toBe(false);
    });

    it('should allow URLs with hash fragments', () => {
      expect(isValidRedirectUrl('/index.html#about')).toBe(true);
      expect(isValidRedirectUrl('/index.html#features')).toBe(true);
    });

    it('should allow URLs with query parameters', () => {
      expect(isValidRedirectUrl('/dashboard/student-notes.html?type=pyqs')).toBe(true);
      expect(isValidRedirectUrl('/dashboard/student-notes.html?type=pyqs&page=1')).toBe(true);
      expect(isValidRedirectUrl('/search.html?q=test')).toBe(true);
    });

    it('should allow URLs with both query parameters and hash fragments', () => {
      expect(isValidRedirectUrl('/index.html?page=1#section')).toBe(true);
      expect(isValidRedirectUrl('/dashboard/student.html?tab=marks#top')).toBe(true);
    });

    it('should reject URLs with invalid query parameter characters', () => {
      expect(isValidRedirectUrl('/page.html?evil=<script>')).toBe(false);
      expect(isValidRedirectUrl('/page.html?bad="test"')).toBe(false);
    });

    it('should reject hash fragments with invalid characters', () => {
      // Hash fragments should not contain query-like characters
      expect(isValidRedirectUrl('/page.html#param=value')).toBe(false);
      expect(isValidRedirectUrl('/page.html#section&other')).toBe(false);
    });
  });
});
