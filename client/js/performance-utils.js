/**
 * Performance Utilities for ITER EduHub
 * Memory management, lazy loading, and cleanup utilities
 * @version 1.0.0
 */

(function() {
    'use strict';

    /**
     * PerformanceManager - Central performance optimization manager
     */
    class PerformanceManager {
        constructor() {
            this.eventListeners = new Map();
            this.observers = new Set();
            this.intervals = new Set();
            this.timeouts = new Set();
            this.animationFrames = new Set();
            this.initialized = false;
        }

        /**
         * Initialize performance optimizations
         */
        init() {
            if (this.initialized) return;

            this.setupLazyLoading();
            this.setupCleanup();
            this.optimizeScrollHandlers();

            this.initialized = true;
            console.log('✓ PerformanceManager initialized');
        }

        /**
         * Add a tracked event listener that will be cleaned up on page unload
         * @param {Element} element - DOM element
         * @param {string} event - Event type
         * @param {Function} handler - Event handler
         * @param {Object} options - Event listener options
         */
        addTrackedListener(element, event, handler, options = {}) {
            if (!element) return;

            element.addEventListener(event, handler, options);

            // Use incrementing counter for reliable unique keys
            if (!this._listenerCounter) this._listenerCounter = 0;
            const key = `${event}_${++this._listenerCounter}`;
            this.eventListeners.set(key, { element, event, handler, options });

            return key;
        }

        /**
         * Remove a tracked event listener
         * @param {string} key - Listener key from addTrackedListener
         */
        removeTrackedListener(key) {
            const listener = this.eventListeners.get(key);
            if (listener) {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
                this.eventListeners.delete(key);
            }
        }

        /**
         * Track an IntersectionObserver for cleanup
         * @param {IntersectionObserver} observer - Observer to track
         */
        trackObserver(observer) {
            this.observers.add(observer);
            return observer;
        }

        /**
         * Track a setInterval for cleanup
         * @param {Function} callback - Interval callback
         * @param {number} delay - Interval delay in ms
         * @returns {number} - Interval ID
         */
        trackedInterval(callback, delay) {
            const id = setInterval(callback, delay);
            this.intervals.add(id);
            return id;
        }

        /**
         * Clear a tracked interval
         * @param {number} id - Interval ID
         */
        clearTrackedInterval(id) {
            clearInterval(id);
            this.intervals.delete(id);
        }

        /**
         * Track a setTimeout for cleanup
         * @param {Function} callback - Timeout callback
         * @param {number} delay - Timeout delay in ms
         * @returns {number} - Timeout ID
         */
        trackedTimeout(callback, delay) {
            const id = setTimeout(() => {
                callback();
                this.timeouts.delete(id);
            }, delay);
            this.timeouts.add(id);
            return id;
        }

        /**
         * Clear a tracked timeout
         * @param {number} id - Timeout ID
         */
        clearTrackedTimeout(id) {
            clearTimeout(id);
            this.timeouts.delete(id);
        }

        /**
         * Track a requestAnimationFrame for cleanup
         * @param {Function} callback - Animation frame callback
         * @returns {number} - Animation frame ID
         */
        trackedAnimationFrame(callback) {
            const id = requestAnimationFrame(() => {
                callback();
                this.animationFrames.delete(id);
            });
            this.animationFrames.add(id);
            return id;
        }

        /**
         * Cancel a tracked animation frame
         * @param {number} id - Animation frame ID
         */
        cancelTrackedAnimationFrame(id) {
            cancelAnimationFrame(id);
            this.animationFrames.delete(id);
        }

        /**
         * Setup lazy loading for images
         */
        setupLazyLoading() {
            // Don't setup if IntersectionObserver is not supported
            if (!('IntersectionObserver' in window)) {
                console.warn('IntersectionObserver not supported, lazy loading disabled');
                return;
            }

            const lazyLoadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // Load the actual image
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        
                        // Load srcset if present
                        if (img.dataset.srcset) {
                            img.srcset = img.dataset.srcset;
                            img.removeAttribute('data-srcset');
                        }

                        img.classList.remove('lazy');
                        img.classList.add('lazy-loaded');
                        lazyLoadObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            this.trackObserver(lazyLoadObserver);

            // Observe existing lazy images
            this.observeLazyImages(lazyLoadObserver);

            // Store observer for later use
            this.lazyLoadObserver = lazyLoadObserver;

            console.log('✓ Lazy loading initialized');
        }

        /**
         * Observe lazy images
         * @param {IntersectionObserver} observer - The lazy load observer
         */
        observeLazyImages(observer) {
            const images = document.querySelectorAll('img[data-src], img.lazy');
            images.forEach(img => observer.observe(img));
        }

        /**
         * Add a new image to lazy loading
         * @param {Element} img - Image element
         */
        lazyLoadImage(img) {
            if (this.lazyLoadObserver && img.dataset.src) {
                this.lazyLoadObserver.observe(img);
            }
        }

        /**
         * Optimize scroll handlers using requestAnimationFrame
         */
        optimizeScrollHandlers() {
            let scrollTicking = false;
            const scrollCallbacks = [];

            const handleScroll = () => {
                if (!scrollTicking) {
                    requestAnimationFrame(() => {
                        scrollCallbacks.forEach(cb => cb());
                        scrollTicking = false;
                    });
                    scrollTicking = true;
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            this.eventListeners.set('scroll_optimized', { 
                element: window, 
                event: 'scroll', 
                handler: handleScroll,
                options: { passive: true }
            });

            // Method to add scroll callbacks
            this.addScrollCallback = (callback) => {
                scrollCallbacks.push(callback);
                return scrollCallbacks.length - 1;
            };

            this.removeScrollCallback = (index) => {
                if (index >= 0 && index < scrollCallbacks.length) {
                    scrollCallbacks.splice(index, 1);
                }
            };
        }

        /**
         * Setup cleanup on page unload/navigation
         */
        setupCleanup() {
            const cleanup = () => {
                this.destroy();
            };

            window.addEventListener('beforeunload', cleanup);
            window.addEventListener('pagehide', cleanup);

            // For SPA navigations
            window.addEventListener('popstate', () => {
                // Partial cleanup on navigation
                this.clearDynamicContent();
            });
        }

        /**
         * Clear dynamic content (for SPA navigation)
         */
        clearDynamicContent() {
            // Clear intervals and timeouts
            this.intervals.forEach(id => clearInterval(id));
            this.intervals.clear();

            this.timeouts.forEach(id => clearTimeout(id));
            this.timeouts.clear();

            this.animationFrames.forEach(id => cancelAnimationFrame(id));
            this.animationFrames.clear();
        }

        /**
         * Full cleanup - call when completely leaving the page
         */
        destroy() {
            // Remove all tracked event listeners
            this.eventListeners.forEach((listener) => {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            });
            this.eventListeners.clear();

            // Disconnect all observers
            this.observers.forEach(observer => observer.disconnect());
            this.observers.clear();

            // Clear all intervals
            this.intervals.forEach(id => clearInterval(id));
            this.intervals.clear();

            // Clear all timeouts
            this.timeouts.forEach(id => clearTimeout(id));
            this.timeouts.clear();

            // Cancel all animation frames
            this.animationFrames.forEach(id => cancelAnimationFrame(id));
            this.animationFrames.clear();

            console.log('✓ PerformanceManager cleanup complete');
        }

        /**
         * Debounce function
         * @param {Function} func - Function to debounce
         * @param {number} wait - Wait time in ms
         * @returns {Function} - Debounced function
         */
        static debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    timeout = null;
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        /**
         * Throttle function
         * @param {Function} func - Function to throttle
         * @param {number} limit - Time limit in ms
         * @returns {Function} - Throttled function
         */
        static throttle(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func(...args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        /**
         * Request Idle Callback with fallback
         * @param {Function} callback - Callback to run when idle
         * @param {Object} options - Options object
         */
        static requestIdleCallback(callback, options = {}) {
            if ('requestIdleCallback' in window) {
                return window.requestIdleCallback(callback, options);
            } else {
                // Fallback for browsers that don't support requestIdleCallback
                const timeout = options.timeout || 50;
                return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => timeout }), 1);
            }
        }

        /**
         * Cancel Idle Callback with fallback
         * @param {number} id - Idle callback ID
         */
        static cancelIdleCallback(id) {
            if ('cancelIdleCallback' in window) {
                window.cancelIdleCallback(id);
            } else {
                clearTimeout(id);
            }
        }
    }

    /**
     * Memory Monitor - Tracks memory usage (where available)
     */
    class MemoryMonitor {
        constructor() {
            this.measurements = [];
            this.maxMeasurements = 100;
        }

        /**
         * Take a memory measurement
         * @returns {Object|null} - Memory info or null if not available
         */
        measure() {
            if (performance.memory) {
                const measurement = {
                    timestamp: Date.now(),
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
                
                this.measurements.push(measurement);
                
                // Keep only last N measurements
                if (this.measurements.length > this.maxMeasurements) {
                    this.measurements.shift();
                }
                
                return measurement;
            }
            return null;
        }

        /**
         * Get memory trend
         * @returns {string} - 'increasing', 'decreasing', 'stable', or 'unknown'
         */
        getTrend() {
            if (this.measurements.length < 2) return 'unknown';
            
            const recent = this.measurements.slice(-10);
            const first = recent[0].usedJSHeapSize;
            const last = recent[recent.length - 1].usedJSHeapSize;
            const diff = last - first;
            const threshold = first * 0.05; // 5% threshold
            
            if (diff > threshold) return 'increasing';
            if (diff < -threshold) return 'decreasing';
            return 'stable';
        }

        /**
         * Format bytes to human readable string
         * @param {number} bytes - Bytes to format
         * @returns {string} - Formatted string
         */
        static formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    }

    // Create singleton instances
    const performanceManager = new PerformanceManager();
    const memoryMonitor = new MemoryMonitor();

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            performanceManager.init();
        });
    } else {
        performanceManager.init();
    }

    // Export to global scope
    window.PerformanceManager = PerformanceManager;
    window.performanceManager = performanceManager;
    window.MemoryMonitor = MemoryMonitor;
    window.memoryMonitor = memoryMonitor;

    // Export utility functions
    window.debounce = PerformanceManager.debounce;
    window.throttle = PerformanceManager.throttle;

})();
