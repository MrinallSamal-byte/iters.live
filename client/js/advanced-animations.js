/**
 * Advanced Animations System for ITER EduHub
 * Implements GSAP-based scroll animations, counter animations, hover effects, and particles
 * Version: 1.1.0 - Memory Optimized
 */

class AdvancedAnimations {
    constructor() {
        this.initialized = false;
        this.scrollTriggers = [];
        this.eventListeners = [];
        this.animationTimelines = [];
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        // Check if GSAP is loaded
        if (typeof gsap === 'undefined') {
            console.warn('GSAP not loaded. Advanced animations disabled.');
            return;
        }

        // Skip on mobile for better performance
        const isMobile = window.innerWidth < 768;

        console.log('🎨 Initializing Advanced Animations...');

        this.initScrollAnimations();
        this.initHoverEffects();
        this.initCounters();
        this.initProgressBars();
        this.initRippleEffects();
        
        // Only init floating animations on desktop
        if (!isMobile) {
            this.initFloatingAnimations();
        }
        
        this.initNavbarScroll();
        this.initVisibilityHandler();
        
        this.initialized = true;
        console.log('✓ Advanced Animations initialized successfully');
    }
    
    /**
     * Pause animations when page is hidden
     */
    initVisibilityHandler() {
        const handler = () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        };
        
