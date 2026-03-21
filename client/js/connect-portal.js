(function () {
    'use strict';

    const REMEMBERED_REG_KEY = 'soaRememberedRegNo';
    const IMPORT_TARGET = '/dashboard/student-personal-info';

    let portalEnabled = true;
    let currentSessionId = null;
    let currentConnection = null;

    let statusBanner;
    let startSessionBtn;
    let refreshCaptchaBtn;
    let importBtn;
    let demoBtn;
    let useCachedDataBtn;
    let openImportedDataBtn;
    let openImportedDataLink;
    let portalForm;
    let regNumberInput;
    let portalPasswordInput;
    let captchaInput;
    let sessionDisplay;
    let rememberRegNo;
    let clearRememberedBtn;
    let captchaShell;
    let captchaFrame;
    let connectionPill;
    let connectionMeta;
    let stepSession;
    let stepCredentials;
    let stepImport;

    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pagehide', releaseActiveSession);
    window.addEventListener('beforeunload', releaseActiveSession);

    function init() {
        if (typeof APP === 'undefined') {
            window.location.href = '/login.html';
            return;
        }

        const user = APP.Storage.get('user');
        if (!user || !APP.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        if (user.role !== 'student') {
            const dashboardByRole = {
                teacher: '/dashboard/teacher.html',
                admin: '/dashboard/admin.html'
            };
            const target = dashboardByRole[user.role] || '/dashboard/student.html';
            APP.navigateToDashboard(target);
            return;
        }

        bindDom();
        bindEvents();
        hydrateRegistrationNumber(user);
        loadConnectionStatus();
    }

    function bindDom() {
        statusBanner = document.getElementById('statusBanner');
        startSessionBtn = document.getElementById('startSessionBtn');
        refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
        importBtn = document.getElementById('importBtn');
        demoBtn = document.getElementById('demoBtn');
        useCachedDataBtn = document.getElementById('useCachedDataBtn');
        openImportedDataBtn = document.getElementById('openImportedDataBtn');
        openImportedDataLink = document.getElementById('openImportedDataLink');
        portalForm = document.getElementById('portalForm');
        regNumberInput = document.getElementById('regNumber');
        portalPasswordInput = document.getElementById('portalPassword');
        captchaInput = document.getElementById('captchaInput');
        sessionDisplay = document.getElementById('sessionDisplay');
        rememberRegNo = document.getElementById('rememberRegNo');
        clearRememberedBtn = document.getElementById('clearRememberedBtn');
        captchaShell = document.getElementById('captchaShell');
        captchaFrame = document.getElementById('captchaFrame');
        connectionPill = document.getElementById('connectionPill');
        connectionMeta = document.getElementById('connectionMeta');
        stepSession = document.getElementById('stepSession');
        stepCredentials = document.getElementById('stepCredentials');
        stepImport = document.getElementById('stepImport');
    }

    function bindEvents() {
        startSessionBtn?.addEventListener('click', startSession);
        refreshCaptchaBtn?.addEventListener('click', refreshCaptcha);
        portalForm?.addEventListener('submit', importPortalData);
        demoBtn?.addEventListener('click', loadDemoData);
        useCachedDataBtn?.addEventListener('click', openImportedData);
        clearRememberedBtn?.addEventListener('click', clearRememberedRegistrationNumber);
    }

    function hydrateRegistrationNumber(user) {
        let rememberedValue = null;

        try {
            rememberedValue = JSON.parse(localStorage.getItem(REMEMBERED_REG_KEY) || 'null');
        } catch (_) {
            rememberedValue = null;
        }

        if (rememberedValue && regNumberInput) {
            regNumberInput.value = rememberedValue;
            if (rememberRegNo) rememberRegNo.checked = true;
            return;
        }

        if (user?.registration_number && !String(user.registration_number).startsWith('GOOGLE_') && regNumberInput) {
            regNumberInput.value = user.registration_number;
        }
    }

    async function loadConnectionStatus() {
        setStatus('info', 'Checking your SOA connection status.', 'We are loading the latest saved import status for your account.');

        try {
            const response = await APP.API.get('/soa/status');
            portalEnabled = response.portalEnabled !== false;
            currentConnection = response.connection || null;
            renderConnectionStatus();

            if (!portalEnabled && currentConnection?.hasImportedData) {
                setStatus('warning', 'Live SOA import is unavailable right now.', 'You can still open the SOA data already imported into your account.');
            } else if (!portalEnabled) {
                setStatus('warning', 'Live SOA import is unavailable right now.', response.message || 'Use demo data for now and try the live import again later.');
            } else if (currentConnection?.connected) {
                setStatus('success', 'SOA portal already connected.', 'You can import again with a fresh CAPTCHA whenever you need a new sync.');
            } else if (currentConnection?.hasImportedData) {
                setStatus('info', 'Previously imported SOA data is available.', 'Open the saved data directly or run a fresh import if you want the newest portal data.');
            } else {
                hideStatus();
            }
        } catch (error) {
            portalEnabled = true;
            setStatus('warning', 'We could not verify the SOA status.', 'You can still try fetching a CAPTCHA or switch to demo data.');
        } finally {
            updateFlowAvailability();
        }
    }

    function updateFlowAvailability() {
        if (startSessionBtn) {
            startSessionBtn.disabled = !portalEnabled;
        }

        if (refreshCaptchaBtn) {
            refreshCaptchaBtn.disabled = !portalEnabled;
        }

        if (importBtn) {
            importBtn.disabled = !portalEnabled;
        }

        if (!portalEnabled && sessionDisplay) {
            sessionDisplay.value = 'Live import unavailable on this server right now';
        }

        updateStepCards(Boolean(currentSessionId));
    }

    function updateStepCards(hasActiveSession) {
        stepSession?.classList.toggle('active', !hasActiveSession);
        stepSession?.classList.toggle('complete', hasActiveSession);
        stepCredentials?.classList.toggle('active', hasActiveSession);
        stepImport?.classList.toggle('active', hasActiveSession);
    }

    function renderConnectionStatus() {
        if (!connectionPill || !connectionMeta) return;

        const connection = currentConnection || {};
        let stateClass = 'disconnected';
        let stateText = 'Not connected';

        if (connection.connected) {
            stateClass = 'connected';
            stateText = 'Verified from SOA';
        } else if (connection.hasImportedData) {
            stateClass = 'cached';
            stateText = 'Cached SOA data';
        }

        connectionPill.className = `connection-pill ${stateClass}`;
        connectionPill.textContent = stateText;

        const metaRows = [
            ['Provider', connection.portalProvider ? connection.portalProvider.toUpperCase() : 'Not set'],
            ['Last synced', formatDateTime(connection.lastSynced)],
            ['Status', connection.needsReconnect ? 'Needs reconnect' : connection.connected ? 'Connected' : connection.hasImportedData ? 'Saved data available' : 'No import yet'],
            ['Student', connection.profileSummary?.studentName || 'Not imported yet']
        ];

        connectionMeta.innerHTML = metaRows.map(([label, value]) => `
            <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value || '—')}</strong>
            </div>
        `).join('');

        const canOpenImportedData = Boolean(connection.hasImportedData);
        if (openImportedDataBtn) openImportedDataBtn.style.display = canOpenImportedData ? 'inline-flex' : 'none';
        if (openImportedDataLink) openImportedDataLink.style.display = canOpenImportedData ? 'inline-flex' : 'none';
        if (useCachedDataBtn) useCachedDataBtn.style.display = canOpenImportedData ? 'inline-flex' : 'none';
    }

    async function startSession() {
        if (!portalEnabled) {
            setStatus('warning', 'Live SOA import is unavailable right now.', 'Use demo data or open your saved SOA data if you have already imported it before.');
            return;
        }

        setButtonLoading(startSessionBtn, 'Fetching SOA CAPTCHA');
        setStatus('info', 'Opening a secure SOA session.', 'We are requesting a fresh CAPTCHA from the official SOA portal.');

        try {
            const response = await APP.API.get('/soa/captcha');
            currentSessionId = response.sessionId;
            renderCaptcha(response.captchaImage);
            if (sessionDisplay) sessionDisplay.value = 'Fresh SOA session ready';
            updateStepCards(true);
            setStatus('success', 'SOA CAPTCHA ready.', 'Complete the form below to start importing your student data.');
        } catch (error) {
            resetSessionUi();
            const payload = error.data || {};
            if (payload.connection) {
                currentConnection = payload.connection;
                renderConnectionStatus();
            }
            if (payload.status === 'PORTAL_DISABLED') {
                portalEnabled = false;
                currentConnection = payload.connection || currentConnection;
                renderConnectionStatus();
                updateFlowAvailability();
            }
            if (payload.status === 'PORTAL_UNREACHABLE' && currentConnection?.hasImportedData) {
                setStatus('warning', 'Could not fetch a fresh SOA CAPTCHA.', 'The official SOA portal is not responding right now. You can still open the last imported SOA data saved in your account.');
            } else {
                setStatus('error', 'Could not fetch a fresh SOA CAPTCHA.', payload.message || error.message || 'Please try again in a moment.');
            }
        } finally {
            resetButton(startSessionBtn);
        }
    }

    async function refreshCaptcha() {
        if (!currentSessionId) {
            startSession();
            return;
        }

        setButtonLoading(refreshCaptchaBtn, 'Refreshing');
        setStatus('info', 'Refreshing the CAPTCHA.', 'Use the latest CAPTCHA shown here before you submit the import.');

        try {
            const response = await APP.API.post('/soa/refresh-captcha', {
                sessionId: currentSessionId
            });
            currentSessionId = response.sessionId || currentSessionId;
            renderCaptcha(response.captchaImage);
            if (sessionDisplay) sessionDisplay.value = 'CAPTCHA refreshed';
            setStatus('success', 'Fresh CAPTCHA loaded.', 'Enter the new CAPTCHA value before you import.');
        } catch (error) {
            const payload = error.data || {};
            if (payload.status === 'SESSION_EXPIRED') {
                resetSessionUi();
                setStatus('warning', 'That SOA session expired.', 'Fetch a fresh CAPTCHA and then submit your credentials again.');
            } else {
                setStatus('error', 'Could not refresh the CAPTCHA.', payload.message || error.message || 'Please fetch a new session and try again.');
            }
        } finally {
            resetButton(refreshCaptchaBtn);
        }
    }

    async function importPortalData(event) {
        event.preventDefault();

        const regNo = regNumberInput?.value.trim();
        const password = portalPasswordInput?.value || '';
        const captcha = captchaInput?.value.trim();

        if (!currentSessionId) {
            setStatus('warning', 'Fetch the CAPTCHA first.', 'Start a secure SOA session before submitting your login details.');
            return;
        }

        if (!regNo || !password || !captcha) {
            setStatus('warning', 'Complete every field first.', 'Registration number, password, and CAPTCHA are all required for the SOA import.');
            return;
        }

        rememberRegistrationNumber(regNo);
        setButtonLoading(importBtn, 'Importing SOA data');
        setStatus('info', 'Importing your SOA data.', 'This can take a short while while we log in, collect the available sections, and save them to your account.');

        try {
            const response = await APP.API.post('/soa/login', {
                sessionId: currentSessionId,
                regNo,
                password,
                captcha
            });

            clearSensitiveInputs();
            currentSessionId = null;
            syncStoredUser(response.connection, null, false);
            currentConnection = response.connection || currentConnection;
            renderConnectionStatus();
            resetSessionUi(false);
            setStatus('success', 'SOA data imported successfully.', 'Opening your student-facing SOA data page now.');

            window.setTimeout(() => {
                APP.navigateToDashboard(response.redirectTo || IMPORT_TARGET);
            }, 900);
        } catch (error) {
            clearSensitiveInputs();
            const payload = error.data || {};

            if (payload.status === 'SESSION_EXPIRED') {
                resetSessionUi();
                setStatus('warning', 'Your SOA session expired.', 'Fetch a new CAPTCHA and submit your login details again.');
            } else if (payload.status === 'AUTH_FAILED') {
                setStatus('error', 'SOA login failed.', payload.message || 'Check your registration number, password, and CAPTCHA, then try again.');
            } else if (payload.status === 'PORTAL_UNREACHABLE') {
                currentConnection = payload.connection || currentConnection;
                renderConnectionStatus();
                setStatus('warning', 'The official SOA portal could not be reached.', 'If you already imported data before, you can still open the saved copy inside this app.');
            } else if (payload.status === 'PORTAL_DISABLED') {
                portalEnabled = false;
                currentConnection = payload.connection || currentConnection;
                renderConnectionStatus();
                updateFlowAvailability();
                setStatus('warning', 'Live SOA import is unavailable right now.', payload.message || 'You can continue with demo data or open saved imported data.');
            } else if (payload.status === 'RATE_LIMITED') {
                setStatus('warning', 'Too many import attempts.', payload.message || 'Please wait a little before you try again.');
            } else {
                setStatus('error', 'SOA import failed.', payload.message || error.message || 'Fetch a fresh CAPTCHA and try again.');
            }
        } finally {
            resetButton(importBtn);
        }
    }

    async function loadDemoData() {
        setButtonLoading(demoBtn, 'Loading demo data');
        setStatus('info', 'Loading demo data.', 'You can continue exploring the student experience without a live SOA import.');

        try {
            const response = await APP.API.get('/portal/demo');
            const demoConnection = {
                connected: false,
                isVerified: false,
                portalProvider: null,
                lastSynced: new Date().toISOString(),
                hasImportedData: true,
                needsReconnect: false,
                dataSource: 'demo',
                profileSummary: {
                    studentName: response.data?.profile?.name || 'Demo Student',
                    registrationNumber: response.data?.profile?.registration_number || 'Demo',
                    branch: response.data?.profile?.department || 'Demo',
                    semester: response.data?.profile?.semester || null
                }
            };

            currentConnection = demoConnection;
            syncStoredUser(demoConnection, response.data, true);
            renderConnectionStatus();
            setStatus('success', 'Demo data is ready.', 'Opening the student-facing SOA data page with demo content.');

            window.setTimeout(() => {
                APP.navigateToDashboard(IMPORT_TARGET);
            }, 700);
        } catch (error) {
            setStatus('error', 'Demo data could not be loaded.', error.message || 'Please try again in a moment.');
        } finally {
            resetButton(demoBtn);
        }
    }

    function openImportedData() {
        APP.navigateToDashboard(IMPORT_TARGET);
    }

    function rememberRegistrationNumber(regNo) {
        if (!rememberRegNo) return;

        try {
            if (!rememberRegNo.checked) {
                localStorage.removeItem(REMEMBERED_REG_KEY);
                return;
            }

            localStorage.setItem(REMEMBERED_REG_KEY, JSON.stringify(regNo));
        } catch (_) {
            // Storage may be unavailable. The live flow still works without remembering the value.
        }
    }

    function clearRememberedRegistrationNumber() {
        try {
            localStorage.removeItem(REMEMBERED_REG_KEY);
        } catch (_) {
            // Ignore storage errors.
        }
        if (rememberRegNo) rememberRegNo.checked = false;
        if (regNumberInput) regNumberInput.value = '';
        setStatus('info', 'Remembered registration number cleared.', 'You can still enter a registration number manually for this session.');
    }

    function syncStoredUser(connection, data, keepLocalPortalData) {
        const user = APP.Storage.get('user');
        if (!user) return;

        user.portalConnected = Boolean(connection?.connected);
        user.isVerified = Boolean(connection?.isVerified);
        user.portalProvider = connection?.portalProvider || null;
        user.portal_last_synced = connection?.lastSynced || null;
        user.portalStatus = connection || null;
        user.dataSource = connection?.dataSource || user.dataSource || null;

        if (keepLocalPortalData && data) {
            user.portalData = data;
        } else {
            delete user.portalData;
        }

        APP.Storage.set('user', user);
    }

    function renderCaptcha(imageSrc) {
        if (!captchaShell || !captchaFrame) return;

        captchaShell.classList.add('visible');
        captchaFrame.innerHTML = '';

        const image = document.createElement('img');
        image.src = imageSrc;
        image.alt = 'Official SOA CAPTCHA';
        captchaFrame.appendChild(image);
    }

    function resetSessionUi(clearCaptcha = true) {
        currentSessionId = null;
        updateStepCards(false);

        if (sessionDisplay) {
            sessionDisplay.value = portalEnabled
                ? 'Waiting for a fresh CAPTCHA session'
                : 'Live import unavailable on this server right now';
        }

        if (clearCaptcha && captchaFrame) {
            captchaFrame.innerHTML = '<span>Fetch a session to load the CAPTCHA.</span>';
        }

        if (clearCaptcha && captchaShell) {
            captchaShell.classList.remove('visible');
        }
    }

    function clearSensitiveInputs() {
        if (portalPasswordInput) portalPasswordInput.value = '';
        if (captchaInput) captchaInput.value = '';
    }

    function setStatus(type, title, message) {
        if (!statusBanner) return;
        statusBanner.className = `status-banner ${type} visible`;
        statusBanner.innerHTML = `
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message || '')}</span>
        `;
    }

    function hideStatus() {
        if (!statusBanner) return;
        statusBanner.className = 'status-banner';
        statusBanner.innerHTML = '';
    }

    function setButtonLoading(button, label) {
        if (!button) return;
        if (!button.dataset.originalLabel) {
            button.dataset.originalLabel = button.innerHTML;
        }
        button.disabled = true;
        button.innerHTML = `<span class="spinner"></span>${escapeHtml(label)}`;
    }

    function resetButton(button) {
        if (!button) return;
        button.disabled = false;
        if (button.dataset.originalLabel) {
            button.innerHTML = button.dataset.originalLabel;
        }
    }

    function formatDateTime(value) {
        if (!value) return 'Not synced yet';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function escapeHtml(value) {
        return APP?.sanitize ? APP.sanitize(String(value || '')) : String(value || '');
    }

    function releaseActiveSession() {
        if (!currentSessionId) return;
        const sessionId = currentSessionId;
        currentSessionId = null;

        const token = APP?.Storage?.get ? APP.Storage.get('accessToken') : null;
        const headers = {};
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        fetch(`/api/soa/session/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE',
            headers,
            keepalive: true
        }).catch(() => {});
    }
})();
