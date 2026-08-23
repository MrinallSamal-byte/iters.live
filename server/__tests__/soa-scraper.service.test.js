/**
 * @jest-environment node
 */

jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn(),
        executablePath: jest.fn(() => '/mock/chromium')
    }
}));

describe('soa-scraper.service CAPTCHA extraction', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.SOA_MAX_ACTIVE_SESSIONS;
        const { chromium } = require('playwright');
        chromium.launch.mockReset();
        chromium.executablePath.mockReset();
        chromium.executablePath.mockReturnValue('/mock/chromium');
    });

    it('extracts captcha from the first matching selector when a visible inline image is present', async () => {
        const screenshotBuffer = Buffer.from('selector-captcha');
        const visibleElement = {
            isVisible: jest.fn().mockResolvedValue(true),
            screenshot: jest.fn().mockResolvedValue(screenshotBuffer)
        };

        const page = {
            locator: jest.fn(() => ({
                first: jest.fn(() => visibleElement)
            })),
            evaluate: jest.fn()
        };

        const service = require('../services/soa-scraper.service');
        const result = await service.__private.extractCaptchaImage(page);

        expect(result).toBe(`data:image/png;base64,${screenshotBuffer.toString('base64')}`);
        expect(page.locator).toHaveBeenCalledWith('img[src^="data:image"]');
    });

    it('falls back to score-based visible image extraction when selector lookup misses', async () => {
        const screenshotBuffer = Buffer.from('fallback-captcha');

        const page = {
            locator: jest.fn((selector) => {
                if (selector === 'img') {
                    return {
                        nth: jest.fn((index) => ({
                            isVisible: jest.fn().mockResolvedValue(index === 1),
                            screenshot: jest.fn().mockResolvedValue(screenshotBuffer)
                        }))
                    };
                }

                return {
                    first: jest.fn(() => ({
                        isVisible: jest.fn().mockResolvedValue(false)
                    }))
                };
            }),
            evaluate: jest.fn().mockResolvedValue({
                hasCaptchaInput: true,
                captchaRect: { top: 150, left: 10, right: 250 },
                images: [
                    {
                        index: 0,
                        src: 'https://soaportals.com/logo.png',
                        id: 'main-logo',
                        className: 'brand',
                        alt: 'Logo',
                        visible: true,
                        width: 180,
                        height: 60,
                        top: 20,
                        left: 20
                    },
                    {
                        index: 1,
                        src: 'https://soaportals.com/assets/img/x1.png',
                        id: 'img-123',
                        className: 'verify-img',
                        alt: '',
                        visible: true,
                        width: 260,
                        height: 70,
                        top: 130,
                        left: 20
                    }
                ]
            })
        };

        const service = require('../services/soa-scraper.service');
        const result = await service.__private.extractCaptchaImage(page);

        expect(result).toBe(`data:image/png;base64,${screenshotBuffer.toString('base64')}`);
        expect(page.locator).toHaveBeenCalledWith('img');
    });

    it('returns null when no visible or scoreable captcha image candidates exist', async () => {
        const page = {
            locator: jest.fn((selector) => {
                if (selector === 'img') {
                    return {
                        nth: jest.fn(() => ({
                            isVisible: jest.fn().mockResolvedValue(false)
                        }))
                    };
                }

                if (selector === 'form') {
                    return {
                        first: jest.fn(() => ({
                            isVisible: jest.fn().mockResolvedValue(false),
                            locator: jest.fn(() => ({ all: jest.fn().mockResolvedValue([]) }))
                        }))
                    };
                }

                return {
                    first: jest.fn(() => ({
                        isVisible: jest.fn().mockResolvedValue(false)
                    }))
                };
            }),
            evaluate: jest.fn().mockResolvedValue({
                hasCaptchaInput: false,
                captchaRect: null,
                images: [
                    {
                        index: 0,
                        src: 'https://soaportals.com/logo.png',
                        id: 'logo',
                        className: 'brand',
                        alt: 'Logo',
                        visible: false,
                        width: 120,
                        height: 40,
                        top: 20,
                        left: 20
                    }
                ]
            })
        };

        const service = require('../services/soa-scraper.service');
        const result = await service.__private.extractCaptchaImage(page);

        expect(result).toBeNull();
    });

    it('rejects new captcha sessions when the global active-session cap is reached', async () => {
        process.env.SOA_MAX_ACTIVE_SESSIONS = '1';
        jest.resetModules();

        const { chromium } = require('playwright');
        chromium.launch.mockReset();
        chromium.executablePath.mockReset();
        chromium.executablePath.mockReturnValue('/mock/chromium');

        const service = require('../services/soa-scraper.service');
        service.__private.activeSessions.set('existing-session', {
            createdAt: Date.now(),
            context: { close: jest.fn().mockResolvedValue(undefined) },
            browser: { close: jest.fn().mockResolvedValue(undefined) }
        });

        const result = await service.createSessionAndGetCaptcha();

        expect(result).toMatchObject({
            success: false,
            status: service.STATUS_SCRAPER_BUSY,
            activeSessionCount: 1,
            maxActiveSessions: 1,
            hasCapacity: false
        });
        expect(chromium.launch).not.toHaveBeenCalled();

        service.__private.activeSessions.clear();
    });
});

