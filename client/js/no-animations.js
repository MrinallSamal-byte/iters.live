/**
 * No Animations Override - Student Dashboard
 * Disables all JavaScript-based animations
 * Provides instant UI/UX without any animations
 */

(function() {
    'use strict';
    
    console.log('🚫 Disabling all animations for clean UI/UX...');
    
    // ===== DISABLE ANIMATION FUNCTIONS =====
    
    // Override animation functions
    window.requestAnimationFrame = function(callback) {
        // Execute immediately instead of waiting for next frame
        callback(Date.now());
        return 0;
    };
    
    window.cancelAnimationFrame = function() {
        // Do nothing
    };
    
    // ===== DISABLE COUNTER ANIMATIONS =====
    function disableCounters() {
        const counters = document.querySelectorAll('.counter, .stat-value, [data-target]');
        counters.forEach(counter => {
            const target = counter.dataset.target || counter.textContent;
            counter.textContent = target;
            counter.dataset.animated = 'true';
            // Remove any animation classes
            counter.classList.remove('animate', 'counting', 'animated');
        });
    }
    
    // ===== DISABLE PROGRESS BAR ANIMATIONS =====
    function disableProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill, [data-progress]');
        progressBars.forEach(bar => {
            const progress = bar.dataset.progress || bar.style.width;
            if (progress) {
                bar.style.width = progress.includes('%') ? progress : progress + '%';
                bar.style.transition = 'none';
            }
        });
    }
    
    // ===== DISABLE SCROLL ANIMATIONS =====
    function disableScrollAnimations() {
        const elements = document.querySelectorAll('[data-scroll], .fade-in, .slide-in, .zoom-in, .reveal');
        elements.forEach(el => {
            el.classList.remove('fade-in', 'slide-in', 'zoom-in', 'reveal');
            el.style.opacity = '1';
            el.style.transform = 'none';
            el.style.animation = 'none';
        });
    }
    
    // ===== DISABLE INTERSECTION OBSERVER ANIMATIONS =====
    const originalObserve = IntersectionObserver.prototype.observe;
    IntersectionObserver.prototype.observe = function(target) {
        // Immediately trigger the callback
        if (this.callback && typeof this.callback === 'function') {
            try {
                this.callback([{
                    target: target,
                    isIntersecting: true,
                    intersectionRatio: 1
                }], this);
            } catch (e) {
                // Silent fail
            }
        }
        // Don't actually observe
        return;
    };
    
    // ===== DISABLE ANIMATION CONTROLLER =====
    if (typeof AnimationController !== 'undefined') {
        AnimationController.prototype.init = function() {
            // Do nothing - disabled
        };
        AnimationController.prototype.setupCounterAnimations = function() {
            disableCounters();
        };
        AnimationController.prototype.setupScrollReveal = function() {
            disableScrollAnimations();
        };
        AnimationController.prototype.setupParallax = function() {
            // Disabled
        };
        AnimationController.prototype.setupCardHoverEffects = function() {
            // Disabled
        };
        AnimationController.prototype.setupRippleEffect = function() {
            // Disabled
        };
        AnimationController.prototype.setupPageTransitions = function() {
            // Disabled
        };
        AnimationController.prototype.setupSkeletonLoaders = function() {
            // Hide skeleton loaders immediately
            const skeletons = document.querySelectorAll('.skeleton, .skeleton-loader');
            skeletons.forEach(s => s.remove());
        };
    }
    
    // ===== DISABLE CHART.JS ANIMATIONS =====
    if (typeof Chart !== 'undefined') {
        Chart.defaults.animation = false;
        Chart.defaults.animations = {
            numbers: { duration: 0 },
            colors: { duration: 0 }
        };
        Chart.defaults.transitions = {
            active: { animation: { duration: 0 } },
            resize: { animation: { duration: 0 } }
        };
    }
    
    // ===== DISABLE LOADING STATES =====
    function disableLoadingStates() {
        const loadingElements = document.querySelectorAll('.loading, .spinner, [data-loading]');
        loadingElements.forEach(el => {
            el.classList.remove('loading');
            el.style.display = 'none';
        });
    }
    
    // ===== DISABLE SKELETON LOADERS =====
    function disableSkeletonLoaders() {
        const skeletons = document.querySelectorAll('.skeleton, .skeleton-loader, .skeleton-text, .skeleton-card');
        skeletons.forEach(skeleton => {
            skeleton.remove();
        });
    }
    
    // ===== DISABLE RIPPLE EFFECTS =====
    document.addEventListener('click', function(e) {
        // Remove any ripple elements
        const ripples = document.querySelectorAll('.ripple, .ripple-effect');
        ripples.forEach(r => r.remove());
    }, true);
    
    // ===== DISABLE TOOLTIP ANIMATIONS =====
    function disableTooltips() {
        const tooltips = document.querySelectorAll('[data-tooltip], .tooltip');
        tooltips.forEach(tooltip => {
            tooltip.style.transition = 'none';
            tooltip.style.animation = 'none';
        });
    }
    
    // ===== DISABLE MODAL ANIMATIONS =====
    function disableModals() {
        const modals = document.querySelectorAll('.modal, .modal-content, .modal-backdrop');
        modals.forEach(modal => {
            modal.style.transition = 'none';
            modal.style.animation = 'none';
        });
    }
    
    // ===== DISABLE DROPDOWN ANIMATIONS =====
    function disableDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown, .dropdown-menu, [data-dropdown]');
        dropdowns.forEach(dropdown => {
            dropdown.style.transition = 'none';
            dropdown.style.animation = 'none';
        });
    }
    
    // ===== DISABLE NOTIFICATION ANIMATIONS =====
    if (typeof Toast !== 'undefined' && Toast.show) {
        const originalToastShow = Toast.show;
        Toast.show = function(message, type, duration) {
            // Show without animation
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 12px 20px;
                background: rgba(99, 102, 241, 0.9);
                color: white;
                border-radius: 8px;
                z-index: 10000;
                transition: none;
                animation: none;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), duration || 3000);
        };
    }
    
    // ===== APPLY ON DOM READY =====
    function applyNoAnimations() {
        disableCounters();
        disableProgressBars();
        disableScrollAnimations();
        disableLoadingStates();
        disableSkeletonLoaders();
        disableTooltips();
        disableModals();
        disableDropdowns();
        
        console.log('✅ All animations disabled - Clean UI/UX active');
    }
    
    // ===== INITIALIZE =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyNoAnimations);
    } else {
        applyNoAnimations();
    }
    
    // Re-apply after dynamic content loads
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                setTimeout(applyNoAnimations, 0);
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // ===== EXPORT =====
    window.NoAnimations = {
        disable: applyNoAnimations,
        enabled: true
    };
    
    console.log('🎨 No-Animation Mode: ACTIVE');
    
})();
