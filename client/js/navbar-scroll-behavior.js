// Scrolling Navigation Bar Behavior
// Hide on scroll down, show on scroll up with smooth animations

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        scrollThreshold: 10,        // Minimum scroll distance to trigger hide/show
        scrollUpThreshold: 5,       // Minimum scroll up to show navbar
        debounceDelay: 10,          // Debounce delay for scroll events (in ms)
        hideDelay: 150,             // Delay before hiding navbar (in ms)
        showDelay: 0,               // Delay before showing navbar (in ms)
    };

    // State
    let state = {
        lastScrollY: 0,
        currentScrollY: 0,
        isScrollingDown: false,
        isNavbarVisible: true,
        ticking: false,
        hideTimeout: null,
        navbar: null,
        isAtTop: true
    };

    /**
     * Initialize the scrolling navigation behavior
     */
    function init() {
        // Get navbar element
        state.navbar = document.querySelector('.navbar');

        if (!state.navbar) {
            console.warn('Navbar not found for scroll behavior');
            return;
        }

        // Set initial state
        state.lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
        state.currentScrollY = state.lastScrollY;
        state.isAtTop = state.currentScrollY <= CONFIG.scrollThreshold;

        // Add initial class
        state.navbar.classList.add('navbar-initial', 'navbar-visible');
        
        // Remove initial animation class after animation completes
        setTimeout(() => {
            state.navbar.classList.remove('navbar-initial');
        }, 600);

        // Setup event listeners
        setupEventListeners();

        console.log('Navbar scroll behavior initialized');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Use passive listener for better performance
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Handle window resize
        window.addEventListener('resize', debounce(handleResize, 200));

        // Reset on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            updateNavbarState(true); // Show navbar when page becomes visible
        });
    }

    /**
     * Handle scroll events
     */
    function handleScroll() {
        state.currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Request animation frame for smooth updates
        if (!state.ticking) {
            window.requestAnimationFrame(() => {
                updateScrollDirection();
                updateNavbarState();
                state.ticking = false;
            });
            state.ticking = true;
        }
    }

    /**
     * Update scroll direction
     */
    function updateScrollDirection() {
        const scrollDifference = state.currentScrollY - state.lastScrollY;
        
        // Only update if scroll difference is above threshold
        if (Math.abs(scrollDifference) < CONFIG.scrollThreshold) {
            return;
        }

        state.isScrollingDown = scrollDifference > 0;
        state.isAtTop = state.currentScrollY <= CONFIG.scrollThreshold;
        state.lastScrollY = state.currentScrollY;
    }

    /**
     * Update navbar visibility state
     * @param {boolean} forceShow - Force navbar to show
     */
    function updateNavbarState(forceShow = false) {
        if (!state.navbar) return;

        // Clear any pending hide timeout
        if (state.hideTimeout) {
            clearTimeout(state.hideTimeout);
            state.hideTimeout = null;
        }

        // Determine if navbar should be visible
        const shouldShow = forceShow || 
                          state.isAtTop || 
                          !state.isScrollingDown ||
                          state.currentScrollY < state.lastScrollY - CONFIG.scrollUpThreshold;

        // Update navbar visibility with appropriate delay
        if (shouldShow && !state.isNavbarVisible) {
            // Show navbar immediately (or with small delay)
            if (CONFIG.showDelay > 0) {
                setTimeout(() => showNavbar(), CONFIG.showDelay);
            } else {
                showNavbar();
            }
        } else if (!shouldShow && state.isNavbarVisible && !state.isAtTop) {
            // Hide navbar with delay
            state.hideTimeout = setTimeout(() => hideNavbar(), CONFIG.hideDelay);
        }

        // Add scrolled class for styling (e.g., shadow)
        if (state.currentScrollY > CONFIG.scrollThreshold) {
            state.navbar.classList.add('navbar-scrolled');
        } else {
            state.navbar.classList.remove('navbar-scrolled');
        }
    }

    /**
     * Show the navbar
     */
    function showNavbar() {
        if (!state.navbar || state.isNavbarVisible) return;

        state.isNavbarVisible = true;
        state.navbar.classList.remove('navbar-hidden');
        state.navbar.classList.add('navbar-visible');
        state.navbar.setAttribute('aria-hidden', 'false');

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('navbar:show'));
    }

    /**
     * Hide the navbar
     */
    function hideNavbar() {
        if (!state.navbar || !state.isNavbarVisible) return;

        state.isNavbarVisible = false;
        state.navbar.classList.remove('navbar-visible');
        state.navbar.classList.add('navbar-hidden');
        state.navbar.setAttribute('aria-hidden', 'true');

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('navbar:hide'));
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        // Reset state on resize
        state.lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
        state.currentScrollY = state.lastScrollY;
        updateNavbarState(state.currentScrollY <= CONFIG.scrollThreshold);
    }

    /**
     * Debounce function for performance
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Public API
     */
    window.NavbarScrollBehavior = {
        init,
        show: () => updateNavbarState(true),
        hide: hideNavbar,
        isVisible: () => state.isNavbarVisible,
        getScrollY: () => state.currentScrollY
    };

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Debug helper (development only)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Navbar Scroll Behavior: Debug mode enabled');
        console.log('Available commands:', {
            'NavbarScrollBehavior.show()': 'Force show navbar',
            'NavbarScrollBehavior.hide()': 'Force hide navbar',
            'NavbarScrollBehavior.isVisible()': 'Check navbar visibility',
            'NavbarScrollBehavior.getScrollY()': 'Get current scroll position'
        });
    }
})();

// Integration with mobile menu
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        // Show navbar when mobile menu is opened
        mobileMenuBtn.addEventListener('click', () => {
            const isOpening = !navLinks.classList.contains('active');
            if (isOpening && window.NavbarScrollBehavior) {
                window.NavbarScrollBehavior.show();
            }
        });
    }
});
