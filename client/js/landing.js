// Landing Page Specific JavaScript

// Load Lottie Animation
function loadHeroAnimation() {
    const container = document.getElementById('heroAnimation');
    if (!container) return;

    // Simple fallback animation data (minimal Lottie JSON)
    const animationData = {
        v: "5.7.4",
        fr: 60,
        ip: 0,
        op: 180,
        w: 500,
        h: 500,
        nm: "Hero Animation",
        ddd: 0,
        assets: [],
        layers: [
            {
                ddd: 0,
                ind: 1,
                ty: 4,
                nm: "Circle",
                sr: 1,
                ks: {
                    o: { a: 0, k: 100 },
                    r: { a: 1, k: [
                        { t: 0, s: [0], e: [360] },
                        { t: 180 }
                    ]},
                    p: { a: 0, k: [250, 250, 0] },
                    a: { a: 0, k: [0, 0, 0] },
                    s: { a: 0, k: [100, 100, 100] }
                },
                ao: 0,
                shapes: [
                    {
                        ty: "gr",
                        it: [
                            {
                                ty: "el",
                                p: { a: 0, k: [0, 0] },
                                s: { a: 0, k: [200, 200] }
                            },
                            {
                                ty: "st",
                                c: { a: 0, k: [0.4, 0.4, 0.95, 1] },
                                o: { a: 0, k: 100 },
                                w: { a: 0, k: 8 }
                            },
                            {
                                ty: "tr",
                                p: { a: 0, k: [0, 0] },
                                a: { a: 0, k: [0, 0] },
                                s: { a: 0, k: [100, 100] },
                                r: { a: 0, k: 0 },
                                o: { a: 0, k: 100 }
                            }
                        ]
                    }
                ],
                ip: 0,
                op: 180,
                st: 0
            }
        ]
    };

    // Try to load Lottie if available
    if (typeof lottie !== 'undefined') {
        lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
        });
    } else {
        // Fallback: Create a simple CSS animation
        container.innerHTML = `
            <div style="
                width: 200px;
                height: 200px;
                border: 8px solid #6366f1;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 2s linear infinite;
                margin: 150px auto;
            "></div>
        `;
    }
}

// Smooth Scroll for Anchor Links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '#!') return;
            
            const target = document.querySelector(href);
            if (!target) return;
            
            e.preventDefault();
            
            const offsetTop = target.offsetTop - 80; // Account for navbar height
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        });
    });
}

// Parallax Effect
function initParallax() {
    const orbs = document.querySelectorAll('.gradient-orb');
    if (orbs.length === 0) return;
    
    let mouseMoveTimeout;
    window.addEventListener('mousemove', (e) => {
        // Throttle mouse move events
        if (mouseMoveTimeout) return;
        
        mouseMoveTimeout = setTimeout(() => {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            
            orbs.forEach((orb, index) => {
                const speed = (index + 1) * 20;
                const moveX = (x - 0.5) * speed;
                const moveY = (y - 0.5) * speed;
                
                orb.style.transform = `translate(${moveX}px, ${moveY}px)`;
            });
            
            mouseMoveTimeout = null;
        }, 16); // ~60fps
    }, { passive: true });
}

// Animate Stats on Scroll
function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const targetValue = parseInt(target.textContent);
                let current = 0;
                const increment = targetValue / 50;
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= targetValue) {
                        target.textContent = targetValue + (target.textContent.includes('+') ? '+' : '');
                        clearInterval(timer);
                    } else {
                        target.textContent = Math.floor(current) + (target.textContent.includes('+') ? '+' : '');
                    }
                }, 30);
                
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

// Feature Cards Stagger Animation
function initFeatureCards() {
    const cards = document.querySelectorAll('.feature-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease';
        observer.observe(card);
    });
}

// Scroll Progress Indicator
function initScrollProgress() {
    const progress = document.createElement('div');
    progress.id = 'scroll-progress-bar';
    progress.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        width: 0;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        z-index: 10000;
        transition: width 0.1s ease;
        pointer-events: none;
    `;
    document.body.appendChild(progress);

    let scrollTimeout;
    window.addEventListener('scroll', () => {
        // Debounce scroll updates to prevent performance issues
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        
        scrollTimeout = window.requestAnimationFrame(() => {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            if (windowHeight > 0) {
                const scrolled = Math.min(100, Math.max(0, (window.scrollY / windowHeight) * 100));
                progress.style.width = scrolled + '%';
            }
        });
    }, { passive: true });
}

// Navbar Background on Scroll
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let scrollTimeout;
    window.addEventListener('scroll', () => {
        // Debounce scroll updates
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        
        scrollTimeout = window.requestAnimationFrame(() => {
            if (window.scrollY > 100) {
                navbar.style.background = 'var(--glass-bg)';
                navbar.style.backdropFilter = 'blur(20px)';
            } else {
                navbar.style.background = 'var(--glass-bg)';
            }
        });
    }, { passive: true });
}

// Check for Download Files
function checkDownloadFiles() {
    // Skip file checking as it causes 404 errors
    // The download buttons are already disabled in HTML with "Coming Soon" badges
    // If files exist in the future, they can be linked directly in the HTML
    
    // Optional: Add event listeners to disabled buttons to show info toast
    const downloadButtons = document.querySelectorAll('.download-card button[disabled]');
    downloadButtons.forEach(button => {
        const parent = button.closest('.download-card');
        if (parent) {
            parent.style.cursor = 'default';
        }
    });
}

// Initialize all landing page features
document.addEventListener('DOMContentLoaded', () => {
    loadHeroAnimation();
    initSmoothScroll();
    initParallax();
    animateStats();
    initFeatureCards();
    initScrollProgress();
    initNavbarScroll();
    checkDownloadFiles();

    // Add typing effect to hero title
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        let index = 0;
        
        function type() {
            if (index < text.length) {
                heroTitle.textContent += text.charAt(index);
                index++;
                setTimeout(type, 50);
            }
        }
        
        setTimeout(type, 500);
    }
});

// Export for use in other scripts
window.Landing = {
    loadHeroAnimation,
    animateStats
};
