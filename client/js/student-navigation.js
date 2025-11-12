/**
 * Student Navigation Enhancement
 * Handles hamburger menu, mobile navigation, and improved interactions
 */

(function() {
    'use strict';
    
    console.log('🎯 Loading Student Navigation Enhancements...');
    
    // ===== HAMBURGER MENU HANDLER =====
    function initHamburgerMenu() {
        const nav = document.querySelector('.dashboard-nav');
        const links = document.querySelector('.nav-links');
        const overlay = document.getElementById('navOverlay');
        
        if (!nav || !links) {
            console.warn('Navigation elements not found');
            return;
        }
        
        // Check if hamburger already exists
        let hamburger = nav.querySelector('.hamburger-menu');
        
        // Create hamburger if it doesn't exist
        if (!hamburger) {
            hamburger = document.createElement('button');
            hamburger.className = 'hamburger-menu';
            hamburger.setAttribute('aria-label', 'Toggle Navigation Menu');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.innerHTML = `
                <span class="line"></span>
                <span class="line"></span>
                <span class="line"></span>
            `;
            
            // Insert hamburger at the beginning of nav (using absolute positioning)
            // Since hamburger uses position: absolute, order doesn't matter
            nav.appendChild(hamburger);
        }
        
        // Toggle function
        function toggleMenu() {
            const isActive = links.classList.toggle('active');
            hamburger.classList.toggle('active');
            document.body.classList.toggle('nav-open');
            
            // Update ARIA
            hamburger.setAttribute('aria-expanded', isActive);
            
            // Show/hide overlay
            if (overlay) {
                overlay.style.display = isActive ? 'block' : 'none';
            }
            
            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
            
            console.log(`Menu ${isActive ? 'opened' : 'closed'}`);
        }
        
        // Close function
        function closeMenu() {
            if (links.classList.contains('active')) {
                toggleMenu();
            }
        }
        
        // Event listeners
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
        
        // Close on overlay click
        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }
        
        // Close on outside click (desktop fallback)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!nav.contains(e.target) && links.classList.contains('active')) {
                    closeMenu();
                }
            }
        });
        
        // Close on link click
        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMenu();
                }
            });
        });
        
        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && links.classList.contains('active')) {
                closeMenu();
            }
        });
        
        // Handle resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && links.classList.contains('active')) {
                closeMenu();
            }
        });
        
        console.log('✓ Hamburger menu initialized');
    }
    
    // ===== ACTIVE LINK HANDLER =====
    function initActiveLinkTracking() {
        const links = document.querySelectorAll('.nav-links a');
        const sections = document.querySelectorAll('main section[id]');
        
        if (links.length === 0 || sections.length === 0) return;
        
        // Set active based on hash
        function setActiveLink() {
            const hash = window.location.hash || '#';
            
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href === hash || (hash === '' && href === '#')) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }
        
        // Initial set
        setActiveLink();
        
        // Update on hash change
        window.addEventListener('hashchange', setActiveLink);
        
        // Update on click
        links.forEach(link => {
            link.addEventListener('click', () => {
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        
        console.log('✓ Active link tracking initialized');
    }
    
    // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
    function initSmoothScroll() {
        const links = document.querySelectorAll('.nav-links a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#' || href === '') return;
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    
                    // Get nav height for offset
                    const nav = document.querySelector('.dashboard-nav');
                    const offset = nav ? nav.offsetHeight + 20 : 80;
                    
                    const targetPosition = target.offsetTop - offset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Update URL hash
                    history.pushState(null, null, href);
                }
            });
        });
        
        console.log('✓ Smooth scroll initialized');
    }
    
    // ===== NAVIGATION SCROLL EFFECT =====
    function initScrollEffect() {
        const nav = document.querySelector('.dashboard-nav');
        if (!nav) return;
        
        let lastScroll = 0;
        const scrollThreshold = 100;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            // Add shadow on scroll
            if (currentScroll > 50) {
                nav.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                nav.style.background = 'rgba(255, 255, 255, 0.15)';
            } else {
                nav.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                nav.style.background = 'rgba(255, 255, 255, 0.1)';
            }
            
            // Hide on scroll down, show on scroll up (optional)
            // Uncomment if you want this behavior
            /*
            if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }
            */
            
            lastScroll = currentScroll;
        });
        
        console.log('✓ Scroll effect initialized');
    }
    
    // ===== ADD ICONS TO MOBILE MENU =====
    function enhanceMobileMenu() {
        if (window.innerWidth > 768) return;
        
        const links = document.querySelectorAll('.nav-links a');
        const icons = {
            'Dashboard': '🏠',
            'Attendance': '📊',
            'Marks': '📝',
            'Assignments': '📋',
            'Downloads': '📥',
            'Timetable': '📅'
        };
        
        links.forEach(link => {
            const text = link.textContent.trim();
            const icon = icons[text];
            
            if (icon && !link.querySelector('.nav-icon')) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'nav-icon';
                iconSpan.textContent = icon;
                iconSpan.style.marginRight = '8px';
                link.insertBefore(iconSpan, link.firstChild);
            }
        });
        
        console.log('✓ Mobile menu enhanced with icons');
    }
    
    // ===== KEYBOARD NAVIGATION =====
    function initKeyboardNav() {
        const links = document.querySelectorAll('.nav-links a');
        
        links.forEach((link, index) => {
            link.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = (index + 1) % links.length;
                    links[nextIndex].focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = (index - 1 + links.length) % links.length;
                    links[prevIndex].focus();
                }
            });
        });
        
        console.log('✓ Keyboard navigation initialized');
    }
    
    // ===== TOUCH GESTURES (MOBILE) =====
    function initTouchGestures() {
        if (window.innerWidth > 768) return;
        
        const nav = document.querySelector('.dashboard-nav');
        const links = document.querySelector('.nav-links');
        
        if (!nav || !links) return;
        
        let touchStartX = 0;
        let touchEndX = 0;
        
        links.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        links.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            // Swipe left to close
            if (touchStartX - touchEndX > 50) {
                if (links.classList.contains('active')) {
                    const hamburger = nav.querySelector('.hamburger-menu');
                    if (hamburger) hamburger.click();
                }
            }
        }
        
        console.log('✓ Touch gestures initialized');
    }
    
    // ===== INITIALIZE ALL =====
    function initNavigation() {
        console.log('🚀 Initializing Student Navigation...');
        
        initHamburgerMenu();
        initActiveLinkTracking();
        initSmoothScroll();
        initScrollEffect();
        enhanceMobileMenu();
        initKeyboardNav();
        initTouchGestures();
        
        console.log('✅ Student Navigation Enhancement Complete!');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        setTimeout(initNavigation, 100);
    }
    
    // Expose for debugging
    window.StudentNavigation = {
        version: '1.0.0',
        reinit: initNavigation
    };
    
})();
