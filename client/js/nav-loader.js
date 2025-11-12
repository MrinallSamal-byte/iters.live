/**
 * Navigation Loader - Loads navigation bar and handles active state
 */

const NavLoader = {
    /**
     * Load navigation for a specific role
     * @param {string} role - 'student', 'teacher', or 'admin'
     * @param {string} currentPage - Current page name (e.g., 'dashboard', 'attendance')
     */
    async load(role, currentPage = 'dashboard') {
        const navContainer = document.getElementById('nav-container');
        if (!navContainer) {
            console.error('Navigation container not found');
            return;
        }

        try {
            const response = await fetch(`../partials/${role}-nav.html`);
            const html = await response.text();
            navContainer.innerHTML = html;

            // Set active navigation item (works for top nav and sidebar)
            this.setActive(currentPage);

            // Load user name
            this.loadUserName(role);

            // Load profile control
            if (typeof ProfileLoader !== 'undefined') {
                ProfileLoader.loadTopRightProfile('top-right-profile-container');
            }

            // Initialize sidebar behavior (script tags inside partial won’t auto-run)
            this.initSidebarInteractions();
        } catch (error) {
            console.error('Failed to load navigation:', error);
        }
    },

    /**
     * Set active navigation item
     */
    setActive(currentPage) {
        // Remove all active classes for both top nav and sidebar
        document.querySelectorAll('.nav-links a, .sidebar-menu-item').forEach(link => {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        });

        // Try ID-based selection first
        const byId = document.getElementById(`nav-${currentPage}`);
        if (byId) {
            byId.classList.add('active');
            byId.setAttribute('aria-current', 'page');
            return;
        }

        // Fallback to href match against current path
        const page = window.location.pathname.split('/').pop();
        document.querySelectorAll('.nav-links a, .sidebar-menu-item').forEach(link => {
            const href = link.getAttribute('href') || '';
            if (href.includes(page)) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            }
        });
    },

    /**
     * Load user name from storage
     */
    loadUserName(role) {
        let user = {};
        try {
            if (typeof APP !== 'undefined' && APP.Storage) {
                user = APP.Storage.get('user') || {};
            } else {
                user = JSON.parse(localStorage.getItem('user') || '{}');
            }
        } catch (_) {}

        // Top navigation name by role (e.g., studentName)
        const nameElement = document.getElementById(`${role}Name`);
        if (nameElement && user.name) nameElement.textContent = user.name;

        // Sidebar header elements
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarName && user.name) sidebarName.textContent = user.name;
        if (sidebarAvatar) {
            const initial = (user.name || 'S').toString().trim().charAt(0).toUpperCase() || 'S';
            sidebarAvatar.textContent = initial;
        }
    },

    /**
     * Initialize sidebar toggle/open/close interactions
     * Needed because injected <script> tags do not execute via innerHTML
     */
    initSidebarInteractions() {
        const sidebar = document.getElementById('sidebarNav');
        const toggleBtn = document.getElementById('sidebarToggle');
        const mainContent = document.querySelector('.dashboard-main');
        if (!sidebar || !toggleBtn) return;

        // Create a mobile overlay to close on outside tap
        let overlay = document.getElementById('sidebarOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebarOverlay';
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        const isMobile = () => window.innerWidth <= 768;

        const updateAria = () => {
            const expanded = (isMobile() && sidebar.classList.contains('mobile-open')) || (!isMobile() && !sidebar.classList.contains('collapsed'));
            toggleBtn.setAttribute('aria-expanded', String(expanded));
        };

        const openMobile = () => {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('is-visible');
            document.body.style.overflow = 'hidden';
            updateAria();
        };

        const closeMobile = () => {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('is-visible');
            document.body.style.overflow = '';
            updateAria();
        };

        const toggleDesktop = () => {
            sidebar.classList.toggle('collapsed');
            toggleBtn.classList.toggle('collapsed');
            if (mainContent) mainContent.classList.toggle('expanded');
            const collapsed = sidebar.classList.contains('collapsed');
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            document.body.classList.toggle('sidebar-expanded', !collapsed);
            updateAria();
        };

        // Toggle button
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isMobile()) {
                if (sidebar.classList.contains('mobile-open')) closeMobile(); else openMobile();
            } else {
                toggleDesktop();
            }
        });

        // Close on overlay tap (mobile)
        overlay.addEventListener('click', closeMobile);

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isMobile() && sidebar.classList.contains('mobile-open')) closeMobile();
            }
        });

        // Close sidebar on menu click (mobile) for better UX
        sidebar.querySelectorAll('.sidebar-menu-item').forEach(a => {
            a.addEventListener('click', () => { if (isMobile()) closeMobile(); });
        });

        // Hide overlay if resizing from mobile to desktop
        window.addEventListener('resize', () => {
            if (!isMobile()) {
                overlay.classList.remove('is-visible');
                document.body.style.overflow = '';
            }
            updateAria();
        });

        updateAria();
    }
};

// Make available globally
window.NavLoader = NavLoader;

// Auto-init: if a nav container exists, detect role from path and load sidebar
(function autoInitNav() {
    if (!document.getElementById('nav-container')) return;
    const path = (window.location.pathname || '').toLowerCase();
    let role = 'student';
    if (path.includes('/teacher')) role = 'teacher';
    else if (path.includes('/admin')) role = 'admin';

    const inferPage = () => {
        const file = path.split('/').pop();
        if (!file) return 'dashboard';
        // map 'student-marks.html' -> 'marks'
        const name = file.replace('.html','');
        const parts = name.split('-');
        return parts.length > 1 ? parts.slice(1).join('-') : 'dashboard';
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NavLoader.load(role, inferPage()));
    } else {
        NavLoader.load(role, inferPage());
    }
})();
