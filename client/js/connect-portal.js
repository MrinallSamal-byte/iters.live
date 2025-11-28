/**
 * Connect Portal JavaScript
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * Portal data fetching from the SOA website is currently SUSPENDED.
 * This page will show a suspended message and redirect users to the dashboard.
 * 
 * The portal fetching functionality has been temporarily disabled as per requirement.
 * Users will be shown a message and can continue with demo data.
 */

(function() {
    'use strict';

    /**
     * Initialize the connect portal page
     * TEMPORARILY DISABLED — DO NOT REMOVE
     * Portal fetching is suspended - show message and provide demo data option
     */
    function init() {
        // Check if user is logged in
        const user = APP.Storage.get('user');
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // TEMPORARILY DISABLED — DO NOT REMOVE
        // Portal fetching is suspended - log this and set up demo data button
        console.log('Portal fetching is suspended. Showing suspended message...');
        
        // Set up the demo data button
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', async function() {
                console.log('Loading demo data...');
                
                // Update button state
                demoBtn.disabled = true;
                demoBtn.textContent = 'Loading...';
                
                // Update user storage with demo data flag
                if (user) {
                    user.portalConnected = false;
                    user.isVerified = false;
                    user.dataSource = 'demo';
                    APP.Storage.set('user', user);
                }
                
                // Show toast if available
                if (typeof APP.showToast === 'function') {
                    APP.showToast('Demo data loaded successfully!', 'success');
                }
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard/student.html';
                }, 500);
            });
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();

/* COMMENTED OUT — TEMPORARILY DISABLED — DO NOT REMOVE
 * The following code contains the original portal fetching functionality.
 * It has been disabled but preserved for future re-enablement.
 * To re-enable: Set PORTAL_FEATURES_ENABLED=true in environment and uncomment this code.
 */

