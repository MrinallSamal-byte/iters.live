// Main JavaScript File
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';
const RENDER_HEARTBEAT_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:5000/health'
    : '/health';
const RENDER_HEARTBEAT_INTERVAL_MS = 14 * 60 * 1000;

// Check if localStorage is available
let storageAvailable = false;
let sessionStorageAvailable = false;

try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    storageAvailable = true;
} catch (e) {
    console.warn('localStorage is not available. Trying sessionStorage...');
}

// Try sessionStorage as fallback
if (!storageAvailable) {
    try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        sessionStorageAvailable = true;
        console.log('Using sessionStorage as fallback');
    } catch (e) {
        console.warn('sessionStorage also not available. Using in-memory storage (will not persist across page reloads).');
    }
}

// In-memory storage fallback (won't persist across pages)
const memoryStorage = {};
const SESSION_TIMEOUT_MS = 20 * 60 * 1000;
const POST_LOGOUT_REDIRECT_KEY = 'postLogoutRedirectTarget';
const POST_LOGOUT_REDIRECT_AT_KEY = 'postLogoutRedirectTimestamp';
const POST_LOGOUT_REDIRECT_REASON_KEY = 'postLogoutRedirectReason';
const PUBLIC_HOME_PATHS = new Set(['/', '/index.html']);
const PUBLIC_AUTH_PATHS = new Set(['/login', '/login.html', '/register', '/register.html']);
const SESSION_INVALID_LOGOUT_REASON = 'session_invalid';
let authExpiryHandled = false;
const AUTH_STORAGE_KEYS = [
    'accessToken',
    'refreshToken',
    'user',
    'token',
    'prototypeMode',
    'demoRole',
    'rememberedUser',
    'lastActivityTimestamp',
    'sessionId',
    'sessionStartTimestamp',
    'pageAccessToken',
    'pageAccessTokenTimestamp',
    'pageAccessTokenPath',
    'loginRedirect',
    'loginMessage'
];

function getRawStorageItem(storageObject, key) {
    if (!storageObject) return null;
    try {
        return storageObject.getItem(key);
    } catch (error) {
        return null;
    }
}

function removeRawStorageItem(storageObject, key) {
    if (!storageObject) return;
    try {
        storageObject.removeItem(key);
    } catch (error) {
        // Ignore storage errors
    }
}

function clearMatchingStorageKeys(storageObject, predicate, preserveKeys = new Set()) {
    if (!storageObject) return;

    try {
        Object.keys(storageObject).forEach((key) => {
            if (!preserveKeys.has(key) && predicate(key)) {
                storageObject.removeItem(key);
            }
        });
    } catch (error) {
        // Ignore storage errors
    }
}

function clearMemoryStorage() {
    Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key]);
}

function setPostLogoutRedirect(target = '/index.html', reason = 'session_timeout') {
    try {
        localStorage.setItem(POST_LOGOUT_REDIRECT_KEY, target);
        localStorage.setItem(POST_LOGOUT_REDIRECT_AT_KEY, Date.now().toString());
        localStorage.setItem(POST_LOGOUT_REDIRECT_REASON_KEY, reason);
    } catch (error) {
        // Ignore storage errors
    }
}

function clearPostLogoutRedirect() {
    removeRawStorageItem(localStorage, POST_LOGOUT_REDIRECT_KEY);
    removeRawStorageItem(localStorage, POST_LOGOUT_REDIRECT_AT_KEY);
    removeRawStorageItem(localStorage, POST_LOGOUT_REDIRECT_REASON_KEY);
}

function resolveNavigationPath(href) {
    if (!href || typeof href !== 'string') return null;

    if (href.startsWith('#')) {
        return decodeVisiblePathname(window.location.pathname);
    }

    try {
        const pathname = new URL(href, window.location.origin).pathname;
        return decodeVisiblePathname(pathname);
    } catch (error) {
        return null;
    }
}

function decodeVisiblePathname(pathname = window.location.pathname) {
    if (!pathname || typeof pathname !== 'string' || !pathname.startsWith('/r/')) {
        return pathname;
    }

    try {
        const encoded = pathname.slice(3);
        let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = atob(b64);
        const queryIndex = decoded.indexOf('?');
        const hashIndex = decoded.indexOf('#');
        let cutIndex = decoded.length;

        if (queryIndex !== -1) cutIndex = Math.min(cutIndex, queryIndex);
        if (hashIndex !== -1) cutIndex = Math.min(cutIndex, hashIndex);

        return decoded.slice(0, cutIndex) || pathname;
    } catch (error) {
        return pathname;
    }
}