        document.addEventListener('visibilitychange', handler);
        this.eventListeners.push({ element: document, event: 'visibilitychange', handler });
    }
    
    /**
     * Pause all GSAP animations
     */
    pauseAnimations() {
        if (typeof gsap !== 'undefined') {
            gsap.globalTimeline.pause();
        }
    }
    
    /**
     * Resume all GSAP animations
     */
    resumeAnimations() {
        if (typeof gsap !== 'undefined') {
            gsap.globalTimeline.resume();
        }
    }

    /**
     * Scroll-triggered animations with GSAP ScrollTrigger
     */
    initScrollAnimations() {
        if (typeof ScrollTrigger === 'undefined') {
            console.info('ℹ️ GSAP ScrollTrigger not loaded - scroll animations disabled');
            return;
        }

        gsap.registerPlugin(ScrollTrigger);

        // Fade-in on scroll
        gsap.utils.toArray('.scroll-reveal').forEach(elem => {
            gsap.fromTo(elem, 
                { 
                    opacity: 0, 
                    y: 50 
                },
                {
                    opacity: 1,
                    y: 0,
                    duration: 1,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: elem,
                        start: 'top 85%',
                        end: 'bottom 20%',
                        toggleActions: 'play none none reverse',
                        once: false
                    }
                }
            );
        });

        // Parallax effect on hero text
        gsap.utils.toArray('.parallax-text').forEach(elem => {
            gsap.to(elem, {
                y: -100,
                ease: 'none',
                scrollTrigger: {
                    trigger: elem,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 1
                }
            });
        });

        // Stagger animations for grouped elements
        gsap.utils.toArray('.stagger-animation').forEach(container => {
            const children = Array.from(container.children);
            if (children.length === 0) return;

            gsap.fromTo(children,
                { 
                    opacity: 0, 
                    y: 30,
                    scale: 0.95
                },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.6,
                    stagger: 0.1,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: container,
                        start: 'top 80%',
                        once: false
                    }
                }
            );
        });

        // Scale-in effect
        gsap.utils.toArray('.scale-in').forEach(elem => {
            gsap.fromTo(elem,
                { 
                    scale: 0.8, 
                    opacity: 0 
                },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 0.8,
                    ease: 'back.out(1.7)',
                    scrollTrigger: {
                        trigger: elem,
                        start: 'top 85%',
                        once: false
                    }
                }
            );
        });

        // Slide-in from sides
        gsap.utils.toArray('.slide-in-left').forEach(elem => {
            gsap.fromTo(elem,
                { x: -100, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: elem,
                        start: 'top 85%',
                        once: false
                    }
                }
            );
        });

        gsap.utils.toArray('.slide-in-right').forEach(elem => {
            gsap.fromTo(elem,
                { x: 100, opacity: 0 },
                {
                    x: 0,
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: elem,
                        start: 'top 85%',
                        once: false
                    }
                }
            );
        });

        console.log('✓ Scroll animations initialized');
    }

    /**
     * Number counter animation
     */
    initCounters() {
        const counters = document.querySelectorAll('.counter');
        
        counters.forEach(counter => {
            const target = parseFloat(counter.dataset.target || counter.textContent);
            const decimals = parseInt(counter.dataset.decimals) || 0;
            const suffix = counter.dataset.suffix || '';
            const prefix = counter.dataset.prefix || '';
            
            // Reset to 0
            counter.textContent = prefix + '0' + suffix;

            const animateCounter = () => {
                gsap.to({ val: 0 }, {
                    val: target,
                    duration: 2,
                    ease: 'power1.out',
                    onUpdate: function() {
                        const currentVal = this.targets()[0].val;
                        counter.textContent = prefix + currentVal.toFixed(decimals) + suffix;
                    },
                    onComplete: function() {
                        counter.textContent = prefix + target.toFixed(decimals) + suffix;
                    }
                });
            };

            if (gsap.ScrollTrigger) {
                ScrollTrigger.create({
                    trigger: counter,
                    start: 'top 85%',
                    once: true,
                    onEnter: animateCounter
                });
            } else {
                // Fallback: animate on page load
                setTimeout(animateCounter, 300);
            }
        });

        console.log(`✓ ${counters.length} counters initialized`);
    }

    /**
     * Progress bar animations
     */
    initProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        
        progressBars.forEach(bar => {
            const target = bar.dataset.progress || bar.style.width || '0%';
            const targetValue = parseInt(target);
            
            // Reset to 0
            bar.style.width = '0%';

            const animateProgress = () => {
                gsap.to(bar, {
                    width: `${targetValue}%`,
                    duration: 1.5,
                    ease: 'power2.out'
                });
            };

            if (gsap.ScrollTrigger) {
                ScrollTrigger.create({
                    trigger: bar,
                    start: 'top 90%',
                    once: true,
                    onEnter: animateProgress
                });
            } else {
                setTimeout(animateProgress, 500);
            }
        });

        console.log(`✓ ${progressBars.length} progress bars initialized`);
    }

    /**
     * Hover effects for cards and buttons
     */
    initHoverEffects() {
        // Lift effect on hover
        const hoverLiftElements = document.querySelectorAll('.hover-lift');
        hoverLiftElements.forEach(elem => {
            elem.addEventListener('mouseenter', () => {
                gsap.to(elem, {
                    y: -8,
                    scale: 1.02,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
            
            elem.addEventListener('mouseleave', () => {
                gsap.to(elem, {
                    y: 0,
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
        });

        // Glow effect on hover
        const hoverGlowElements = document.querySelectorAll('.hover-glow');
        hoverGlowElements.forEach(elem => {
            elem.addEventListener('mouseenter', () => {
                gsap.to(elem, {
                    boxShadow: '0 0 30px rgba(99, 102, 241, 0.5), 0 0 60px rgba(99, 102, 241, 0.3)',
                    duration: 0.3
                });
            });
            
            elem.addEventListener('mouseleave', () => {
                gsap.to(elem, {
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    duration: 0.3
                });
            });
        });

        // 3D Tilt effect (subtle)
        const tiltElements = document.querySelectorAll('.hover-tilt');
        tiltElements.forEach(elem => {
            elem.addEventListener('mousemove', (e) => {
                const rect = elem.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -5;
                const rotateY = ((x - centerX) / centerX) * 5;
                
                gsap.to(elem, {
                    rotateX: rotateX,
                    rotateY: rotateY,
                    duration: 0.3,
                    ease: 'power1.out',
                    transformPerspective: 1000
                });
            });
            
            elem.addEventListener('mouseleave', () => {
                gsap.to(elem, {
                    rotateX: 0,
                    rotateY: 0,
                    duration: 0.5,
                    ease: 'power2.out'
                });
            });
        });

        console.log('✓ Hover effects initialized');
    }

    /**
     * Ripple effect on click
     */
    initRippleEffects() {
        document.querySelectorAll('.ripple-effect').forEach(elem => {
            elem.addEventListener('click', createRipple);
        });

        // Also add to all buttons without specific class
        document.querySelectorAll('.btn:not(.no-ripple)').forEach(elem => {
            elem.classList.add('ripple-effect');
            elem.addEventListener('click', createRipple);
        });

        console.log('✓ Ripple effects initialized');
    }

    /**
     * Floating animations
     */
    initFloatingAnimations() {
        const floatingElements = document.querySelectorAll('.float-animation');
        
        floatingElements.forEach((elem, index) => {
            gsap.to(elem, {
                y: -20,
                duration: 2 + (index * 0.2),
                ease: 'sine.inOut',
                repeat: -1,
                yoyo: true
            });
        });

        console.log(`✓ ${floatingElements.length} floating animations initialized`);
    }

    /**
     * Navbar hide/show on scroll
     */
    initNavbarScroll() {
        const navbar = document.querySelector('.navbar, .dashboard-nav');
        if (!navbar) return;

        let lastScrollY = window.scrollY;
        let ticking = false;

        const updateNavbar = () => {
            const scrollY = window.scrollY;

            if (scrollY > 100) {
                if (scrollY > lastScrollY) {
                    // Scrolling down
                    gsap.to(navbar, {
                        y: -100,
                        duration: 0.3,
                        ease: 'power2.inOut'
                    });
                } else {
                    // Scrolling up
                    gsap.to(navbar, {
                        y: 0,
                        duration: 0.3,
                        ease: 'power2.inOut'
                    });
                }
            } else {
                gsap.to(navbar, {
                    y: 0,
                    duration: 0.3,
                    ease: 'power2.inOut'
                });
            }

            lastScrollY = scrollY;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        });

        console.log('✓ Navbar scroll behavior initialized');
    }

    /**
     * Pulse animation for elements
     */
    static pulse(element, options = {}) {
        const defaults = {
            scale: 1.05,
            duration: 0.6,
            repeat: 1,
            yoyo: true
        };
        const config = { ...defaults, ...options };

        gsap.to(element, {
            scale: config.scale,
            duration: config.duration,
            repeat: config.repeat,
            yoyo: config.yoyo,
            ease: 'power1.inOut'
        });
    }

    /**
     * Shake animation for errors
     */
    static shake(element) {
        gsap.fromTo(element,
            { x: 0 },
            {
                x: -10,
                duration: 0.1,
                repeat: 5,
                yoyo: true,
                ease: 'power1.inOut',
                onComplete: () => {
                    gsap.set(element, { x: 0 });
                }
            }
        );
    }

    /**
     * Success checkmark animation
     */
    static successCheck(element) {
        element.innerHTML = '<span class="success-checkmark">✓</span>';
        const checkmark = element.querySelector('.success-checkmark');
        
        gsap.fromTo(checkmark,
            { scale: 0, opacity: 0 },
            {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: 'back.out(2)'
            }
        );
    }
    
    /**
     * Cleanup and destroy all animations
     */
    destroy() {
        // Kill all ScrollTriggers
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.getAll().forEach(st => st.kill());
        }
        
        // Kill all GSAP tweens
        if (typeof gsap !== 'undefined') {
            gsap.killTweensOf('*');
        }
        
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        this.initialized = false;
        console.log('AdvancedAnimations destroyed');
    }
}

/**
 * Create ripple effect on click
 */
function createRipple(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    // Remove old ripples
    const oldRipples = button.querySelectorAll('.ripple');
    oldRipples.forEach(r => r.remove());
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

/**
 * Loading screen animation
 */
class LoadingScreen {
    static show() {
        const loader = document.getElementById('loadingScreen');
        if (loader) {
            gsap.to(loader, {
                opacity: 1,
                duration: 0.3,
                display: 'flex'
            });
        }
    }

    static hide() {
        const loader = document.getElementById('loadingScreen');
        if (loader) {
            gsap.to(loader, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => {
                    loader.style.display = 'none';
                }
            });
        }
    }
}

/**
 * Particle System (Simple Canvas-based)
 */
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        
        this.init();
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Create particles
        const particleCount = Math.floor((this.canvas.width * this.canvas.height) / 15000);
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(this.canvas, this.mouse));
        }

        // Mouse move listener
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        // Mouse leave listener
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        // Resize listener
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });

        this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.update();
            particle.draw(this.ctx);
        });

        requestAnimationFrame(() => this.animate());
    }
}

