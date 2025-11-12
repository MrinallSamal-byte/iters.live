// Teacher Sidebar Navigation Handler
(function() {
    'use strict';

    const TeacherSidebar = {
        init() {
            this.createSidebar();
            this.setupEventListeners();
            this.loadUserInfo();
            this.setActivePage();
            this.initMobileMenu();
        },

        createSidebar() {
            const sidebarHTML = `
                <aside class="teacher-sidebar" id="teacherSidebar">
                    <button class="sidebar-toggle" id="sidebarToggle" title="Toggle Sidebar">
                        ‹
                    </button>
                    
                    <div class="sidebar-logo">
                        <img src="../assets/logo.png" alt="ITER Logo" class="sidebar-logo-img" onerror="this.style.display='none'">
                        <div class="sidebar-branding">
                            <span class="sidebar-title">ITER Portal</span>
                            <span class="sidebar-subtitle">Teacher Dashboard</span>
                        </div>
                    </div>

                    <nav class="sidebar-nav">
                        <ul class="sidebar-nav-list">
                            <li class="sidebar-nav-item">
                                <a href="teacher.html" class="sidebar-nav-link" data-page="dashboard">
                                    <span class="sidebar-nav-icon">🏠</span>
                                    <span class="sidebar-nav-text">Dashboard</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-attendance.html" class="sidebar-nav-link" data-page="attendance">
                                    <span class="sidebar-nav-icon">📊</span>
                                    <span class="sidebar-nav-text">Attendance</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-marks.html" class="sidebar-nav-link" data-page="marks">
                                    <span class="sidebar-nav-icon">📈</span>
                                    <span class="sidebar-nav-text">Marks</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-assignments.html" class="sidebar-nav-link" data-page="assignments">
                                    <span class="sidebar-nav-icon">📝</span>
                                    <span class="sidebar-nav-text">Assignments</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-notes.html" class="sidebar-nav-link" data-page="notes">
                                    <span class="sidebar-nav-icon">📚</span>
                                    <span class="sidebar-nav-text">Study Material</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-students.html" class="sidebar-nav-link" data-page="students">
                                    <span class="sidebar-nav-icon">👥</span>
                                    <span class="sidebar-nav-text">My Students</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-question-bank.html" class="sidebar-nav-link" data-page="question-bank">
                                    <span class="sidebar-nav-icon">❓</span>
                                    <span class="sidebar-nav-text">Question Bank</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-rubric-creator.html" class="sidebar-nav-link" data-page="rubric">
                                    <span class="sidebar-nav-icon">📋</span>
                                    <span class="sidebar-nav-text">Rubric Creator</span>
                                </a>
                            </li>
                            <li class="sidebar-nav-item">
                                <a href="teacher-timetable.html" class="sidebar-nav-link" data-page="timetable">
                                    <span class="sidebar-nav-icon">📅</span>
                                    <span class="sidebar-nav-text">My Timetable</span>
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div class="sidebar-footer">
                        <div class="sidebar-user">
                            <div class="sidebar-user-avatar" id="sidebarUserAvatar">T</div>
                            <div class="sidebar-user-info">
                                <div class="sidebar-user-name" id="sidebarUserName">Teacher</div>
                                <div class="sidebar-user-role">Faculty Portal</div>
                            </div>
                        </div>
                        <button class="sidebar-logout" onclick="TeacherSidebar.logout()">
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
            const sidebar = document.getElementById('teacherSidebar');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Load collapsed state from localStorage
            const isCollapsed = localStorage.getItem('teacherSidebarCollapsed') === 'true';
            if (isCollapsed && sidebar) {
                sidebar.classList.add('collapsed');
                if (toggleBtn) toggleBtn.textContent = '›';
            }
        },

        toggleSidebar() {
            const sidebar = document.getElementById('teacherSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');

            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                
                if (toggleBtn) {
                    toggleBtn.textContent = isCollapsed ? '›' : '‹';
                }
                
                // Save state
                localStorage.setItem('teacherSidebarCollapsed', isCollapsed);
            }
        },

        initMobileMenu() {
            const mobileToggle = document.getElementById('mobileSidebarToggle');
            const sidebar = document.getElementById('teacherSidebar');
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
                const userName = user.name || 'Teacher';
                
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
                if ((currentPage === 'teacher' || currentPage === '') && pageName === 'dashboard') {
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
            TeacherSidebar.init();
        });
    } else {
        TeacherSidebar.init();
    }

    // Expose globally
    window.TeacherSidebar = TeacherSidebar;
})();