function shouldClearPostLogoutRedirectForLink(href) {
    const pathname = resolveNavigationPath(href);
    return pathname ? PUBLIC_AUTH_PATHS.has(pathname) : false;
}

function initPublicAuthLinkGuard() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!shouldClearPostLogoutRedirectForLink(href)) {
            return;
        }

        clearPostLogoutRedirect();
    }, true);
}

function getLastActivityTimestamp() {
    const sessionActivity = parseInt(getRawStorageItem(sessionStorage, 'lastActivityTimestamp') || '0', 10);
    const localActivity = parseInt(getRawStorageItem(localStorage, 'lastActivityTimestamp') || '0', 10);
    return Math.max(sessionActivity, localActivity, 0);
}

function hasStoredAuthState() {
    return Boolean(
        getRawStorageItem(localStorage, 'accessToken') ||
        getRawStorageItem(localStorage, 'user') ||
        getRawStorageItem(sessionStorage, 'accessToken') ||
        getRawStorageItem(sessionStorage, 'user')
    );
}

function hasExpiredSessionByInactivity() {
    const lastActivity = getLastActivityTimestamp();
    if (!lastActivity) return false;
    return Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
}

function clearAppCaches() {
    const cacheTasks = [];

    if ('serviceWorker' in navigator) {
        const notifyServiceWorker = (registration) => {
            try {
                registration?.active?.postMessage({ type: 'CLEAR_APP_CACHE' });
            } catch (error) {
                // Ignore messaging errors
            }
        };

        if (navigator.serviceWorker.controller) {
            try {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
            } catch (error) {
                // Ignore messaging errors
            }
        }

        cacheTasks.push(
            navigator.serviceWorker.ready
                .then(notifyServiceWorker)
                .catch(() => {})
        );
    }

    if ('caches' in window) {
        cacheTasks.push(
            caches.keys()
                .then((cacheNames) => Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName.startsWith('iter-'))
                        .map((cacheName) => caches.delete(cacheName))
                ))
                .catch(() => {})
        );
    }

    return Promise.allSettled(cacheTasks);
}

function clearClientState(options = {}) {
    authExpiryHandled = false;

    const preserveTheme = options.preserveTheme !== false;
    const preserveLogoutReason = options.preserveLogoutReason === true;
    const preservePostLogoutRedirect = options.preservePostLogoutRedirect === true;
    const clearCaches = options.clearCaches !== false;

    clearMemoryStorage();
    Socket.disconnect();

    const localPreserveKeys = new Set();
    const sessionPreserveKeys = new Set();

    if (preserveTheme) {
        localPreserveKeys.add('theme');
        sessionPreserveKeys.add('theme');
    }

    if (preserveLogoutReason) {
        sessionPreserveKeys.add('logoutReason');
    }

    if (preservePostLogoutRedirect) {
        localPreserveKeys.add(POST_LOGOUT_REDIRECT_KEY);
        localPreserveKeys.add(POST_LOGOUT_REDIRECT_AT_KEY);
        localPreserveKeys.add(POST_LOGOUT_REDIRECT_REASON_KEY);
    }

    AUTH_STORAGE_KEYS.forEach((key) => {
        if (!localPreserveKeys.has(key)) removeRawStorageItem(localStorage, key);
        if (!sessionPreserveKeys.has(key)) removeRawStorageItem(sessionStorage, key);
    });

    clearMatchingStorageKeys(
        localStorage,
        (key) => key.startsWith('portal') || key.startsWith('soa') || key.includes('retry'),
        localPreserveKeys
    );
    clearMatchingStorageKeys(
        sessionStorage,
        (key) => key.startsWith('portal') || key.startsWith('soa') || key.includes('retry'),
        sessionPreserveKeys
    );

    if (!preservePostLogoutRedirect) {
        clearPostLogoutRedirect();
    }

    if (clearCaches) {
        clearAppCaches().catch(() => {});
    }
}

