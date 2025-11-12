// Admin Sidebar Navigation Handler
(function() {
    'use strict';

    const AdminSidebar = {
        init() {
            this.createSidebar();
            this.setupEventListeners();
            this.loadUserInfo();
            this.setActivePage();
            this.initMobileMenu();
        },

        createSidebar() {
            const sidebarHTML = `
                <aside class="admin-sidebar" id="adminSidebar">
                    <button class="sidebar-toggle" id="sidebarToggle" title="Toggle Sidebar">
                        ‹
                    </button>
                    
                    <div class="sidebar-logo">
                        <img src="../assets/logo.png" alt="ITER Logo" class="sidebar-logo-img" onerror="this.style.display='none'">
                        <div class="sidebar-branding">
                            <span class="sidebar-title">ITER Portal</span>
                            <span class="sidebar-subtitle">Admin Dashboard</span>
                        </div>
                    </div>

                    <nav class="sidebar-nav">
                        <ul class="sidebar-nav-list">
                            <li class="sidebar-nav-item">
                                <a href="admin.html" class="sidebar-nav-link" data-page="dashboard">
                                    <span class="sidebar-nav-icon">🏠</span>
                                    <span class="sidebar-nav-text">Dashboard</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-users.html" class="sidebar-nav-link" data-page="users">
                                    <span class="sidebar-nav-icon">👥</span>
                                    <span class="sidebar-nav-text">User Management</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-approvals.html" class="sidebar-nav-link" data-page="approvals">
                                    <span class="sidebar-nav-icon">✅</span>
                                    <span class="sidebar-nav-text">Approvals</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-analytics.html" class="sidebar-nav-link" data-page="analytics">
                                    <span class="sidebar-nav-icon">📊</span>
                                    <span class="sidebar-nav-text">Analytics</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-reports.html" class="sidebar-nav-link" data-page="reports">
                                    <span class="sidebar-nav-icon">📈</span>
                                    <span class="sidebar-nav-text">Reports</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-announcements.html" class="sidebar-nav-link" data-page="announcements">
                                    <span class="sidebar-nav-icon">📢</span>
                                    <span class="sidebar-nav-text">Announcements</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-departments.html" class="sidebar-nav-link" data-page="departments">
                                    <span class="sidebar-nav-icon">🏢</span>
                                    <span class="sidebar-nav-text">Departments</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-courses.html" class="sidebar-nav-link" data-page="courses">
                                    <span class="sidebar-nav-icon">📚</span>
                                    <span class="sidebar-nav-text">Courses</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-settings.html" class="sidebar-nav-link" data-page="settings">
                                    <span class="sidebar-nav-icon">⚙️</span>
                                    <span class="sidebar-nav-text">System Settings</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="admin-logs.html" class="sidebar-nav-link" data-page="logs">
                                    <span class="sidebar-nav-icon">📋</span>
                                    <span class="sidebar-nav-text">Activity Logs</span>
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div class="sidebar-footer">
                        <div class="sidebar-user">
                            <div class="sidebar-user-avatar" id="sidebarUserAvatar">A</div>
                            <div class="sidebar-user-info">
                                <div class="sidebar-user-name" id="sidebarUserName">Admin</div>
                                <div class="sidebar-user-role">Admin Portal</div>
                            </div>
                        </div>
                        <button class="sidebar-logout" onclick="AdminSidebar.logout()">
                            <span>🚪</span>
                            <span class="logout-text">Logout</span>
                        </button>
                    </div>
                </aside>

                <!-- Mobile overlay -->
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
                
                <!-- Mobile toggle button -->
                <button class="mobile-sidebar-toggle" id="mobileSidebarToggle">
                    ☰
                </button>
            `;

            // Insert sidebar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        },

        setupEventListeners() {
            const toggleBtn = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('adminSidebar');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Load collapsed state from localStorage
            const isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
            if (isCollapsed && sidebar) {
                sidebar.classList.add('collapsed');
                if (toggleBtn) toggleBtn.textContent = '›';
            }
        },

        toggleSidebar() {
            const sidebar = document.getElementById('adminSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');

            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                
                if (toggleBtn) {
                    toggleBtn.textContent = isCollapsed ? '›' : '‹';
                }
                
                // Save state
                localStorage.setItem('adminSidebarCollapsed', isCollapsed);
            }
        },

        initMobileMenu() {
            const mobileToggle = document.getElementById('mobileSidebarToggle');
            const sidebar = document.getElementById('adminSidebar');
            const overlay = document.getElementById('sidebarOverlay');

            if (mobileToggle) {
                mobileToggle.addEventListener('click', () => {
                    if (sidebar) sidebar.classList.add('mobile-open');
                    if (overlay) overlay.classList.add('active');
                });
            }

            if (overlay) {
                overlay.addEventListener('click', () => {
                    if (sidebar) sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                });
            }

            // Close on navigation
            document.querySelectorAll('.sidebar-nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 968) {
                        if (sidebar) sidebar.classList.remove('mobile-open');
                        if (overlay) overlay.classList.remove('active');
                    }
                });
            });
        },

        loadUserInfo() {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const userName = user.name || 'Admin';
                
                // Update sidebar user info
                const sidebarUserName = document.getElementById('sidebarUserName');
                if (sidebarUserName) {
                    sidebarUserName.textContent = userName;
                }

                // Update avatar
                const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
                if (sidebarUserAvatar) {
                    sidebarUserAvatar.textContent = userName.charAt(0).toUpperCase();
                }
            } catch (error) {
                console.error('Error loading user info:', error);
            }
        },

        setActivePage() {
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            const links = document.querySelectorAll('.sidebar-nav-link');

            links.forEach(link => {
                const pageName = link.getAttribute('data-page');
                
                // Handle dashboard as default
                if ((currentPage === 'admin' || currentPage === '') && pageName === 'dashboard') {
                    link.classList.add('active');
                } else if (currentPage.includes(pageName)) {
                    link.classList.add('active');
                }
            });
        },

        logout() {
            if (confirm('Are you sure you want to logout?')) {
                // Use APP.logout if available
                if (typeof APP !== 'undefined' && typeof APP.logout === 'function') {
                    APP.logout();
                } else {
                    // Fallback logout
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '../login.html';
                }
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            AdminSidebar.init();
        });
    } else {
        AdminSidebar.init();
    }

    // Expose globally
    window.AdminSidebar = AdminSidebar;
})();
