/**
 * Page Transition System using GSAP
 * Provides smooth transitions between pages and sections
 */

class PageTransitions {
    constructor() {
        this.isTransitioning = false;
        this.init();
    }

    init() {
        // Initialize GSAP if available
        if (typeof gsap === 'undefined') {
            console.warn('GSAP not loaded. Using fallback transitions.');
            this.useGSAP = false;
        } else {
            this.useGSAP = true;
            this.setupGSAPDefaults();
        }

        // Setup navigation listeners
        this.setupNavigationListeners();
    }

    setupGSAPDefaults() {
        gsap.config({
            force3D: true,
            nullTargetWarn: false
        });

        gsap.defaults({
            ease: 'power3.out',
            duration: 0.6
        });
    }

    setupNavigationListeners() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && !link.hasAttribute('data-no-transition')) {
                const href = link.getAttribute('href');
                // Ignore modifier/middle-clicks
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

                // Skip anchors, downloads, new tabs, special protocols
                const isAnchor = href.startsWith('#');
                const isDownload = link.hasAttribute('download');
                const isNewTab = link.getAttribute('target') === '_blank';
                const isSpecial = /^(mailto:|tel:|javascript:)/i.test(href);

                // Skip file/API downloads or static assets
                const isFileOrApi = /\.(pdf|zip|docx?|xlsx?|pptx?|png|jpe?g|gif|webp|mp4|mp3)(\?|$)/i.test(href)
                                  || /\/(api|uploads)\//i.test(href);

                // Only intercept same-origin html navigation
                if (!isAnchor && !isDownload && !isNewTab && !isSpecial && !isFileOrApi && this.isSameOrigin(href)) {
                    e.preventDefault();
                    this.navigateToPage(href);
                }
            }
        });
    }

    isSameOrigin(href) {
        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin;
        } catch {
            return true; // Relative URLs
        }
    }

    async navigateToPage(href) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        try {
            await this.fadeOut();
            window.location.href = href;
        } catch (error) {
            console.error('Navigation error:', error);
            this.isTransitioning = false;
        }
    }

    fadeOut() {
        return new Promise((resolve) => {
            if (this.useGSAP) {
                gsap.to('main, .dashboard-main', {
                    opacity: 0,
                    y: -30,
                    duration: 0.4,
                    onComplete: resolve
                });
            } else {
                const main = document.querySelector('main, .dashboard-main');
                if (main) {
                    main.style.transition = 'opacity 0.4s, transform 0.4s';
                    main.style.opacity = '0';
                    main.style.transform = 'translateY(-30px)';
                }
                setTimeout(resolve, 400);
            }
        });
    }

    fadeIn(element = 'main, .dashboard-main') {
        if (this.useGSAP) {
            gsap.from(element, {
                opacity: 0,
                y: 30,
                duration: 0.6,
                ease: 'power3.out'
            });
        } else {
            const el = document.querySelector(element);
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.6s, transform 0.6s';
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 10);
            }
        }
    }

    // Stagger animation for elements
    staggerIn(selector, options = {}) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) return;

        const defaults = {
            delay: 0.1,
            stagger: 0.1,
            y: 30,
            opacity: 0,
            duration: 0.6
        };

        const config = { ...defaults, ...options };

        if (this.useGSAP) {
            gsap.from(elements, {
                opacity: config.opacity,
                y: config.y,
                duration: config.duration,
                stagger: config.stagger,
                delay: config.delay,
                ease: 'power3.out'
            });
        } else {
            // Fallback animation
            elements.forEach((el, index) => {
                el.style.opacity = '0';
                el.style.transform = `translateY(${config.y}px)`;
                el.style.transition = `opacity ${config.duration}s, transform ${config.duration}s`;
                
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, (config.delay + index * config.stagger) * 1000);
            });
        }
    }

    // Section transition
    transitionSection(fromSection, toSection) {
        return new Promise((resolve) => {
            if (this.useGSAP) {
                const tl = gsap.timeline({ onComplete: resolve });
                
                tl.to(fromSection, {
                    opacity: 0,
                    x: -50,
                    duration: 0.3
                })
                .set(fromSection, { display: 'none' })
                .set(toSection, { display: 'block', opacity: 0, x: 50 })
                .to(toSection, {
                    opacity: 1,
                    x: 0,
                    duration: 0.4
                });
            } else {
                fromSection.style.transition = 'opacity 0.3s, transform 0.3s';
                fromSection.style.opacity = '0';
                fromSection.style.transform = 'translateX(-50px)';

                setTimeout(() => {
                    fromSection.style.display = 'none';
                    toSection.style.display = 'block';
                    toSection.style.opacity = '0';
                    toSection.style.transform = 'translateX(50px)';
                    toSection.style.transition = 'opacity 0.4s, transform 0.4s';

                    setTimeout(() => {
                        toSection.style.opacity = '1';
                        toSection.style.transform = 'translateX(0)';
                        resolve();
                    }, 10);
                }, 300);
            }
        });
    }

    // Card flip animation
    flipCard(card) {
        if (this.useGSAP) {
            gsap.to(card, {
                rotateY: 180,
                duration: 0.6,
                ease: 'power2.inOut'
            });
        } else {
            card.style.transition = 'transform 0.6s';
            card.style.transform = 'rotateY(180deg)';
        }
    }

    // Scale animation
    scaleIn(element, scale = 0.8) {
        if (this.useGSAP) {
            gsap.from(element, {
                scale: scale,
                opacity: 0,
                duration: 0.5,
                ease: 'back.out(1.7)'
            });
        } else {
            element.style.transform = `scale(${scale})`;
            element.style.opacity = '0';
            element.style.transition = 'transform 0.5s, opacity 0.5s';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.opacity = '1';
            }, 10);
        }
    }

    // Slide animation
    slideIn(element, direction = 'left') {
        const directions = {
            left: { x: -100, y: 0 },
            right: { x: 100, y: 0 },
            up: { x: 0, y: -100 },
            down: { x: 0, y: 100 }
        };

        const { x, y } = directions[direction];

        if (this.useGSAP) {
            gsap.from(element, {
                x: x,
                y: y,
                opacity: 0,
                duration: 0.6,
                ease: 'power3.out'
            });
        } else {
            element.style.transform = `translate(${x}px, ${y}px)`;
            element.style.opacity = '0';
            element.style.transition = 'transform 0.6s, opacity 0.6s';
            setTimeout(() => {
                element.style.transform = 'translate(0, 0)';
                element.style.opacity = '1';
            }, 10);
        }
    }

    // Scroll reveal
    setupScrollReveal(selector = '.scroll-reveal') {
        const elements = document.querySelectorAll(selector);
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    if (this.useGSAP) {
                        gsap.to(entry.target, {
                            opacity: 1,
                            y: 0,
                            duration: 0.6,
                            ease: 'power3.out'
                        });
                    }
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        elements.forEach(el => observer.observe(el));
    }

    // Loading transition
    showLoader() {
        const loader = document.createElement('div');
        loader.className = 'page-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <p>Loading...</p>
        `;
        document.body.appendChild(loader);

        if (this.useGSAP) {
            gsap.from(loader, { opacity: 0, duration: 0.3 });
        }

        return loader;
    }

    hideLoader(loader) {
        if (this.useGSAP) {
            gsap.to(loader, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => loader.remove()
            });
        } else {
            loader.style.transition = 'opacity 0.3s';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
    }
}

// Initialize transitions on page load
let pageTransitions;

document.addEventListener('DOMContentLoaded', () => {
    pageTransitions = new PageTransitions();
    
    // Fade in main content
    pageTransitions.fadeIn();
    
    // Setup scroll reveal
    pageTransitions.setupScrollReveal();
    
    // Stagger in cards
    setTimeout(() => {
        pageTransitions.staggerIn('.glass-card, .widget, .stat-card');
    }, 300);
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageTransitions;
}
