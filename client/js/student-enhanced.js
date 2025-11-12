// Enhanced Student Dashboard Interactions & Animations
(function() {
    'use strict';

    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        setupScrollAnimations();
        setupCounterAnimations();
        setupParallaxEffects();
        setupRippleEffects();
        setupProgressBars();
        setupStaggerAnimations();
        setupHoverEffects();
        setupLoadingStates();
    }

    // ============================================
    // SCROLL ANIMATIONS
    // ============================================
    
    function setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    entry.target.style.opacity = '1';
                }
            });
        }, observerOptions);

        // Observe all cards and sections
        document.querySelectorAll('.glass-card, .stat-card, .widget').forEach(el => {
            el.style.opacity = '0';
            observer.observe(el);
        });
    }

    // ============================================
    // COUNTER ANIMATIONS
    // ============================================
    
    function setupCounterAnimations() {
        const counters = document.querySelectorAll('.counter, .stat-value');
        
        const animateCounter = (element) => {
            const target = parseFloat(element.dataset.target || element.textContent);
            const decimals = parseInt(element.dataset.decimals || 0);
            const duration = 2000; // 2 seconds
            const steps = 60;
            const increment = target / steps;
            let current = 0;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                element.textContent = decimals > 0 
                    ? current.toFixed(decimals) 
                    : Math.floor(current);
            }, duration / steps);
        };

        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.animated) {
                    animateCounter(entry.target);
                    entry.target.dataset.animated = 'true';
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => counterObserver.observe(counter));
    }

    // ============================================
    // PARALLAX EFFECTS
    // ============================================
    
    function setupParallaxEffects() {
        const parallaxElements = document.querySelectorAll('.gradient-orb');
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach((element, index) => {
                const speed = 0.5 + (index * 0.2);
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        });

        // Mouse parallax
        document.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;
            
            parallaxElements.forEach((element, index) => {
                const depth = 20 + (index * 10);
                const moveX = (mouseX - 0.5) * depth;
                const moveY = (mouseY - 0.5) * depth;
                
                element.style.transform = `translate(${moveX}px, ${moveY}px)`;
            });
        });
    }

    // ============================================
    // RIPPLE EFFECTS
    // ============================================
    
    function setupRippleEffects() {
        const rippleElements = document.querySelectorAll('.btn, .stat-card, .ripple-effect');
        
        rippleElements.forEach(element => {
            element.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const ripple = document.createElement('span');
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                this.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    // ============================================
    // PROGRESS BAR ANIMATIONS
    // ============================================
    
    function setupProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        
        const progressObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.animated) {
                    const target = entry.target.dataset.progress || 0;
                    setTimeout(() => {
                        entry.target.style.width = target + '%';
                    }, 200);
                    entry.target.dataset.animated = 'true';
                }
            });
        }, { threshold: 0.5 });

        progressBars.forEach(bar => progressObserver.observe(bar));
    }

    // ============================================
    // STAGGER ANIMATIONS
    // ============================================
    
    function setupStaggerAnimations() {
        const containers = document.querySelectorAll('.stagger-animation, .quick-stats, .dashboard-widgets');
        
        containers.forEach(container => {
            const children = container.children;
            Array.from(children).forEach((child, index) => {
                child.style.animationDelay = `${index * 0.1}s`;
                child.classList.add('fade-in-up');
            });
        });
    }

    // ============================================
    // HOVER EFFECTS
    // ============================================
    
    function setupHoverEffects() {
        // Magnetic effect for buttons
        const magneticElements = document.querySelectorAll('.btn-primary, .fab');
        
        magneticElements.forEach(element => {
            element.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                
                this.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.05)`;
            });
            
            element.addEventListener('mouseleave', function() {
                this.style.transform = 'translate(0, 0) scale(1)';
            });
        });

        // Tilt effect for cards
        const tiltCards = document.querySelectorAll('.stat-card, .event-card, .club-card');
        
        tiltCards.forEach(card => {
            card.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;
                
                this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
            });
        });
    }

    // ============================================
    // LOADING STATES
    // ============================================
    
    function setupLoadingStates() {
        // Show skeleton loaders
        const loadingElements = document.querySelectorAll('[data-loading]');
        
        loadingElements.forEach(element => {
            const skeleton = document.createElement('div');
            skeleton.classList.add('loading-skeleton');
            skeleton.style.height = element.offsetHeight + 'px';
            skeleton.style.width = element.offsetWidth + 'px';
            
            element.style.display = 'none';
            element.parentNode.insertBefore(skeleton, element);
            
            // Remove skeleton when content loads
            setTimeout(() => {
                skeleton.remove();
                element.style.display = '';
                element.classList.add('fade-in-up');
            }, 1000);
        });
    }

    // ============================================
    // SMOOTH SCROLL
    // ============================================
    
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // ============================================
    // NOTIFICATION ANIMATIONS
    // ============================================
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in-down`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5rem;">${getNotificationIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            z-index: 10000;
            min-width: 300px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.5s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-out';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    function getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // ============================================
    // EXPORT FUNCTIONS
    // ============================================
    
    window.StudentDashboard = {
        showNotification,
        init
    };

    // ============================================
    // AUTO INIT
    // ============================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// ============================================
// CSS ANIMATIONS (Add to page)
// ============================================

const style = document.createElement('style');
style.textContent = `
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

    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
