/**
 * Toast Notification System
 * Minimal dark toasts with coral accent rule; GSAP optional
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
            this.container.setAttribute('role', 'status');
            this.container.setAttribute('aria-live', 'polite');
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
                --toast-surface: #111111;
                --toast-border: rgba(255, 255, 255, 0.08);
                --toast-text: #f6f3ee;
                --toast-text-muted: rgba(246, 243, 238, 0.62);
                --toast-accent: var(--primary, #d71921);
                --toast-shadow: rgba(0, 0, 0, 0.4);

                position: relative;
                overflow: hidden;
                min-width: 300px;
                max-width: 420px;
                padding: 14px 18px 16px;
                background: var(--toast-surface);
                border: 1px solid var(--toast-border);
                border-left: 3px solid var(--toast-accent);
                border-radius: 10px;
                box-shadow: 0 12px 32px var(--toast-shadow);
                color: var(--toast-text);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                pointer-events: all;
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            body.light-theme .toast {
                --toast-surface: #fcfaf6;
                --toast-border: rgba(19, 19, 19, 0.1);
                --toast-text: #161616;
                --toast-text-muted: rgba(22, 22, 22, 0.6);
                --toast-shadow: rgba(19, 19, 19, 0.16);
            }

            .toast:hover {
                transform: translateX(-4px);
                box-shadow: 0 16px 40px var(--toast-shadow);
            }

            .toast-success {
                --toast-accent: var(--success, #2cc37b);
            }

            .toast-error {
                --toast-accent: var(--danger, #ff6b6b);
            }

            .toast-warning {
                --toast-accent: var(--warning, #f1b34a);
            }

            .toast-info {
                --toast-accent: var(--primary, #d71921);
            }

            .toast-icon {
                flex-shrink: 0;
                min-width: 18px;
                padding-top: 1px;
                font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.5;
                color: var(--toast-accent);
            }

            .toast-content {
                flex: 1;
                min-width: 0;
            }

            .toast-title {
                font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--toast-text-muted);
                margin-bottom: 4px;
            }

            .toast-message {
                font-size: 13px;
                line-height: 1.45;
                color: var(--toast-text);
                word-wrap: break-word;
            }

            .toast-close {
                flex-shrink: 0;
                width: 22px;
                height: 22px;
                background: transparent;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--toast-text-muted);
                font-size: 15px;
                line-height: 1;
                transition: color 0.2s ease;
            }

            .toast-close:hover {
                color: var(--toast-text);
            }

            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                width: 100%;
                background: var(--toast-accent);
                opacity: 0.9;
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
                .toast,
                .toast-progress,
                .toast-close {
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

        // Create toast element (built via DOM APIs so dynamic strings are never parsed as HTML)
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        const iconEl = document.createElement('div');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icons[type] || icons.info;
        toast.appendChild(iconEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'toast-content';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            contentEl.appendChild(titleEl);
        }

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = message;
            contentEl.appendChild(messageEl);
        }

        toast.appendChild(contentEl);

        let closeBtn = null;
        if (closable) {
            closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'toast-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.textContent = '×';
            toast.appendChild(closeBtn);
        }

        let progressBar = null;
        if (showProgress && duration > 0) {
            progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';
            toast.appendChild(progressBar);
        }

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Animate in
        this.animateIn(toast);

        // Setup close button
        if (closeBtn) {
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
        if (progressBar) {
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
        [...this.toasts].forEach(toast => this.remove(toast));
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
