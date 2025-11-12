/**
 * CRITICAL FIX: Mobile Touch & Scroll Issues
 * Fixes: Button clicks not working, scroll jumping to top
 * Updated: Fixed unwanted scroll-to-top behavior on scroll stop
 */

(function() {
    'use strict';

    // ===================================
    // CRITICAL FIX 1: Prevent scroll jumps (IMPROVED)
    // ===================================
    
    // Disable scroll restoration completely
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Store scroll position continuously
    let lastScrollPosition = 0;
    let isScrolling = false;
    let scrollTimeout;
    let pageJustLoaded = true;
    let loadTime = Date.now();

    // Monitor and preserve scroll position
    function preserveScrollPosition() {
        if (!isScrolling) {
            lastScrollPosition = window.scrollY;
        }
    }

    // Track scrolling state
    window.addEventListener('scroll', function() {
        isScrolling = true;
        lastScrollPosition = window.scrollY;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
            isScrolling = false;
        }, 150);
    }, { passive: true });

    // REMOVED: Problematic MutationObserver that caused unwanted scroll restoration
    // The observer was triggering on every DOM change and forcing scroll position
    // This caused the page to jump to top when users stopped scrolling

    // Prevent scroll jump on initial page load ONLY
    window.addEventListener('load', function() {
        const initialScrollY = window.scrollY;
        
        // Only restore if we were scrolled down before refresh
        // And only do this ONCE on page load, never again
        setTimeout(function() {
            if (initialScrollY > 0 && window.scrollY === 0 && Date.now() - loadTime < 500) {
                window.scrollTo(0, initialScrollY);
            }
            // Mark that page has finished loading - no more automatic restores
            pageJustLoaded = false;
        }, 100);
    });

    // ===================================
    // CRITICAL FIX 2: Enhanced Touch Detection for Mobile
    // ===================================
    
    function enhanceTouchSupport() {
        // Get all clickable elements
        const clickableElements = document.querySelectorAll(`
            button,
            a,
            .btn,
            .nav-link,
            .mobile-menu-btn,
            .hamburger-menu,
            .feature-card,
            .why-card,
            .academic-card,
            .contact-card,
            .download-card,
            .facility-card,
            .creator-link,
            .back-to-top-btn,
            [role="button"],
            input[type="submit"],
            input[type="button"]
        `);

        clickableElements.forEach(function(element) {
            // Skip if already processed
            if (element.hasAttribute('data-touch-enhanced')) return;
            element.setAttribute('data-touch-enhanced', 'true');

            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let isTouching = false;

            // Touch start
            element.addEventListener('touchstart', function(e) {
                isTouching = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                
                // Add active state
                this.classList.add('touch-active');
            }, { passive: true });

            // Touch move - check if it's a swipe
            element.addEventListener('touchmove', function(e) {
                if (!isTouching) return;

                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const diffX = Math.abs(touchX - touchStartX);
                const diffY = Math.abs(touchY - touchStartY);

                // If moved more than 10px, it's a swipe, not a tap
                if (diffX > 10 || diffY > 10) {
                    isTouching = false;
                    this.classList.remove('touch-active');
                }
            }, { passive: true });

            // Touch end - trigger click if it was a tap
            element.addEventListener('touchend', function(e) {
                this.classList.remove('touch-active');
                
                if (!isTouching) return;

                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;

                // If touch was quick (< 500ms) and didn't move much, treat as click
                if (touchDuration < 500) {
                    e.preventDefault(); // Prevent double-tap zoom
                    
                    // Get the actual link/button target
                    const href = this.getAttribute('href');
                    const isLink = this.tagName.toLowerCase() === 'a';
                    
                    if (isLink && href) {
                        if (href.startsWith('#')) {
                            // Internal anchor link
                            e.preventDefault();
                            const target = document.querySelector(href);
                            if (target) {
                                smoothScrollToElement(target);
                            } else if (href === '#' || href === '#top') {
                                smoothScrollToTop();
                            }
                        } else if (href.startsWith('http') || href.endsWith('.html')) {
                            // External link or page navigation
                            const target = this.getAttribute('target');
                            if (target === '_blank') {
                                window.open(href, '_blank', 'noopener,noreferrer');
                            } else {
                                window.location.href = href;
                            }
                        }
                    } else {
                        // Regular button - trigger click
                        this.click();
                    }
                }
                
                isTouching = false;
            }, { passive: false }); // passive: false allows preventDefault

            // Touch cancel
            element.addEventListener('touchcancel', function() {
                this.classList.remove('touch-active');
                isTouching = false;
            });
        });
    }

    // ===================================
    // CRITICAL FIX 3: Improved Click/Tap Handler
    // ===================================
    
    function improveClickHandling() {
        // Handle all button clicks
        document.addEventListener('click', function(e) {
            const button = e.target.closest('button, .btn, a[href]');
            if (!button) return;

            const href = button.getAttribute('href');
            
            // Handle anchor links
            if (href && href.startsWith('#')) {
                e.preventDefault();
                
                if (href === '#' || href === '#top') {
                    smoothScrollToTop();
                } else {
                    const target = document.querySelector(href);
                    if (target) {
                        smoothScrollToElement(target);
                    }
                }
            }
        }, true); // Use capture phase for earlier handling
    }

    // ===================================
    // Helper: Smooth Scroll to Element
    // ===================================
    function smoothScrollToElement(element) {
        const navbar = document.querySelector('.navbar');
        const navbarHeight = navbar ? navbar.offsetHeight : 70;
        const targetPosition = element.getBoundingClientRect().top + window.scrollY - navbarHeight - 20;
        
        isScrolling = true;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        
        // Close mobile menu if open
        closeMobileMenu();
        
        setTimeout(function() {
            isScrolling = false;
            lastScrollPosition = window.scrollY;
        }, 1000);
    }

    // ===================================
    // Helper: Smooth Scroll to Top
    // ===================================
    function smoothScrollToTop() {
        isScrolling = true;
        
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Close mobile menu if open
        closeMobileMenu();
        
        setTimeout(function() {
            isScrolling = false;
            lastScrollPosition = 0;
        }, 1000);
    }

    // ===================================
    // Helper: Close Mobile Menu
    // ===================================
    function closeMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        if (mobileMenuBtn && mobileMenuBtn.classList.contains('active')) {
            mobileMenuBtn.classList.remove('active');
            navLinks?.classList.remove('active', 'mobile-open');
            overlay?.classList.remove('active');
            document.body.classList.remove('nav-open');
        }
    }

    // ===================================
    // CRITICAL FIX 4: Landscape Mode Fix
    // ===================================
    function fixLandscapeMode() {
        const updateOrientation = function() {
            const isLandscape = window.matchMedia('(orientation: landscape)').matches;
            const isMobile = window.innerWidth <= 900;
            
            if (isLandscape && isMobile) {
                document.body.classList.add('landscape-mode');
                // Increase touch target sizes in landscape
                document.documentElement.style.setProperty('--touch-target-size', '38px');
            } else {
                document.body.classList.remove('landscape-mode');
                document.documentElement.style.setProperty('--touch-target-size', '44px');
            }
        };

        window.addEventListener('orientationchange', updateOrientation);
        window.addEventListener('resize', updateOrientation);
        updateOrientation();
    }

    // ===================================
    // CRITICAL FIX 5: Prevent Double-Tap Zoom
    // ===================================
    function preventDoubleTapZoom() {
        let lastTouchEnd = 0;
        
        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }

    // ===================================
    // CRITICAL FIX 6: Enhanced Mobile Menu
    // ===================================
    function enhanceMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (!mobileMenuBtn || !navLinks) return;

        // Create overlay if it doesn't exist
        let overlay = document.querySelector('.mobile-nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-nav-overlay';
            document.body.appendChild(overlay);
        }

        // Toggle menu function
        function toggleMenu(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            const isActive = mobileMenuBtn.classList.contains('active');
            
            if (isActive) {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active', 'mobile-open');
                overlay.classList.remove('active');
                document.body.classList.remove('nav-open');
            } else {
                mobileMenuBtn.classList.add('active');
                navLinks.classList.add('active', 'mobile-open');
                overlay.classList.add('active');
                document.body.classList.add('nav-open');
            }
        }

        // Remove old listeners and add new ones
        const newMenuBtn = mobileMenuBtn.cloneNode(true);
        mobileMenuBtn.parentNode.replaceChild(newMenuBtn, mobileMenuBtn);

        // Add click listener
        newMenuBtn.addEventListener('click', toggleMenu, { passive: false });
        
        // Add touch listener for better mobile response
        newMenuBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            toggleMenu(e);
        }, { passive: false });

        // Close on overlay click
        overlay.addEventListener('click', toggleMenu);
        overlay.addEventListener('touchend', function(e) {
            e.preventDefault();
            toggleMenu(e);
        }, { passive: false });

        // Close on navigation link click
        const links = navLinks.querySelectorAll('a');
        links.forEach(function(link) {
            link.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    setTimeout(toggleMenu, 100);
                }
            });
        });

        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && newMenuBtn.classList.contains('active')) {
                toggleMenu();
            }
        });

        // Close on resize to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768 && newMenuBtn.classList.contains('active')) {
                toggleMenu();
            }
        });
    }

    // ===================================
    // CRITICAL FIX 7: Back to Top Button
    // ===================================
    function fixBackToTop() {
        const backToTopBtn = document.getElementById('backToTopBtn');
        
        if (backToTopBtn) {
            // Remove old listeners
            const newBtn = backToTopBtn.cloneNode(true);
            backToTopBtn.parentNode.replaceChild(newBtn, backToTopBtn);
            
            // Add click listener
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                smoothScrollToTop();
            });
            
            // Add touch listener
            newBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                smoothScrollToTop();
            }, { passive: false });
        }
    }

    // ===================================
    // CRITICAL FIX 8: Viewport Height for Mobile
    // ===================================
    function fixViewportHeight() {
        function updateVH() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        
        updateVH();
        window.addEventListener('resize', updateVH, { passive: true });
        window.addEventListener('orientationchange', function() {
            setTimeout(updateVH, 100);
        });
    }

    // ===================================
    // CRITICAL FIX 9: Force Repaint on Scroll Stop
    // ===================================
    function preventScrollFreeze() {
        let scrollTimer;
        
        window.addEventListener('scroll', function() {
            clearTimeout(scrollTimer);
            
            scrollTimer = setTimeout(function() {
                // Safe reflow only; do NOT toggle display which can jump scroll to top
                void document.body.offsetHeight;
            }, 150);
        }, { passive: true });
    }

    // ===================================
    // Initialize All Fixes
    // ===================================
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🔧 Applying critical mobile and scroll fixes...');

        try {
            // Apply all fixes
            preserveScrollPosition();
            enhanceTouchSupport();
            improveClickHandling();
            fixLandscapeMode();
            preventDoubleTapZoom();
            enhanceMobileMenu();
            fixBackToTop();
            fixViewportHeight();
            preventScrollFreeze();

            // Re-enhance touch on dynamic content
            const bodyObserver = new MutationObserver(function() {
                enhanceTouchSupport();
            });
            
            bodyObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('✅ All critical fixes applied successfully');
            
            // Add visual indicator for debugging
            if (window.location.search.includes('debug')) {
                const indicator = document.createElement('div');
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    background: #10b981;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    z-index: 99999;
                    font-family: monospace;
                `;
                indicator.textContent = '✓ Touch fixes active';
                document.body.appendChild(indicator);
                
                setTimeout(function() {
                    indicator.style.opacity = '0';
                    indicator.style.transition = 'opacity 0.5s';
                    setTimeout(function() {
                        indicator.remove();
                    }, 500);
                }, 3000);
            }
        } catch (error) {
            console.error('❌ Error applying fixes:', error);
        }
    }

    // Auto-initialize
    init();

    // Export for manual use
    window.MobileFixes = {
        init,
        enhanceTouchSupport,
        smoothScrollToTop,
        closeMobileMenu
    };

})();
