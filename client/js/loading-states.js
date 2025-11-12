/**
 * Loading States Manager for ITER EduHub
 * Provides skeleton loaders, spinners, and progress bars
 * Version: 1.0.0
 */

class LoadingManager {
    /**
     * Show skeleton loader
     * @param {string} elementId - ID of the element to show skeleton in
     * @param {string} type - Type of skeleton (card, list, table, text)
     * @param {number} count - Number of skeleton items (for list/table)
     */
    static showSkeleton(elementId, type = 'card', count = 3) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const skeletons = {
            card: `
                <div class="skeleton-card animate-pulse">
                    <div class="skeleton skeleton-header" style="height: 20px; width: 60%; margin-bottom: 10px;"></div>
                    <div class="skeleton skeleton-line" style="height: 14px; width: 100%; margin-bottom: 8px;"></div>
                    <div class="skeleton skeleton-line" style="height: 14px; width: 90%; margin-bottom: 8px;"></div>
                    <div class="skeleton skeleton-line" style="height: 14px; width: 80%;"></div>
                </div>
            `,
            list: Array(count).fill(0).map(() => `
                <div class="skeleton-list-item animate-pulse" style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px;">
                    <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;"></div>
                    <div style="flex: 1;">
                        <div class="skeleton" style="height: 16px; width: 60%; margin-bottom: 8px;"></div>
                        <div class="skeleton" style="height: 12px; width: 40%;"></div>
                    </div>
                </div>
            `).join(''),
            table: `
                <div class="skeleton-table animate-pulse">
                    ${Array(count).fill(0).map(() => `
                        <div class="skeleton-row" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div class="skeleton" style="height: 16px; flex: 1;"></div>
                            <div class="skeleton" style="height: 16px; flex: 1;"></div>
                            <div class="skeleton" style="height: 16px; flex: 1;"></div>
                            <div class="skeleton" style="height: 16px; width: 80px;"></div>
                        </div>
                    `).join('')}
                </div>
            `,
            text: `
                <div class="skeleton-text animate-pulse">
                    <div class="skeleton" style="height: 16px; width: 100%; margin-bottom: 8px;"></div>
                    <div class="skeleton" style="height: 16px; width: 95%; margin-bottom: 8px;"></div>
                    <div class="skeleton" style="height: 16px; width: 90%; margin-bottom: 8px;"></div>
                    <div class="skeleton" style="height: 16px; width: 85%;"></div>
                </div>
            `,
            stats: `
                <div class="skeleton-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    ${Array(4).fill(0).map(() => `
                        <div class="skeleton-stat-card animate-pulse" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03);">
                            <div class="skeleton" style="height: 40px; width: 40px; border-radius: 8px; margin-bottom: 12px;"></div>
                            <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 8px;"></div>
                            <div class="skeleton" style="height: 14px; width: 80%;"></div>
                        </div>
                    `).join('')}
                </div>
            `,
            chart: `
                <div class="skeleton-chart animate-pulse" style="position: relative; height: 300px; display: flex; align-items: flex-end; gap: 8px; padding: 20px;">
                    ${Array(8).fill(0).map(() => {
                        const height = Math.random() * 60 + 40;
                        return `<div class="skeleton" style="flex: 1; height: ${height}%; border-radius: 4px 4px 0 0;"></div>`;
                    }).join('')}
                </div>
            `
        };
        
        element.innerHTML = skeletons[type] || skeletons.card;
        element.classList.add('loading-state');
        
        return element;
    }

    /**
     * Hide skeleton and show content with animation
     * @param {string} elementId - ID of the element
     * @param {string} content - HTML content to show
     */
    static hideSkeleton(elementId, content = '') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.classList.remove('loading-state');
        
        if (content) {
            element.style.opacity = '0';
            element.innerHTML = content;
            
            // Fade in
            if (typeof gsap !== 'undefined') {
                gsap.to(element, {
                    opacity: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            } else {
                element.style.opacity = '1';
            }
        }
    }

    /**
     * Show spinner
     * @param {string} elementId - ID of the element
     * @param {string} message - Optional loading message
     */
    static showSpinner(elementId, message = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = `
            <div class="spinner-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
                <div class="spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(99, 102, 241, 0.2);
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></div>
                ${message ? `<p style="margin-top: 16px; color: rgba(255,255,255,0.7);">${message}</p>` : ''}
            </div>
        `;
        element.classList.add('loading-state');
    }

    /**
     * Show progress bar
     * @param {string} elementId - ID of the element
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} label - Optional label
     */
    static showProgress(elementId, percentage = 0, label = '') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const existingProgress = element.querySelector('.progress-fill');
        
        if (existingProgress) {
            // Update existing progress bar
            if (typeof gsap !== 'undefined') {
                gsap.to(existingProgress, {
                    width: `${percentage}%`,
                    duration: 0.5,
                    ease: 'power2.out'
                });
            } else {
                existingProgress.style.width = `${percentage}%`;
            }
            
            const progressText = element.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = `${percentage}%`;
            }
            
            const progressLabel = element.querySelector('.progress-label');
            if (progressLabel && label) {
                progressLabel.textContent = label;
            }
        } else {
            // Create new progress bar
            element.innerHTML = `
                <div class="progress-container" style="width: 100%;">
                    ${label ? `<div class="progress-label" style="margin-bottom: 8px; font-size: 14px; color: rgba(255,255,255,0.8);">${label}</div>` : ''}
                    <div class="progress-bar" style="
                        width: 100%;
                        height: 12px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        overflow: hidden;
                        position: relative;
                    ">
                        <div class="progress-fill" style="
                            height: 100%;
                            width: ${percentage}%;
                            background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
                            border-radius: 10px;
                            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                            position: relative;
                            overflow: hidden;
                        ">
                            <div style="
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                bottom: 0;
                                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                                animation: shimmer 2s infinite;
                            "></div>
                        </div>
                        <span class="progress-text" style="
                            position: absolute;
                            right: 8px;
                            top: 50%;
                            transform: translateY(-50%);
                            font-size: 11px;
                            font-weight: 600;
                            color: rgba(255,255,255,0.9);
                        ">${percentage}%</span>
                    </div>
                </div>
            `;
        }
        
        element.classList.add('loading-state');
    }

    /**
     * Show inline loader (small spinner for buttons)
     * @param {HTMLElement} element - Button or element to show loader in
     */
    static showInlineLoader(element) {
        if (!element) return;
        
        element.dataset.originalContent = element.innerHTML;
        element.disabled = true;
        element.style.opacity = '0.7';
        element.style.cursor = 'not-allowed';
        
        element.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 8px;">
                <span class="inline-spinner" style="
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #ffffff;
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite;
                "></span>
                <span>Loading...</span>
            </span>
        `;
    }

    /**
     * Hide inline loader
     * @param {HTMLElement} element - Button or element to restore
     */
    static hideInlineLoader(element) {
        if (!element) return;
        
        element.disabled = false;
        element.style.opacity = '1';
        element.style.cursor = 'pointer';
        
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
    }

    /**
     * Show loading overlay on entire page
     * @param {string} message - Optional loading message
     */
    static showOverlay(message = 'Loading...') {
        let overlay = document.getElementById('globalLoadingOverlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(10px);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            overlay.innerHTML = `
                <div class="spinner" style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(99, 102, 241, 0.2);
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></div>
                <p style="
                    margin-top: 20px;
                    color: white;
                    font-size: 16px;
                    font-weight: 500;
                ">${message}</p>
            `;
            
            document.body.appendChild(overlay);
        }
        
        // Fade in
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }

    /**
     * Hide loading overlay
     */
    static hideOverlay() {
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }

    /**
     * Show pulsing dots loader
     * @param {string} elementId - ID of the element
     */
    static showDots(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = `
            <div class="dots-loader" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px;">
                <div class="dot" style="
                    width: 12px;
                    height: 12px;
                    background: #6366f1;
                    border-radius: 50%;
                    animation: dotPulse 1.4s ease-in-out infinite;
                "></div>
                <div class="dot" style="
                    width: 12px;
                    height: 12px;
                    background: #8b5cf6;
                    border-radius: 50%;
                    animation: dotPulse 1.4s ease-in-out infinite;
                    animation-delay: 0.2s;
                "></div>
                <div class="dot" style="
                    width: 12px;
                    height: 12px;
                    background: #ec4899;
                    border-radius: 50%;
                    animation: dotPulse 1.4s ease-in-out infinite;
                    animation-delay: 0.4s;
                "></div>
            </div>
        `;
        element.classList.add('loading-state');
    }

    /**
     * Clear any loading state
     * @param {string} elementId - ID of the element
     */
    static clear(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.classList.remove('loading-state');
        element.innerHTML = '';
    }
}

// Add required CSS animations if not already present
if (!document.getElementById('loading-states-css')) {
    const style = document.createElement('style');
    style.id = 'loading-states-css';
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        @keyframes dotPulse {
            0%, 100% {
                transform: scale(1);
                opacity: 1;
            }
            50% {
                transform: scale(1.5);
                opacity: 0.5;
            }
        }

        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        .skeleton {
            background: linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.05) 0%,
                rgba(255, 255, 255, 0.1) 50%,
                rgba(255, 255, 255, 0.05) 100%
            );
            background-size: 200% 100%;
            animation: skeleton-loading 1.5s ease-in-out infinite;
            border-radius: 4px;
        }

        @keyframes skeleton-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        .loading-state {
            min-height: 100px;
        }
    `;
    document.head.appendChild(style);
}

// Export for global use
window.LoadingManager = LoadingManager;

console.log('✓ Loading States Manager initialized');
