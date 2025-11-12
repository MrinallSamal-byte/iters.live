/**
 * Futuristic Dashboard Animations
 * Advanced GSAP-powered animations matching landing page aesthetics
 */

(function() {
    'use strict';

    class FuturisticAnimations {
        constructor() {
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeAll());
            } else {
                this.initializeAll();
            }
        }

        initializeAll() {
            this.setupMagneticButtons();
            this.setup3DCardTilt();
            this.setupScrollReveal();
            this.setupParallaxCards();
            this.setupHolographicEffects();
            this.setupGlowingElements();
            this.setupRippleEffects();
            this.enhanceNavigationAnimations();
            this.initPageTransitions();
        }

        /**
         * Magnetic Button Effect
         */
        setupMagneticButtons() {
            const buttons = document.querySelectorAll('.btn, button, .sidebar-menu-item');
            
            buttons.forEach(btn => {
                if (!btn.classList.contains('btn-magnetic-applied')) {
                    btn.classList.add('btn-magnetic', 'btn-magnetic-applied');
                    
                    btn.addEventListener('mousemove', (e) => {
                        const rect = btn.getBoundingClientRect();
                        const x = e.clientX - rect.left - rect.width / 2;
                        const y = e.clientY - rect.top - rect.height / 2;
                        
                        if (typeof gsap !== 'undefined') {
                            gsap.to(btn, {
                                x: x * 0.3,
                                y: y * 0.3,
                                duration: 0.3,
                                ease: 'power2.out'
                            });
                        }
                    });
                    
                    btn.addEventListener('mouseleave', () => {
                        if (typeof gsap !== 'undefined') {
                            gsap.to(btn, {
                                x: 0,
                                y: 0,
                                duration: 0.5,
                                ease: 'elastic.out(1, 0.5)'
                            });
                        }
                    });
                }
            });
        }

        /**
         * 3D Card Tilt Effect
         */
        setup3DCardTilt() {
            const cards = document.querySelectorAll('.glass-card, .stat-card, .widget');
            
            cards.forEach(card => {
                if (card.classList.contains('card-tilt-applied')) return;
                
                card.classList.add('card-3d', 'card-tilt-applied');
                const inner = document.createElement('div');
                inner.className = 'card-3d-inner';
                while (card.firstChild) {
                    inner.appendChild(card.firstChild);
                }
                card.appendChild(inner);
                
                card.addEventListener('mousemove', (e) => {
                    if (window.innerWidth < 768) return; // Skip on mobile
                    
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    
                    const rotateX = ((y - centerY) / centerY) * -10;
                    const rotateY = ((x - centerX) / centerX) * 10;
                    
                    if (typeof gsap !== 'undefined') {
                        gsap.to(inner, {
                            rotationX: rotateX,
                            rotationY: rotateY,
                            duration: 0.5,
                            ease: 'power2.out',
                            transformPerspective: 1000
                        });
                    }
                });
                
                card.addEventListener('mouseleave', () => {
                    if (typeof gsap !== 'undefined') {
                        gsap.to(inner, {
                            rotationX: 0,
                            rotationY: 0,
                            duration: 0.6,
                            ease: 'elastic.out(1, 0.5)'
                        });
                    }
                });
            });
        }

        /**
         * Scroll Reveal Animations
         */
        setupScrollReveal() {
            const elements = document.querySelectorAll('.dashboard-section, .widget, .stat-card');
            
            elements.forEach(el => {
                if (!el.classList.contains('reveal-applied')) {
                    el.classList.add('reveal-fade-up', 'reveal-applied');
                }
            });
            
            if (typeof IntersectionObserver !== 'undefined') {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('revealed');
                            
                            if (typeof gsap !== 'undefined') {
                                gsap.to(entry.target, {
                                    opacity: 1,
                                    y: 0,
                                    duration: 0.8,
                                    ease: 'power3.out'
                                });
                            }
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '50px'
                });
                
                elements.forEach(el => observer.observe(el));
            }
        }

        /**
         * Parallax Stat Cards
         */
        setupParallaxCards() {
            const statCards = document.querySelectorAll('.stat-card');
            
            statCards.forEach(card => {
                card.classList.add('stat-card-parallax');
            });
        }

        /**
         * Holographic Effects
         */
        setupHolographicEffects() {
            const welcomeSections = document.querySelectorAll('.dashboard-welcome');
            
            welcomeSections.forEach(section => {
                if (!section.classList.contains('holographic')) {
                    section.classList.add('holographic');
                }
            });
        }

        /**
         * Glowing Elements
         */
        setupGlowingElements() {
            // Add neon glow to important text
            const titles = document.querySelectorAll('.dashboard-welcome h2, .section-title');
            titles.forEach(title => {
                if (!title.classList.contains('neon-text')) {
                    title.classList.add('neon-text');
                }
            });
            
            // Add glowing borders to key cards
            const primaryCards = document.querySelectorAll('.dashboard-welcome, .quick-stats');
            primaryCards.forEach(card => {
                if (!card.classList.contains('gradient-border-applied')) {
                    card.classList.add('glow-primary', 'gradient-border-applied');
                }
            });
        }

        /**
         * Ripple Click Effects
         */
        setupRippleEffects() {
            const interactive = document.querySelectorAll('.btn, .stat-card, .sidebar-menu-item, .tab');
            
            interactive.forEach(el => {
                if (!el.classList.contains('ripple-applied')) {
                    el.classList.add('ripple-effect', 'ripple-applied');
                }
            });
        }

        /**
         * Enhanced Navigation Animations
         */
        enhanceNavigationAnimations() {
            if (typeof gsap === 'undefined') return;

            // Sidebar entrance animation
            const sidebar = document.getElementById('sidebarNav');
            if (sidebar) {
                gsap.from(sidebar, {
                    x: -300,
                    opacity: 0,
                    duration: 0.8,
                    ease: 'power3.out'
                });
                
                // Stagger menu items
                const menuItems = sidebar.querySelectorAll('.sidebar-menu-item');
                gsap.from(menuItems, {
                    x: -50,
                    opacity: 0,
                    duration: 0.5,
                    stagger: 0.05,
                    ease: 'power2.out',
                    delay: 0.3
                });
            }

            // Animate avatar
            const avatar = document.getElementById('sidebarAvatar');
            if (avatar) {
                gsap.from(avatar, {
                    scale: 0,
                    rotation: 360,
                    duration: 1,
                    ease: 'back.out(1.7)',
                    delay: 0.2
                });
            }
        }

        /**
         * Page Load Transitions
         */
        initPageTransitions() {
            if (typeof gsap === 'undefined') return;

            // Animate main content on load
            const main = document.querySelector('.dashboard-main, main');
            if (main) {
                gsap.from(main, {
                    opacity: 0,
                    y: 30,
                    duration: 0.8,
                    ease: 'power3.out',
                    delay: 0.1
                });
            }

            // Stagger widgets/cards
            const widgets = document.querySelectorAll('.widget, .quick-stats .stat-card');
            if (widgets.length > 0) {
                gsap.from(widgets, {
                    opacity: 0,
                    y: 50,
                    duration: 0.6,
                    stagger: 0.1,
                    ease: 'power2.out',
                    delay: 0.4
                });
            }

            // Animate welcome section with special effect
            const welcome = document.querySelector('.dashboard-welcome');
            if (welcome) {
                gsap.from(welcome, {
                    opacity: 0,
                    scale: 0.95,
                    duration: 1,
                    ease: 'power3.out',
                    delay: 0.2
                });

                // Pulse animation for welcome text
                const welcomeTitle = welcome.querySelector('h2');
                if (welcomeTitle) {
                    gsap.from(welcomeTitle, {
                        scale: 0,
                        opacity: 0,
                        duration: 1.2,
                        ease: 'elastic.out(1, 0.5)',
                        delay: 0.5
                    });
                }
            }

            // Particle effect on hover for special elements
            this.setupParticleTrails();
        }

        /**
         * Particle Trails
         */
        setupParticleTrails() {
            const specialElements = document.querySelectorAll('.btn-primary, .fab');
            
            specialElements.forEach(el => {
                if (!el.classList.contains('particle-trail')) {
                    el.classList.add('particle-trail');
                }
            });
        }

        /**
         * Morphing Hover Effects
         */
        setupMorphingHovers() {
            const cards = document.querySelectorAll('.glass-card:not(.morph-applied)');
            
            cards.forEach(card => {
                card.classList.add('morph-hover', 'morph-applied');
            });
        }

        /**
         * Liquid Fill on Special Buttons
         */
        setupLiquidFill() {
            const primaryBtns = document.querySelectorAll('.btn-primary:not(.liquid-applied)');
            
            primaryBtns.forEach(btn => {
                btn.classList.add('liquid-fill', 'liquid-applied');
            });
        }
    }

    // Initialize when ready
    if (typeof window !== 'undefined') {
        window.FuturisticAnimations = new FuturisticAnimations();
    }
})();