/**
 * Particle class
 */
class Particle {
    constructor(canvas, mouse) {
        this.canvas = canvas;
        this.mouse = mouse;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.color = `rgba(99, 102, 241, ${Math.random() * 0.5 + 0.2})`;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off edges
        if (this.x > this.canvas.width || this.x < 0) {
            this.speedX *= -1;
        }
        if (this.y > this.canvas.height || this.y < 0) {
            this.speedY *= -1;
        }

        // Mouse interaction
        if (this.mouse.x && this.mouse.y) {
            const dx = this.mouse.x - this.x;
            const dy = this.mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                const directionX = dx / distance;
                const directionY = dy / distance;
                
                this.x -= directionX * force * 3;
                this.y -= directionY * force * 3;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Auto-initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.advancedAnimations = new AdvancedAnimations();
        
        // Initialize particles if canvas exists
        if (document.getElementById('particleCanvas')) {
            window.particleSystem = new ParticleSystem('particleCanvas');
        }
    });
} else {
    // DOM already loaded
    window.advancedAnimations = new AdvancedAnimations();
    
    if (document.getElementById('particleCanvas')) {
        window.particleSystem = new ParticleSystem('particleCanvas');
    }
}

// Export for global use
window.AdvancedAnimations = AdvancedAnimations;
window.LoadingScreen = LoadingScreen;
window.ParticleSystem = ParticleSystem;