describe('soa-scraper.service session lifecycle', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.SOA_MAX_ACTIVE_SESSIONS;
        delete process.env.SOA_CRAWL_DEADLINE_MS;
        const { chromium } = require('playwright');
        chromium.launch.mockReset();
        chromium.executablePath.mockReset();
        chromium.executablePath.mockReturnValue('/mock/chromium');
    });

    it('returns SESSION_EXPIRED and evicts sessions seeded with an old createdAt', async () => {
        const service = require('../services/soa-scraper.service');

        service.__private.activeSessions.set('stale-session', {
            browser: { close: async () => {} },
            context: { close: async () => {} },
            page: {},
            createdAt: Date.now() - 11 * 60 * 1000
        });

        const result = await service.loginAndScrape('stale-session', 'reg-no', 'password-value', 'captcha-value');

        expect(result).toMatchObject({
            success: false,
            status: service.STATUS_SESSION_EXPIRED,
            message: 'Session expired. Please fetch a new CAPTCHA.'
        });
        expect(service.__private.activeSessions.has('stale-session')).toBe(false);
    });

    it('rejects loginAndScrape when the session belongs to a different user', async () => {
        const service = require('../services/soa-scraper.service');

        service.__private.activeSessions.set('foreign-session', {
            browser: { close: async () => {} },
            context: { close: async () => {} },
            page: {},
            createdAt: Date.now(),
            lastActivity: Date.now(),
            userId: 'user-1'
        });

        const result = await service.loginAndScrape('foreign-session', 'reg-no', 'password-value', 'captcha-value', { userId: 'user-2' });

        expect(result).toEqual({
            success: false,
            status: service.STATUS_AUTH_FAILED,
            message: 'This SOA session belongs to a different user. Please start a new session.'
        });
        expect(service.__private.activeSessions.has('foreign-session')).toBe(false);
    });

    it('hasSnapshotContent is true only for snapshots with tables or fields', () => {
        const service = require('../services/soa-scraper.service');

        expect(service.__private.hasSnapshotContent({ tables: [{ headers: ['Subject'], rows: [['Maths']] }] })).toBe(true);
        expect(service.__private.hasSnapshotContent({ fields: { Name: 'Test Student' } })).toBe(true);
        expect(service.__private.hasSnapshotContent({ tables: [], fields: {}, headings: ['Heading'] })).toBe(false);
        expect(service.__private.hasSnapshotContent(null)).toBe(false);
        expect(service.__private.hasSnapshotContent(undefined)).toBe(false);
    });

    it('hasMeaningfulPortalData treats rawSections content as usable data', () => {
        const service = require('../services/soa-scraper.service');

        expect(service.__private.hasMeaningfulPortalData({
            profile: {},
            qualifications: [],
            attendance: {},
            marks: {},
            rawSections: {
                marks: { fields: { 'Register Number': '200101' } }
            }
        })).toBe(true);

        expect(service.__private.hasMeaningfulPortalData({
            profile: {},
            qualifications: [],
            attendance: {},
            marks: {},
            rawSections: {
                marks: { tables: [], fields: {} }
            }
        })).toBe(false);
    });

    it('getSessionPoolStats reports active, pending, and max pool slots', () => {
        process.env.SOA_MAX_ACTIVE_SESSIONS = '3';
        jest.resetModules();

        const { chromium } = require('playwright');
        chromium.launch.mockReset();
        chromium.executablePath.mockReset();
        chromium.executablePath.mockReturnValue('/mock/chromium');

        const service = require('../services/soa-scraper.service');
        service.__private.activeSessions.set('pool-session', {
            createdAt: Date.now(),
            lastActivity: Date.now(),
            context: { close: async () => {} },
            browser: { close: async () => {} }
        });

        expect(service.getSessionPoolStats()).toEqual({ active: 1, pending: 0, max: 3 });
        expect(service.__private.getSessionPoolStats()).toEqual({ active: 1, pending: 0, max: 3 });

        service.__private.activeSessions.clear();
    });
});
