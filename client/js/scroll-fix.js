/**
 * Scroll Fix & Navigation Enhancement
 * Fixes scroll jump bugs and improves navigation behavior
 */

(function() {
    'use strict';

    // ===================================
    // FIX: Prevent scroll jump on page load
    // ===================================
    let scrollPosition = 0;
    let isScrolling = false;

    // Store scroll position before any potential jumps
    window.addEventListener('load', () => {
        scrollPosition = window.scrollY;
        
        // Ensure we stay at the correct position
        setTimeout(() => {
            window.scrollTo(0, scrollPosition);
        }, 100);
    });

    // ===================================
    // FIX: Smooth scroll for anchor links
    // ===================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                // Ignore empty hash
                if (href === '#' || href === '#top') {
                    e.preventDefault();
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                    return;
                }
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    
                    // Close mobile menu if open
                    const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
                    const navLinks = document.querySelector('.nav-links');
                    const overlay = document.querySelector('.mobile-nav-overlay');
                    
                    if (mobileMenuBtn && mobileMenuBtn.classList.contains('active')) {
                        mobileMenuBtn.classList.remove('active');
                        navLinks?.classList.remove('active', 'mobile-open');
                        overlay?.classList.remove('active');
                        document.body.classList.remove('nav-open');
                    }
                    
                    // Calculate offset for fixed navbar
                    const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 70;
                    const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 20;
                    
                    // Smooth scroll to target
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ===================================
    // Back to Top Button Handler
    // ===================================
    function initBackToTop() {
        const backToTopBtn = document.getElementById('backToTopBtn');
        
        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }

    // ===================================
    // Navbar Scroll Effect
    // ===================================
    function initNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        let lastScrollY = window.scrollY;
        let ticking = false;

        const updateNavbar = () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
            
            lastScrollY = currentScrollY;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        }, { passive: true });
    }

    // ===================================
    // Prevent scroll restoration on page reload
    // ===================================
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // ===================================
    // Fix: Prevent scroll jump from animations
    // ===================================
    function preventScrollJump() {
        // Disable scroll anchoring that causes jumps
        if (CSS.supports('overflow-anchor', 'none')) {
            document.body.style.overflowAnchor = 'none';
        }

        // Ensure smooth scroll behavior
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    // ===================================
    // Handle viewport height for mobile browsers
    // ===================================
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // ===================================
    // Mobile Menu Enhancement
    // ===================================
    function enhanceMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (!mobileMenuBtn || !navLinks) return;

        // Ensure mobile menu closes when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const isMenuBtn = e.target.closest('.mobile-menu-btn');
                const isNavLinks = e.target.closest('.nav-links');
                
                if (!isMenuBtn && !isNavLinks && mobileMenuBtn.classList.contains('active')) {
                    mobileMenuBtn.classList.remove('active');
                    navLinks.classList.remove('active', 'mobile-open');
                    document.querySelector('.mobile-nav-overlay')?.classList.remove('active');
                    document.body.classList.remove('nav-open');
                }
            }
        });

        // Handle escape key to close menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenuBtn.classList.contains('active')) {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active', 'mobile-open');
                document.querySelector('.mobile-nav-overlay')?.classList.remove('active');
                document.body.classList.remove('nav-open');
            }
        });
    }

    // ===================================
    // Active Navigation Link Highlighting
    // ===================================
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '-100px 0px -50% 0px'
        });

        sections.forEach(section => observer.observe(section));
    }

    // ===================================
    // Debounce function for performance
    // ===================================
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

    // ===================================
    // Handle window resize
    // ===================================
    const handleResize = debounce(() => {
        setViewportHeight();
        
        // Close mobile menu on desktop resize
        if (window.innerWidth > 768) {
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
    }, 150);

    // ===================================
    // Initialize all features
    // ===================================
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🔧 Initializing scroll fixes and navigation enhancements...');

        try {
            preventScrollJump();
            initSmoothScroll();
            initBackToTop();
            initNavbarScroll();
            enhanceMobileMenu();
            updateActiveNavLink();
            setViewportHeight();

            // Event listeners
            window.addEventListener('resize', handleResize, { passive: true });
            window.addEventListener('orientationchange', setViewportHeight, { passive: true });

            console.log('✅ Scroll fixes and navigation enhancements initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing scroll fixes:', error);
        }
    }

    // Auto-initialize
    init();

    // Export for manual use if needed
    window.ScrollFix = {
        init,
        initSmoothScroll,
        initBackToTop,
        preventScrollJump
    };

})();
