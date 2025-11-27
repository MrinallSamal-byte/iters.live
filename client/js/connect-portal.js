/**
 * Connect Portal - Student Portal Onboarding Flow
 * Handles portal connection, scraping, retry logic, and dummy data fallback
 */

(function() {
    'use strict';

    // Configuration
    const MAX_RETRY_ATTEMPTS = 3;
    const STORAGE_KEY = 'portal_retry_attempts';
    const SCRAPER_ENDPOINT = '/api/portal/scrape';

    // Dummy data for fallback
    const DUMMY_DATA = {
        name: 'Demo Student',
        registration_number: 'DEMO2025001',
        email: 'demo@iter.edu',
        department: 'CSE',
        year: 2,
        section: 'A',
        semester: 3,
        blood_group: 'O+',
        phone: '9876543210',
        address: 'Demo Address, City',
        attendance: {
            overall: 85,
            subjects: [
                { name: 'Data Structures', present: 28, total: 32, percentage: 87.5 },
                { name: 'Algorithms', present: 26, total: 30, percentage: 86.7 },
                { name: 'Database Management', present: 25, total: 28, percentage: 89.3 },
                { name: 'Operating Systems', present: 24, total: 30, percentage: 80 }
            ]
        },
        marks: {
            cgpa: 8.5,
            subjects: [
                { name: 'Data Structures', internal1: 25, internal2: 27, internal3: 26, external: 75 },
                { name: 'Algorithms', internal1: 24, internal2: 26, internal3: 28, external: 78 },
                { name: 'Database Management', internal1: 26, internal2: 28, internal3: 27, external: 80 }
            ]
        },
        timetable: [
            { day: 'Monday', slots: ['DS', 'Algo', 'DBMS', 'Lunch', 'OS', 'Lab'] },
            { day: 'Tuesday', slots: ['Algo', 'DS', 'OS', 'Lunch', 'DBMS', 'Lab'] },
            { day: 'Wednesday', slots: ['DBMS', 'OS', 'DS', 'Lunch', 'Algo', 'Free'] },
            { day: 'Thursday', slots: ['OS', 'DBMS', 'Algo', 'Lunch', 'DS', 'Lab'] },
            { day: 'Friday', slots: ['DS', 'Algo', 'OS', 'Lunch', 'DBMS', 'Free'] }
        ]
    };

    // State
    let retryAttempts = parseInt(localStorage.getItem(STORAGE_KEY) || '0');

    // DOM Elements
    const connectForm = document.getElementById('connectForm');
    const syncBtn = document.getElementById('syncBtn');
    const syncBtnText = document.getElementById('syncBtnText');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const retrySection = document.getElementById('retrySection');
    const retryBtn = document.getElementById('retryBtn');
    const useDummyBtn = document.getElementById('useDummyBtn');
    const skipLink = document.getElementById('skipLink');
    const attemptsCounter = document.getElementById('attemptsCounter');
    const registrationInput = document.getElementById('registration_number');
    const passwordInput = document.getElementById('portal_password');

    // Initialize
    function init() {
        updateAttemptsCounter();
        
        // Event listeners
        connectForm.addEventListener('submit', handleFormSubmit);
        retryBtn.addEventListener('click', handleRetry);
        useDummyBtn.addEventListener('click', handleUseDummyData);
        skipLink.addEventListener('click', handleSkip);

        // Check if user is authenticated
        checkAuthentication();

        // Pre-fill registration number if available (only if not a Google temp registration)
        const user = APP?.Storage?.get('user');
        if (user && user.registration_number) {
            // Only pre-fill if it's not a temporary Google registration number
            if (!user.registration_number.startsWith('GOOGLE_')) {
                registrationInput.value = user.registration_number;
            }
        }
    }

    // Check if user is authenticated
    function checkAuthentication() {
        if (typeof APP !== 'undefined' && !APP.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    }

    // Update attempts counter display
    function updateAttemptsCounter() {
        if (retryAttempts > 0) {
            attemptsCounter.textContent = `Attempts: ${retryAttempts}/${MAX_RETRY_ATTEMPTS}`;
        } else {
            attemptsCounter.textContent = '';
        }
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        successMessage.classList.remove('show');
    }

    // Show success message
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.classList.add('show');
        errorMessage.classList.remove('show');
    }

    // Hide all messages
    function hideMessages() {
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
    }

    // Show retry section
    function showRetrySection() {
        retrySection.classList.add('show');
    }

    // Hide retry section
    function hideRetrySection() {
        retrySection.classList.remove('show');
    }

    // Set loading state
    function setLoading(isLoading) {
        syncBtn.disabled = isLoading;
        if (isLoading) {
            syncBtnText.innerHTML = '<span class="loading-spinner"></span> Syncing...';
        } else {
            syncBtnText.textContent = '🔄 Sync Data';
        }
    }

    // Show toast notification
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            margin-bottom: 10px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        toast.textContent = message;

        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Handle form submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        hideMessages();
        hideRetrySection();

        const registrationNumber = registrationInput.value.trim();
        const portalPassword = passwordInput.value;

        if (!registrationNumber || !portalPassword) {
            showError('Please fill in all fields');
            return;
        }

        await attemptScrape(registrationNumber, portalPassword);
    }

    // Attempt to scrape portal data
    async function attemptScrape(registrationNumber, portalPassword) {
        setLoading(true);
        retryAttempts++;
        localStorage.setItem(STORAGE_KEY, retryAttempts.toString());
        updateAttemptsCounter();

        try {
            const response = await fetch(SCRAPER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${APP?.Storage?.get('accessToken') || ''}`
                },
                body: JSON.stringify({
                    registration_number: registrationNumber,
                    password: portalPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                // Success! Save data and redirect
                handleScrapeSuccess(data.student_data);
            } else if (data.status === 'AUTH_FAILED') {
                // Invalid credentials
                handleAuthFailed();
            } else {
                // Scrape error
                handleScrapeError(data.error || 'Unable to fetch data');
            }
        } catch (error) {
            console.error('Scrape error:', error);
            handleScrapeError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Handle successful scrape
    function handleScrapeSuccess(studentData) {
        // Reset retry attempts
        localStorage.removeItem(STORAGE_KEY);
        retryAttempts = 0;

        // Save student data
        const user = APP?.Storage?.get('user') || {};
        const updatedUser = {
            ...user,
            ...studentData,
            isVerified: true,
            portalConnected: true,
            lastSynced: new Date().toISOString()
        };
        APP?.Storage?.set('user', updatedUser);
        APP?.Storage?.set('studentPortalData', studentData);

        showSuccess('✅ Data synced successfully! Redirecting...');
        showToast('Portal connected successfully!', 'success');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard/student.html';
        }, 1500);
    }

    // Handle authentication failure
    function handleAuthFailed() {
        showError('❌ Invalid credentials. Please check your registration number and password.');
        
        if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
            handleMaxRetriesReached();
        } else {
            showRetrySection();
        }
    }

    // Handle scrape error
    function handleScrapeError(errorMsg) {
        showError(`❌ ${errorMsg}`);
        
        if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
            handleMaxRetriesReached();
        } else {
            showRetrySection();
        }
    }

    // Handle max retries reached - automatic fallback
    function handleMaxRetriesReached() {
        localStorage.removeItem(STORAGE_KEY);
        retryAttempts = 0;
        
        hideRetrySection();
        
        showToast(
            '⚠️ We could not verify your details after 3 attempts. Demo data has been loaded. You can retry verification later from Settings.',
            'warning'
        );

        // Use dummy data
        useDummyDataAndRedirect();
    }

    // Handle retry button click
    function handleRetry() {
        hideRetrySection();
        hideMessages();
        
        const registrationNumber = registrationInput.value.trim();
        const portalPassword = passwordInput.value;

        if (!registrationNumber || !portalPassword) {
            showError('Please fill in all fields');
            return;
        }

        attemptScrape(registrationNumber, portalPassword);
    }

    // Handle use dummy data button click
    function handleUseDummyData() {
        localStorage.removeItem(STORAGE_KEY);
        retryAttempts = 0;
        
        useDummyDataAndRedirect();
    }

    // Handle skip link click
    function handleSkip(e) {
        e.preventDefault();
        
        const confirmed = confirm('Are you sure you want to skip? You will see demo data instead of your actual academic information.');
        
        if (confirmed) {
            localStorage.removeItem(STORAGE_KEY);
            retryAttempts = 0;
            useDummyDataAndRedirect();
        }
    }

    // Use dummy data and redirect to dashboard
    function useDummyDataAndRedirect() {
        // Save dummy data
        const user = APP?.Storage?.get('user') || {};
        const updatedUser = {
            ...user,
            name: DUMMY_DATA.name,
            department: DUMMY_DATA.department,
            year: DUMMY_DATA.year,
            section: DUMMY_DATA.section,
            semester: DUMMY_DATA.semester,
            isVerified: false,
            portalConnected: false,
            usingDummyData: true
        };
        APP?.Storage?.set('user', updatedUser);
        APP?.Storage?.set('studentPortalData', DUMMY_DATA);
        APP?.Storage?.set('isDummyMode', true);

        showSuccess('📊 Demo data loaded. Redirecting to dashboard...');
        showToast('Using demo data. You can connect your portal later from Settings.', 'info');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard/student.html';
        }, 1500);
    }

    // Add CSS for toast animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
