/**
 * Connect Portal JavaScript
 * Handles portal sync with retry logic and fallback to demo data
 */

(function() {
    'use strict';

    // Constants
    const MAX_RETRY_ATTEMPTS = 3;
    const RETRY_KEY_PREFIX = 'portalRetryAttempts:';

    // DOM Elements
    let portalForm;
    let syncBtn;
    let demoBtn;
    let statusMessage;
    let retryInfo;
    let attemptCounter;
    let regNumberInput;
    let portalPasswordInput;

    /**
     * Initialize the connect portal page
     */
    function init() {
        // Get DOM elements
        portalForm = document.getElementById('portalForm');
        syncBtn = document.getElementById('syncBtn');
        demoBtn = document.getElementById('demoBtn');
        statusMessage = document.getElementById('statusMessage');
        retryInfo = document.getElementById('retryInfo');
        attemptCounter = document.getElementById('attemptCounter');
        regNumberInput = document.getElementById('regNumber');
        portalPasswordInput = document.getElementById('portalPassword');

        // Check if user is logged in
        const user = APP.Storage.get('user');
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Pre-fill registration number if available
        if (user.registration_number && !user.registration_number.startsWith('GOOGLE_')) {
            regNumberInput.value = user.registration_number;
        }

        // Update attempt counter display
        updateAttemptDisplay();

        // Bind events
        portalForm.addEventListener('submit', handleSyncSubmit);
        demoBtn.addEventListener('click', handleUseDemoData);
    }

    /**
     * Get the user ID for storage key
     */
    function getUserId() {
        const user = APP.Storage.get('user');
        return user ? (user.id || user.registration_number) : 'unknown';
    }

    /**
     * Get current retry attempts from localStorage
     */
    function getRetryAttempts() {
        const key = RETRY_KEY_PREFIX + getUserId();
        const attempts = parseInt(localStorage.getItem(key) || '0', 10);
        return attempts;
    }

    /**
     * Set retry attempts in localStorage
     */
    function setRetryAttempts(count) {
        const key = RETRY_KEY_PREFIX + getUserId();
        localStorage.setItem(key, count.toString());
    }

    /**
     * Clear retry attempts (on success)
     */
    function clearRetryAttempts() {
        const key = RETRY_KEY_PREFIX + getUserId();
        localStorage.removeItem(key);
    }

    /**
     * Update the attempt counter display
     */
    function updateAttemptDisplay() {
        const attempts = getRetryAttempts();
        const remaining = MAX_RETRY_ATTEMPTS - attempts;

        if (attempts > 0 && remaining > 0) {
            attemptCounter.textContent = `Attempts remaining: ${remaining}`;
            attemptCounter.style.display = 'block';
        } else {
            attemptCounter.style.display = 'none';
        }

        // If max attempts reached, auto-fallback
        if (attempts >= MAX_RETRY_ATTEMPTS) {
            handleAutoFallback();
        }
    }

    /**
     * Show status message
     */
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        statusMessage.style.display = 'block';
    }

    /**
     * Hide status message
     */
    function hideStatus() {
        statusMessage.className = 'status-message';
        statusMessage.style.display = 'none';
    }

    /**
     * Show retry info
     */
    function showRetryInfo(message, type) {
        retryInfo.textContent = message;
        retryInfo.className = 'retry-info ' + type;
        retryInfo.style.display = 'block';
    }

    /**
     * Show toast notification
     */
    function showToast(message, type) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-notification ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Set loading state
     */
    function setLoading(isLoading) {
        if (isLoading) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span class="spinner"></span> Syncing...';
            demoBtn.disabled = true;
        } else {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Sync Portal Data';
            demoBtn.disabled = false;
        }
    }

    /**
     * Handle sync form submission
     */
    async function handleSyncSubmit(e) {
        e.preventDefault();

        const regNumber = regNumberInput.value.trim();
        const password = portalPasswordInput.value;

        if (!regNumber || !password) {
            showStatus('Please fill in all fields', 'error');
            return;
        }

        // Check if max attempts already reached
        const currentAttempts = getRetryAttempts();
        if (currentAttempts >= MAX_RETRY_ATTEMPTS) {
            handleAutoFallback();
            return;
        }

        setLoading(true);
        showStatus('🔄 Connecting to portal... This may take up to 30 seconds while we solve the CAPTCHA.', 'loading');
        hideRetryInfo();

        try {
            const response = await APP.API.post('/portal/sync', {
                reg_number: regNumber,
                password: password
            });

            if (response.success && response.status === 'SUCCESS') {
                // Success - clear retry attempts and redirect
                clearRetryAttempts();
                showStatus('✅ Portal connected successfully!', 'success');
                showToast('Portal data synced successfully!', 'success');

                // Update user data in storage
                const user = APP.Storage.get('user');
                if (user) {
                    user.portalConnected = true;
                    user.isVerified = true;
                    APP.Storage.set('user', user);
                }

                // Redirect to dashboard after brief delay
                setTimeout(() => {
                    window.location.href = '/dashboard/student.html';
                }, 1500);
            } else {
                handleSyncFailure(response);
            }
        } catch (error) {
            console.error('Sync error:', error);
            // Determine error status from error object
            let errorStatus = 'SCRAPE_ERROR';
            let errorMessage = error.message || 'Unknown error';
            
            if (error.status === 401 || (error.data && error.data.status === 'AUTH_FAILED')) {
                errorStatus = 'AUTH_FAILED';
                errorMessage = error.data?.message || 'Invalid credentials';
            } else if (error.status === 503 || (error.data && error.data.status === 'PORTAL_UNREACHABLE')) {
                errorStatus = 'PORTAL_UNREACHABLE';
                errorMessage = error.data?.message || 'Student portal is currently unreachable';
            } else if (error.data && error.data.status) {
                errorStatus = error.data.status;
                errorMessage = error.data.message || 'Failed to fetch portal data';
            }
            
            handleSyncFailure({
                status: errorStatus,
                message: errorMessage
            });
        } finally {
            setLoading(false);
        }
    }

    /**
     * Handle sync failure with retry logic
     */
    function handleSyncFailure(response) {
        const currentAttempts = getRetryAttempts() + 1;
        setRetryAttempts(currentAttempts);

        const remaining = MAX_RETRY_ATTEMPTS - currentAttempts;

        // Show specific error message based on status
        if (response.status === 'AUTH_FAILED') {
            showStatus('❌ Invalid portal credentials. Please check your Registration Number and Password.', 'error');
        } else if (response.status === 'PORTAL_UNREACHABLE') {
            showStatus('⚠️ Student portal is currently unreachable. The university portal may be down for maintenance. Please try again later or use demo data.', 'error');
            // For portal unreachable, offer demo data immediately
            showRetryInfo(
                'The student portal appears to be offline. You can use demo data to explore the system, or try again later.',
                'warning'
            );
            return; // Don't count against retry attempts for portal outages
        } else if (response.message && response.message.toLowerCase().includes('captcha')) {
            showStatus('❌ Failed to solve CAPTCHA. Please try again.', 'error');
        } else {
            const msg = response.message || 'Failed to fetch portal data';
            showStatus(`❌ ${msg}`, 'error');
        }

        if (remaining > 0) {
            // Attempts 1 or 2 - show retry option
            showRetryInfo(
                `Attempt ${currentAttempts} of ${MAX_RETRY_ATTEMPTS} failed. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining. Click "Sync Portal Data" to retry.`,
                'warning'
            );
            updateAttemptDisplay();
        } else {
            // Attempt 3 - auto-fallback
            handleAutoFallback();
        }
    }

    /**
     * Hide retry info
     */
    function hideRetryInfo() {
        retryInfo.style.display = 'none';
    }

    /**
     * Handle auto-fallback after 3 failed attempts
     */
    async function handleAutoFallback() {
        showStatus('⚠️ Verification failed after 3 attempts. Loading demo data...', 'loading');
        setLoading(true);

        try {
            await loadDemoData();
            showToast('Verification failed. Demo data loaded.', 'warning');
        } catch (error) {
            console.error('Fallback error:', error);
            showToast('Error loading demo data', 'error');
        }

        // Clear retry attempts for future attempts
        clearRetryAttempts();

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard/student.html';
        }, 2000);
    }

    /**
     * Handle use demo data button click
     */
    async function handleUseDemoData() {
        setLoading(true);
        showStatus('Loading demo data...', 'loading');

        try {
            await loadDemoData();
            showToast('Demo data loaded successfully', 'success');
            
            setTimeout(() => {
                window.location.href = '/dashboard/student.html';
            }, 1000);
        } catch (error) {
            console.error('Demo data error:', error);
            showStatus('Failed to load demo data', 'error');
            showToast('Error loading demo data', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Load demo data via API
     */
    async function loadDemoData() {
        const user = APP.Storage.get('user');
        const regNumber = regNumberInput.value.trim() || (user ? user.registration_number : '');

        const response = await APP.API.post('/portal/sync', {
            reg_number: regNumber,
            useDemoData: true
        });

        if (response.success) {
            // Update user data in storage
            if (user) {
                user.portalConnected = false;
                user.isVerified = false;
                APP.Storage.set('user', user);
            }
            return response;
        } else {
            throw new Error(response.message || 'Failed to load demo data');
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
