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
        initMobileAriaState();
    });

    window.Landing = {
        initRevealOnScroll,
        initCounters
    };
})();
