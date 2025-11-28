/**
 * Tests for Link Encoding Utilities
 * Tests the Base64 URL-safe encoding/decoding functionality
 */

describe('Link Encoding Module', () => {
  // Simulate the LinkEncoding functions (since this is a client-side module)
  const LinkEncoding = {
    isEncoded(str) {
      if (!str || typeof str !== 'string') return false;
      // Minimum length of 12 to avoid false positives
      if (str.length < 12) return false;
      // Must not contain dots or slashes (not a path)
      if (str.includes('.') || str.includes('/')) return false;
      return /^[A-Za-z0-9\-_]+$/.test(str);
    },

    encodeLink(raw) {
      if (!raw || typeof raw !== 'string') return '';
      if (this.isEncoded(raw)) return raw;
      if (raw === '' || raw === '#' || raw.startsWith('#')) return raw;
      if (this.isExternalLink(raw)) return raw;
      // Don't encode javascript:, vbscript:, or data: URLs (security-sensitive)
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.startsWith('javascript:') || 
          lowerRaw.startsWith('vbscript:') || 
          lowerRaw.startsWith('data:')) {
        return raw;
      }
      if (raw.startsWith('/api/') || raw.includes('/api/')) return raw;
      if (this.isStaticAsset(raw)) return raw;

      try {
        const bytes = Buffer.from(raw, 'utf-8');
        const b64 = bytes.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        return b64;
      } catch (error) {
        return raw;
      }
    },

    decodeLink(encoded) {
      if (!encoded || typeof encoded !== 'string') return '';
      if (!this.isEncoded(encoded)) return encoded;

      try {
        let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return Buffer.from(b64, 'base64').toString('utf-8');
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

    it('should return false for short strings (less than 12 chars)', () => {
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
      const raw = '/dashboard/student.html';
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
      expect(decoded).toBe(raw);
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
      expect(decoded).toBe(raw);
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
    ];

    testUrls.forEach(url => {
      it(`should correctly encode and decode: ${url}`, () => {
        const encoded = LinkEncoding.encodeLink(url);
        const decoded = LinkEncoding.decodeLink(encoded);
        expect(decoded).toBe(url);
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
    
    const allowedPatterns = [
      /^\/$/,
      /^\/[a-z0-9\-_]+\.html$/i,
      /^\/dashboard\/[a-z0-9\-_]+\.html$/i,
      /^\/[a-z0-9\-_]+\.html#[a-z0-9\-_]+$/i,
      /^\/[a-z0-9\-_]+$/i,
      /^\/web\/[a-z0-9\-_]+$/i,
      /^\/[a-z0-9\-_]+#[a-z0-9\-_]+$/i,
      /^\/index\.html(#[a-z0-9\-_]+)?$/i,
    ];
    
    for (const pattern of allowedPatterns) {
      if (pattern.test(url)) return true;
    }
    
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
  });
});
