// ============================================
// UNIVERSAL SIDEBAR NAVIGATION
// For Student, Teacher & Admin Dashboards
// ============================================

(function() {
    'use strict';

    const UniversalSidebar = {
        currentRole: '',
        
        // Navigation menus for different roles
        menus: {
            student: [
                { icon: '🏠', text: 'Dashboard', href: 'student.html', page: 'dashboard' },
                { icon: '📊', text: 'Attendance', href: 'student-attendance.html', page: 'attendance' },
                { icon: '📈', text: 'Marks', href: 'student-marks.html', page: 'marks' },
                { icon: '📅', text: 'Timetable', href: 'student-timetable.html', page: 'timetable' },
                { icon: '📚', text: 'Study Notes', href: 'student-notes.html', page: 'notes' },
                { icon: '🎫', text: 'Admit Card', href: 'student-admit-card.html', page: 'admit-card' },
                { icon: '🎉', text: 'Events', href: 'student-events.html', page: 'events' },
                { icon: '🎪', text: 'Clubs', href: 'student-clubs.html', page: 'clubs' },
                { icon: '🍽️', text: 'Hostel Menu', href: 'student-hostel-menu.html', page: 'hostel' },
                { icon: '🚪', text: 'Logout', href: '#', page: 'logout' }
            ],
            teacher: [
                { icon: '🏠', text: 'Dashboard', href: 'teacher.html', page: 'dashboard' },
                { icon: '📊', text: 'Mark Attendance', href: 'teacher-attendance.html', page: 'attendance' },
                { icon: '📈', text: 'Upload Marks', href: 'teacher-marks.html', page: 'marks' },
                { icon: '📝', text: 'Assignments', href: 'teacher-assignments.html', page: 'assignments' },
                { icon: '📚', text: 'Study Material', href: 'teacher-notes.html', page: 'notes' },
                { icon: '🎯', text: 'Question Bank', href: 'teacher-question-bank.html', page: 'question-bank' },
                { icon: '📋', text: 'Rubric Creator', href: 'teacher-rubric-creator.html', page: 'rubric' },
                { icon: '👥', text: 'My Students', href: 'teacher-students.html', page: 'students' },
                { icon: '🚪', text: 'Logout', href: '#', page: 'logout' }
            ],
            admin: [
                { icon: '🏠', text: 'Dashboard', href: 'admin.html', page: 'dashboard' },
                { icon: '✅', text: 'Approvals', href: 'admin-approvals.html', page: 'approvals' },
                { icon: '👥', text: 'User Management', href: 'admin-users.html', page: 'users' },
                { icon: '📊', text: 'Analytics', href: 'admin-analytics.html', page: 'analytics' },
                { icon: '📢', text: 'Announcements', href: 'admin-announcements.html', page: 'announcements' },
                { icon: '🎓', text: 'Departments', href: 'admin-departments.html', page: 'departments' },
                { icon: '⚙️', text: 'Settings', href: 'admin-settings.html', page: 'settings' },
                { icon: '🚪', text: 'Logout', href: '#', page: 'logout' }
            ]
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
            const menuItems = this.menus[this.currentRole] || this.menus.student;
            const roleTitle = this.currentRole.charAt(0).toUpperCase() + this.currentRole.slice(1);
            
            const sidebarHTML = `
                <aside class="universal-sidebar" id="universalSidebar">
                    <button class="sidebar-toggle" id="sidebarToggle" title="Toggle Sidebar">
                        ‹
                    </button>
                    
                    <div class="sidebar-header">
                        <img src="../assets/logo.png" alt="ITER Logo" class="sidebar-logo" onerror="this.style.display='none'">
                        <div class="sidebar-branding">
                            <span class="sidebar-title">ITER Portal</span>
                            <span class="sidebar-subtitle">${roleTitle} Dashboard</span>
                        </div>
                    </div>

                    <nav class="sidebar-nav">
                        <ul class="sidebar-nav-list">
                            ${menuItems.map(item => `
                                <li class="sidebar-nav-item">
                                    <a href="${item.href}" class="sidebar-nav-link" data-page="${item.page}">
                                        <span class="sidebar-nav-icon">${item.icon}</span>
                                        <span class="sidebar-nav-text">${item.text}</span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                </aside>

                <!-- Mobile overlay -->
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
                
                <!-- Mobile toggle button -->
                <button class="mobile-sidebar-toggle" id="mobileSidebarToggle">
                    ☰
                </button>
            `;

            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        },

        createProfileIcon() {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
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
                                <li class="profile-dropdown-item">
                                    <a href="#" class="profile-dropdown-link" onclick="UniversalSidebar.openSettings(); return false;">
                                        <span class="profile-dropdown-icon">⚙️</span>
                                        <span>Settings</span>
                                    </a>
                                </li>
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
                if (toggleBtn) toggleBtn.textContent = '›';
            }
            // Wire Logout link in sidebar
            const logoutLink = document.querySelector('.sidebar-nav-link[data-page="logout"]');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }
        },

        toggleSidebar() {
            const sidebar = document.getElementById('universalSidebar');
            const toggleBtn = document.getElementById('sidebarToggle');

            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                
                if (toggleBtn) {
                    toggleBtn.textContent = isCollapsed ? '›' : '‹';
                }
                
                localStorage.setItem('sidebarCollapsed', isCollapsed);
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
                // User info is already set in createProfileIcon
            } catch (error) {
                console.error('Error loading user info:', error);
            }
        },

        setActivePage() {
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            const links = document.querySelectorAll('.sidebar-nav-link');

            links.forEach(link => {
                const pageName = link.getAttribute('data-page');
                
                if (currentPage === this.currentRole && pageName === 'dashboard') {
                    link.classList.add('active');
                } else if (currentPage.includes(pageName)) {
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
                        const token = localStorage.getItem('token');
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
                                try { localStorage.setItem('profilePicture', data.data.profile_pic); } catch {}
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
                display: flex; align-items: center; justify-content: center; z-index: 10000;`;

            const modal = document.createElement('div');
            modal.style.cssText = `
                width: 720px; max-width: 95vw; background: var(--card-bg, #0f172a);
                color: var(--text-primary, #e5e7eb); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
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
            canvas.style.cssText = 'width:100%; height:auto; border-radius:12px; background:#111827; display:block;';

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:10px; justify-content:flex-end; margin-top:12px;';
            actions.innerHTML = `
                <button id="idCardDownload" class="btn btn-primary" style="padding:10px 14px; border-radius:8px; border:none; background:#6366f1; color:white; cursor:pointer;">Download PNG</button>
                <button id="idCardPrint" class="btn" style="padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:inherit; cursor:pointer;">Print</button>
            `;

            modal.appendChild(header);
            modal.appendChild(canvas);
            modal.appendChild(actions);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Prevent background scroll
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            const close = () => {
                overlay.remove();
                document.body.style.overflow = prevOverflow || '';
            };
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            header.querySelector('#fallbackIdCardClose').addEventListener('click', close);
            document.addEventListener('keydown', function onEsc(ev){ if (ev.key === 'Escape'){ close(); document.removeEventListener('keydown', onEsc); } });

            // Draw the ID card on canvas
            const ctx = canvas.getContext('2d');
            const DPR = window.devicePixelRatio || 1;
            // Scale for crispness
            canvas.width = 640 * DPR; canvas.height = 360 * DPR; canvas.style.width = '100%';
            ctx.scale(DPR, DPR);

            // Background
            const grd = ctx.createLinearGradient(0,0,640,360);
            grd.addColorStop(0, '#111827');
            grd.addColorStop(1, '#1f2937');
            ctx.fillStyle = grd;
            ctx.fillRect(0,0,640,360);

            // Card panel
            const panelX = 24, panelY = 24, panelW = 592, panelH = 312, radius = 14;
            const roundRect = (x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); };
            ctx.fillStyle = '#0b1220';
            roundRect(panelX, panelY, panelW, panelH, radius);
            ctx.fill();

            // Header strip
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(panelX, panelY, panelW, 54);
            ctx.fillStyle = '#e5e7eb';
            ctx.font = 'bold 20px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
            ctx.fillText('ITER EduHub • ID Card', panelX + 16, panelY + 34);

            // Photo placeholder or image
            const photoX = panelX + 24, photoY = panelY + 74, photoSize = 96;
            const drawText = (text, x, y, opts={}) => { ctx.save(); ctx.fillStyle = opts.color || '#e5e7eb'; ctx.font = opts.font || '14px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; ctx.fillText(text, x, y); ctx.restore(); };

            const drawDetails = () => {
                // Labels and values
                drawText('Name', photoX + photoSize + 24, photoY + 6, { color: '#9ca3af' });
                drawText(name, photoX + photoSize + 24, photoY + 26, { font: 'bold 18px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' });
                drawText('Role', photoX + photoSize + 24, photoY + 56, { color: '#9ca3af' });
                drawText(role.charAt(0).toUpperCase() + role.slice(1), photoX + photoSize + 24, photoY + 76);
                drawText('Department', photoX + photoSize + 24, photoY + 106, { color: '#9ca3af' });
                drawText(dept, photoX + photoSize + 24, photoY + 126);
                drawText('Registration No.', photoX + photoSize + 24, photoY + 156, { color: '#9ca3af' });
                drawText(regNo, photoX + photoSize + 24, photoY + 176, { font: 'bold 16px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' });
                if (email) { drawText('Email', photoX + photoSize + 24, photoY + 206, { color: '#9ca3af' }); drawText(email, photoX + photoSize + 24, photoY + 226); }

                // Footer
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                roundRect(panelX + 16, panelY + panelH - 60, panelW - 32, 44, 10);
                ctx.fill();
                drawText('Generated by Universal Sidebar • ' + new Date().toLocaleDateString(), panelX + 28, panelY + panelH - 32, { color: '#9ca3af' });
            };

            const drawPhoto = () => {
                // Photo background
                ctx.fillStyle = '#111827';
                roundRect(photoX, photoY, photoSize, photoSize, 12);
                ctx.fill();
                // Border
                ctx.strokeStyle = 'rgba(99,102,241,0.6)';
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
                            roundRect(photoX+1, photoY+1, photoSize-2, photoSize-2, 10);
                            ctx.clip();
                            ctx.drawImage(img, photoX+1, photoY+1, photoSize-2, photoSize-2);
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
                    ctx.fillStyle = '#4b5563';
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
            
            // Prefer a common settings page if available
            const byRole = {
                student: '/settings.html',
                teacher: '/settings.html',
                admin: '/settings.html'
            };

            const target = byRole[this.currentRole] || '/settings.html';
            window.location.href = target;
        },

        logout() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) dropdown.classList.remove('show');
            
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
            UniversalSidebar.init();
        });
    } else {
        UniversalSidebar.init();
    }

    // Expose globally
    window.UniversalSidebar = UniversalSidebar;
})();
