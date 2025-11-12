(
function () {
    'use strict';

    // Handle pull-to-refresh on mobile
    function initPullToRefresh() {
        if (!('ontouchstart' in window)) return;

        let startY = 0;
        let startX = 0;
        let currentY = 0;
        let isDragging = false;
        const threshold = 90; // require a bit more pull
        const horizontalTolerance = 12; // px
        let lastRefreshAt = 0;
        const cooldownMs = 3000; // 3s cooldown

        const indicator = document.createElement('div');
        indicator.className = 'pull-to-refresh-indicator';
        indicator.innerHTML = `
            <div class="spinner"></div>
            <span class="text">Pull to refresh</span>
        `;
        document.body.appendChild(indicator);

        const resetIndicator = () => {
            indicator.style.transform = 'translate(-50%, -100%)';
            indicator.classList.remove('ready', 'refreshing');
            indicator.querySelector('.text').textContent = 'Pull to refresh';
        };

        const updateIndicator = (distance) => {
            const percent = Math.min(distance / threshold, 1);
            indicator.style.transform = `translate(-50%, ${-100 + percent * 100}%)`;
            if (percent >= 1) {
                indicator.classList.add('ready');
                indicator.querySelector('.text').textContent = 'Release to refresh';
            } else {
                indicator.classList.remove('ready');
                indicator.querySelector('.text').textContent = 'Pull to refresh';
            }
        };

        const refresh = async () => {
            indicator.classList.add('refreshing');
            indicator.querySelector('.text').textContent = 'Refreshing...';
            try {
                await new Promise(resolve => setTimeout(resolve, 600));
                // Disable full page reload to prevent auto-reload loops
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                lastRefreshAt = Date.now();
                // Reset handled after reload; if not reloaded, reset after short delay
                setTimeout(() => {
                    resetIndicator();
                }, 500);
            }
        };

        document.addEventListener('touchstart', (e) => {
            const atTop = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
            const isScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight;
            const now = Date.now();
            if (!atTop || !isScrollable || (now - lastRefreshAt <= cooldownMs)) {
                isDragging = false;
                return;
            }
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const dy = currentY - startY;
            const dx = Math.abs(currentX - startX);

            // Cancel if mostly horizontal gesture
            if (dx > horizontalTolerance && Math.abs(dy) < 2 * dx) {
                isDragging = false;
                resetIndicator();
                return;
            }

            if (dy > 0 && (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0) {
                e.preventDefault();
                updateIndicator(dy);
            }
        }, { passive: false });

        document.addEventListener('touchend', async () => {
            if (!isDragging) return;
            isDragging = false;
            const dy = currentY - startY;
            if (dy >= (threshold + 10)) {
                await refresh();
            } else {
                resetIndicator();
            }
        });
    }

    // Optimize touch scrolling
    function initSmoothScrolling() {
        // Add smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Minimal stubs to avoid runtime errors if not defined elsewhere
    function initMobileMenu() {
        // If a mobile menu toggle exists, wire it up; otherwise, no-op
        const toggle = document.querySelector('#mobile-menu-toggle, .mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar, .side-nav, aside');
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-visible');
            });
        }
    }

    function initMobileBottomNav() {
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (!bottomNav) return;
        bottomNav.addEventListener('click', (e) => {
            const link = e.target.closest('a.nav-item');
            if (!link) return;
            bottomNav.querySelectorAll('.nav-item.active').forEach(n => n.classList.remove('active'));
            link.classList.add('active');
        });
    }

    // Handle orientation changes
    function handleOrientationChange() {
        const onOrientationChange = () => {
            // Update viewport height for mobile browsers without forcing reflow/display toggles
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        window.addEventListener('orientationchange', onOrientationChange);
        window.addEventListener('resize', onOrientationChange);
        
        // Initial call
        onOrientationChange();
    }

    // Optimize images for mobile
    function optimizeImages() {
        const images = document.querySelectorAll('img[data-src-mobile]');
        
        const loadMobileImage = (img) => {
            if (window.innerWidth <= 768 && img.dataset.srcMobile) {
                img.src = img.dataset.srcMobile;
            }
        };

        images.forEach(loadMobileImage);
        
        window.addEventListener('resize', () => {
            images.forEach(loadMobileImage);
        });
    }

    // Add swipe gesture support for cards
    function initSwipeGestures() {
        const swipeableCards = document.querySelectorAll('.swipeable-card');
        
        swipeableCards.forEach(card => {
            let startX = 0;
            let currentX = 0;
            let isSwiping = false;

            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].pageX;
                isSwiping = true;
                card.classList.add('swiping');
            });

            card.addEventListener('touchmove', (e) => {
                if (!isSwiping) return;
                
                currentX = e.touches[0].pageX;
                const diffX = currentX - startX;
                
                if (Math.abs(diffX) > 10) {
                    card.style.transform = `translateX(${diffX}px)`;
                }
            });

            card.addEventListener('touchend', () => {
                if (!isSwiping) return;
                
                const diffX = currentX - startX;
                isSwiping = false;
                card.classList.remove('swiping');
                
                // If swiped more than 100px, trigger action
                if (diffX < -100) {
                    card.style.transform = 'translateX(-100%)';
                    // Show action buttons
                    const actions = card.querySelector('.swipe-actions');
                    if (actions) actions.style.display = 'flex';
                } else {
                    card.style.transform = '';
                }
            });
        });
    }

    // Handle mobile table responsiveness
    function initResponsiveTables() {
        const tables = document.querySelectorAll('table:not(.data-table)');
        
        tables.forEach(table => {
            // Wrap table in responsive container if not already wrapped
            if (!table.parentElement.classList.contains('table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }

            // Add data-label attributes for stacked mobile view
            const headers = table.querySelectorAll('th');
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, index) => {
                    if (headers[index]) {
                        cell.setAttribute('data-label', headers[index].textContent);
                    }
                });
            });
        });
    }

    // Initialize viewport height fix for mobile browsers
    function initViewportFix() {
        // First we get the viewport height and multiply it by 1% to get a value for a vh unit
        let vh = window.innerHeight * 0.01;
        // Then we set the value in the --vh custom property to the root of the document
        document.documentElement.style.setProperty('--vh', `${vh}px`);

        // We listen to the resize event
        window.addEventListener('resize', () => {
            // We execute the same script as before
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        });
    }

    // Prevent zoom on input focus (iOS)
    function preventInputZoom() {
        const inputs = document.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // Ensure font-size is at least 16px to prevent iOS zoom
            const fontSize = window.getComputedStyle(input).fontSize;
            if (parseFloat(fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        });
    }

    // Handle bottom navigation visibility on scroll
    function initBottomNavScroll() {
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (!bottomNav) return;

        let lastScrollY = window.scrollY;
        let ticking = false;

        const updateNavVisibility = () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling down - hide nav
                bottomNav.style.transform = 'translateY(100%)';
            } else {
                // Scrolling up - show nav
                bottomNav.style.transform = 'translateY(0)';
            }
            
            lastScrollY = currentScrollY;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateNavVisibility);
                ticking = true;
            }
        });
    }

    // Add haptic feedback for touch interactions (if supported)
    function initHapticFeedback() {
        if (!('vibrate' in navigator)) return;

        const hapticElements = document.querySelectorAll('.btn, button, .nav-item, .card');
        
        hapticElements.forEach(element => {
            element.addEventListener('touchstart', () => {
                navigator.vibrate(10); // Light tap feedback
            });
        });
    }

    // Initialize all mobile features
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🔧 Initializing mobile responsive features...');

        try {
            initMobileMenu();
            initMobileBottomNav();
            initSmoothScrolling();
            handleOrientationChange();
            optimizeImages();
            initSwipeGestures();
            initResponsiveTables();
            initViewportFix();
            preventInputZoom();
            initBottomNavScroll();
            initHapticFeedback();
            
            // Optional: Pull to refresh (can be disabled if not needed)
            // initPullToRefresh();

            console.log('✅ Mobile responsive features initialized');
        } catch (error) {
            console.error('Error initializing mobile features:', error);
        }
    }

    // Auto-initialize
    init();

    // Export for manual initialization if needed
    window.MobileNav = {
        init,
        initMobileMenu,
        initMobileBottomNav,
        initPullToRefresh,
        initSmoothScrolling
    };

})();
