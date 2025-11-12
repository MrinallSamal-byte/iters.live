/**
 * Dashboard Enhanced Features
 * Handles theme toggle and profile dropdown functionality
 */

(function() {
    'use strict';
    
    console.log('🎨 Loading Dashboard Enhanced Features...');
    
    // ===== THEME TOGGLE FUNCTIONALITY =====
    class ThemeManager {
        constructor() {
            this.currentTheme = localStorage.getItem('theme') || 'dark';
            this.init();
        }
        
        init() {
            // Apply saved theme
            this.applyTheme(this.currentTheme);
            
            // Create theme toggle button
            this.createThemeToggle();
            
            console.log('✅ Theme Manager initialized:', this.currentTheme);
        }
        
        createThemeToggle() {
            const navUser = document.querySelector('.nav-user');
            if (!navUser) return;
            
            // Check if toggle already exists
            if (document.getElementById('themeToggle')) return;
            
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'themeToggle';
            toggleBtn.className = 'theme-toggle-btn';
            toggleBtn.setAttribute('aria-label', 'Toggle theme');
            toggleBtn.innerHTML = `
                <span class="icon sun-icon" aria-hidden="true">☀️</span>
                <span class="icon moon-icon" aria-hidden="true">🌙</span>
            `;
            
            toggleBtn.addEventListener('click', () => this.toggleTheme());
            
            // Insert before profile controls
            const profileContainer = navUser.querySelector('#top-right-profile-container');
            if (profileContainer) {
                navUser.insertBefore(toggleBtn, profileContainer);
            } else {
                navUser.insertBefore(toggleBtn, navUser.firstChild);
            }
        }
        
        toggleTheme() {
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme(this.currentTheme);
            localStorage.setItem('theme', this.currentTheme);
            
            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
            
            console.log('🎨 Theme switched to:', this.currentTheme);
        }
        
        applyTheme(theme) {
            if (theme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        }
    }
    
    // ===== PROFILE DROPDOWN FUNCTIONALITY =====
    class ProfileDropdown {
        constructor() {
            this.isOpen = false;
            this.init();
        }
        
        init() {
            // Create profile avatar and dropdown
            this.createProfileDropdown();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('✅ Profile Dropdown initialized');
        }
        
        createProfileDropdown() {
            const navUser = document.querySelector('.nav-user');
            if (!navUser) return;
            
            // Check if dropdown already exists
            if (document.getElementById('profileDropdown')) return;
            
            // Get user data
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const userName = userData.name || 'Student';
            const userRole = userData.role || 'Student';
            const initials = this.getInitials(userName);
            
            // Create container
            const container = document.createElement('div');
            container.id = 'profileDropdown';
            container.className = 'profile-dropdown-container';
            
            container.innerHTML = `
                <button class="profile-avatar-btn" id="profileAvatarBtn" aria-label="User profile menu" aria-expanded="false">
                    ${initials}
                </button>
                <div class="profile-dropdown-menu" id="profileDropdownMenu">
                    <div class="profile-dropdown-header">
                        <span class="user-name">${userName}</span>
                        <span class="user-role">${userRole}</span>
                    </div>
                    <button class="profile-dropdown-item" data-action="change-picture">
                        <span class="item-icon">📷</span>
                        <span>Change Profile Picture</span>
                    </button>
                    <button class="profile-dropdown-item" data-action="show-id">
                        <span class="item-icon">🎫</span>
                        <span>Show ID Card</span>
                    </button>
                    <button class="profile-dropdown-item" data-action="settings">
                        <span class="item-icon">⚙️</span>
                        <span>Settings</span>
                    </button>
                    <button class="profile-dropdown-item logout" data-action="logout">
                        <span class="item-icon">🚪</span>
                        <span>Logout</span>
                    </button>
                </div>
            `;
            
            // Insert before logout button
            const logoutBtn = navUser.querySelector('.btn-logout');
            if (logoutBtn) {
                navUser.insertBefore(container, logoutBtn);
            } else {
                navUser.appendChild(container);
            }
        }
        
        setupEventListeners() {
            const avatarBtn = document.getElementById('profileAvatarBtn');
            const menu = document.getElementById('profileDropdownMenu');
            
            if (!avatarBtn || !menu) return;
            
            // Toggle dropdown
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
            
            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.profile-dropdown-container')) {
                    this.closeDropdown();
                }
            });
            
            // Handle menu item clicks
            menu.querySelectorAll('.profile-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    this.handleAction(action);
                    this.closeDropdown();
                });
            });
            
            // Close on ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeDropdown();
                    avatarBtn.focus();
                }
            });
        }
        
        toggleDropdown() {
            if (this.isOpen) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        }
        
        openDropdown() {
            const menu = document.getElementById('profileDropdownMenu');
            const avatarBtn = document.getElementById('profileAvatarBtn');
            
            if (!menu || !avatarBtn) return;
            
            menu.classList.add('active');
            avatarBtn.setAttribute('aria-expanded', 'true');
            this.isOpen = true;
            
            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        }
        
        closeDropdown() {
            const menu = document.getElementById('profileDropdownMenu');
            const avatarBtn = document.getElementById('profileAvatarBtn');
            
            if (!menu || !avatarBtn) return;
            
            menu.classList.remove('active');
            avatarBtn.setAttribute('aria-expanded', 'false');
            this.isOpen = false;
        }
        
        handleAction(action) {
            console.log('Profile action:', action);
            
            switch (action) {
                case 'change-picture':
                    this.changeProfilePicture();
                    break;
                case 'show-id':
                    this.showIDCard();
                    break;
                case 'settings':
                    this.openSettings();
                    break;
                case 'logout':
                    this.logout();
                    break;
            }
        }
        
        changeProfilePicture() {
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const avatarBtn = document.getElementById('profileAvatarBtn');
                        if (avatarBtn) {
                            avatarBtn.innerHTML = `<img src="${event.target.result}" alt="Profile">`;
                            localStorage.setItem('profilePicture', event.target.result);
                        }
                        this.showNotification('Profile picture updated successfully!', 'success');
                    };
                    reader.readAsDataURL(file);
                }
            });
            
            input.click();
        }
        
        showIDCard() {
            this.showNotification('ID Card feature - Opening...', 'info');
            // Navigate to ID card page or open modal
            setTimeout(() => {
                window.location.href = 'student-admit-card.html';
            }, 500);
        }
        
        openSettings() {
            this.showNotification('Settings panel - Coming soon!', 'info');
            // Open settings modal or navigate to settings page
        }
        
        logout() {
            if (confirm('Are you sure you want to logout?')) {
                // Clear user data
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                
                this.showNotification('Logging out...', 'info');
                
                // Redirect to login page
                setTimeout(() => {
                    window.location.href = '../login.html';
                }, 500);
            }
        }
        
        getInitials(name) {
            if (!name) return 'ST';
            const parts = name.split(' ');
            if (parts.length === 1) {
                return parts[0].substring(0, 2).toUpperCase();
            }
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        
        showNotification(message, type = 'info') {
            // Use existing Toast if available
            if (typeof Toast !== 'undefined') {
                Toast[type](message);
            } else {
                // Fallback to console
                console.log(`[${type.toUpperCase()}] ${message}`);
                
                // Simple fallback notification
                const notification = document.createElement('div');
                notification.className = `notification notification-${type}`;
                notification.textContent = message;
                notification.style.cssText = `
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    padding: 12px 20px;
                    background: rgba(99, 102, 241, 0.9);
                    color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                `;
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
            }
        }
    }
    
    // ===== INITIALIZE ON DOM READY =====
    function initialize() {
        // Initialize Theme Manager
        window.themeManager = new ThemeManager();
        
        // Initialize Profile Dropdown
        window.profileDropdown = new ProfileDropdown();
        
        console.log('✨ Dashboard Enhanced Features loaded successfully');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Export for external access
    window.DashboardEnhanced = {
        ThemeManager,
        ProfileDropdown
    };
    
})();
