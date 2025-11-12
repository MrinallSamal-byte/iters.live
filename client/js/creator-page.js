// Creator Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mark that animations can run; CSS will only animate when this class exists
    document.body.classList.add('animations-enabled');
    console.log('Creator page loaded');

    // Initialize scroll reveal animations with GSAP if available
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Animate all scroll-reveal elements with from() to not affect initial state
        gsap.utils.toArray('.scroll-reveal').forEach((element, index) => {
            // Set initial state without hiding the element
            gsap.set(element, { opacity: 1, y: 0 });
            
            gsap.from(element, {
                scrollTrigger: {
                    trigger: element,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                    once: true
                },
                opacity: 0,
                y: 30,
                duration: 0.6,
                delay: index * 0.05,
                ease: 'power2.out',
                clearProps: 'all' // Clear inline styles after animation
            });
        });

        // Animate profile icon with visible fallback
        const profileIcon = document.querySelector('.profile-icon');
        if (profileIcon) {
            gsap.set(profileIcon, { scale: 1, rotation: 0 });
            gsap.from(profileIcon, {
                scale: 0,
                rotation: 360,
                duration: 1,
                ease: 'back.out(1.7)',
                delay: 0.3,
                clearProps: 'all'
            });
        }

        // Animate tech tags with visible fallback
        const techTags = document.querySelectorAll('.tech-tag');
        if (techTags.length > 0) {
            gsap.set(techTags, { opacity: 1, scale: 1 });
            gsap.from(techTags, {
                scrollTrigger: {
                    trigger: '.tech-tags',
                    start: 'top 80%',
                    once: true
                },
                opacity: 0,
                scale: 0.8,
                stagger: 0.05,
                duration: 0.5,
                ease: 'back.out(1.7)',
                clearProps: 'all'
            });
        }

        // Animate info cards with visible fallback
        const infoCards = document.querySelectorAll('.info-card');
        if (infoCards.length > 0) {
            gsap.set(infoCards, { opacity: 1, y: 0 });
            gsap.from(infoCards, {
                scrollTrigger: {
                    trigger: '.creator-info-grid',
                    start: 'top 80%',
                    once: true
                },
                opacity: 0,
                y: 30,
                stagger: 0.2,
                duration: 0.6,
                ease: 'power2.out',
                clearProps: 'all'
            });
        }

        // Animate highlight items with visible fallback
        const highlightItems = document.querySelectorAll('.highlight-item');
        if (highlightItems.length > 0) {
            gsap.set(highlightItems, { opacity: 1, y: 0 });
            gsap.from(highlightItems, {
                scrollTrigger: {
                    trigger: '.highlights-grid',
                    start: 'top 80%',
                    once: true
                },
                opacity: 0,
                y: 40,
                stagger: 0.15,
                duration: 0.7,
                ease: 'power2.out',
                clearProps: 'all'
            });
        }

        // Animate creator links with visible fallback
        const creatorLinks = document.querySelectorAll('.creator-link');
        if (creatorLinks.length > 0) {
            gsap.set(creatorLinks, { opacity: 1, x: 0 });
            gsap.from(creatorLinks, {
                scrollTrigger: {
                    trigger: '.creator-links',
                    start: 'top 80%',
                    once: true
                },
                opacity: 0,
                x: -50,
                stagger: 0.2,
                duration: 0.6,
                ease: 'power2.out',
                clearProps: 'all'
            });
        }
    }

    // Add hover effect to tech tags
    const techTags = document.querySelectorAll('.tech-tag');
    techTags.forEach(tag => {
        tag.addEventListener('mouseenter', function() {
            if (typeof gsap !== 'undefined') {
                gsap.to(this, {
                    scale: 1.1,
                    duration: 0.3,
                    ease: 'back.out(1.7)'
                });
            }
        });

        tag.addEventListener('mouseleave', function() {
            if (typeof gsap !== 'undefined') {
                gsap.to(this, {
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
        });
    });

    // Add ripple effect to buttons
    const rippleButtons = document.querySelectorAll('.ripple-effect');
    rippleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Add parallax effect to background orbs
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const orbs = document.querySelectorAll('.gradient-orb');
            
            orbs.forEach((orb, index) => {
                const speed = 0.5 + (index * 0.2);
                orb.style.transform = `translateY(${scrolled * speed}px)`;
            });
        });
    }

    // Add entrance animation to main content
    setTimeout(() => {
        document.querySelector('.creator-content-wrapper')?.classList.add('loaded');
    }, 100);

    console.log('Creator page animations initialized');
});

// Add CSS class for loaded state
const style = document.createElement('style');
style.textContent = `
    .creator-content-wrapper.loaded {
        animation: fadeInUp 0.8s ease-out;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
