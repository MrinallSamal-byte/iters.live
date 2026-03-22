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
    });

    it('extracts captcha from direct verify image selector when visible', async () => {
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
        expect(page.locator).toHaveBeenCalledWith('.verify-img');
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
});
