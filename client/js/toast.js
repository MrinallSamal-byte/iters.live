/**
 * Toast Notification System
 * Modern, animated toast notifications with GSAP support
 */

class ToastNotification {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 4000;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }

        // Add styles if not already present
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }

            .toast {
                min-width: 280px;
                max-width: 380px;
                padding: 12px 16px;
                border-radius: 6px;
                background: var(--surface, #0d0d0d);
                border: 1px solid var(--border, rgba(255,255,255,0.08));
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: all;
                cursor: pointer;
                transition: transform 0.2s ease;
                position: relative;
                overflow: hidden;
            }

            .toast:hover { transform: translateX(-3px); }

            .toast-success { border-left: 2px solid var(--ok, #00E676); }
            .toast-error   { border-left: 2px solid var(--danger, #FF5252); }
            .toast-warning { border-left: 2px solid var(--warn, #FFB300); }
            .toast-info    { border-left: 2px solid var(--primary, #FF0000); }

            .toast-icon {
                width: 22px; height: 22px;
                flex-shrink: 0;
                display: flex; align-items: center; justify-content: center;
                font-size: 13px; font-weight: 700;
            }
            .toast-success .toast-icon { color: var(--ok, #00E676); }
            .toast-error   .toast-icon { color: var(--danger, #FF5252); }
            .toast-warning .toast-icon { color: var(--warn, #FFB300); }
            .toast-info    .toast-icon { color: var(--primary, #FF0000); }

            .toast-content { flex: 1; min-width: 0; }

            .toast-title {
                font-weight: 700;
                font-size: 13px;
                color: var(--text, #fff);
                margin-bottom: 2px;
            }

            .toast-message {
                font-size: 12px;
                color: var(--muted, #888);
                line-height: 1.4;
                word-wrap: break-word;
            }

            .toast-close {
                width: 18px; height: 18px;
                background: none;
                border: none;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
                color: var(--muted, #888);
                font-size: 14px;
                transition: color 0.15s;
            }
            .toast-close:hover { color: var(--text, #fff); }

            .toast-progress {
                position: absolute;
                bottom: 0; left: 0;
                height: 2px;
                background: var(--primary, #FF0000);
                transition: width linear;
            }

            @media (max-width: 640px) {
                .toast-container {
                    left: 20px;
                    right: 20px;
                }

                .toast {
                    min-width: auto;
                    max-width: none;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .toast {
                    transition: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    show(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = this.defaultDuration,
            closable = true,
            showProgress = true
        } = options;

        // Remove oldest toast if max reached
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            ${closable ? '<button class="toast-close" aria-label="Close">×</button>' : ''}
            ${showProgress && duration > 0 ? '<div class="toast-progress"></div>' : ''}
        `;

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Animate in
        this.animateIn(toast);

        // Setup close button
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(toast);
            });
        }

        // Setup click to close
        toast.addEventListener('click', () => {
            this.remove(toast);
        });

        // Setup progress bar
        if (showProgress && duration > 0) {
            const progressBar = toast.querySelector('.toast-progress');
            progressBar.style.width = '100%';
            progressBar.style.transitionDuration = `${duration}ms`;
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 10);
        }

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (this.toasts.includes(toast)) {
                    this.remove(toast);
                }
            }, duration);
        }

        return toast;
    }

    animateIn(toast) {
        if (typeof gsap !== 'undefined') {
            gsap.from(toast, {
                x: 100,
                opacity: 0,
                duration: 0.4,
                ease: 'power3.out'
            });
        } else {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            toast.style.transition = 'opacity 0.4s, transform 0.4s';
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);
        }
    }

    animateOut(toast) {
        return new Promise((resolve) => {
            if (typeof gsap !== 'undefined') {
                gsap.to(toast, {
                    x: 100,
                    opacity: 0,
                    duration: 0.3,
                    ease: 'power3.in',
                    onComplete: resolve
                });
            } else {
                toast.style.transition = 'opacity 0.3s, transform 0.3s';
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100px)';
                setTimeout(resolve, 300);
            }
        });
    }

    async remove(toast) {
        const index = this.toasts.indexOf(toast);
        if (index === -1) return;

        this.toasts.splice(index, 1);
        await this.animateOut(toast);
        toast.remove();
    }

    // Convenience methods
    success(message, title = 'Success') {
        return this.show({ type: 'success', title, message });
    }

    error(message, title = 'Error') {
        return this.show({ type: 'error', title, message });
    }

    warning(message, title = 'Warning') {
        return this.show({ type: 'warning', title, message });
    }

    info(message, title = 'Info') {
        return this.show({ type: 'info', title, message });
    }

    // Clear all toasts
    clearAll() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

// Create global instance
const Toast = new ToastNotification();

// Add to window for easy access
if (typeof window !== 'undefined') {
    window.Toast = Toast;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastNotification;
}
