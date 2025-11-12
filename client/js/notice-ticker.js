// Notice Ticker Functionality
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        displayDelay: 5000,        // 5 seconds before ticker appears
        noticeDuration: 15000,     // 15 seconds for each notice to scroll
        noticeGap: 1500,           // 1.5 seconds gap between notices
        autoClose: false,          // Auto close after all notices (set to false for loop)
        enableHoverPause: true     // Pause animation on hover
    };

    // State
    let state = {
        currentNoticeIndex: 0,
        isActive: false,
        isPaused: false,
        notices: [],
        timeouts: [],
        tickerElement: null,
        contentElement: null,
        closeButton: null
    };

    /**
     * Initialize the notice ticker
     */
    function init() {
        // Get DOM elements
        state.tickerElement = document.getElementById('noticeTicker');
        state.contentElement = document.querySelector('.notice-ticker-content');
        state.closeButton = document.getElementById('noticeCloseBtn');

        if (!state.tickerElement || !state.contentElement) {
            console.warn('Notice ticker elements not found');
            return;
        }

        // Get all notice items
        state.notices = Array.from(document.querySelectorAll('.notice-item'));

        if (state.notices.length === 0) {
            console.warn('No notices found');
            return;
        }

        // Set initial position class (navbar is visible on page load)
        state.tickerElement.classList.add('navbar-visible');

        // Setup event listeners
        setupEventListeners();

        // Show ticker after delay
        setTimeout(() => {
            showTicker();
        }, CONFIG.displayDelay);

        console.log('Notice ticker initialized with', state.notices.length, 'notices');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Close button
        if (state.closeButton) {
            state.closeButton.addEventListener('click', closeTicker);
        }

        // Hover pause functionality
        if (CONFIG.enableHoverPause && state.contentElement) {
            state.contentElement.addEventListener('mouseenter', pauseAnimation);
            state.contentElement.addEventListener('mouseleave', resumeAnimation);
        }

        // Keyboard accessibility (ESC to close)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.isActive) {
                closeTicker();
            }
        });

        // Listen for navbar visibility changes
        window.addEventListener('navbar:hide', handleNavbarHide);
        window.addEventListener('navbar:show', handleNavbarShow);
    }

    /**
     * Handle navbar hide event - move ticker to top
     */
    function handleNavbarHide() {
        if (!state.tickerElement) return;
        
        state.tickerElement.classList.add('navbar-hidden');
        state.tickerElement.classList.remove('navbar-visible');
        
        console.log('Notice ticker moved to top (navbar hidden)');
    }

    /**
     * Handle navbar show event - move ticker below navbar
     */
    function handleNavbarShow() {
        if (!state.tickerElement) return;
        
        state.tickerElement.classList.remove('navbar-hidden');
        state.tickerElement.classList.add('navbar-visible');
        
        console.log('Notice ticker moved below navbar (navbar visible)');
    }

    /**
     * Show the ticker
     */
    function showTicker() {
        if (!state.tickerElement) return;

        state.isActive = true;
        state.tickerElement.classList.add('active');

        // Start showing notices
        showNextNotice();

        console.log('Notice ticker displayed');
    }

    /**
     * Close the ticker
     */
    function closeTicker() {
        if (!state.tickerElement) return;

        state.isActive = false;
        state.tickerElement.classList.remove('active');

        // Clear all active animations
        state.notices.forEach(notice => {
            notice.classList.remove('active', 'exiting');
        });

        // Clear all pending timeouts
        state.timeouts.forEach(timeout => clearTimeout(timeout));
        state.timeouts = [];

        console.log('Notice ticker closed');
    }

    /**
     * Show the next notice in sequence
     */
    function showNextNotice() {
        if (!state.isActive) return;

        // Hide previous notice
        if (state.currentNoticeIndex > 0) {
            const prevNotice = state.notices[state.currentNoticeIndex - 1];
            if (prevNotice) {
                prevNotice.classList.add('exiting');
                setTimeout(() => {
                    prevNotice.classList.remove('active', 'exiting');
                }, 300);
            }
        }

        // Get current notice
        const currentNotice = state.notices[state.currentNoticeIndex];
        
        if (!currentNotice) {
            // All notices shown, loop back to start
            state.currentNoticeIndex = 0;
            
            // Wait before restarting
            const loopTimeout = setTimeout(() => {
                showNextNotice();
            }, CONFIG.noticeGap);
            state.timeouts.push(loopTimeout);
            return;
        }

        // Show current notice
        currentNotice.classList.add('active');
        console.log('Showing notice', state.currentNoticeIndex + 1, 'of', state.notices.length);

        // Schedule next notice
        const nextTimeout = setTimeout(() => {
            state.currentNoticeIndex++;
            showNextNotice();
        }, CONFIG.noticeDuration + CONFIG.noticeGap);
        
        state.timeouts.push(nextTimeout);
    }

    /**
     * Pause animation on hover
     */
    function pauseAnimation() {
        if (!state.isActive || state.isPaused) return;

        state.isPaused = true;
        const activeNotice = document.querySelector('.notice-item.active');
        
        if (activeNotice) {
            activeNotice.style.animationPlayState = 'paused';
        }
    }

    /**
     * Resume animation
     */
    function resumeAnimation() {
        if (!state.isActive || !state.isPaused) return;

        state.isPaused = false;
        const activeNotice = document.querySelector('.notice-item.active');
        
        if (activeNotice) {
            activeNotice.style.animationPlayState = 'running';
        }
    }

    /**
     * Update notices dynamically (for future admin integration)
     * @param {Array} newNotices - Array of notice objects with icon and text
     */
    function updateNotices(newNotices) {
        if (!Array.isArray(newNotices) || newNotices.length === 0) {
            console.warn('Invalid notices data');
            return;
        }

        // Clear current notices
        state.contentElement.innerHTML = '';

        // Create new notice elements
        newNotices.forEach((notice, index) => {
            const noticeElement = document.createElement('div');
            noticeElement.className = 'notice-item';
            noticeElement.setAttribute('data-notice-id', index + 1);
            
            noticeElement.innerHTML = `
                <span class="notice-icon">${notice.icon || '📢'}</span>
                <span class="notice-text">${notice.text}</span>
            `;
            
            state.contentElement.appendChild(noticeElement);
        });

        // Update state
        state.notices = Array.from(document.querySelectorAll('.notice-item'));
        state.currentNoticeIndex = 0;

        // Restart ticker if active
        if (state.isActive) {
            // Clear existing timeouts
            state.timeouts.forEach(timeout => clearTimeout(timeout));
            state.timeouts = [];

            // Restart
            showNextNotice();
        }

        console.log('Notices updated:', newNotices.length, 'notices loaded');
    }

    /**
     * Fetch notices from API (for future implementation)
     */
    async function fetchNotices() {
        try {
            // This will be implemented when admin panel is ready
            const response = await fetch('/api/notices/active');
            
            if (!response.ok) {
                throw new Error('Failed to fetch notices');
            }

            const data = await response.json();
            
            if (data.success && data.notices) {
                updateNotices(data.notices);
            }
        } catch (error) {
            console.error('Error fetching notices:', error);
            // Continue with static notices if fetch fails
        }
    }

    /**
     * Public API
     */
    window.NoticeTicker = {
        init,
        show: showTicker,
        close: closeTicker,
        updateNotices,
        fetchNotices,
        
        // Getters for state
        isActive: () => state.isActive,
        getCurrentIndex: () => state.currentNoticeIndex,
        getNoticeCount: () => state.notices.length
    };

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Debug helper (remove in production)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Notice Ticker: Debug mode enabled');
        console.log('Available commands:', {
            'NoticeTicker.show()': 'Show ticker manually',
            'NoticeTicker.close()': 'Close ticker',
            'NoticeTicker.isActive()': 'Check if ticker is active',
            'NoticeTicker.updateNotices(array)': 'Update notices dynamically'
        });
    }
})();

// Example usage for future admin integration:
/*
// Fetch notices from admin panel
async function loadNoticesFromAdmin() {
    try {
        const response = await fetch('/api/admin/notices');
        const data = await response.json();
        
        if (data.success) {
            NoticeTicker.updateNotices(data.notices.map(notice => ({
                icon: notice.icon || '📢',
                text: notice.message
            })));
        }
    } catch (error) {
        console.error('Failed to load notices:', error);
    }
}

// Call when needed
loadNoticesFromAdmin();
*/
