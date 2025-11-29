/**
 * Menu System JavaScript Module
 * Handles menu viewing, date selection, and hostel filtering
 */

(function() {
    'use strict';

    const MenuViewer = {
        selectedDate: new Date(),
        selectedHostel: '',
        
        // API base URL
        apiBase: '/api/menu',
        
        // Meal type configuration
        mealTypes: {
            breakfast: { icon: '🌅', title: 'Breakfast', time: '7:00 AM - 9:00 AM' },
            lunch: { icon: '🍛', title: 'Lunch', time: '12:00 PM - 2:00 PM' },
            snacks: { icon: '☕', title: 'Snacks', time: '4:30 PM - 6:00 PM' },
            dinner: { icon: '🌙', title: 'Dinner', time: '7:00 PM - 9:00 PM' }
        },

        init() {
            this.loadUserPreferences();
            this.setupEventListeners();
            this.setInitialDate();
            this.loadMenu();
        },

        loadUserPreferences() {
            // Load saved hostel preference from localStorage
            const savedHostel = localStorage.getItem('preferredHostel');
            if (savedHostel) {
                this.selectedHostel = savedHostel;
                const hostelSelect = document.getElementById('hostelSelect');
                if (hostelSelect) {
                    hostelSelect.value = savedHostel;
                }
            }
        },

        saveUserPreferences() {
            if (this.selectedHostel) {
                localStorage.setItem('preferredHostel', this.selectedHostel);
            }
        },

        setInitialDate() {
            const dateInput = document.getElementById('menuDate');
            if (dateInput) {
                // Set to today's date
                const today = new Date();
                this.selectedDate = today;
                dateInput.valueAsDate = today;
                this.updateDateDisplay();
            }
        },

        setupEventListeners() {
            // Date navigation
            const prevDayBtn = document.getElementById('prevDay');
            const nextDayBtn = document.getElementById('nextDay');
            const dateInput = document.getElementById('menuDate');
            const todayBtn = document.getElementById('todayBtn');
            const tomorrowBtn = document.getElementById('tomorrowBtn');
            const hostelSelect = document.getElementById('hostelSelect');

            if (prevDayBtn) {
                prevDayBtn.addEventListener('click', () => this.navigateDate(-1));
            }

            if (nextDayBtn) {
                nextDayBtn.addEventListener('click', () => this.navigateDate(1));
            }

            if (dateInput) {
                dateInput.addEventListener('change', (e) => {
                    this.selectedDate = e.target.valueAsDate || new Date();
                    this.updateDateDisplay();
                    this.loadMenu();
                });
            }

            if (todayBtn) {
                todayBtn.addEventListener('click', () => this.goToDate(new Date()));
            }

            if (tomorrowBtn) {
                tomorrowBtn.addEventListener('click', () => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    this.goToDate(tomorrow);
                });
            }

            if (hostelSelect) {
                hostelSelect.addEventListener('change', (e) => {
                    this.selectedHostel = e.target.value;
                    this.saveUserPreferences();
                    this.loadMenu();
                });
            }

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                
                if (e.key === 'ArrowLeft') {
                    this.navigateDate(-1);
                } else if (e.key === 'ArrowRight') {
                    this.navigateDate(1);
                }
            });
        },

        navigateDate(days) {
            const newDate = new Date(this.selectedDate);
            newDate.setDate(newDate.getDate() + days);
            this.goToDate(newDate);
        },

        goToDate(date) {
            this.selectedDate = date;
            const dateInput = document.getElementById('menuDate');
            if (dateInput) {
                dateInput.valueAsDate = date;
            }
            this.updateDateDisplay();
            this.loadMenu();
        },

        updateDateDisplay() {
            const menuDateTitle = document.getElementById('menuDateTitle');
            const menuDateBadge = document.getElementById('menuDateBadge');
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const selectedDateNormalized = new Date(this.selectedDate);
            selectedDateNormalized.setHours(0, 0, 0, 0);
            
            let titleText = '';
            
            if (selectedDateNormalized.getTime() === today.getTime()) {
                titleText = "Today's Menu";
            } else if (selectedDateNormalized.getTime() === tomorrow.getTime()) {
                titleText = "Tomorrow's Menu";
            } else {
                const options = { weekday: 'long', month: 'short', day: 'numeric' };
                titleText = `Menu for ${this.selectedDate.toLocaleDateString('en-US', options)}`;
            }
            
            if (menuDateTitle) {
                menuDateTitle.textContent = titleText;
            }
            
            if (menuDateBadge) {
                menuDateBadge.textContent = this.formatDate(this.selectedDate);
            }

            // Update button active states
            const todayBtn = document.getElementById('todayBtn');
            const tomorrowBtn = document.getElementById('tomorrowBtn');
            
            if (todayBtn) {
                todayBtn.classList.toggle('active', selectedDateNormalized.getTime() === today.getTime());
            }
            if (tomorrowBtn) {
                tomorrowBtn.classList.toggle('active', selectedDateNormalized.getTime() === tomorrow.getTime());
            }
        },

        formatDate(date) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        },

        formatDateForAPI(date) {
            return date.toISOString().split('T')[0];
        },

        async loadMenu() {
            const container = document.getElementById('menuContainer');
            if (!container) return;

            // Show loading state
            container.innerHTML = `
                <div class="menu-loading">
                    <div class="menu-loading-spinner"></div>
                    <p>Loading menu...</p>
                </div>
            `;

            try {
                const dateStr = this.formatDateForAPI(this.selectedDate);
                let url = `${this.apiBase}/date/${dateStr}`;
                
                if (this.selectedHostel) {
                    url += `?hostel=${encodeURIComponent(this.selectedHostel)}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to load menu');
                }

                const data = await response.json();
                
                if (data.success && data.data && data.data.length > 0) {
                    this.displayMenu(data.data);
                } else {
                    this.displayEmptyState();
                }
            } catch (error) {
                console.error('Error loading menu:', error);
                this.displayError();
            }
        },

        displayMenu(menus) {
            const container = document.getElementById('menuContainer');
            if (!container) return;

            // If we have multiple menus (different hostels), group them
            if (menus.length > 1 && !this.selectedHostel) {
                this.displayGroupedMenus(menus);
                return;
            }

            // Single menu display
            const menu = menus[0];
            
            let html = `<div class="menu-grid">`;
            
            // Display each meal type
            Object.keys(this.mealTypes).forEach(mealType => {
                const mealConfig = this.mealTypes[mealType];
                const mealItems = menu[mealType] || '';
                
                if (mealItems) {
                    const items = mealItems.split(',').map(item => item.trim()).filter(item => item);
                    
                    html += `
                        <div class="meal-card ${mealType}">
                            <div class="meal-header">
                                <span class="meal-icon">${mealConfig.icon}</span>
                                <div>
                                    <div class="meal-title">${mealConfig.title}</div>
                                    <div class="meal-time">${mealConfig.time}</div>
                                </div>
                            </div>
                            <div class="meal-items">
                                ${items.map(item => `<span class="meal-item">${this.escapeHtml(item)}</span>`).join('')}
                            </div>
                        </div>
                    `;
                }
            });
            
            html += `</div>`;
            
            // Check if any meals exist
            const hasMeals = Object.keys(this.mealTypes).some(type => menu[type] && menu[type].trim());
            
            if (!hasMeals) {
                this.displayEmptyState();
                return;
            }
            
            container.innerHTML = html;
        },

        displayGroupedMenus(menus) {
            const container = document.getElementById('menuContainer');
            if (!container) return;

            let html = '';
            
            menus.forEach(menu => {
                html += `
                    <div style="margin-bottom: 2rem;">
                        <h4 style="color: var(--primary); margin-bottom: 1rem; font-size: 1.25rem;">
                            🏢 ${this.escapeHtml(menu.hostel_name)}
                        </h4>
                        <div class="menu-grid">
                `;
                
                Object.keys(this.mealTypes).forEach(mealType => {
                    const mealConfig = this.mealTypes[mealType];
                    const mealItems = menu[mealType] || '';
                    
                    if (mealItems) {
                        const items = mealItems.split(',').map(item => item.trim()).filter(item => item);
                        
                        html += `
                            <div class="meal-card ${mealType}">
                                <div class="meal-header">
                                    <span class="meal-icon">${mealConfig.icon}</span>
                                    <div>
                                        <div class="meal-title">${mealConfig.title}</div>
                                        <div class="meal-time">${mealConfig.time}</div>
                                    </div>
                                </div>
                                <div class="meal-items">
                                    ${items.map(item => `<span class="meal-item">${this.escapeHtml(item)}</span>`).join('')}
                                </div>
                            </div>
                        `;
                    }
                });
                
                html += `</div></div>`;
            });
            
            container.innerHTML = html;
        },

        displayEmptyState() {
            const container = document.getElementById('menuContainer');
            if (!container) return;

            const dateStr = this.formatDate(this.selectedDate);
            const hostelStr = this.selectedHostel || 'selected hostel';
            
            container.innerHTML = `
                <div class="menu-empty-state">
                    <div class="menu-empty-icon">🍽️</div>
                    <div class="menu-empty-title">No Menu Available</div>
                    <div class="menu-empty-text">
                        Menu for ${dateStr}${this.selectedHostel ? ' at ' + hostelStr : ''} has not been uploaded yet.
                        <br>Please check back later or try a different date.
                    </div>
                </div>
            `;
        },

        displayError() {
            const container = document.getElementById('menuContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="menu-empty-state">
                    <div class="menu-empty-icon">⚠️</div>
                    <div class="menu-empty-title">Error Loading Menu</div>
                    <div class="menu-empty-text">
                        Unable to load menu data. Please try again later.
                    </div>
                    <button class="menu-nav-btn" onclick="MenuViewer.loadMenu()" style="margin-top: 1rem;">
                        🔄 Retry
                    </button>
                </div>
            `;
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MenuViewer.init());
    } else {
        MenuViewer.init();
    }

    // Expose globally
    window.MenuViewer = MenuViewer;
})();
