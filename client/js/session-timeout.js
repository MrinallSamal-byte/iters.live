/**
 * Session Timeout System
 * Manages user session with automatic logout after inactivity.
 * Enforces 20-minute inactivity timeout across all dashboard pages.
 */

(function() {
    'use strict';

    // Configuration
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds
    const SESSION_WARNING_MS = 2 * 60 * 1000; // Show warning 2 minutes before timeout
    const SESSION_CHECK_INTERVAL_MS = 30 * 1000; // Check session every 30 seconds
    const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
    const SESSION_ID_KEY = 'sessionId';
    const SESSION_START_KEY = 'sessionStartTimestamp';

    // Activity events to track
    const ACTIVITY_EVENTS = [
        'mousedown',
        'mousemove',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'focus'
    ];

    // State
    let sessionCheckInterval = null;
    let warningShown = false;
    let warningModal = null;

    /**
     * Generate a unique session ID
     * @returns {string} A random session ID
     */
    function generateSessionId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get or create session ID
     * @returns {string} The session ID
     */
    function getSessionId() {
        let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (!sessionId) {
            sessionId = generateSessionId();
            sessionStorage.setItem(SESSION_ID_KEY, sessionId);
            sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
        }
        return sessionId;
    }

    /**
     * Update last activity timestamp
     */
    function updateLastActivity() {
        const now = Date.now();
        try {
            sessionStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
            // Also update in localStorage for cross-tab synchronization
            localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        } catch (e) {
            // Ignore storage errors
        }
        
        // Hide warning if shown
        if (warningShown) {
            hideTimeoutWarning();
        }
    }

    /**
     * Get last activity timestamp
     * @returns {number} Last activity timestamp in milliseconds
     */
    function getLastActivity() {
        // Check both storages, use the most recent
        const sessionActivity = parseInt(sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
        const localActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
        return Math.max(sessionActivity, localActivity);
    }

    /**
     * Check if session has timed out
     * @returns {boolean} True if session has timed out
     */
    function isSessionTimedOut() {
        const lastActivity = getLastActivity();
        if (!lastActivity) return true;
        
        const elapsed = Date.now() - lastActivity;
        return elapsed >= SESSION_TIMEOUT_MS;
    }

    /**
     * Check if session is close to timing out
     * @returns {boolean} True if within warning period
     */
    function isSessionNearTimeout() {
        const lastActivity = getLastActivity();
        if (!lastActivity) return true;
        
        const elapsed = Date.now() - lastActivity;
        const remaining = SESSION_TIMEOUT_MS - elapsed;
        return remaining <= SESSION_WARNING_MS && remaining > 0;
    }

    /**
     * Get remaining session time in milliseconds
     * @returns {number} Remaining time in milliseconds
     */
    function getRemainingTime() {
        const lastActivity = getLastActivity();
        if (!lastActivity) return 0;
        
        const elapsed = Date.now() - lastActivity;
        const remaining = SESSION_TIMEOUT_MS - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Format time for display
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
     */
    function formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Clear session data and redirect to login
     * @param {string} reason - Reason for logout
     */
    function logout(reason) {
        // Clear session storage
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionStorage.removeItem(SESSION_START_KEY);
        sessionStorage.removeItem('pageAccessToken');
        sessionStorage.removeItem('pageAccessTokenTimestamp');
        sessionStorage.removeItem('pageAccessTokenPath');
        
        // Clear local storage auth data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        
        // Stop the session check interval
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
        
        // Store logout reason for login page to display
        try {
            sessionStorage.setItem('logoutReason', reason || 'session_timeout');
        } catch (e) {
            // Ignore
        }
        
        // Redirect to login using encoded URL
        if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
            window.LinkEncoding.navigateTo('/login.html');
        } else {
            window.location.href = '/login.html';
        }
    }

    /**
     * Create and show timeout warning modal
     */
    function showTimeoutWarning() {
        if (warningShown) return;
        warningShown = true;
        
        // Create modal if it doesn't exist
        if (!warningModal) {
            warningModal = document.createElement('div');
            warningModal.id = 'sessionTimeoutWarning';
            warningModal.innerHTML = `
                <div class="session-warning-overlay">
                    <div class="session-warning-modal">
                        <div class="session-warning-icon">⏰</div>
                        <h3>Session Expiring Soon</h3>
                        <p>Your session will expire in <span id="sessionCountdown">2:00</span></p>
                        <p class="session-warning-subtext">Click anywhere or press any key to stay logged in</p>
                        <div class="session-warning-buttons">
                            <button id="sessionStayBtn" class="btn btn-primary">Stay Logged In</button>
                            <button id="sessionLogoutBtn" class="btn btn-secondary">Logout Now</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .session-warning-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    animation: fadeIn 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .session-warning-modal {
                    background: var(--glass-bg, rgba(30, 30, 46, 0.95));
                    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                    border-radius: 16px;
                    padding: 2rem;
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                    animation: slideUp 0.3s ease;
                }
                
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .session-warning-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }
                
                .session-warning-modal h3 {
                    color: var(--text-primary, #fff);
                    margin-bottom: 1rem;
                    font-size: 1.5rem;
                }
                
                .session-warning-modal p {
                    color: var(--text-secondary, rgba(255, 255, 255, 0.8));
                    margin-bottom: 0.5rem;
                }
                
                .session-warning-subtext {
                    font-size: 0.875rem;
                    opacity: 0.7;
                }
                
                #sessionCountdown {
                    font-weight: bold;
                    color: var(--danger, #ef4444);
                    font-size: 1.25rem;
                }
                
                .session-warning-buttons {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    margin-top: 1.5rem;
                }
                
                .session-warning-buttons .btn {
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s ease;
                }
                
                .session-warning-buttons .btn-primary {
                    background: linear-gradient(135deg, var(--primary, #6366f1), var(--accent, #8b5cf6));
                    color: white;
                }
                
                .session-warning-buttons .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                }
                
                .session-warning-buttons .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary, #fff);
                    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.2));
                }
                
                .session-warning-buttons .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(warningModal);
            
            // Add event listeners
            document.getElementById('sessionStayBtn').addEventListener('click', () => {
                updateLastActivity();
                hideTimeoutWarning();
            });
            
            document.getElementById('sessionLogoutBtn').addEventListener('click', () => {
                logout('user_initiated');
            });
        } else {
            warningModal.style.display = 'block';
        }
        
        // Start countdown
        updateWarningCountdown();
    }

    /**
     * Update the countdown in the warning modal
     */
    function updateWarningCountdown() {
        if (!warningShown) return;
        
        const countdown = document.getElementById('sessionCountdown');
        if (countdown) {
            const remaining = getRemainingTime();
            countdown.textContent = formatTime(remaining);
            
            if (remaining <= 0) {
                logout('session_timeout');
            }
        }
    }

    /**
     * Hide the timeout warning modal
     */
    function hideTimeoutWarning() {
        warningShown = false;
        if (warningModal) {
            warningModal.style.display = 'none';
        }
    }

    /**
     * Check session status
     */
    function checkSession() {
        // Only check on dashboard pages
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/dashboard/')) {
            return;
        }
        
        // Check if user is authenticated
        const accessToken = localStorage.getItem('accessToken');
        const user = localStorage.getItem('user');
        
        if (!accessToken || !user) {
            logout('not_authenticated');
            return;
        }
        
        // Check if session has timed out
        if (isSessionTimedOut()) {
            logout('session_timeout');
            return;
        }
        
        // Check if session is near timeout
        if (isSessionNearTimeout()) {
            showTimeoutWarning();
            updateWarningCountdown();
        }
    }

    /**
     * Setup activity listeners
     */
    function setupActivityListeners() {
        // Debounce activity updates to prevent excessive calls
        let activityTimeout = null;
        
        function handleActivity() {
            if (activityTimeout) return;
            
            activityTimeout = setTimeout(() => {
                updateLastActivity();
                activityTimeout = null;
            }, 1000); // Update at most once per second
        }
        
        ACTIVITY_EVENTS.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });
        
        // Listen for visibility changes (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkSession();
            }
        });
        
        // Listen for storage events (cross-tab synchronization)
        window.addEventListener('storage', (e) => {
            if (e.key === LAST_ACTIVITY_KEY) {
                // Another tab updated activity, sync the session
                if (warningShown && e.newValue) {
                    const otherTabActivity = parseInt(e.newValue, 10);
                    const ourLastActivity = getLastActivity();
                    
                    if (otherTabActivity > ourLastActivity) {
                        hideTimeoutWarning();
                    }
                }
            }
            
            // Check if user logged out in another tab
            if (e.key === 'accessToken' && !e.newValue) {
                logout('logged_out_other_tab');
            }
        });
    }

    /**
     * Validate session with backend
     * @returns {Promise<boolean>} True if session is valid
     */
    async function validateSessionWithBackend() {
        try {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) return false;
            
            const response = await fetch('/api/auth/validate-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    sessionId: getSessionId(),
                    lastActivity: getLastActivity()
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                return false;
            }
            
            // Update activity from server response if provided
            if (data.data && data.data.serverLastActivity) {
                const serverActivity = data.data.serverLastActivity;
                const clientActivity = getLastActivity();
                
                // Use the more recent activity
                if (serverActivity > clientActivity) {
                    sessionStorage.setItem(LAST_ACTIVITY_KEY, serverActivity.toString());
                    localStorage.setItem(LAST_ACTIVITY_KEY, serverActivity.toString());
                }
            }
            
            return true;
        } catch (error) {
            // Network error - still enforce client-side timeout
            // Check if session would be timed out based on local data
            if (isSessionTimedOut()) {
                return false;
            }
            // Allow offline usage with grace period, but log for monitoring
            return true;
        }
    }

    /**
     * Initialize the session timeout system
     */
    function init() {
        const currentPath = window.location.pathname;
        
        // Only initialize on dashboard pages
        if (!currentPath.startsWith('/dashboard/')) {
            return;
        }
        
        // Initialize session
        getSessionId();
        
        // Set initial activity if not set
        if (!getLastActivity()) {
            updateLastActivity();
        }
        
        // Check session immediately
        checkSession();
        
        // Setup activity listeners
        setupActivityListeners();
        
        // Start periodic session checks
        sessionCheckInterval = setInterval(() => {
            checkSession();
        }, SESSION_CHECK_INTERVAL_MS);
        
        // Validate with backend periodically (every 5 minutes)
        setInterval(async () => {
            if (currentPath.startsWith('/dashboard/')) {
                const isValid = await validateSessionWithBackend();
                if (!isValid) {
                    logout('session_invalid');
                }
            }
        }, 5 * 60 * 1000);
    }

    // Export to global scope
    window.SessionTimeout = {
        SESSION_TIMEOUT_MS,
        getSessionId,
        updateLastActivity,
        getLastActivity,
        isSessionTimedOut,
        getRemainingTime,
        logout,
        checkSession,
        validateSessionWithBackend,
        init
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
