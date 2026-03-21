/**
 * @jest-environment jsdom
 */

describe('mobile-fixes menu handling', () => {
    beforeEach(() => {
        jest.resetModules();

        document.body.innerHTML = `
            <nav class="navbar">
                <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-expanded="false">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <div class="nav-links">
                    <a href="#about" class="nav-link">About</a>
                </div>
            </nav>
        `;

        window.scrollTo = jest.fn();
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: query.includes('max-width'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn()
        }));
    });

    function loadMobileFixes() {
        jest.isolateModules(() => {
            require('../client/js/mobile-fixes.js');
        });
    }

    it('does not mark the dedicated mobile menu button for generic touch enhancement', () => {
        loadMobileFixes();

        const button = document.getElementById('mobileMenuBtn');
        expect(button.hasAttribute('data-touch-enhanced')).toBe(false);
    });

    it('keeps the mobile menu open when a touchend is followed by a click', () => {
        loadMobileFixes();

        const button = document.getElementById('mobileMenuBtn');
        const navLinks = document.querySelector('.nav-links');

        button.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(button.classList.contains('active')).toBe(true);
        expect(navLinks.classList.contains('active')).toBe(true);
        expect(document.body.classList.contains('nav-open')).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });
});
