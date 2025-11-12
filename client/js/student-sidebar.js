// Student Sidebar Navigation Handler
(function() {
    'use strict';

    const StudentSidebar = {
        init() {
            this.createSidebar();
            this.setupEventListeners();
            this.loadUserInfo();
            this.setActivePage();
            this.initMobileMenu();
        },

        createSidebar() {
            const sidebarHTML = `
                <aside class="student-sidebar" id="studentSidebar">
                    <button class="sidebar-toggle" id="sidebarToggle" title="Toggle Sidebar">
                        ‹
                    </button>
                    
                    <div class="sidebar-logo">
                        <img src="../assets/logo.png" alt="ITER Logo" class="sidebar-logo-img" onerror="this.style.display='none'">
                        <div class="sidebar-branding">
                            <span class="sidebar-title">ITER Portal</span>
                            <span class="sidebar-subtitle">Student Dashboard</span>
                        </div>
                    </div>

                    <nav class="sidebar-nav">
                        <ul class="sidebar-nav-list">
                            <li class="sidebar-nav-item">
                                <a href="student.html" class="sidebar-nav-link" data-page="dashboard">
                                    <span class="sidebar-nav-icon">🏠</span>
                                    <span class="sidebar-nav-text">Dashboard</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-attendance.html" class="sidebar-nav-link" data-page="attendance">
                                    <span class="sidebar-nav-icon">📊</span>
                                    <span class="sidebar-nav-text">Attendance</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-marks.html" class="sidebar-nav-link" data-page="marks">
                                    <span class="sidebar-nav-icon">📈</span>
                                    <span class="sidebar-nav-text">Marks</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-timetable.html" class="sidebar-nav-link" data-page="timetable">
                                    <span class="sidebar-nav-icon">📅</span>
                                    <span class="sidebar-nav-text">Timetable</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-notes.html" class="sidebar-nav-link" data-page="notes">
                                    <span class="sidebar-nav-icon">📚</span>
                                    <span class="sidebar-nav-text">Study Notes</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-admit-card.html" class="sidebar-nav-link" data-page="admit-card">
                                    <span class="sidebar-nav-icon">🎫</span>
                                    <span class="sidebar-nav-text">Admit Card</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-events.html" class="sidebar-nav-link" data-page="events">
                                    <span class="sidebar-nav-icon">🎉</span>
                                    <span class="sidebar-nav-text">Events</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-clubs.html" class="sidebar-nav-link" data-page="clubs">
                                    <span class="sidebar-nav-icon">🎪</span>
                                    <span class="sidebar-nav-text">Clubs</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="student-hostel-menu.html" class="sidebar-nav-link" data-page="hostel">
                                    <span class="sidebar-nav-icon">🍽️</span>
                                    <span class="sidebar-nav-text">Hostel Menu</span>
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div class="sidebar-footer">
                        <div class="sidebar-user">
                            <div class="sidebar-user-avatar" id="sidebarUserAvatar">S</div>
                            <div class="sidebar-user-info">
                                <div class="sidebar-user-name" id="sidebarUserName">Student</div>
                                <div class="sidebar-user-role">Student Portal</div>
                            </div>
                        </div>
                        <button class="sidebar-logout" onclick="StudentSidebar.logout()">
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
            const sidebar = document.getElementById('studentSidebar');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Load collapsed state from localStorage
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed && sidebar) {
                sidebar.classList.add('collapsed');
                if (toggleBtn) toggleBtn.textContent = '›';
            }
        },

        toggleSidebar() {
            const sidebar = document.getElementById('studentSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');

            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                
                if (toggleBtn) {
                    toggleBtn.textContent = isCollapsed ? '›' : '‹';
                }
                
                // Save state
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            }
        },

        initMobileMenu() {
            const mobileToggle = document.getElementById('mobileSidebarToggle');
            const sidebar = document.getElementById('studentSidebar');
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
                const userName = user.name || 'Student';
                
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
                if ((currentPage === 'student' || currentPage === '') && pageName === 'dashboard') {
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
            StudentSidebar.init();
        });
    } else {
        StudentSidebar.init();
    }

    // Expose globally
    window.StudentSidebar = StudentSidebar;
})();
