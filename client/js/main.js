// Main JavaScript File
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : '/api';

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
                throw new Error(data.message || 'Request failed');
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
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

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
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Copy to Clipboard
window.copyToClipboard = function(text) {
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
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
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
        API.post('/auth/logout', { refreshToken }).catch(() => {});
    }

    Storage.clear();
    Socket.disconnect();
    window.location.href = '/';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initScrollAnimations();
    initMobileMenu();

    // Check if user is logged in and redirect if needed
    const currentPage = window.location.pathname;
    const user = checkAuth();

    // Only redirect from landing page, allow access to login page
    if (user && (currentPage === '/' || currentPage === '/index.html')) {
        // Redirect to dashboard based on role
        const dashboardUrls = {
            student: '/dashboard/student.html',
            teacher: '/dashboard/teacher.html',
            admin: '/dashboard/admin.html'
        };
        window.location.href = dashboardUrls[user.role] || '/dashboard/student.html';
    }
});

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
    checkAuth,
    logout,
    isAuthenticated,
    getUserRole,
    openProfile: function() {
        // Try to open edit panel if profile control exists
        if (window.profileControl && typeof window.profileControl.openEditPanel === 'function') {
            window.profileControl.openEditPanel();
        } else {
            // Navigate to settings as fallback
            window.location.href = '/settings.html';
        }
    }
};
