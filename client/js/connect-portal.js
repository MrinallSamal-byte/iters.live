/**
 * Connect Portal JavaScript
 * 
 * Features:
 * - Data source selection (live portal vs demo data)
 * - 3-attempt login system with automatic fallback
 * - CAPTCHA solving integration via backend
 * - Backup data recovery
 * - Smooth transitions and error handling
 * - Automatic detection of portal availability
 */

(function() {
    'use strict';

    // Constants
    const MAX_RETRY_ATTEMPTS = 3;
    const RETRY_KEY_PREFIX = 'portalRetryAttempts:';

    // State
    let selectedSource = null;
    let portalEnabled = true; // Will be checked from server

    // DOM Elements
    let portalForm;
    let syncBtn;
    let demoBtn;
    let statusMessage;
    let retryInfo;
    let attemptCounter;
    let regNumberInput;
    let portalPasswordInput;
    let dataSourceSelection;
    let backupOption;

    /**
     * Initialize the connect portal page
     */
    async function init() {
        // Get DOM elements
        portalForm = document.getElementById('portalForm');
        syncBtn = document.getElementById('syncBtn');
        demoBtn = document.getElementById('demoBtn');
        statusMessage = document.getElementById('statusMessage');
        retryInfo = document.getElementById('retryInfo');
        attemptCounter = document.getElementById('attemptCounter');
        regNumberInput = document.getElementById('regNumber');
        portalPasswordInput = document.getElementById('portalPassword');
        dataSourceSelection = document.getElementById('dataSourceSelection');
        backupOption = document.getElementById('backupOption');

        // Check if user is logged in
        const user = APP.Storage.get('user');
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Check if portal features are enabled on the server
        await checkPortalAvailability();

        // Pre-fill registration number if available
        if (user.registration_number && !user.registration_number.startsWith('GOOGLE_')) {
            if (regNumberInput) {
                regNumberInput.value = user.registration_number;
            }
        }

        // Set up data source selection
        setupDataSourceSelection();

        // Check for pending portal sync from login page
        checkPendingSync();

        // Update attempt counter display
        updateAttemptDisplay();

        // Bind events
        if (portalForm) {
            portalForm.addEventListener('submit', handleSyncSubmit);
        }
        if (syncBtn) {
            syncBtn.addEventListener('click', handleSyncSubmit);
        }
        if (demoBtn) {
            demoBtn.addEventListener('click', handleUseDemoData);
        }
        
        // Add backup load button handler if it exists
        const loadBackupBtn = document.getElementById('loadBackupBtn');
        if (loadBackupBtn) {
            loadBackupBtn.addEventListener('click', handleLoadBackup);
        }
    }

    /**
     * Check if portal features are available on the server
     */
    async function checkPortalAvailability() {
        try {
            const response = await APP.API.get('/portal/status');
            if (response.success && response.data) {
                portalEnabled = response.data.portalEnabled !== false;
            }
        } catch (error) {
            // If we can't check, assume portal is disabled to be safe
            console.log('Could not check portal status, defaulting to demo mode');
            portalEnabled = false;
        }

        // If portal is disabled, update UI to reflect that
        if (!portalEnabled) {
            const optionLive = document.getElementById('optionLive');
            if (optionLive) {
                optionLive.style.opacity = '0.5';
                optionLive.style.cursor = 'not-allowed';
                optionLive.innerHTML = `
                    <div class="icon">🌐</div>
                    <h4>Live Data</h4>
                    <p style="color: #f59e0b;">Currently Unavailable</p>
                `;
            }
            // Auto-select demo option
            selectDataSource('demo');
            showStatus('Portal syncing is currently unavailable on this server. Please use demo data.', 'loading');
        }
    }

    /**
     * Set up data source selection options
     */
    function setupDataSourceSelection() {
        const optionLive = document.getElementById('optionLive');
        const optionDemo = document.getElementById('optionDemo');

        if (optionLive) {
            optionLive.addEventListener('click', () => {
                if (!portalEnabled) {
                    showStatus('Portal syncing is currently unavailable. Please use demo data.', 'error');
                    return;
                }
                selectDataSource('live');
            });
        }

        if (optionDemo) {
            optionDemo.addEventListener('click', () => selectDataSource('demo'));
        }
    }

    /**
     * Handle data source selection
     */
    function selectDataSource(source) {
        selectedSource = source;

        // Update UI
        const optionLive = document.getElementById('optionLive');
        const optionDemo = document.getElementById('optionDemo');

        if (optionLive) optionLive.classList.remove('active');
        if (optionDemo) optionDemo.classList.remove('active');

        if (source === 'live') {
            if (optionLive) optionLive.classList.add('active');
            showLiveDataForm();
        } else {
            if (optionDemo) optionDemo.classList.add('active');
            showDemoDataOption();
        }
    }

    /**
     * Show live data form for portal login
     */
    function showLiveDataForm() {
        if (portalForm) {
            portalForm.classList.add('visible');
        }
        if (syncBtn) {
            syncBtn.style.display = 'block';
        }
        if (demoBtn) {
            demoBtn.style.display = 'none';
        }
        if (backupOption) {
            backupOption.style.display = 'block';
        }
    }

    /**
     * Show demo data option
     */
    function showDemoDataOption() {
        if (portalForm) {
            portalForm.classList.remove('visible');
        }
        if (syncBtn) {
            syncBtn.style.display = 'none';
        }
        if (demoBtn) {
            demoBtn.style.display = 'block';
        }
        if (backupOption) {
            backupOption.style.display = 'none';
        }
    }

    /**
     * Check for pending portal sync from login page
     */
    function checkPendingSync() {
        const pendingSync = sessionStorage.getItem('pendingPortalSync');
        const savedPassword = sessionStorage.getItem('portalPassword');
        
        if (pendingSync) {
            try {
                const syncData = JSON.parse(pendingSync);
                // Only use if less than 5 minutes old
                if (Date.now() - syncData.timestamp < 5 * 60 * 1000) {
                    if (regNumberInput) {
                        regNumberInput.value = syncData.reg_number || regNumberInput.value;
                    }
                    
                    // Auto-select live data option
                    selectDataSource('live');
                    
                    // Auto-fill password if available from login
                    if (savedPassword && portalPasswordInput) {
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

        if (attemptCounter) {
            if (attempts > 0 && remaining > 0) {
                attemptCounter.textContent = `Attempts remaining: ${remaining}`;
                attemptCounter.style.display = 'block';
            } else {
                attemptCounter.style.display = 'none';
            }
        }

        // If max attempts reached, auto-fallback
        if (attempts >= MAX_RETRY_ATTEMPTS) {
            handleAutoFallback();
        }
    }

    function showStatus(message, type) {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message ' + type;
            statusMessage.style.display = 'block';
        }
    }

    function hideStatus() {
        if (statusMessage) {
            statusMessage.className = 'status-message';
            statusMessage.style.display = 'none';
        }
    }

    function showRetryInfo(message) {
        if (retryInfo) {
            retryInfo.textContent = message;
            retryInfo.classList.add('visible');
        }
    }

    function hideRetryInfo() {
        if (retryInfo) {
            retryInfo.classList.remove('visible');
        }
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
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<span class="spinner"></span> Syncing...';
            }
            if (demoBtn) demoBtn.disabled = true;
            const loadBackupBtn = document.getElementById('loadBackupBtn');
            if (loadBackupBtn) loadBackupBtn.disabled = true;
        } else {
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '🔄 Fetch Data from SOA Portal';
            }
            if (demoBtn) demoBtn.disabled = false;
            const loadBackupBtn = document.getElementById('loadBackupBtn');
            if (loadBackupBtn) loadBackupBtn.disabled = false;
        }
    }

    /**
     * Handle portal sync submission
     * 
     * ============================================================================
     * NOTE: Portal scraping functionality has been disabled on the server
     * ============================================================================
     * This function calls backend API endpoints that attempt to scrape data
     * from external student portals. The actual scraping code has been commented
     * out on the server side, so these API calls will return disabled responses.
     * ============================================================================
     */
    async function handleSyncSubmit(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        const regNumber = regNumberInput ? regNumberInput.value.trim() : '';
        const password = portalPasswordInput ? portalPasswordInput.value.trim() : '';

        if (!regNumber || !password) {
            showStatus('Please fill in all fields', 'error');
            return;
        }

        setLoading(true);
        showStatus('🔄 Connecting to SOA Portal... This may take up to 90 seconds while we solve the CAPTCHA.', 'loading');
        hideRetryInfo();

        try {
            // NOTE: This API call will return a disabled response as scraping is disabled
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

    /**
     * Handle sync failure
     */
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
                'The student portal appears to be offline. Click "Load Previously Saved Data" to use your backup, or select "Demo Data" to explore the system.'
            );
            return;
        } else if (response.status === 'PORTAL_DISABLED') {
            showStatus('⚠️ Portal syncing is temporarily disabled. Please use demo data.', 'error');
            showRetryInfo('Portal features are currently suspended. You can use demo data to explore all features.');
            return;
        } else if (response.message && response.message.toLowerCase().includes('captcha')) {
            showStatus('❌ Failed to solve CAPTCHA. Please try again.', 'error');
        } else {
            const msg = response.message || 'Failed to fetch portal data';
            showStatus(`❌ ${msg}`, 'error');
        }

        if (remaining > 0) {
            showRetryInfo(
                `Attempt ${attempt} of ${MAX_RETRY_ATTEMPTS} failed. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
            );
            updateAttemptDisplay();
        } else {
            handleAutoFallback();
        }
    }

    /**
     * Handle automatic fallback after max attempts
     */
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
        setLoading(false);
        setTimeout(() => {
            window.location.href = '/dashboard/student.html';
        }, 2000);
    }

    /**
     * Handle loading backup data
     */
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

    /**
     * Handle using demo data
     */
    async function handleUseDemoData() {
        setLoading(true);
        showStatus('Loading demo data...', 'loading');

        try {
            await loadDemoData();
            showStatus('✅ Demo data loaded successfully!', 'success');
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
     * Load backup data from server
     */
    async function loadBackupData() {
        const user = APP.Storage.get('user');
        const regNumber = (regNumberInput ? regNumberInput.value.trim() : '') || (user ? user.registration_number : '');

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
                const response = await APP.API.post('/portal/load-backup', {
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

    /**
     * Load demo data
     */
    async function loadDemoData() {
        const user = APP.Storage.get('user');
        const regNumber = (regNumberInput ? regNumberInput.value.trim() : '') || (user ? user.registration_number : '');

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

    /**
     * Update user storage with portal data
     */
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

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