function sanitizeExpiredPublicSession() {
    if (decodeVisiblePathname(window.location.pathname).startsWith('/dashboard/')) {
        return false;
    }

    const accessToken = getRawStorageItem(localStorage, 'accessToken') || getRawStorageItem(sessionStorage, 'accessToken');
    const user = getRawStorageItem(localStorage, 'user') || getRawStorageItem(sessionStorage, 'user');
    const hasMismatchedAuthState = Boolean(accessToken) !== Boolean(user);
    const hasExpiredAuthState = hasStoredAuthState() && hasExpiredSessionByInactivity();

    if (!hasMismatchedAuthState && !hasExpiredAuthState) {
        return false;
    }

    clearClientState({
        preserveTheme: true,
        preserveLogoutReason: true,
        preservePostLogoutRedirect: true
    });
    return true;
}

function consumePostLogoutRedirect(currentPath = decodeVisiblePathname(window.location.pathname)) {
    const target = getRawStorageItem(localStorage, POST_LOGOUT_REDIRECT_KEY);
    const timestamp = parseInt(getRawStorageItem(localStorage, POST_LOGOUT_REDIRECT_AT_KEY) || '0', 10);

    if (!target) return false;

    if (!timestamp || Date.now() - timestamp > SESSION_TIMEOUT_MS) {
        clearPostLogoutRedirect();
        return false;
    }

    if (!PUBLIC_AUTH_PATHS.has(currentPath)) {
        return false;
    }

    clearPostLogoutRedirect();
    window.location.replace(target);
    return true;
}

let renderHeartbeatTimer = null;
let renderHeartbeatInFlight = false;
const renderHeartbeatState = {
    enabled: false,
    endpoint: RENDER_HEARTBEAT_URL,
    intervalMs: RENDER_HEARTBEAT_INTERVAL_MS,
    lastError: null,
    lastPingAt: null,
    lastReason: null,
    lastSuccessAt: null,
    status: 'idle'
};

function updateRenderHeartbeatState(status, extra = {}) {
    Object.assign(renderHeartbeatState, extra, { status });

    if (document?.documentElement) {
        document.documentElement.dataset.renderHeartbeatStatus = status;
    }
}

function isRenderHeartbeatVisible() {
    if (typeof document === 'undefined' || typeof document.visibilityState === 'undefined') {
        return true;
    }

    return document.visibilityState === 'visible';
}

function clearRenderHeartbeatTimer() {
    if (!renderHeartbeatTimer) return;

    window.clearInterval(renderHeartbeatTimer);
    renderHeartbeatTimer = null;
}

async function pingRenderHeartbeat(reason = 'interval') {
    if (renderHeartbeatInFlight || !isRenderHeartbeatVisible()) {
        return false;
    }

    renderHeartbeatInFlight = true;
    updateRenderHeartbeatState('pinging', {
        lastError: null,
        lastPingAt: Date.now(),
        lastReason: reason
    });

    try {
        const response = await fetch(RENDER_HEARTBEAT_URL, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            keepalive: true
        });

        if (!response.ok) {
            throw new Error(`Heartbeat failed with status ${response.status}`);
        }

        updateRenderHeartbeatState(
            !renderHeartbeatState.enabled
                ? 'stopped'
                : (isRenderHeartbeatVisible() ? 'active' : 'paused'),
            {
            lastSuccessAt: Date.now()
            }
        );
        return true;
    } catch (error) {
        updateRenderHeartbeatState(
            !renderHeartbeatState.enabled
                ? 'stopped'
                : (isRenderHeartbeatVisible() ? 'error' : 'paused'),
            {
                lastError: error.message
            }
        );
        return false;
    } finally {
        renderHeartbeatInFlight = false;
    }
}

function pauseRenderHeartbeat() {
    clearRenderHeartbeatTimer();
    updateRenderHeartbeatState('paused');
}

function scheduleRenderHeartbeat() {
    clearRenderHeartbeatTimer();

    if (!renderHeartbeatState.enabled) {
        updateRenderHeartbeatState('stopped');
        return;
    }

    if (!isRenderHeartbeatVisible()) {
        pauseRenderHeartbeat();
        return;
    }

    renderHeartbeatTimer = window.setInterval(() => {
        if (!renderHeartbeatState.enabled) {
            clearRenderHeartbeatTimer();
            return;
        }

        if (!isRenderHeartbeatVisible()) {
            pauseRenderHeartbeat();
            return;
        }

        pingRenderHeartbeat('interval').catch(() => {});
    }, RENDER_HEARTBEAT_INTERVAL_MS);

    updateRenderHeartbeatState('scheduled');
    pingRenderHeartbeat('startup').catch(() => {});
}

