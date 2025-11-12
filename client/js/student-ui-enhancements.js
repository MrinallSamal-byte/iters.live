/**
 * Student Dashboard UI/UX Enhancements
 * Professional animations and interactions
 */

(function() {
    'use strict';
    
    console.log('🎨 Loading Student UI/UX Enhancements...');
    
    // ===== THEME TOGGLE FUNCTIONALITY =====
    function initEnhancedThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) {
            console.warn('Theme toggle button not found');
            return;
        }
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.body.classList.toggle('light-theme', savedTheme === 'light');
        updateThemeIcon(savedTheme);
        
        // Add click handler
        themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light-theme');
            const newTheme = isLight ? 'dark' : 'light';
            
            // Smooth transition
            document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            document.body.classList.toggle('light-theme');
            
            // Save preference
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            
            // Show feedback
            if (typeof Toast !== 'undefined') {
                Toast.success(`Switched to ${newTheme} mode`, 'Theme');
            }
        });
        
        console.log('✓ Enhanced theme toggle initialized');
    }
    
    function updateThemeIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    // ===== PROFILE DROPDOWN FIX =====
    function fixProfileDropdown() {
        const profileBtn = document.getElementById('profileAvatarBtn');
        const dropdown = document.getElementById('profileDropdown');
        
        if (!profileBtn || !dropdown) {
            console.warn('Profile components not found, will retry...');
            // Retry after a short delay
            setTimeout(fixProfileDropdown, 500);
            return;
        }
        
        console.log('✓ Profile dropdown elements found');
        
        // Enhanced click handler with proper event propagation
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isOpen = dropdown.classList.contains('show');
            
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                closeDropdown();
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDropdown();
            }
        });
        
        function openDropdown() {
            dropdown.classList.add('show');
            profileBtn.setAttribute('aria-expanded', 'true');
            dropdown.setAttribute('aria-hidden', 'false');
            
            // Add animation
            dropdown.style.animation = 'dropdownSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        
        function closeDropdown() {
            dropdown.classList.remove('show');
            profileBtn.setAttribute('aria-expanded', 'false');
            dropdown.setAttribute('aria-hidden', 'true');
        }
        
        console.log('✓ Profile dropdown functionality fixed');
    }
    
    // Add dropdown animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes dropdownSlideIn {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // ===== SCROLL REVEAL ANIMATIONS =====
    function initScrollReveal() {
        const revealElements = document.querySelectorAll('.scroll-reveal');
        
        if (revealElements.length === 0) return;
        
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        revealElements.forEach(el => observer.observe(el));
        
        console.log(`✓ Scroll reveal initialized for ${revealElements.length} elements`);
    }
    
    // ===== COUNTER ANIMATIONS =====
    function animateCounters() {
        const counters = document.querySelectorAll('.counter');
        
        counters.forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target'));
            const decimals = parseInt(counter.getAttribute('data-decimals')) || 0;
            const duration = 2000; // 2 seconds
            const increment = target / (duration / 16); // 60fps
            
            let current = 0;
            
            const updateCounter = () => {
                current += increment;
                
                if (current < target) {
                    counter.textContent = current.toFixed(decimals);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toFixed(decimals);
                }
            };
            
            // Start animation when visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        updateCounter();
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            observer.observe(counter);
        });
        
        console.log(`✓ Counter animations initialized for ${counters.length} counters`);
    }
    
    // ===== PROGRESS BAR ANIMATIONS =====
    function animateProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        
        progressBars.forEach(bar => {
            const targetWidth = bar.getAttribute('data-progress');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            bar.style.width = targetWidth + '%';
                        }, 100);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            observer.observe(bar);
        });
        
        console.log(`✓ Progress bar animations initialized for ${progressBars.length} bars`);
    }
    
    // ===== STAT CARD INTERACTIONS =====
    function enhanceStatCards() {
        const statCards = document.querySelectorAll('.stat-card');
        
        statCards.forEach(card => {
            // Add smooth hover effect
            card.addEventListener('mouseenter', () => {
                const icon = card.querySelector('.stat-icon');
                if (icon) {
                    icon.style.transform = 'scale(1.2) rotate(10deg)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                const icon = card.querySelector('.stat-icon');
                if (icon) {
                    icon.style.transform = 'scale(1) rotate(0deg)';
                }
            });
            
            // Add click ripple effect
            card.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50%;
                    background: rgba(99, 102, 241, 0.3);
                    left: ${x}px;
                    top: ${y}px;
                    pointer-events: none;
                    animation: ripple-expand 0.6s ease-out;
                `;
                
                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 600);
            });
        });
        
        console.log(`✓ Enhanced ${statCards.length} stat cards`);
    }
    
    // Add ripple animation
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        @keyframes ripple-expand {
            from {
                transform: scale(0);
                opacity: 1;
            }
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(rippleStyle);
    
    // ===== SMOOTH SCROLL =====
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                e.preventDefault();
                const target = document.querySelector(href);
                
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        console.log('✓ Smooth scroll initialized');
    }
    
    // ===== CARD HOVER EFFECTS =====
    function enhanceCards() {
        const cards = document.querySelectorAll('.glass-card, .hover-lift');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            });
        });
        
        console.log(`✓ Enhanced ${cards.length} cards`);
    }
    
    // ===== LOADING STATE IMPROVEMENTS =====
    function enhanceLoadingStates() {
        // Add shimmer effect to loading elements
        const loadingElements = document.querySelectorAll('[data-loading="true"]');
        
        loadingElements.forEach(el => {
            el.classList.add('loading-shimmer');
        });
        
        console.log(`✓ Enhanced ${loadingElements.length} loading states`);
    }
    
    // ===== PARALLAX TEXT EFFECT =====
    function initParallaxText() {
        const parallaxElements = document.querySelectorAll('.parallax-text');
        
        window.addEventListener('scroll', () => {
            parallaxElements.forEach(el => {
                const speed = el.getAttribute('data-speed') || 0.5;
                const yPos = -(window.pageYOffset * speed);
                el.style.transform = `translateY(${yPos}px)`;
            });
        });
        
        console.log(`✓ Parallax effect initialized for ${parallaxElements.length} elements`);
    }
    
    // ===== ACCESSIBILITY ENHANCEMENTS =====
    function enhanceAccessibility() {
        // Add keyboard navigation
        const interactiveElements = document.querySelectorAll('.stat-card, .hover-lift, .ripple-effect');
        
        interactiveElements.forEach(el => {
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
            
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    el.click();
                }
            });
        });
        
        console.log('✓ Accessibility enhancements applied');
    }
    
    // ===== INITIALIZE ALL ENHANCEMENTS =====
    function initAllEnhancements() {
        console.log('🚀 Initializing Student Dashboard Enhancements...');
        
        // Core functionality
        initEnhancedThemeToggle();
        fixProfileDropdown();
        
        // Visual enhancements
        initScrollReveal();
        animateCounters();
        animateProgressBars();
        enhanceStatCards();
        enhanceCards();
        
        // Interactions
        initSmoothScroll();
        initParallaxText();
        enhanceAccessibility();
        enhanceLoadingStates();
        
        console.log('✅ All Student Dashboard Enhancements Loaded Successfully!');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllEnhancements);
    } else {
        // DOM already loaded
        setTimeout(initAllEnhancements, 100);
    }
    
    // Expose for debugging
    window.StudentEnhancements = {
        version: '1.0.0',
        reinit: initAllEnhancements,
        fixProfile: fixProfileDropdown
    };
    
})();