/* ORIGINAL PORTAL FETCHING CODE - TEMPORARILY DISABLED — DO NOT REMOVE

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

        // Check for pending portal sync from login page
        const pendingSync = sessionStorage.getItem('pendingPortalSync');
        const savedPassword = sessionStorage.getItem('portalPassword');
        
        if (pendingSync) {
            try {
                const syncData = JSON.parse(pendingSync);
                // Only use if less than 5 minutes old
                if (Date.now() - syncData.timestamp < 5 * 60 * 1000) {
                    regNumberInput.value = syncData.reg_number || regNumberInput.value;
                    
                    // Auto-fill password if available from login
                    if (savedPassword) {
                        portalPasswordInput.value = savedPassword;
                        // Auto-trigger sync
                        showStatus('🔄 Auto-syncing with your login credentials...', 'loading');
                        setTimeout(() => {
                            handleSyncSubmit({ preventDefault: () => {} });
                        }, 500);
                    }
                }
            } catch (e) {
                console.warn('Could not parse pending sync data');
            }
            // Clear after use
            sessionStorage.removeItem('pendingPortalSync');
            sessionStorage.removeItem('portalPassword');
        }

        // Update attempt counter display
        updateAttemptDisplay();

        // Bind events
        portalForm.addEventListener('submit', handleSyncSubmit);
        demoBtn.addEventListener('click', handleUseDemoData);
        
        // Add backup load button handler if it exists
        const backupBtn = document.getElementById('loadBackupBtn');
        if (backupBtn) {
            backupBtn.addEventListener('click', handleLoadBackup);
        }
    }

    function getUserId() {
        const user = APP.Storage.get('user');
        return user ? (user.id || user.registration_number) : 'unknown';
    }

    function getRetryAttempts() {
        const key = RETRY_KEY_PREFIX + getUserId();
        const attempts = parseInt(localStorage.getItem(key) || '0', 10);
        return attempts;
    }

    function setRetryAttempts(count) {
        const key = RETRY_KEY_PREFIX + getUserId();
        localStorage.setItem(key, count.toString());
    }

    function clearRetryAttempts() {
        const key = RETRY_KEY_PREFIX + getUserId();
        localStorage.removeItem(key);
    }

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

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        statusMessage.style.display = 'block';
    }

    function hideStatus() {
        statusMessage.className = 'status-message';
        statusMessage.style.display = 'none';
    }

    function showRetryInfo(message, type) {
        retryInfo.textContent = message;
        retryInfo.className = 'retry-info ' + type;
        retryInfo.style.display = 'block';
    }

    function showToast(message, type) {
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-notification ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function setLoading(isLoading) {
        if (isLoading) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span class="spinner"></span> Syncing...';
            demoBtn.disabled = true;
            const backupBtn = document.getElementById('loadBackupBtn');
            if (backupBtn) backupBtn.disabled = true;
        } else {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '🔄 Fetch Fresh Data from SOA Portal';
            demoBtn.disabled = false;
            const backupBtn = document.getElementById('loadBackupBtn');
            if (backupBtn) backupBtn.disabled = false;
        }
    }

    async function handleSyncSubmit(e) {
        e.preventDefault();

        const regNumber = regNumberInput.value.trim();
        const password = portalPasswordInput.value;

        if (!regNumber || !password) {
            showStatus('Please fill in all fields', 'error');
            return;
        }

        setLoading(true);
        showStatus('🔄 Connecting to SOA Portal... This may take up to 90 seconds while we solve the CAPTCHA.', 'loading');
        hideRetryInfo();

        try {
            const response = await APP.API.post('/portal/login', {
                reg_number: regNumber,
                password: password
            });

            if (response.success) {
                if (response.status === 'SUCCESS') {
                    clearRetryAttempts();
                    showStatus('✅ Portal data synced successfully!', 'success');
                    showToast('Live data synced successfully!', 'success');
                    updateUserStorage(true, true, response.data);
                    setTimeout(() => {
                        window.location.href = '/dashboard/student.html';
                    }, 1500);
                } else if (response.status === 'BACKUP_LOADED') {
                    clearRetryAttempts();
                    const msg = response.data.warning || response.message || 'Showing previously saved data.';
                    showStatus(`📂 ${msg}`, 'success');
                    showToast('Loaded backup data', 'warning');
                    updateUserStorage(false, false, response.data);
                    setTimeout(() => {
                        window.location.href = '/dashboard/student.html';
                    }, 2000);
                } else if (response.status === 'DEMO_LOADED') {
                    clearRetryAttempts();
                    showStatus('🎭 No backup found. Loading demo data to explore the system.', 'success');
                    showToast('Demo data loaded', 'warning');
                    updateUserStorage(false, false, response.data);
                    setTimeout(() => {
                        window.location.href = '/dashboard/student.html';
                    }, 2000);
                }
            } else {
                handleSyncFailure(response);
            }
        } catch (error) {
            console.error('Sync error:', error);
            const errorData = error.data || error;
            const errorStatus = errorData.status || 'SCRAPE_ERROR';
            const errorMessage = errorData.message || error.message || 'Unknown error';
            const attempt = errorData.attempt;
            const attemptsRemaining = errorData.attemptsRemaining;
            
            handleSyncFailure({
                status: errorStatus,
                message: errorMessage,
                attempt: attempt,
                attemptsRemaining: attemptsRemaining
            });
        } finally {
            setLoading(false);
        }
    }

    function handleSyncFailure(response) {
        const attempt = response.attempt || (getRetryAttempts() + 1);
        const remaining = response.attemptsRemaining !== undefined 
            ? response.attemptsRemaining 
            : (MAX_RETRY_ATTEMPTS - attempt);

        if (response.attempt) {
            setRetryAttempts(response.attempt);
        } else {
            setRetryAttempts(attempt);
        }

        if (response.status === 'AUTH_FAILED') {
            showStatus('❌ Invalid portal credentials. Please check your Registration Number and Password.', 'error');
        } else if (response.status === 'PORTAL_UNREACHABLE') {
            showStatus('⚠️ Student portal is currently unreachable. The university portal may be down for maintenance.', 'error');
            showRetryInfo(
                'The student portal appears to be offline. Click "Load Last Saved Data" to use your backup, or "Use Demo Data" to explore the system.',
                'warning'
            );
            return;
        } else if (response.message && response.message.toLowerCase().includes('captcha')) {
            showStatus('❌ Failed to solve CAPTCHA. Please try again.', 'error');
        } else {
            const msg = response.message || 'Failed to fetch portal data';
            showStatus(`❌ ${msg}`, 'error');
        }

        if (remaining > 0) {
            showRetryInfo(
                `Attempt ${attempt} of ${MAX_RETRY_ATTEMPTS} failed. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
                'warning'
            );
            updateAttemptDisplay();
        } else {
            handleAutoFallback();
        }
    }

    function hideRetryInfo() {
        retryInfo.style.display = 'none';
    }

    async function handleAutoFallback() {
        showStatus('⚠️ Verification failed. Loading backup data...', 'loading');
        setLoading(true);

        try {
            const backupLoaded = await loadBackupData();
            if (backupLoaded) {
                showStatus('📂 Loaded your previously saved data.', 'success');
                showToast('Backup data loaded successfully', 'success');
                clearRetryAttempts();
                setTimeout(() => {
                    window.location.href = '/dashboard/student.html';
                }, 1500);
                return;
            }
        } catch (e) {
            console.warn('Backup load failed:', e);
        }

        try {
            await loadDemoData();
            showToast('Demo data loaded (no backup available)', 'warning');
        } catch (error) {
            console.error('Fallback error:', error);
            showToast('Error loading data', 'error');
        }

        clearRetryAttempts();
        setTimeout(() => {
            window.location.href = '/dashboard/student.html';
        }, 2000);
    }

    async function handleLoadBackup() {
        setLoading(true);
        showStatus('📂 Loading backup data...', 'loading');

        try {
            const backupLoaded = await loadBackupData();
            if (backupLoaded) {
                showStatus('✅ Backup data loaded successfully!', 'success');
                showToast('Backup data loaded', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard/student.html';
                }, 1000);
            } else {
                showStatus('❌ No backup data found. Try syncing from portal or use demo data.', 'error');
                showToast('No backup data found', 'error');
            }
        } catch (error) {
            console.error('Backup load error:', error);
            showStatus('Failed to load backup data', 'error');
            showToast('Error loading backup data', 'error');
        } finally {
            setLoading(false);
        }
    }

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

    async function loadBackupData() {
        const user = APP.Storage.get('user');
        const regNumber = regNumberInput.value.trim() || (user ? user.registration_number : '');

        try {
            const response = await APP.API.get('/portal/recover', {
                params: { reg_number: regNumber }
            });

            if (response.success && (response.status === 'BACKUP_LOADED' || response.status === 'DEMO_LOADED')) {
                updateUserStorage(false, false, response.data);
                return true;
            }
        } catch (error) {
            console.warn('Recover endpoint failed, trying backup endpoint:', error);
            try {
                const response = await APP.API.post('/portal/backup', {
                    reg_number: regNumber
                });

                if (response.success && response.status === 'BACKUP_LOADED') {
                    updateUserStorage(false, false, response.data);
                    return true;
                }
            } catch (e) {
                console.warn('Backup endpoint also failed:', e);
            }
        }
        return false;
    }

    async function loadDemoData() {
        const user = APP.Storage.get('user');
        const regNumber = regNumberInput.value.trim() || (user ? user.registration_number : '');

        const response = await APP.API.post('/portal/sync', {
            reg_number: regNumber,
            useDemoData: true
        });

        if (response.success) {
            updateUserStorage(false, false, response.data);
            return response;
        } else {
            throw new Error(response.message || 'Failed to load demo data');
        }
    }

    function updateUserStorage(isVerified, portalConnected, data) {
        const user = APP.Storage.get('user');
        if (user) {
            user.portalConnected = portalConnected;
            user.isVerified = isVerified;
            user.portalData = data;
            user.dataSource = data.dataSource || (portalConnected ? 'live_portal' : 'demo');
            APP.Storage.set('user', user);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();

*/ // END COMMENTED OUT — TEMPORARILY DISABLED — DO NOT REMOVE