function startRenderHeartbeat() {
    renderHeartbeatState.enabled = true;
    scheduleRenderHeartbeat();
}

function stopRenderHeartbeat() {
    renderHeartbeatState.enabled = false;
    clearRenderHeartbeatTimer();
    updateRenderHeartbeatState('stopped');
}

function initRenderHeartbeat() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
        updateRenderHeartbeatState('unsupported');
        return;
    }

    if (window.__renderHeartbeatInitialized) {
        return;
    }

    window.__renderHeartbeatInitialized = true;
    startRenderHeartbeat();

    document.addEventListener('visibilitychange', () => {
        if (!renderHeartbeatState.enabled) {
            return;
        }

        if (isRenderHeartbeatVisible()) {
            scheduleRenderHeartbeat();
            return;
        }

        pauseRenderHeartbeat();
    });

    window.addEventListener('focus', () => {
        if (!renderHeartbeatState.enabled || !isRenderHeartbeatVisible()) {
            return;
        }

        scheduleRenderHeartbeat();
    });

    window.addEventListener('pagehide', () => {
        if (renderHeartbeatState.enabled) {
            pauseRenderHeartbeat();
        }
    });
}

const RenderHeartbeat = {
    getState() {
        return { ...renderHeartbeatState };
    },
    ping() {
        return pingRenderHeartbeat('manual');
    },
    start() {
        startRenderHeartbeat();
    },
    stop() {
        stopRenderHeartbeat();
    }
};

// Local Storage Helper with multiple fallbacks
const Storage = {
    get(key) {
        // Try localStorage first
        if (storageAvailable) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (error) {
                // Fall through to next option
            }
        }

        // Try sessionStorage second
        if (sessionStorageAvailable) {
            try {
                const item = sessionStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (error) {
                // Fall through to next option
            }
        }

        // Use memory storage last
        return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
    },

    set(key, value) {
        // Try to save to all available storage methods
        let saved = false;

        // Try localStorage
        if (storageAvailable) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                saved = true;
            } catch (error) {
                // Continue to try other methods
            }
        }

        // Try sessionStorage
        if (sessionStorageAvailable) {
            try {
                sessionStorage.setItem(key, JSON.stringify(value));
                saved = true;
            } catch (error) {
                // Continue to try other methods
            }
        }

        // Always keep in memory as last resort
        memoryStorage[key] = value;

        if (!saved && !sessionStorageAvailable) {
            console.warn(`Storage unavailable: ${key} will not persist across page reloads`);
        }
    },

    remove(key) {
        delete memoryStorage[key];

        if (storageAvailable) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                // Silent fail
            }
        }

        if (sessionStorageAvailable) {
            try {
                sessionStorage.removeItem(key);
            } catch (error) {
                // Silent fail
            }
        }
    },

    clear() {
        Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);

        if (storageAvailable) {
            try {
                localStorage.clear();
            } catch (error) {
                // Silent fail
            }
        }

        if (sessionStorageAvailable) {
            try {
                sessionStorage.clear();
            } catch (error) {
                // Silent fail
            }
        }
    }
};

// API Helper
const API = {
    async request(endpoint, options = {}) {
        const token = Storage.get('accessToken');

        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            }
        };

        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                const error = new Error(data.message || 'Request failed');
                error.status = response.status;
                error.data = data;

                if (response.status === 401 && !authExpiryHandled) {
                    authExpiryHandled = true;

                    if (window.SessionTimeout && typeof window.SessionTimeout.logout === 'function') {
                        window.SessionTimeout.logout(SESSION_INVALID_LOGOUT_REASON);
                    } else {
                        setPostLogoutRedirect('/index.html', SESSION_INVALID_LOGOUT_REASON);
                        clearClientState({
                            preserveTheme: true,
                            preserveLogoutReason: true,
                            preservePostLogoutRedirect: true
                        });
                        window.location.replace('/index.html');
                    }
                }

                throw error;
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint);
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
};

// Socket.IO Helper
let socket = null;

