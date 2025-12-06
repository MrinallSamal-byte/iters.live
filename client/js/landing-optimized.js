/**
 * Optimized Landing Page JavaScript
 * Focuses on performance, smooth animations, and user experience
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        observerThreshold: 0.1,
        counterSpeed: 30,
        scrollProgressDebounce: 16,
        parallaxThrottle: 16
    };

    // State
    let scrollTimeout = null;
    let mouseMoveTimeout = null;
    let hasCountedStats = false;

    /**
     * Initialize smooth scroll for anchor links
     */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                
                // Skip empty or just hash
                if (!href || href === '#' || href === '#!') {
                    return;
                }
                
                const target = document.querySelector(href);
                if (!target) return;
                
                e.preventDefault();
                
                const navHeight = document.querySelector('.navbar')?.offsetHeight || 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            });
        });
    }

    /**
     * Animate counter numbers
     */
    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'));
        const suffix = element.getAttribute('data-suffix') || '';
        
        if (isNaN(target)) {
            console.warn('Invalid counter target:', element);
            return;
        }
        
        let current = 0;
        const increment = Math.ceil(target / 50);
        const duration = 1500; // 1.5 seconds
        const stepTime = duration / 50;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target + suffix;
                clearInterval(timer);
            } else {
                element.textContent = current + suffix;
            }
        }, stepTime);
    }

    /**
     * Initialize stats counter animation
     */
    function initStatsCounter() {
        const counters = document.querySelectorAll('.counter');
        
        if (counters.length === 0) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasCountedStats) {
                    hasCountedStats = true;
                    counters.forEach(counter => {
                        setTimeout(() => animateCounter(counter), 300);
                    });
                    observer.disconnect();
                }
            });
        }, { threshold: CONFIG.observerThreshold });
        
        // Observe the first counter's parent container
        const statsContainer = counters[0].closest('.hero-stats');
        if (statsContainer) {
            observer.observe(statsContainer);
        }
    }

    /**
     * Initialize scroll reveal animations
     */
    function initScrollReveal() {
        const revealElements = document.querySelectorAll('.scroll-reveal');
        
        if (revealElements.length === 0) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { 
            threshold: CONFIG.observerThreshold,
            rootMargin: '0px 0px -50px 0px'
        });
        
        revealElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
        
        // Add CSS for revealed state
        if (!document.getElementById('reveal-styles')) {
            const style = document.createElement('style');
            style.id = 'reveal-styles';
            style.textContent = `
                .scroll-reveal.revealed {
                    opacity: 1 !important;
                    transform: translateY(0) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Initialize stagger animations
     */
    function initStaggerAnimation() {
        const staggerContainers = document.querySelectorAll('.stagger-animation');
        
        staggerContainers.forEach(container => {
            const children = container.children;
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        Array.from(children).forEach((child, index) => {
                            setTimeout(() => {
                                child.style.opacity = '1';
                                child.style.transform = 'translateY(0)';
                            }, index * 100);
                        });
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: CONFIG.observerThreshold });
            
            // Setup initial styles
            Array.from(children).forEach(child => {
                child.style.opacity = '0';
                child.style.transform = 'translateY(20px)';
                child.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            });
            
            observer.observe(container);
        });
    }

    /**
     * Initialize parallax effect for gradient orbs
     */
    function initParallax() {
        const orbs = document.querySelectorAll('.gradient-orb');
        
        if (orbs.length === 0) return;
        
        window.addEventListener('mousemove', (e) => {
            if (mouseMoveTimeout) return;
            
            mouseMoveTimeout = setTimeout(() => {
                const x = (e.clientX / window.innerWidth) - 0.5;
                const y = (e.clientY / window.innerHeight) - 0.5;
                
                orbs.forEach((orb, index) => {
                    const speed = (index + 1) * 15;
                    const moveX = x * speed;
                    const moveY = y * speed;
                    
                    orb.style.transform = `translate(${moveX}px, ${moveY}px)`;
                });
                
                mouseMoveTimeout = null;
            }, CONFIG.parallaxThrottle);
        }, { passive: true });
    }

    /**
     * Initialize scroll progress indicator
     */
    function initScrollProgress() {
        let progressBar = document.getElementById('scroll-progress-bar');
        
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'scroll-progress-bar';
            progressBar.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                height: 3px;
                width: 0%;
                background: linear-gradient(90deg, var(--primary), var(--secondary));
                z-index: 10000;
                transition: width 0.1s ease;
                pointer-events: none;
            `;
            document.body.appendChild(progressBar);
        }
        
        window.addEventListener('scroll', () => {
            if (scrollTimeout) {
                window.cancelAnimationFrame(scrollTimeout);
            }
            
            scrollTimeout = window.requestAnimationFrame(() => {
                const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (window.pageYOffset / windowHeight) * 100;
                progressBar.style.width = Math.min(scrolled, 100) + '%';
            });
        }, { passive: true });
    }

    /**
     * Initialize navbar scroll behavior
     */
    function initNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        
        if (!navbar) return;
        
        let lastScroll = 0;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll <= 0) {
                navbar.classList.remove('navbar-scrolled');
                return;
            }
            
            if (currentScroll > lastScroll && currentScroll > 100) {
                // Scrolling down
                navbar.classList.add('navbar-hidden');
            } else {
                // Scrolling up
                navbar.classList.remove('navbar-hidden');
            }
            
            if (currentScroll > 50) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
            
            lastScroll = currentScroll;
        }, { passive: true });
        
        // Add styles for navbar scroll behavior
        if (!document.getElementById('navbar-scroll-styles')) {
            const style = document.createElement('style');
            style.id = 'navbar-scroll-styles';
            style.textContent = `
                .navbar {
                    transition: transform 0.3s ease, background 0.3s ease;
                }
                .navbar-hidden {
                    transform: translateX(-50%) translateY(-100%);
                }
                .navbar-scrolled {
                    background: var(--glass-bg);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Initialize hover effects for cards
     */
    function initCardHoverEffects() {
        const cards = document.querySelectorAll('.feature-card, .why-card, .tech-feature-item, .academic-card, .contact-card');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-8px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    }

    /**
     * Initialize lazy loading for images
     */
    function initLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for browsers without IntersectionObserver
            images.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }

    /**
     * Initialize typing effect for hero title
     */
    function initTypingEffect() {
        const heroTitle = document.querySelector('.hero-title');
        
        if (!heroTitle || heroTitle.classList.contains('typed')) return;
        
        heroTitle.classList.add('typed');
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        heroTitle.style.opacity = '1';
        
        let index = 0;
        const typeInterval = setInterval(() => {
            if (index < text.length) {
                heroTitle.textContent += text.charAt(index);
                index++;
            } else {
                clearInterval(typeInterval);
            }
        }, 50);
    }

    /**
     * Initialize all animations and interactions
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performInit);
        } else {
            performInit();
        }
    }

    /**
     * Perform initialization
     */
    function performInit() {
        try {
            initSmoothScroll();
            initStatsCounter();
            initScrollReveal();
            initStaggerAnimation();
            initParallax();
            initScrollProgress();
            initNavbarScroll();
            initCardHoverEffects();
            initLazyLoading();
            
            // Add typing effect with slight delay
            setTimeout(initTypingEffect, 300);
            
            console.log('✓ Landing page optimizations initialized');
        } catch (error) {
            console.error('Error initializing landing page:', error);
        }
    }

    // Auto-initialize
    init();

    // Export for external use
    window.LandingOptimized = {
        init: performInit,
        animateCounter,
        initSmoothScroll,
        initStatsCounter
    };

})();
