// Active Link Detection for Landing Page Navigation
// Updates active state based on current scroll position

(function() {
    'use strict';

    // State
    let state = {
        sections: [],
        navLinks: [],
        ticking: false,
        currentSection: null
    };

    /**
     * Initialize active link detection
     */
    function init() {
        // Get all navigation links
        state.navLinks = document.querySelectorAll('.nav-link');
        
        if (!state.navLinks.length) {
            return;
        }

        // Get all sections that have corresponding nav links
        state.sections = Array.from(state.navLinks)
            .map(link => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const section = document.querySelector(href);
                    return {
                        id: href,
                        element: section,
                        link: link
                    };
                }
                return null;
            })
            .filter(item => item && item.element);

        if (!state.sections.length) {
            return;
        }

        // Setup event listeners
        setupEventListeners();
        
        // Initial check
        updateActiveLink();

        console.log('Navbar active link detection initialized');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Use passive listener for better performance
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Update on window resize
        window.addEventListener('resize', debounce(updateActiveLink, 100));
    }

    /**
     * Handle scroll events
     */
    function handleScroll() {
        if (!state.ticking) {
            window.requestAnimationFrame(() => {
                updateActiveLink();
                state.ticking = false;
            });
            state.ticking = true;
        }
    }

    /**
     * Update active link based on current scroll position
     */
    function updateActiveLink() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        
        // Find the current section
        let activeSection = null;
        
        for (let i = 0; i < state.sections.length; i++) {
            const section = state.sections[i];
            const rect = section.element.getBoundingClientRect();
            const sectionTop = rect.top + scrollY;
            const sectionBottom = sectionTop + rect.height;
            
            // Check if we're in this section
            // Consider a section active if it's within the top 40% of viewport
            if (scrollY >= sectionTop - windowHeight * 0.4 && 
                scrollY < sectionBottom - windowHeight * 0.4) {
                activeSection = section;
                break;
            }
        }

        // Update if changed
        if (activeSection && activeSection !== state.currentSection) {
            state.currentSection = activeSection;
            
            // Remove active class from all links
            state.navLinks.forEach(link => link.classList.remove('active'));
            
            // Add active class to current link
            if (activeSection.link) {
                activeSection.link.classList.add('active');
            }
        } else if (!activeSection && state.currentSection) {
            // No active section - remove all active states
            state.navLinks.forEach(link => link.classList.remove('active'));
            state.currentSection = null;
        }
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

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for manual control if needed
    window.NavbarActiveLinks = {
        init,
        update: updateActiveLink
    };
})();