const Socket = {
    connect() {
        const token = Storage.get('accessToken');
        if (!token) return;

        const socketUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:5000'
            : window.location.origin;

        socket = io(socketUrl, {
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('Socket connected');
            const user = Storage.get('user');
            if (user) {
                socket.emit('join:department', {
                    department: user.department,
                    year: user.year,
                    section: user.section
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        return socket;
    },

    disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    },

    on(event, callback) {
        if (socket) {
            socket.on(event, callback);
        }
    },

    emit(event, data) {
        if (socket) {
            socket.emit(event, data);
        }
    }
};

// Theme Toggle
function ensureThemeToggle() {
    if (!document.body || document.getElementById('themeToggle')) return;

    const themeToggle = document.createElement('button');
    themeToggle.type = 'button';
    themeToggle.id = 'themeToggle';
    themeToggle.className = 'theme-toggle';
    themeToggle.title = 'Toggle theme';
    themeToggle.setAttribute('aria-label', 'Toggle dark and light theme');
    themeToggle.innerHTML = '<span class="theme-icon">🌙</span>';

    document.body.appendChild(themeToggle);
}

function applyThemeToggleFallback(themeToggle) {
    if (!themeToggle) return;

    const computed = window.getComputedStyle(themeToggle);
    if (computed.position !== 'static') {
        themeToggle.dataset.fallbackStyled = 'false';
        return;
    }

    themeToggle.style.position = 'fixed';
    themeToggle.style.right = '20px';
    themeToggle.style.bottom = '20px';
    themeToggle.style.width = '54px';
    themeToggle.style.height = '54px';
    themeToggle.style.display = 'inline-flex';
    themeToggle.style.alignItems = 'center';
    themeToggle.style.justifyContent = 'center';
    themeToggle.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    themeToggle.style.borderRadius = '999px';
    themeToggle.style.background = 'rgba(15, 15, 18, 0.92)';
    themeToggle.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.28)';
    themeToggle.style.color = '#f6f3ee';
    themeToggle.style.backdropFilter = 'blur(18px)';
    themeToggle.style.webkitBackdropFilter = 'blur(18px)';
    themeToggle.style.cursor = 'pointer';
    themeToggle.style.zIndex = '1000';
    themeToggle.style.fontSize = '1.15rem';
    themeToggle.dataset.fallbackStyled = 'true';
}

function initThemeToggle() {
    ensureThemeToggle();

    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    applyThemeToggleFallback(themeToggle);

    if (themeToggle.dataset.bound === 'true') {
        const currentTheme = Storage.get('theme') || 'dark';
        document.body.classList.toggle('light-theme', currentTheme === 'light');
        updateThemeIcon(currentTheme);
        return;
    }

    const currentTheme = Storage.get('theme') || 'dark';
    document.body.classList.toggle('light-theme', currentTheme === 'light');
    updateThemeIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('light-theme');
        const newTheme = isDark ? 'light' : 'dark';

        document.body.classList.toggle('light-theme');
        Storage.set('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    themeToggle.dataset.bound = 'true';
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    if (themeToggle?.dataset.fallbackStyled === 'true') {
        const isLight = theme === 'light';
        themeToggle.style.background = isLight ? 'rgba(248, 242, 236, 0.96)' : 'rgba(15, 15, 18, 0.92)';
        themeToggle.style.borderColor = isLight ? 'rgba(29, 29, 32, 0.12)' : 'rgba(255, 255, 255, 0.2)';
        themeToggle.style.color = isLight ? '#19191b' : '#f6f3ee';
        themeToggle.style.boxShadow = isLight
            ? '0 16px 40px rgba(116, 86, 74, 0.18)'
            : '0 16px 40px rgba(0, 0, 0, 0.28)';
    }
}

// Copy to Clipboard
window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy', 'error');
    });
};

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-enter`;
    toast.textContent = message;

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--glass-bg);
        backdrop-filter: blur(10px);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        color: var(--text-primary);
        z-index: 10000;
        box-shadow: 0 8px 32px var(--glass-shadow);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Form Validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });

    return isValid;
}

// Loading Spinner
function showLoading(element) {
    element.innerHTML = '<div class="spinner"></div>';
    element.disabled = true;
}

function hideLoading(element, originalContent) {
    element.innerHTML = originalContent;
    element.disabled = false;
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format Time
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Intersection Observer for Animations
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-aos]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const animation = element.dataset.aos;
                const delay = element.dataset.aosDelay || 0;

                setTimeout(() => {
                    element.classList.add(animation);
                }, delay);

                observer.unobserve(element);
            }
        });
    }, { threshold: 0.1 });

    animatedElements.forEach(el => observer.observe(el));
}

// Mobile Menu Toggle
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        if (document.body.dataset.mobileMenuEnhanced === 'true' || mobileMenuBtn.dataset.menuEnhanced === 'true') {
            return;
        }

        mobileMenuBtn.addEventListener('click', () => {
            const isActive = mobileMenuBtn.classList.toggle('active');
            navLinks.classList.toggle('active', isActive);
            mobileMenuBtn.setAttribute('aria-expanded', String(isActive));
        });
    }
}

// Auth Check
function checkAuth() {
    const token = Storage.get('accessToken');
    const user = Storage.get('user');

    if (!token || !user) {
        return null;
    }

    return user;
}

// Logout
function logout() {
    const refreshToken = Storage.get('refreshToken');

    if (refreshToken) {
        API.post('/auth/logout', { refreshToken }).catch(() => { });
    }

    // Use SessionTimeout.logout if available (ensures proper cleanup)
    if (window.SessionTimeout && typeof window.SessionTimeout.logout === 'function') {
        window.SessionTimeout.logout('user_initiated');
    } else {
        // Fallback: manual cleanup and redirect
        try {
            sessionStorage.setItem('logoutReason', 'user_initiated');
        } catch (e) {
            // Ignore
        }

        setPostLogoutRedirect('/index.html', 'user_initiated');
        clearClientState({
            preserveTheme: true,
            preserveLogoutReason: true,
            preservePostLogoutRedirect: true
        });
        
        window.location.replace('/index.html');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = decodeVisiblePathname(window.location.pathname);

    initPublicAuthLinkGuard();

    const clearedExpiredPublicSession = sanitizeExpiredPublicSession();
    if (clearedExpiredPublicSession && PUBLIC_AUTH_PATHS.has(currentPage)) {
        window.location.replace('/index.html');
        return;
    }

    if (consumePostLogoutRedirect(currentPage)) {
        return;
    }

    ensureThemeToggle();
    initThemeToggle();
    initScrollAnimations();
    initMobileMenu();

    // Check if user is logged in and redirect if needed
    const user = checkAuth();

    // Only redirect from landing page, allow access to login page
    if (user && PUBLIC_HOME_PATHS.has(currentPage) && !hasExpiredSessionByInactivity()) {
        // Redirect to dashboard based on role
        const dashboardUrls = {
            student: '/dashboard/student.html',
            teacher: '/dashboard/teacher.html',
            admin: '/dashboard/admin.html'
        };
        const redirectUrl = dashboardUrls[user.role] || '/dashboard/student.html';
        
        // Create page access token before redirecting
        if (window.PageAccessToken && typeof window.PageAccessToken.createPageAccessToken === 'function') {
            window.PageAccessToken.createPageAccessToken(redirectUrl);
        }
        
        // Use encoded URL for navigation
        if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
            window.LinkEncoding.navigateTo(redirectUrl);
        } else {
            window.location.href = redirectUrl;
        }

        return;
    }

    initRenderHeartbeat();
});

window.ensureThemeToggle = ensureThemeToggle;

// Helper functions
function isAuthenticated() {
    return !!Storage.get('accessToken');
}

function getUserRole() {
    const user = Storage.get('user');
    return user ? user.role : null;
}

// Export for use in other scripts
window.APP = {
    API,
    Storage,
    Socket,
    showToast,
    validateForm,
    formatDate,
    formatTime,
    clearClientState,
    clearAppCaches,
    setPostLogoutRedirect,
    clearPostLogoutRedirect,
    hasExpiredSessionByInactivity,
    RenderHeartbeat,
    sanitizeExpiredPublicSession,
    consumePostLogoutRedirect,
    checkAuth,
    logout,
    isAuthenticated,
    getUserRole,
    sanitize: function (str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    openProfile: function () {
        // Try to open edit panel if profile control exists
        if (window.profileControl && typeof window.profileControl.openEditPanel === 'function') {
            window.profileControl.openEditPanel();
        } else {
            // Navigate to settings as fallback with encoded URL
            if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
                window.LinkEncoding.navigateTo('/settings.html');
            } else {
                window.location.href = '/settings.html';
            }
        }
    },
    // Secure navigation to dashboard pages
    navigateToDashboard: function (path) {
        // Create page access token before navigating
        if (window.PageAccessToken && typeof window.PageAccessToken.createPageAccessToken === 'function') {
            window.PageAccessToken.createPageAccessToken(path);
        }
        // Use encoded URL for navigation
        if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
            window.LinkEncoding.navigateTo(path);
        } else {
            window.location.href = path;
        }
    }
};
