(function() {
    'use strict';

    function initRevealOnScroll() {
        const elements = document.querySelectorAll('.reveal-on-scroll');
        if (!elements.length) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px'
        });

        elements.forEach((element) => observer.observe(element));
    }

    function initCounters() {
        const counters = document.querySelectorAll('.counter');
        if (!counters.length) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const counter = entry.target;
                const target = Number(counter.dataset.target || 0);
                const suffix = counter.dataset.suffix || '';

                if (!Number.isFinite(target) || target <= 0) {
                    counter.textContent = `${counter.textContent || target}${suffix}`;
                    observer.unobserve(counter);
                    return;
                }

                const duration = 1400;
                const startTime = performance.now();

                function step(currentTime) {
                    const progress = Math.min((currentTime - startTime) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const value = Math.round(target * eased);

                    counter.textContent = `${value}${suffix}`;

                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    }
                }

                window.requestAnimationFrame(step);
                observer.unobserve(counter);
            });
        }, {
            threshold: 0.35
        });

        counters.forEach((counter) => observer.observe(counter));
    }

    function initStatusRotation() {
        const statusElement = document.getElementById('liveStatus');
        if (!statusElement) {
            return;
        }

        const messages = [
            'Simple. Useful. Fast.',
            'Built for direct access.',
            'Premium without the clutter.'
        ];

        let index = 0;
        window.setInterval(() => {
            index = (index + 1) % messages.length;
            statusElement.textContent = messages[index];
        }, 2400);
    }

    function initCurrentYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = String(new Date().getFullYear());
        }
    }

    function initLogoShortcut() {
        const logoLink = document.querySelector('.nav-logo');
        if (!logoLink) {
            return;
        }

        logoLink.addEventListener('click', (event) => {
            const isHome = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
            if (!isHome) {
                return;
            }

            event.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    function closePrimaryMobileMenu() {
        const menuButton = document.getElementById('mobileMenuBtn');
        const navLinks = document.querySelector('.nav-links');
        const overlay = document.querySelector('.mobile-nav-overlay');

        if (!menuButton || !navLinks) {
            return;
        }

        menuButton.classList.remove('active');
        navLinks.classList.remove('active', 'mobile-open');
        overlay?.classList.remove('active');
        document.body.classList.remove('nav-open');
        menuButton.setAttribute('aria-expanded', 'false');
    }

    function scrollToHomeSection(hash) {
        if (!hash || !hash.startsWith('#')) {
            return false;
        }

        const target = document.querySelector(hash);
        if (!target) {
            return false;
        }

        if (window.NavbarScrollBehavior?.show) {
            window.NavbarScrollBehavior.show();
        }

        const navbar = document.querySelector('.navbar');
        const navbarHeight = navbar ? navbar.offsetHeight : 70;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 20;

        closePrimaryMobileMenu();
        window.scrollTo({
            top: Math.max(targetPosition, 0),
            behavior: 'smooth'
        });

        if (window.history?.replaceState) {
            window.history.replaceState(window.history.state, document.title, hash);
        }

        window.requestAnimationFrame(() => {
            window.NavbarActiveLinks?.update?.();
        });

        return true;
    }

    function isPrimaryInternalLink(link, href, event) {
        if (!link || !href || href.startsWith('#')) {
            return false;
        }

        if (link.hasAttribute('download') || link.getAttribute('target') === '_blank') {
            return false;
        }

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) {
            return false;
        }

        if (/^(mailto:|tel:|javascript:)/i.test(href)) {
            return false;
        }

        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin;
        } catch (_) {
            return href.startsWith('/') || href.startsWith('./') || href.startsWith('../');
        }
    }

    function initPrimaryNavLinks() {
        const navLinks = document.querySelectorAll('.navbar .nav-links a[href]');
        if (!navLinks.length) {
            return;
        }

        navLinks.forEach((link) => {
            if (link.dataset.primaryNavBound === 'true') {
                return;
            }

            link.dataset.primaryNavBound = 'true';
            link.addEventListener('click', (event) => {
                const href = link.getAttribute('href');
                if (!href) {
                    return;
                }

                if (href.startsWith('#')) {
                    const handled = scrollToHomeSection(href);
                    if (handled) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    return;
                }

                if (isPrimaryInternalLink(link, href, event) && window.LinkEncoding?.navigateTo) {
                    event.preventDefault();
                    event.stopPropagation();
                    closePrimaryMobileMenu();
                    window.LinkEncoding.navigateTo(href);
                }
            });
        });
    }

    function initMobileAriaState() {
        const menuButton = document.getElementById('mobileMenuBtn');
        const navLinks = document.querySelector('.nav-links');

        if (!menuButton || !navLinks) {
            return;
        }

        const updateExpandedState = () => {
            menuButton.setAttribute('aria-expanded', navLinks.classList.contains('active') ? 'true' : 'false');
        };

        menuButton.addEventListener('click', () => {
            window.requestAnimationFrame(updateExpandedState);
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.navbar')) {
                window.requestAnimationFrame(updateExpandedState);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                window.requestAnimationFrame(updateExpandedState);
            }
        });

        updateExpandedState();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initRevealOnScroll();
        initCounters();
        initStatusRotation();
        initCurrentYear();
        initLogoShortcut();
        initPrimaryNavLinks();
        initMobileAriaState();
    });

    window.Landing = {
        initRevealOnScroll,
        initCounters,
        initPrimaryNavLinks,
        scrollToHomeSection
    };
})();
