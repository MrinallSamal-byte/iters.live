/**
 * Advanced Animation Controller
 * Handles all UI animations and micro-interactions
 * Part of ITER EduHub Enhancement Suite
 */
class AnimationController {
    constructor() {
        this.observers = [];
        this.init();
    }

    init() {
        this.setupCounterAnimations();
        this.setupScrollReveal();
        this.setupParallax();
        this.setupCardHoverEffects();
        this.setupRippleEffect();
        this.setupPageTransitions();
        this.setupSkeletonLoaders();
    }

    // Animate numbers counting up
    setupCounterAnimations() {
        const counters = document.querySelectorAll('.counter');
        
        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = parseFloat(counter.dataset.target);
                    const decimals = counter.dataset.decimals || 0;
                    const duration = parseInt(counter.dataset.duration) || 2000;
                    const increment = target / (duration / 16);
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

                    updateCounter();
                    observer.unobserve(counter);
                }
            });
        }, observerOptions);

        counters.forEach(counter => observer.observe(counter));
        this.observers.push(observer);
    }

    // Smooth scroll reveal
    setupScrollReveal() {
        const revealElements = document.querySelectorAll('.scroll-reveal');
        
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach(el => revealObserver.observe(el));
        this.observers.push(revealObserver);
    }

    // Parallax scrolling effect
    setupParallax() {
        const parallaxElements = document.querySelectorAll('.parallax-element');
        
        if (parallaxElements.length === 0) return;

        let ticking = false;

        const updateParallax = () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const speed = parseFloat(element.dataset.speed) || 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = `translate3d(0, ${yPos}px, 0)`;
            });

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        });
    }

    // 3D card hover effects
    setupCardHoverEffects() {
        const cards = document.querySelectorAll('.glass-card, .widget, .stat-card');
        
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                if (window.innerWidth < 768) return; // Disable on mobile
                
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * 5;
                const rotateY = ((centerX - x) / centerX) * 5;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                card.style.transition = 'transform 0.1s ease-out';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
                card.style.transition = 'transform 0.3s ease-out';
            });
        });
    }

    // Material Design ripple effect
    setupRippleEffect() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, .btn, .ripple-effect');
            
            if (target && !target.classList.contains('no-ripple')) {
                const ripple = document.createElement('span');
                const rect = target.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                ripple.classList.add('ripple');
                
                // Ensure target has relative positioning
                if (getComputedStyle(target).position === 'static') {
                    target.style.position = 'relative';
                }
                target.style.overflow = 'hidden';
                
                target.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 600);
            }
        });
    }

    // Page transition effects
    setupPageTransitions() {
        // Add transition class to main content
        const mainContent = document.querySelector('.dashboard-main');
        if (mainContent) {
            mainContent.classList.add('page-transition-enter');
        }

        // Handle navigation transitions
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.classList.add('section-transition-enter');
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setTimeout(() => {
                            target.classList.remove('section-transition-enter');
                        }, 500);
                    }
                }
            });
        });
    }

    // Skeleton loader removal
    setupSkeletonLoaders() {
        const skeletons = document.querySelectorAll('.skeleton');
        
        // Simulate content loading
        setTimeout(() => {
            skeletons.forEach(skeleton => {
                skeleton.classList.add('skeleton-loaded');
                setTimeout(() => {
                    skeleton.classList.remove('skeleton', 'skeleton-loaded');
                }, 300);
            });
        }, 1500);
    }

    // Utility: Create pulse animation
    static createPulse(element, duration = 1000) {
        element.style.animation = `pulse ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }

    // Utility: Shake animation for errors
    static shake(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // Utility: Fade in element
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let opacity = 0;
        const increment = 16 / duration;
        
        const fade = () => {
            opacity += increment;
            if (opacity <= 1) {
                element.style.opacity = opacity;
                requestAnimationFrame(fade);
            } else {
                element.style.opacity = '1';
            }
        };
        
        fade();
    }

    // Utility: Fade out element
    static fadeOut(element, duration = 300) {
        let opacity = 1;
        const decrement = 16 / duration;
        
        const fade = () => {
            opacity -= decrement;
            if (opacity >= 0) {
                element.style.opacity = opacity;
                requestAnimationFrame(fade);
            } else {
                element.style.opacity = '0';
                element.style.display = 'none';
            }
        };
        
        fade();
    }

    // Utility: Slide in from direction
    static slideIn(element, direction = 'left', duration = 300) {
        const directions = {
            left: 'translateX(-100%)',
            right: 'translateX(100%)',
            top: 'translateY(-100%)',
            bottom: 'translateY(100%)'
        };

        element.style.transform = directions[direction];
        element.style.opacity = '0';
        element.style.display = 'block';
        
        setTimeout(() => {
            element.style.transition = `all ${duration}ms ease-out`;
            element.style.transform = 'translate(0, 0)';
            element.style.opacity = '1';
        }, 10);
    }

    // Cleanup
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.animationController = new AnimationController();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationController;
}
