const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const sourcePath = path.join(__dirname, '..', 'client', 'js', 'linkEncoding.js');
const moduleSource = fs.readFileSync(sourcePath, 'utf8');

const tokenFor = (value) => Buffer.from(value, 'utf-8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

function createLinkEncoding(overrides = {}) {
  const fakeWindow = {
    location: { hostname: 'localhost', pathname: '/', search: '', hash: '', href: null },
    history: { state: null, replaceState: jest.fn(), pushState: jest.fn() },
    open: jest.fn(),
    ...overrides
  };
  const factory = new Function(
    'window',
    'TextDecoder',
    'URL',
    'atob',
    'btoa',
    `${moduleSource}\nreturn window.LinkEncoding;`
  );
  const LinkEncoding = factory(fakeWindow, TextDecoder, URL, atob, btoa);
  return { LinkEncoding, fakeWindow };
}

describe('LinkEncoding compatibility layer', () => {
  describe('production load path', () => {
    const REQUIRED_KEYS = [
      'ENABLE_LINK_ENCODING',
      'encodeLink',
      'decodeLink',
      'isEncoded',
      'isExternalLink',
      'isDirectRoute',
      'isDirectPublicRoute',
      'isStaticAsset',
      'shouldObfuscateVisibleRoutes',
      'toCanonicalPath',
      'getEncodedRedirectUrl',
      'navigateTo',
      'openLink',
      'encodeAllLinks',
      'setupLinkObserver',
      'init'
    ];

    it('attaches the full legacy API surface to window', () => {
      expect(() => require('../client/js/linkEncoding.js')).not.toThrow();
      expect(window.LinkEncoding).toBeDefined();
      REQUIRED_KEYS.forEach((key) => {
        expect(typeof window.LinkEncoding[key]).not.toBe('undefined');
      });
      expect(window.LinkEncoding.ENABLE_LINK_ENCODING).toBe(false);
    });
  });

  describe('feature flag', () => {
    it('disables client-side encoding by default', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.ENABLE_LINK_ENCODING).toBe(false);
      expect(LinkEncoding.shouldObfuscateVisibleRoutes()).toBe(false);
    });
  });

  describe('encodeLink identity passthrough', () => {
    it.each([
      '/dashboard/student.html',
      '/login',
      '/search.html?q=test',
      '/api/users',
      '/css/style.css',
      '#section',
      'https://google.com',
      'mailto:test@example.com'
    ])('returns %s unchanged', (path) => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.encodeLink(path)).toBe(path);
    });

    it('returns empty string for missing values', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.encodeLink(null)).toBe('');
      expect(LinkEncoding.encodeLink(undefined)).toBe('');
      expect(LinkEncoding.encodeLink('')).toBe('');
    });
  });

  describe('decodeLink legacy support', () => {
    it('still resolves stale bookmarked tokens', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.decodeLink(tokenFor('/login.html'))).toBe('/login.html');
      expect(LinkEncoding.decodeLink(tokenFor('/dashboard/student'))).toBe('/dashboard/student');
      expect(LinkEncoding.decodeLink(tokenFor('/dashboard/student-notes.html?type=pyqs&page=1'))).toBe('/dashboard/student-notes.html?type=pyqs&page=1');
    });

    it('passes plain paths through untouched', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.decodeLink('/login.html')).toBe('/login.html');
      expect(LinkEncoding.decodeLink('/')).toBe('/');
      expect(LinkEncoding.decodeLink('#section')).toBe('#section');
    });

    it('passes non-token strings through untouched', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.decodeLink('abcdefghijk')).toBe('abcdefghijk');
      expect(LinkEncoding.decodeLink('12345678')).toBe('12345678');
      expect(LinkEncoding.decodeLink('hello world ab')).toBe('hello world ab');
    });

    it('returns empty string for missing values', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.decodeLink(null)).toBe('');
      expect(LinkEncoding.decodeLink(undefined)).toBe('');
      expect(LinkEncoding.decodeLink('')).toBe('');
    });

    it('keeps isEncoded detection working for legacy tokens', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.isEncoded(tokenFor('/login.html'))).toBe(true);
      expect(LinkEncoding.isEncoded(tokenFor('/dashboard/student'))).toBe(true);
      expect(LinkEncoding.isEncoded('/login.html')).toBe(false);
      expect(LinkEncoding.isEncoded('abc')).toBe(false);
      expect(LinkEncoding.isEncoded('')).toBe(false);
      expect(LinkEncoding.isEncoded(null)).toBe(false);
    });
  });

  describe('getEncodedRedirectUrl plain output', () => {
    it.each([
      ['/login.html', '/login'],
      ['/register.html', '/register'],
      ['/connect-portal.html', '/connect-portal'],
      ['/dashboard/student.html', '/dashboard/student'],
      ['/dashboard/student-marks.html?tab=internal#top', '/dashboard/student-marks?tab=internal#top']
    ])('maps %s to the plain path %s', (input, expected) => {
      const { LinkEncoding } = createLinkEncoding();
      const result = LinkEncoding.getEncodedRedirectUrl(input);
      expect(result).toBe(expected);
      expect(result.startsWith('/r/')).toBe(false);
    });

    it('unwraps legacy /r/ prefixes to their decoded target', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.getEncodedRedirectUrl(`/r/${tokenFor('/dashboard/teacher')}`)).toBe('/dashboard/teacher');
    });

    it('leaves unmapped internal paths alone', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.getEncodedRedirectUrl('/some/custom/page')).toBe('/some/custom/page');
    });
  });

  describe('toCanonicalPath retained behavior', () => {
    it.each([
      ['/index.html', '/'],
      ['/register.html', '/register'],
      ['/dashboard/student.html', '/dashboard/student']
    ])('canonicalizes %s to %s', (input, expected) => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.toCanonicalPath(input)).toBe(expected);
    });
  });

  describe('navigation helpers target plain paths', () => {
    it('navigateTo assigns canonical plain paths without encoding', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();

      LinkEncoding.navigateTo('/login.html');
      expect(fakeWindow.location.href).toBe('/login');

      LinkEncoding.navigateTo('/dashboard/student.html');
      expect(fakeWindow.location.href).toBe('/dashboard/student');
    });

    it('navigateTo unwraps legacy /r/ URLs before navigating', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.navigateTo(`/r/${tokenFor('/dashboard/teacher')}`);
      expect(fakeWindow.location.href).toBe('/dashboard/teacher');
    });

    it('navigateTo decodes bare legacy tokens', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.navigateTo(tokenFor('/connect-portal'));
      expect(fakeWindow.location.href).toBe('/connect-portal');
    });

    it('navigateTo ignores empty input', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.navigateTo('');
      LinkEncoding.navigateTo(null);
      expect(fakeWindow.location.href).toBeNull();
    });

    it('navigateTo never rewrites history state', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.navigateTo('/settings.html');
      expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
    });

    it('openLink opens the plain path in a new tab', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.openLink('/connect-portal.html', '_blank');
      expect(fakeWindow.open).toHaveBeenCalledWith('/connect-portal', '_blank');
    });

    it('openLink unwraps legacy /r/ URLs', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();
      LinkEncoding.openLink(`/r/${tokenFor('/about')}`);
      expect(fakeWindow.open).toHaveBeenCalledWith('/about', '_blank');
    });
  });

  describe('DOM hooks are inert', () => {
    it('setupLinkObserver does nothing and returns undefined', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(typeof LinkEncoding.setupLinkObserver).toBe('function');
      expect(LinkEncoding.setupLinkObserver()).toBeUndefined();
    });

    it('encodeAllLinks and init perform no work and never rewrite the address bar', () => {
      const { LinkEncoding, fakeWindow } = createLinkEncoding();

      expect(LinkEncoding.encodeAllLinks()).toBeUndefined();
      expect(LinkEncoding.init()).toBeUndefined();

      expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
      expect(fakeWindow.history.pushState).not.toHaveBeenCalled();
      expect(fakeWindow.location.href).toBeNull();
    });
  });

  describe('classification helpers remain available', () => {
    it('identifies external links', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.isExternalLink('https://google.com')).toBe(true);
      expect(LinkEncoding.isExternalLink('//cdn.example.com/file.js')).toBe(true);
      expect(LinkEncoding.isExternalLink('/login.html')).toBe(false);
    });

    it('identifies static assets', () => {
      const { LinkEncoding } = createLinkEncoding();
      expect(LinkEncoding.isStaticAsset('/css/style.css')).toBe(true);
      expect(LinkEncoding.isStaticAsset('/login.html')).toBe(false);
    });

    it('treats public routes as direct with encoding retired', () => {
      const { LinkEncoding } = createLinkEncoding({ location: { hostname: 'iterasn.example.com', pathname: '/', search: '', hash: '', href: null } });
      expect(LinkEncoding.shouldObfuscateVisibleRoutes()).toBe(false);
      expect(LinkEncoding.isDirectRoute('/')).toBe(true);
      expect(LinkEncoding.isDirectRoute('/index.html#about')).toBe(true);
      expect(LinkEncoding.isDirectRoute('/dashboard/student.html')).toBe(true);
      expect(LinkEncoding.isDirectPublicRoute('/login.html')).toBe(true);
    });
  });
});
