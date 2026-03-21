/**
 * @jest-environment jsdom
 */

describe('landing page primary navigation', () => {
    beforeEach(() => {
        jest.resetModules();

        document.body.className = 'landing-page nothing-home public-home-page nav-open';
        document.body.innerHTML = `
            <nav class="navbar">
                <div class="nav-links active mobile-open">
                    <a href="#about" class="nav-link">About</a>
                    <a href="/creator.html" class="nav-link">Creator</a>
                    <a href="/login.html" class="btn btn-primary">Portal Login</a>
                </div>
                <button type="button" class="mobile-menu-btn active" id="mobileMenuBtn" aria-expanded="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </nav>
            <div class="mobile-nav-overlay active"></div>
            <main>
                <section id="about"></section>
            </main>
        `;

        window.scrollTo = jest.fn();
        window.requestAnimationFrame = jest.fn((cb) => {
            cb();
            return 1;
        });
        window.LinkEncoding = { navigateTo: jest.fn() };
        window.NavbarScrollBehavior = { show: jest.fn() };
        window.NavbarActiveLinks = { update: jest.fn() };
        window.history.replaceState = jest.fn();

        Object.defineProperty(window, 'scrollY', {
            value: 120,
            configurable: true,
            writable: true
        });

        const navbar = document.querySelector('.navbar');
        Object.defineProperty(navbar, 'offsetHeight', {
            value: 80,
            configurable: true
        });

        const aboutSection = document.getElementById('about');
        aboutSection.getBoundingClientRect = jest.fn(() => ({ top: 500 }));
    });

    function loadLanding() {
        jest.isolateModules(() => {
            require('../client/js/landing.js');
        });
    }

    it('scrolls to home sections from the top nav and closes the mobile menu', () => {
        loadLanding();
        window.Landing.initPrimaryNavLinks();

        const aboutLink = document.querySelector('.nav-link[href="#about"]');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        const dispatchResult = aboutLink.dispatchEvent(event);

        expect(dispatchResult).toBe(false);
        expect(window.NavbarScrollBehavior.show).toHaveBeenCalled();
        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 520,
            behavior: 'smooth'
        });
        expect(document.getElementById('mobileMenuBtn').classList.contains('active')).toBe(false);
        expect(document.querySelector('.nav-links').classList.contains('active')).toBe(false);
        expect(document.body.classList.contains('nav-open')).toBe(false);
        expect(window.history.replaceState).toHaveBeenCalled();
        expect(window.NavbarActiveLinks.update).toHaveBeenCalled();
    });

    it('navigates internal top-nav routes through LinkEncoding', () => {
        loadLanding();
        window.Landing.initPrimaryNavLinks();

        const creatorLink = document.querySelector('.nav-link[href="/creator.html"]');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        const dispatchResult = creatorLink.dispatchEvent(event);

        expect(dispatchResult).toBe(false);
        expect(window.LinkEncoding.navigateTo).toHaveBeenCalledWith('/creator.html');
        expect(document.getElementById('mobileMenuBtn').classList.contains('active')).toBe(false);
    });
});
