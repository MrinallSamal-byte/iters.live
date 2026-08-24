// ============================================
// UNIVERSAL SIDEBAR NAVIGATION
// For Student, Teacher & Admin Dashboards
// ============================================

(function () {
    'use strict';

    // Minimal inline SVG icon set (16px, viewBox 24, stroke = currentColor).
    // Keyed by nav item `page`; items without a mapping fall back to a dot.
    const SIDEBAR_ICONS = (() => {
        const svg = (paths) => '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
        return {
            'dashboard': svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
            'attendance': svg('<circle cx="12" cy="12" r="8.75"/><path d="M8.25 12.3l2.5 2.5 5-5.2"/>'),
            'marks': svg('<path d="M5.5 20v-6"/><path d="M12 20V9.5"/><path d="M18.5 20V4.5"/>'),
            'timetable': svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
            'notes': svg('<path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18"/><path d="M9.75 12h4.5"/><path d="M9.75 15.5h4.5"/>'),
            'forum': svg('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9.5L4.5 20v-4A2.5 2.5 0 0 1 4 13.5z"/>'),
            'payments': svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10.25h18"/><path d="M6.5 15h4"/>'),
            'admit-card': svg('<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="12" cy="9.75" r="2.25"/><path d="M8 16.5c.7-1.9 2.2-2.85 4-2.85s3.3.95 4 2.85"/>'),
            'events': svg('<path d="M6 21V4"/><path d="M6 4.5h11.5L15 8l2.5 3.5H6"/>'),
            'clubs': svg('<circle cx="9" cy="8.5" r="3.25"/><path d="M3 19.5c.65-3.2 3-4.9 6-4.9s5.35 1.7 6 4.9"/><path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8"/><path d="M17.5 14.9c1.9.7 3.1 2.3 3.5 4.6"/>'),
            'hostel': svg('<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10.5 20v-5.5h3V20"/>'),
            'personal-info': svg('<path d="M20 11a8 8 0 0 0-14.6-3.2"/><path d="M4 13a8 8 0 0 0 14.6 3.2"/><path d="M5.5 3.5v4.3h4.3"/><path d="M18.5 20.5v-4.3h-4.3"/>'),
            'connect-portal': svg('<path d="M9.5 14.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.6l-1.2 1.2"/><path d="M14.5 9.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.6l1.2-1.2"/>'),
            'assignments': svg('<path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18"/><path d="M9.75 12.25h4.5"/><path d="M9.75 15.75h4.5"/>'),
            'question-bank': svg('<circle cx="12" cy="12" r="8.75"/><path d="M9.4 9.3a2.6 2.6 0 0 1 5.05.87c0 1.73-2.45 2.13-2.45 3.53"/><path d="M12 17.1h.01"/>'),
            'rubric': svg('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7.5 9l1.4 1.4 2.4-2.6"/><path d="M14 10h3"/><path d="M7.5 14.5l1.4 1.4 2.4-2.6"/><path d="M14 15.5h3"/>'),
            'students': svg('<circle cx="9" cy="8.5" r="3.25"/><path d="M3 19.5c.65-3.2 3-4.9 6-4.9s5.35 1.7 6 4.9"/><path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8"/><path d="M17.5 14.9c1.9.7 3.1 2.3 3.5 4.6"/>'),
            'users': svg('<circle cx="9" cy="8.5" r="3.25"/><path d="M3 19.5c.65-3.2 3-4.9 6-4.9s5.35 1.7 6 4.9"/><path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8"/><path d="M17.5 14.9c1.9.7 3.1 2.3 3.5 4.6"/>'),
            'analytics': svg('<path d="M4 4v16h16"/><path d="M8.5 15.5v-4"/><path d="M13 15.5V8"/><path d="M17.5 15.5v-6"/>'),
            'approvals': svg('<circle cx="12" cy="12" r="8.75"/><path d="M8.25 12.3l2.5 2.5 5-5.2"/>'),
            'announcements': svg('<path d="M4 10.5l13-5.5v14l-13-5.5z"/><path d="M7 12.4V17a1.75 1.75 0 0 0 3.5 0v-3.3"/><path d="M19.5 10a3 3 0 0 1 0 4"/>'),
            'departments': svg('<path d="M4.5 20V6l7-2.5V20"/><path d="M11.5 9.5l8 2.5v8"/><path d="M3.5 20h17"/><path d="M7 9.5h1.5"/><path d="M7 13h1.5"/><path d="M14.5 14.5H16"/><path d="M14.5 17.5H16"/>'),
            'settings': svg('<path d="M4 7.5h9"/><path d="M17 7.5h3"/><circle cx="15" cy="7.5" r="2"/><path d="M4 16.5h3"/><path d="M11 16.5h9"/><circle cx="9" cy="16.5" r="2"/>'),
            'logout': svg('<path d="M9.5 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.5"/><path d="M15.5 16.5L20 12l-4.5-4.5"/><path d="M20 12H9.5"/>')
        };
    })();

    const UniversalSidebar = {
        currentRole: '',
        lastSidebarNavTouchAt: 0,
        sidebarNavClickSuppressedUntil: 0,

        // Navigation menus for different roles.
        // Student menu is grouped into sections rendered with mono micro-labels;
        // teacher/admin keep their flat order (no grouping).
        menus: {
            student: [
                {
                    section: 'ACADEMIC',
                    items: [
                        { text: 'Dashboard', href: '/dashboard/student.html', page: 'dashboard' },
                        { text: 'Attendance', href: '/dashboard/student-attendance.html', page: 'attendance' },
                        { text: 'Marks', href: '/dashboard/student-marks.html', page: 'marks' },
                        { text: 'Timetable', href: '/dashboard/student-timetable.html', page: 'timetable' },
                        { text: 'Admit Card', href: '/dashboard/student-admit-card.html', page: 'admit-card' }
                    ]
                },
                {
                    section: 'CAMPUS',
                    items: [
                        { text: 'Study Notes', href: '/dashboard/student-notes.html', page: 'notes' },
                        { text: 'Forum', href: '/dashboard/student-forum.html', page: 'forum' },
                        { text: 'Events', href: '/dashboard/student-events.html', page: 'events' },
                        { text: 'Clubs', href: '/dashboard/student-clubs.html', page: 'clubs' },
                        { text: 'Hostel Menu', href: '/dashboard/student-hostel-menu.html', page: 'hostel' },
                        { text: 'Payments', href: '/dashboard/student-payment-history.html', page: 'payments' }
                    ]
                },
                {
                    section: 'ACCOUNT',
                    items: [
                        { text: 'SOA Data', href: '/dashboard/student-personal-info.html', page: 'personal-info' },
                        { text: 'Connect SOA Portal', href: '/connect-portal.html', page: 'connect-portal' },
                        { text: 'Logout', href: '#', page: 'logout' }
                    ]
                }
            ],
            teacher: [
                { text: 'Dashboard', href: '/dashboard/teacher.html', page: 'dashboard' },
                { text: 'Mark Attendance', href: '/dashboard/teacher-attendance.html', page: 'attendance' },
                { text: 'Upload Marks', href: '/dashboard/teacher-marks.html', page: 'marks' },
                { text: 'Assignments', href: '/dashboard/teacher-assignments.html', page: 'assignments' },
                { text: 'Study Material', href: '/dashboard/teacher-notes.html', page: 'notes' },
                { text: 'Question Bank', href: '/dashboard/teacher-question-bank.html', page: 'question-bank' },
                { text: 'Rubric Creator', href: '/dashboard/teacher-rubric-creator.html', page: 'rubric' },
                { text: 'My Students', href: '/dashboard/teacher-students.html', page: 'students' },
                { text: 'Logout', href: '#', page: 'logout' }
            ],
            admin: [
                { text: 'Dashboard', href: '/dashboard/admin.html', page: 'dashboard' },
                { text: 'Approvals', href: '/dashboard/admin-approvals.html', page: 'approvals' },
                { text: 'User Management', href: '/dashboard/admin-users.html', page: 'users' },
                { text: 'Analytics', href: '/dashboard/admin-analytics.html', page: 'analytics' },
                { text: 'Announcements', href: '/dashboard/admin-announcements.html', page: 'announcements' },
                { text: 'Departments', href: '/dashboard/admin-departments.html', page: 'departments' },
                { text: 'Settings', href: '/dashboard/admin-settings.html', page: 'settings' },
                { text: 'Logout', href: '#', page: 'logout' }
            ]
        },

        /**
         * Normalize a role menu into a list of sections:
         * grouped configs pass through; flat lists become a single unlabelled section.
         */
        getMenuSections(role) {
            const menu = this.menus[role] || this.menus.student;
            if (menu.length && Array.isArray(menu[0].items)) {
                return menu;
            }
            return [{ section: null, items: menu }];
        },

        /**
         * Resolve the icon markup for a nav item page key.
         * Falls back to a plain dot when no SVG is mapped.
         */
        getNavIcon(page) {
            const icon = SIDEBAR_ICONS[page];
            if (icon) {
                return `<span class="sidebar-nav-icon" aria-hidden="true">${icon}</span>`;
            }
            return '<span class="sidebar-nav-icon" aria-hidden="true">&middot;</span>';
        },

        init() {
            this.detectRole();
            // Ensure the universal (student-style) profile control is present everywhere
            this.ensureUniversalProfile();

            this.createSidebar();
            // Avoid duplicate top-right profile if global profile control exists
            const hasGlobalProfile = document.getElementById('profileAvatarBtn') || document.querySelector('.profile-control-wrapper');
            if (!hasGlobalProfile) {
                this.createProfileIcon();
            }
            // If global profile control loads later, remove local profile
            window.addEventListener('profileControlLoaded', () => {
                const localTopProfile = document.querySelector('.top-profile-container');
                if (localTopProfile) localTopProfile.remove();
            });
            this.setupEventListeners();
            this.loadUserInfo();
            this.setActivePage();
            this.initMobileMenu();
            // Restore sidebar scroll position
            this.restoreScrollPosition();
            // Save scroll position on navigation
            this.setupScrollPositionSaving();
        },

        /**
         * Restore sidebar scroll position from sessionStorage
         */
        restoreScrollPosition() {
            try {
                const sidebar = document.getElementById('universalSidebar');
                if (sidebar) {
                    const savedScrollPosition = sessionStorage.getItem('sidebarScrollPosition');
                    if (savedScrollPosition) {
                        const sidebarNav = sidebar.querySelector('.sidebar-nav');
                        if (sidebarNav) {
                            sidebarNav.scrollTop = parseInt(savedScrollPosition, 10);
                        }
                    }
                }
            } catch (e) {
                // sessionStorage may be disabled or quota exceeded
                console.warn('Could not restore sidebar scroll position:', e);
            }
        },

        /**
         * Setup scroll position saving for sidebar navigation
         */
        setupScrollPositionSaving() {
            const sidebar = document.getElementById('universalSidebar');
            if (sidebar) {
                const sidebarNav = sidebar.querySelector('.sidebar-nav');
                if (sidebarNav) {
                    // Save scroll position on scroll
                    sidebarNav.addEventListener('scroll', () => {
                        try {
                            sessionStorage.setItem('sidebarScrollPosition', sidebarNav.scrollTop.toString());
                        } catch (e) {
                            // Ignore storage errors
                        }
                    });
                }
            }

            // Save scroll position before navigating away
            window.addEventListener('beforeunload', () => {
                try {
                    const sidebar = document.getElementById('universalSidebar');
                    if (sidebar) {
                        const sidebarNav = sidebar.querySelector('.sidebar-nav');
                        if (sidebarNav) {
                            sessionStorage.setItem('sidebarScrollPosition', sidebarNav.scrollTop.toString());
                        }
                    }
                } catch (e) {
                    // Ignore storage errors
                }
            });

            // Also save on link click
            document.querySelectorAll('.sidebar-nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    try {
                        const sidebar = document.getElementById('universalSidebar');
                        if (sidebar) {
                            const sidebarNav = sidebar.querySelector('.sidebar-nav');
                            if (sidebarNav) {
                                sessionStorage.setItem('sidebarScrollPosition', sidebarNav.scrollTop.toString());
                            }
                        }
                    } catch (e) {
                        // Ignore storage errors
                    }
                });
            });
        },

        /**
         * Ensure universal (student dashboard) profile icon is loaded.
         * Loads ../js/universal-profile.js once per page if not already present.
         */
        ensureUniversalProfile() {
            // If already initialized by script or container exists, do nothing
            if (window.UniversalProfile || document.getElementById('universalProfileContainer')) return;

            // Avoid double-inserting the script
            const existing = Array.from(document.scripts).some(s => (s.getAttribute('src') || '').includes('universal-profile.js'));
            if (existing) return;

            try {
                const script = document.createElement('script');
                // Use absolute path so it works from any page location
                script.src = '/js/universal-profile.js';
                script.defer = true;
                document.head.appendChild(script);
            } catch (e) {
                // Non-fatal: page will fall back to local icon created below
                console.warn('Failed to auto-load universal profile script:', e);
            }
        },

        detectRole() {
            // Detect role from current page or localStorage
            const currentPage = window.location.pathname.split('/').pop();

            if (currentPage.startsWith('student')) {
                this.currentRole = 'student';
            } else if (currentPage.startsWith('teacher')) {
                this.currentRole = 'teacher';
            } else if (currentPage.startsWith('admin')) {
                this.currentRole = 'admin';
            } else {
                // Fallback to user data
                try {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    this.currentRole = user.role || 'student';
                } catch (error) {
                    this.currentRole = 'student';
                }
            }
        },

        createSidebar() {
            const menuSections = this.getMenuSections(this.currentRole);
            const roleTitle = this.currentRole.charAt(0).toUpperCase() + this.currentRole.slice(1);
            const isDemoMode = (localStorage.getItem('prototypeMode') || '').toString() === 'true';

            const renderItems = (items) => items.map(item => `
                                <li class="sidebar-nav-item">
                                    <a href="${item.href}" class="sidebar-nav-link" data-page="${item.page}">
                                        ${this.getNavIcon(item.page)}
                                        <span class="sidebar-nav-text">${item.text}</span>
                                    </a>
                                </li>
                            `).join('');

            const renderSections = menuSections.map(section => {
                if (section.section) {
                    return `
                            <li class="sidebar-nav-section" aria-hidden="true">
                                <span class="sidebar-nav-section-label">${section.section}</span>
                            </li>
                            ${renderItems(section.items)}`;
                }
                return renderItems(section.items);
            }).join('');

            const sidebarHTML = `
                <aside class="universal-sidebar" id="universalSidebar">
                    <div class="sidebar-header">
                        <img src="/assets/soa-logo.png" alt="ITER Logo" class="sidebar-logo">
                        <div class="sidebar-branding">
                            <span class="sidebar-title">ITERasn hub</span>
                            <span class="sidebar-subtitle">${roleTitle} Dashboard</span>
                        </div>
                        <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-controls="universalSidebar" aria-expanded="true" aria-label="Collapse sidebar" title="Collapse sidebar">
                            <span class="sidebar-toggle-icon" aria-hidden="true">←</span>
                        </button>
                    </div>

                    <nav class="sidebar-nav">
                        ${isDemoMode ? `
                            <div class="sidebar-mode-pill" title="Local demo session is active">
                                <span class="sidebar-mode-dot"></span>
                                <span class="sidebar-mode-text">Demo Mode</span>
                            </div>
                        ` : ''}
                        <ul class="sidebar-nav-list">
                            ${renderSections}
                        </ul>
                    </nav>
                </aside>

                <!-- Mobile overlay -->
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
                
                <!-- Mobile toggle button -->
                <button class="mobile-sidebar-toggle" id="mobileSidebarToggle" type="button" aria-controls="universalSidebar" aria-expanded="false" aria-label="Open sidebar menu">
                    ☰
                </button>
            `;

            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        },

        createProfileIcon() {
            let user = {};
            try {
                user = JSON.parse(localStorage.getItem('user') || '{}');
            } catch (e) {
                user = {};
            }
            const userName = user.name || 'User';
            const userInitial = userName.charAt(0).toUpperCase();
            const roleText = this.currentRole.charAt(0).toUpperCase() + this.currentRole.slice(1);

            const profileHTML = `
                <div class="top-profile-container">
                    <div class="profile-icon-wrapper">
                        <div class="profile-icon" id="profileIcon" title="${userName}">
                            ${user.profile_picture ?
                    `<img src="${user.profile_picture}" alt="${userName}">` :
                    userInitial
                }
                        </div>
                        <div class="profile-dropdown" id="profileDropdown">
                            <div class="profile-dropdown-header">
                                <div class="profile-dropdown-name">${userName}</div>
                                <div class="profile-dropdown-role">${roleText}</div>
                            </div>
                            <ul class="profile-dropdown-menu">
                                <li class="profile-dropdown-item">
                                    <a href="#" class="profile-dropdown-link" onclick="UniversalSidebar.changeProfilePicture(); return false;">
                                        <span class="profile-dropdown-icon">📷</span>
                                        <span>Change Profile Picture</span>
                                    </a>
                                </li>
                                <li class="profile-dropdown-item">
                                    <a href="#" class="profile-dropdown-link" onclick="UniversalSidebar.showIDCard(); return false;">
                                        <span class="profile-dropdown-icon">🆔</span>
                                        <span>Show ID Card</span>
                                    </a>
                                </li>
                                ${this.currentRole === 'admin' ? `
                                <li class="profile-dropdown-item">
                                    <a href="#" class="profile-dropdown-link" onclick="UniversalSidebar.openSettings(); return false;">
                                        <span class="profile-dropdown-icon">⚙️</span>
                                        <span>Settings</span>
                                    </a>
                                </li>
                                ` : ''}
                                <div class="profile-dropdown-divider"></div>
                                <li class="profile-dropdown-item">
                                    <a href="#" class="profile-dropdown-link danger" onclick="UniversalSidebar.logout(); return false;">
                                        <span class="profile-dropdown-icon">🚪</span>
                                        <span>Logout</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', profileHTML);
        },

        setupEventListeners() {
            const toggleBtn = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('universalSidebar');
            const profileIcon = document.getElementById('profileIcon');
            const profileDropdown = document.getElementById('profileDropdown');

            // Sidebar toggle
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Profile dropdown toggle
            if (profileIcon && profileDropdown) {
                profileIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    profileDropdown.classList.toggle('show');
                });

                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!profileDropdown.contains(e.target) && !profileIcon.contains(e.target)) {
                        profileDropdown.classList.remove('show');
                    }
                });
            }

            // Load collapsed state from localStorage
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed && sidebar) {
                sidebar.classList.add('collapsed');
            }
            this.syncSidebarState();

            // Wire Logout link in sidebar
            const logoutLink = document.querySelector('.sidebar-nav-link[data-page="logout"]');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }

            this.setupNavigationHandlers();

            window.addEventListener('resize', () => {
                this.syncSidebarState();

                if (window.innerWidth > 1023) {
                    const overlay = document.getElementById('sidebarOverlay');
                    if (sidebar) sidebar.classList.remove('mobile-open');
                    if (overlay) overlay.classList.remove('active');
                }
            });
        },

        setupNavigationHandlers() {
            document.querySelectorAll('.sidebar-nav-link').forEach((link) => {
                if (link.dataset.page === 'logout') {
                    return;
                }

                let touchGesture = null;

                const handleNavigate = (event) => {
                    const href = link.getAttribute('href');
                    if (!href || href === '#') {
                        return;
                    }

                    if (event.type === 'touchstart') {
                        const point = event.touches?.[0];
                        touchGesture = point ? {
                            startX: point.clientX,
                            startY: point.clientY,
                            moved: false
                        } : null;
                        return;
                    }

                    if (event.type === 'touchmove') {
                        const point = event.touches?.[0];
                        if (!touchGesture || !point) {
                            return;
                        }

                        const deltaX = Math.abs(point.clientX - touchGesture.startX);
                        const deltaY = Math.abs(point.clientY - touchGesture.startY);
                        if (deltaX > 10 || deltaY > 10) {
                            touchGesture.moved = true;
                            this.sidebarNavClickSuppressedUntil = Date.now() + 400;
                        }
                        return;
                    }

                    if (event.type === 'touchcancel') {
                        touchGesture = null;
                        this.sidebarNavClickSuppressedUntil = Date.now() + 400;
                        return;
                    }

                    if (event.type === 'click') {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                            return;
                        }

                        if (Date.now() < this.sidebarNavClickSuppressedUntil) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            return;
                        }

                        if (Date.now() - this.lastSidebarNavTouchAt < 500) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            return;
                        }
                    }

                    if (event.type === 'touchend') {
                        const wasDragging = Boolean(touchGesture?.moved);
                        touchGesture = null;

                        if (wasDragging) {
                            this.sidebarNavClickSuppressedUntil = Date.now() + 400;
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            return;
                        }

                        this.lastSidebarNavTouchAt = Date.now();
                    }

                    event.preventDefault();
                    event.stopImmediatePropagation();

                    this.closeMobileSidebar();
                    this.navigateWithinApp(href);
                };

                link.addEventListener('touchstart', handleNavigate, { passive: true });
                link.addEventListener('touchmove', handleNavigate, { passive: true });
                link.addEventListener('touchcancel', handleNavigate, { passive: true });
                link.addEventListener('click', handleNavigate);
                link.addEventListener('touchend', handleNavigate, { passive: false });
            });
        },

        toggleSidebar() {
            const sidebar = document.getElementById('universalSidebar');

            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
                this.syncSidebarState();
            }
        },

        syncSidebarState() {
            const sidebar = document.getElementById('universalSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');
            const mobileToggleBtn = document.getElementById('mobileSidebarToggle');

            if (!sidebar) return;

            const isCollapsed = sidebar.classList.contains('collapsed');
            const isMobile = window.innerWidth <= 1023;

            if (toggleBtn) {
                const icon = toggleBtn.querySelector('.sidebar-toggle-icon');
                toggleBtn.classList.toggle('is-collapsed', isCollapsed);
                toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
                toggleBtn.setAttribute('aria-label', isCollapsed ? 'Open sidebar' : 'Collapse sidebar');
                toggleBtn.setAttribute('title', isCollapsed ? 'Open sidebar' : 'Collapse sidebar');
                toggleBtn.hidden = isMobile;
                if (icon) {
                    icon.textContent = isCollapsed ? '→' : '←';
                }
            }

            if (mobileToggleBtn) {
                const isMobileOpen = sidebar.classList.contains('mobile-open');
                mobileToggleBtn.setAttribute('aria-expanded', String(isMobile && isMobileOpen));
                mobileToggleBtn.setAttribute('aria-label', isMobileOpen ? 'Close sidebar menu' : 'Open sidebar menu');
            }
        },

        initMobileMenu() {
            const mobileToggle = document.getElementById('mobileSidebarToggle');
            const sidebar = document.getElementById('universalSidebar');
            const overlay = document.getElementById('sidebarOverlay');

            if (mobileToggle) {
                mobileToggle.addEventListener('click', () => {
                    if (sidebar) sidebar.classList.add('mobile-open');
                    if (overlay) overlay.classList.add('active');
                    this.syncSidebarState();
                });
            }

            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.closeMobileSidebar();
                });
            }

        },

        closeMobileSidebar() {
            const sidebar = document.getElementById('universalSidebar');
            const overlay = document.getElementById('sidebarOverlay');

            if (window.innerWidth <= 1023) {
                if (sidebar) sidebar.classList.remove('mobile-open');
                if (overlay) overlay.classList.remove('active');
            }

            this.syncSidebarState();
        },

        loadUserInfo() {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                // User info is already set in createProfileIcon
            } catch (error) {
                console.error('Error loading user info:', error);
            }
        },

        /**
         * Build a data-page -> filename (no extension) map from the active
         * role's nav config so active states match exactly.
         */
        getPageFileMap() {
            const map = {};
            this.getMenuSections(this.currentRole).forEach(section => {
                section.items.forEach(item => {
                    if (!item.page || !item.href || item.href === '#') return;
                    const file = item.href.split('/').pop().replace(/\.html.*$/, '');
                    if (file) map[item.page] = file;
                });
            });
            return map;
        },

        setActivePage() {
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            const pageFiles = this.getPageFileMap();
            const links = document.querySelectorAll('.sidebar-nav-link');

            links.forEach(link => {
                const pageName = link.getAttribute('data-page');
                let isActive = false;

                if (!pageName) {
                    isActive = false;
                } else if (currentPage === this.currentRole && pageName === 'dashboard') {
                    // Role root page, e.g. /dashboard/student.html -> "student"
                    isActive = true;
                } else if (pageFiles[pageName] && pageFiles[pageName] === currentPage) {
                    // Exact match against the nav config hrefs
                    isActive = true;
                } else if (currentPage.startsWith(pageName)) {
                    // Safe fallback for sub-pages that extend a nav page name
                    isActive = true;
                }

                if (isActive) {
                    link.classList.add('active');
                }
            });
        },

        // Profile Actions
        changeProfilePicture() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) dropdown.classList.remove('show');

            // Create file input dynamically
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Enforce server-side 2MB limit proactively
                    const MAX = 2 * 1024 * 1024;
                    if (file.size > MAX) {
                        if (typeof Toast !== 'undefined') {
                            Toast.error('File too large. Max 2MB.');
                        } else {
                            alert('File too large. Max 2MB.');
                        }
                        return;
                    }

                    const formData = new FormData();
                    // Server expects the field name 'avatar'
                    formData.append('avatar', file);

                    try {
                        const token = APP.Storage.get('accessToken');
                        const response = await fetch('/api/profile/photo', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            body: formData
                        });

                        const data = await response.json().catch(() => ({}));
                        if (response.ok && data && data.success) {
                            // Persist returned URL for consistent display across pages
                            if (data.data && data.data.profile_pic) {
                                try { localStorage.setItem('profilePicture', data.data.profile_pic); } catch { }
                            }
                            if (typeof Toast !== 'undefined') {
                                Toast.success('Profile picture updated successfully!');
                            }
                            // Refresh page to show new picture
                            setTimeout(() => window.location.reload(), 1000);
                        } else {
                            const msg = (data && (data.error || data.message)) || 'Failed to upload profile picture';
                            if (typeof Toast !== 'undefined') {
                                Toast.error(msg);
                            } else {
                                alert(msg);
                            }
                        }
                    } catch (error) {
                        console.error('Error uploading picture:', error);
                        if (typeof Toast !== 'undefined') {
                            Toast.error('Failed to upload profile picture');
                        }
                    }
                }
            };
            input.click();
        },

        showIDCard() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) dropdown.classList.remove('show');

            // Open the actual ID Card modal via ProfileControl if available
            try {
                if (window.profileControl && typeof window.profileControl.openIdCardModal === 'function') {
                    window.profileControl.openIdCardModal();
                    return;
                }

                // Fallback: open modal if present in DOM
                const modal = document.getElementById('idCardModal');
                if (modal) {
                    modal.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden';
                    if (window.profileControl && typeof window.profileControl.loadAdmitCard === 'function') {
                        window.profileControl.loadAdmitCard();
                    }
                    return;
                }
            } catch (e) {
                console.warn('Failed to open ID Card modal:', e);
            }
            // Final fallback: build and show a lightweight ID Card modal
            this.openFallbackIdCard();
        },

        openFallbackIdCard() {
            // Remove any existing fallback modal
            const existing = document.getElementById('fallbackIdCardOverlay');
            if (existing) existing.remove();

            const user = (() => {
                try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
            })();

            const name = user.name || user.full_name || user.fullName || 'User';
            const role = (user.role || 'User').toString();
            const regNo = user.reg_no || user.registration_no || user.registrationNumber || user.regNumber || user.id || user._id || 'N/A';
            const dept = user.department || user.dept || user.branch || '—';
            const email = user.email || user.contact_email || '';
            const photo = user.profile_picture || user.photo || '';

            // Create overlay and modal container
            const overlay = document.createElement('div');
            overlay.id = 'fallbackIdCardOverlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center; z-index: 10020;`;

            const modal = document.createElement('div');
            modal.style.cssText = `
                width: 720px; max-width: 95vw; background: var(--card-bg, #141414);
                color: var(--text-primary, #f6f3ee); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                padding: 20px 24px;`;

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;';
            header.innerHTML = `
                <div style="font-weight:700; font-size:18px;">ID Card Preview</div>
                <button id="fallbackIdCardClose" style="background:transparent; border:none; color:inherit; font-size:18px; cursor:pointer;">✕</button>
            `;

            const canvas = document.createElement('canvas');
            canvas.id = 'idCardCanvas';
            canvas.width = 640;
            canvas.height = 360;
            canvas.style.cssText = 'width:100%; height:auto; border-radius:12px; background:#0a0a0a; border:1px solid rgba(255,255,255,0.08); display:block;';

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:10px; justify-content:flex-end; margin-top:12px;';
            actions.innerHTML = `
                <button id="idCardDownload" class="btn btn-primary" style="padding:10px 14px; border-radius:8px; border:none; background:#d71921; color:white; cursor:pointer;">Download PNG</button>
                <button id="idCardPrint" class="btn" style="padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:inherit; cursor:pointer;">Print</button>
            `;

            modal.appendChild(header);
            modal.appendChild(canvas);
            modal.appendChild(actions);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            document.body.classList.add('app-overlay-open');
            if (typeof window.syncAppOverlayState === 'function') {
                window.syncAppOverlayState();
            }

            // Prevent background scroll
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            const close = () => {
                overlay.remove();
                document.body.style.overflow = prevOverflow || '';
                if (typeof window.syncAppOverlayState === 'function') {
                    window.syncAppOverlayState();
                } else {
                    document.body.classList.remove('app-overlay-open');
                }
            };
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            header.querySelector('#fallbackIdCardClose').addEventListener('click', close);
            document.addEventListener('keydown', function onEsc(ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });

            // Draw the ID card on canvas
            const ctx = canvas.getContext('2d');
            const DPR = window.devicePixelRatio || 1;
            // Scale for crispness
            canvas.width = 640 * DPR; canvas.height = 360 * DPR; canvas.style.width = '100%';
            ctx.scale(DPR, DPR);

            // Brand palette - respects the app theme flag (body.light-theme, as used by main.js)
            const isLightTheme = document.body.classList.contains('light-theme');
            const palette = isLightTheme ? {
                bg: '#f4efe7',
                panel: '#ffffff',
                accent: '#d71921',
                onAccent: '#ffffff',
                text: '#161616',
                muted: 'rgba(22,22,22,0.55)',
                photoBg: '#ebe4da',
                footerBg: 'rgba(19,19,19,0.05)'
            } : {
                bg: '#0a0a0a',
                panel: '#141414',
                accent: '#d71921',
                onAccent: '#ffffff',
                text: '#f6f3ee',
                muted: 'rgba(246,243,238,0.55)',
                photoBg: '#1e1e1e',
                footerBg: 'rgba(255,255,255,0.06)'
            };

            // Background (flat near-black / warm off-white)
            ctx.fillStyle = palette.bg;
            ctx.fillRect(0, 0, 640, 360);

            // Card panel
            const panelX = 24, panelY = 24, panelW = 592, panelH = 312, radius = 14;
            const roundRect = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.closePath(); };
            ctx.fillStyle = palette.panel;
            roundRect(panelX, panelY, panelW, panelH, radius);
            ctx.fill();

            // Header strip
            ctx.fillStyle = palette.accent;
            ctx.fillRect(panelX, panelY, panelW, 54);
            ctx.fillStyle = palette.onAccent;
            ctx.font = 'bold 20px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
            ctx.fillText('ITERasn hub • ID Card', panelX + 16, panelY + 34);

            // Photo placeholder or image
            const photoX = panelX + 24, photoY = panelY + 74, photoSize = 96;
            const drawText = (text, x, y, opts = {}) => { ctx.save(); ctx.fillStyle = opts.color || palette.text; ctx.font = opts.font || '14px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; ctx.fillText(text, x, y); ctx.restore(); };

            const drawDetails = () => {
                // Labels and values
                drawText('Name', photoX + photoSize + 24, photoY + 6, { color: palette.muted });
                drawText(name, photoX + photoSize + 24, photoY + 26, { font: 'bold 18px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' });
                drawText('Role', photoX + photoSize + 24, photoY + 56, { color: palette.muted });
                drawText(role.charAt(0).toUpperCase() + role.slice(1), photoX + photoSize + 24, photoY + 76);
                drawText('Department', photoX + photoSize + 24, photoY + 106, { color: palette.muted });
                drawText(dept, photoX + photoSize + 24, photoY + 126);
                drawText('Registration No.', photoX + photoSize + 24, photoY + 156, { color: palette.muted });
                drawText(regNo, photoX + photoSize + 24, photoY + 176, { font: 'bold 16px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' });
                if (email) { drawText('Email', photoX + photoSize + 24, photoY + 206, { color: palette.muted }); drawText(email, photoX + photoSize + 24, photoY + 226); }

                // Footer
                ctx.fillStyle = palette.footerBg;
                roundRect(panelX + 16, panelY + panelH - 60, panelW - 32, 44, 10);
                ctx.fill();
                drawText('Generated by Universal Sidebar • ' + new Date().toLocaleDateString(), panelX + 28, panelY + panelH - 32, { color: palette.muted });
            };

            const drawPhoto = () => {
                // Photo background
                ctx.fillStyle = palette.photoBg;
                roundRect(photoX, photoY, photoSize, photoSize, 12);
                ctx.fill();
                // Border
                ctx.strokeStyle = palette.accent;
                ctx.lineWidth = 2;
                roundRect(photoX, photoY, photoSize, photoSize, 12);
                ctx.stroke();
            };

            const render = async () => {
                drawPhoto();
                if (photo) {
                    try {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            // Draw image clipped into rounded rect
                            ctx.save();
                            roundRect(photoX + 1, photoY + 1, photoSize - 2, photoSize - 2, 10);
                            ctx.clip();
                            ctx.drawImage(img, photoX + 1, photoY + 1, photoSize - 2, photoSize - 2);
                            ctx.restore();
                            drawDetails();
                        };
                        img.onerror = () => { drawDetails(); };
                        img.src = photo;
                    } catch {
                        drawDetails();
                    }
                } else {
                    // Placeholder avatar initials
                    ctx.fillStyle = palette.muted;
                    ctx.font = 'bold 42px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
                    const initial = (name || 'U').charAt(0).toUpperCase();
                    ctx.fillText(initial, photoX + 32, photoY + 66);
                    drawDetails();
                }
            };
            render();

            // Actions
            actions.querySelector('#idCardDownload').addEventListener('click', () => {
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    const safeName = name.replace(/[^a-z0-9_\-]/gi, '_');
                    a.href = dataUrl;
                    a.download = `ID_Card_${safeName}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } catch (err) {
                    console.error('Download failed:', err);
                    if (typeof Toast !== 'undefined') Toast.error('Failed to download. Try Print instead.');
                }
            });

            actions.querySelector('#idCardPrint').addEventListener('click', () => {
                const dataUrl = canvas.toDataURL('image/png');
                const w = window.open('', '_blank', 'width=800,height=600');
                if (!w) return;
                w.document.write(`<!DOCTYPE html><html><head><title>Print ID Card</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;background:#fff}img{max-width:100%;}</style></head><body><img src="${dataUrl}" onload="window.print(); setTimeout(()=>window.close(), 300);" /></body></html>`);
                w.document.close();
            });
        },

        openSettings() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) dropdown.classList.remove('show');

            // Only /dashboard/admin-settings.html exists; students/teachers have
            // no settings page yet, so omit the entry entirely for them.
            // ponytail: role-specific settings pages -> link them here once built
            if (this.currentRole !== 'admin') return;

            const target = '/dashboard/admin-settings.html';

            // Use encoded URL for navigation
            if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
                window.LinkEncoding.navigateTo(target);
            } else {
                window.location.href = target;
            }
        },

        navigateWithinApp(target) {
            if (!target) return;

            const isDashboardRoute = target.startsWith('/dashboard/') || target.includes('/dashboard/');
            if (isDashboardRoute) {
                if (typeof APP !== 'undefined' && typeof APP.navigateToDashboard === 'function') {
                    APP.navigateToDashboard(target);
                    return;
                }

                if (window.PageAccessToken && typeof window.PageAccessToken.createPageAccessToken === 'function') {
                    window.PageAccessToken.createPageAccessToken(target);
                }
            }

            if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
                window.LinkEncoding.navigateTo(target);
            } else {
                window.location.href = target;
            }
        },

        logout() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) dropdown.classList.remove('show');

            if (confirm('Are you sure you want to logout?')) {
                // Use APP.logout if available (already uses encoded URLs)
                if (typeof APP !== 'undefined' && typeof APP.logout === 'function') {
                    APP.logout();
                } else if (window.SessionTimeout && typeof window.SessionTimeout.logout === 'function') {
                    // Use SessionTimeout.logout for proper cleanup
                    window.SessionTimeout.logout('user_initiated');
                } else {
                    // Fallback logout - redirect to landing page
                    localStorage.removeItem('token');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    sessionStorage.clear();
                    
                    // Store logout reason
                    try {
                        sessionStorage.setItem('logoutReason', 'user_initiated');
                    } catch (e) {
                        // Ignore
                    }
                    
                    // Use encoded URL for navigation to landing page
                    if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
                        window.LinkEncoding.navigateTo('/index.html');
                    } else {
                        window.location.href = '/index.html';
                    }
                }
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            UniversalSidebar.init();
        });
    } else {
        UniversalSidebar.init();
    }

    // Expose globally
    window.UniversalSidebar = UniversalSidebar;
})();
