/**
 * Admin Menu Manager JavaScript Module
 * Handles CRUD operations, bulk upload, and calendar view for menu management
 */

(function() {
    'use strict';

    const MenuManager = {
        apiBase: '/api/menu',
        currentTab: 'create',
        calendarMonth: new Date().getMonth(),
        calendarYear: new Date().getFullYear(),
        editingMenuId: null,
        menus: [],

        init() {
            this.setupEventListeners();
            this.setupTabs();
            this.setDefaultDate();
            this.loadMenus();
        },

        getAuthToken() {
            return localStorage.getItem('token');
        },

        async fetchWithAuth(url, options = {}) {
            const token = this.getAuthToken();
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            return fetch(url, {
                ...options,
                headers
            });
        },

        setDefaultDate() {
            const dateInput = document.getElementById('formDate');
            if (dateInput) {
                dateInput.valueAsDate = new Date();
            }
        },

        setupTabs() {
            const tabs = document.querySelectorAll('.menu-admin-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tab.dataset.tab);
                });
            });
        },

        switchTab(tabName) {
            this.currentTab = tabName;
            
            // Update tab buttons
            document.querySelectorAll('.menu-admin-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            // Show/hide content
            document.getElementById('createTab').style.display = tabName === 'create' ? 'block' : 'none';
            document.getElementById('listTab').style.display = tabName === 'list' ? 'block' : 'none';
            document.getElementById('calendarTab').style.display = tabName === 'calendar' ? 'block' : 'none';
            document.getElementById('bulkTab').style.display = tabName === 'bulk' ? 'block' : 'none';
            
            // Load data for specific tabs
            if (tabName === 'list') {
                this.loadMenuList();
            } else if (tabName === 'calendar') {
                this.renderCalendar();
            }
        },

        setupEventListeners() {
            // Form submission
            const form = document.getElementById('menuForm');
            if (form) {
                form.addEventListener('submit', (e) => this.handleFormSubmit(e));
            }

            // Clear form button
            const clearBtn = document.getElementById('clearFormBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearForm());
            }

            // Copy menu button
            const copyBtn = document.getElementById('copyMenuBtn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => this.openCopyModal());
            }

            // Filter buttons
            const applyFiltersBtn = document.getElementById('applyFiltersBtn');
            if (applyFiltersBtn) {
                applyFiltersBtn.addEventListener('click', () => this.loadMenuList());
            }

            // Calendar navigation
            const prevMonthBtn = document.getElementById('calPrevMonth');
            const nextMonthBtn = document.getElementById('calNextMonth');
            if (prevMonthBtn) {
                prevMonthBtn.addEventListener('click', () => this.navigateCalendar(-1));
            }
            if (nextMonthBtn) {
                nextMonthBtn.addEventListener('click', () => this.navigateCalendar(1));
            }

            // Bulk upload
            this.setupBulkUpload();

            // Modals
            this.setupModals();

            // Auto-set hostel type based on hostel name
            const hostelNameSelect = document.getElementById('formHostelName');
            if (hostelNameSelect) {
                hostelNameSelect.addEventListener('change', (e) => {
                    const hostelType = document.getElementById('formHostelType');
                    if (hostelType && e.target.value) {
                        hostelType.value = e.target.value.startsWith('LH') ? 'girls' : 'boys';
                    }
                });
            }
        },

        setupBulkUpload() {
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('csvFileInput');
            const selectBtn = document.getElementById('selectFileBtn');
            const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

            if (selectBtn && fileInput) {
                selectBtn.addEventListener('click', () => fileInput.click());
            }

            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
            }

            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.classList.add('drag-over');
                });

                dropZone.addEventListener('dragleave', () => {
                    dropZone.classList.remove('drag-over');
                });

                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.csv')) {
                        this.handleFileSelect(file);
                    } else {
                        this.showToast('Please upload a CSV file', 'error');
                    }
                });
            }

            if (downloadTemplateBtn) {
                downloadTemplateBtn.addEventListener('click', () => this.downloadTemplate());
            }
        },

        setupModals() {
            // Copy modal
            const copyModal = document.getElementById('copyMenuModal');
            const closeCopyBtn = document.getElementById('closeCopyModal');
            const cancelCopyBtn = document.getElementById('cancelCopyBtn');
            const confirmCopyBtn = document.getElementById('confirmCopyBtn');

            if (closeCopyBtn) {
                closeCopyBtn.addEventListener('click', () => this.closeCopyModal());
            }
            if (cancelCopyBtn) {
                cancelCopyBtn.addEventListener('click', () => this.closeCopyModal());
            }
            if (confirmCopyBtn) {
                confirmCopyBtn.addEventListener('click', () => this.handleCopyMenu());
            }
            if (copyModal) {
                copyModal.addEventListener('click', (e) => {
                    if (e.target === copyModal) this.closeCopyModal();
                });
            }

            // Edit modal
            const editModal = document.getElementById('editMenuModal');
            const closeEditBtn = document.getElementById('closeEditModal');
            const cancelEditBtn = document.getElementById('cancelEditBtn');
            const saveEditBtn = document.getElementById('saveEditBtn');

            if (closeEditBtn) {
                closeEditBtn.addEventListener('click', () => this.closeEditModal());
            }
            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => this.closeEditModal());
            }
            if (saveEditBtn) {
                saveEditBtn.addEventListener('click', () => this.handleSaveEdit());
            }
            if (editModal) {
                editModal.addEventListener('click', (e) => {
                    if (e.target === editModal) this.closeEditModal();
                });
            }
        },

        async loadMenus() {
            try {
                const response = await this.fetchWithAuth(`${this.apiBase}/all?limit=100`);
                const data = await response.json();
                
                if (data.success) {
                    this.menus = data.data;
                }
            } catch (error) {
                console.error('Error loading menus:', error);
            }
        },

        async handleFormSubmit(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '⏳ Creating...';
            submitBtn.disabled = true;

            try {
                const formData = {
                    menu_date: document.getElementById('formDate').value,
                    hostel_type: document.getElementById('formHostelType').value,
                    hostel_name: document.getElementById('formHostelName').value,
                    breakfast: document.getElementById('formBreakfast').value,
                    lunch: document.getElementById('formLunch').value,
                    snacks: document.getElementById('formSnacks').value,
                    dinner: document.getElementById('formDinner').value
                };

                const response = await this.fetchWithAuth(this.apiBase, {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast('Menu created successfully!', 'success');
                    this.clearForm();
                    await this.loadMenus();
                } else {
                    this.showToast(data.message || 'Failed to create menu', 'error');
                }
            } catch (error) {
                console.error('Error creating menu:', error);
                this.showToast('Error creating menu', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        },

        clearForm() {
            document.getElementById('menuForm').reset();
            this.setDefaultDate();
        },

        async loadMenuList() {
            const listContainer = document.getElementById('menuList');
            if (!listContainer) return;

            listContainer.innerHTML = '<p class="loading-text">Loading menus...</p>';

            try {
                const filterDate = document.getElementById('filterDate').value;
                const filterHostel = document.getElementById('filterHostel').value;

                let url = `${this.apiBase}/all?limit=100`;
                
                const response = await this.fetchWithAuth(url);
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    let menus = data.data;
                    
                    // Apply client-side filters
                    if (filterDate) {
                        menus = menus.filter(m => m.menu_date === filterDate);
                    }
                    if (filterHostel) {
                        menus = menus.filter(m => m.hostel_name === filterHostel);
                    }

                    if (menus.length === 0) {
                        listContainer.innerHTML = `
                            <div class="menu-empty-state">
                                <div class="menu-empty-icon">📋</div>
                                <div class="menu-empty-title">No Menus Found</div>
                                <div class="menu-empty-text">No menus match your filter criteria.</div>
                            </div>
                        `;
                        return;
                    }

                    listContainer.innerHTML = menus.map(menu => `
                        <div class="menu-list-item" data-id="${menu.id}">
                            <div class="menu-list-info">
                                <div class="menu-list-date">📅 ${this.formatDate(menu.menu_date)}</div>
                                <div class="menu-list-hostel">🏢 ${menu.hostel_name} (${menu.hostel_type})</div>
                            </div>
                            <div class="menu-list-actions">
                                <button class="menu-list-btn edit" onclick="MenuManager.openEditModal('${menu.id}')">
                                    ✏️ Edit
                                </button>
                                <button class="menu-list-btn delete" onclick="MenuManager.deleteMenu('${menu.id}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listContainer.innerHTML = `
                        <div class="menu-empty-state">
                            <div class="menu-empty-icon">📋</div>
                            <div class="menu-empty-title">No Menus Found</div>
                            <div class="menu-empty-text">Create your first menu to get started.</div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading menu list:', error);
                listContainer.innerHTML = '<p class="loading-text">Error loading menus</p>';
            }
        },

        formatDate(dateStr) {
            const date = new Date(dateStr + 'T00:00:00');
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        },

        // Calendar Methods
        renderCalendar() {
            const container = document.getElementById('menuCalendar');
            const titleEl = document.getElementById('calendarTitle');
            
            if (!container || !titleEl) return;

            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
            
            titleEl.textContent = `${months[this.calendarMonth]} ${this.calendarYear}`;

            const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
            const lastDay = new Date(this.calendarYear, this.calendarMonth + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDay = firstDay.getDay();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get menus for this month
            const monthMenus = this.menus.filter(m => {
                const menuDate = new Date(m.menu_date);
                return menuDate.getMonth() === this.calendarMonth && 
                       menuDate.getFullYear() === this.calendarYear;
            });

            const menuDates = new Set(monthMenus.map(m => m.menu_date));

            let html = `
                <div class="menu-calendar-grid">
                    <div class="menu-calendar-header">Sun</div>
                    <div class="menu-calendar-header">Mon</div>
                    <div class="menu-calendar-header">Tue</div>
                    <div class="menu-calendar-header">Wed</div>
                    <div class="menu-calendar-header">Thu</div>
                    <div class="menu-calendar-header">Fri</div>
                    <div class="menu-calendar-header">Sat</div>
            `;

            // Empty cells before first day
            for (let i = 0; i < startDay; i++) {
                html += '<div class="menu-calendar-day" style="opacity: 0.3;"></div>';
            }

            // Days of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(this.calendarYear, this.calendarMonth, day);
                const dateStr = date.toISOString().split('T')[0];
                const isToday = date.getTime() === today.getTime();
                const hasMenu = menuDates.has(dateStr);

                html += `
                    <div class="menu-calendar-day ${isToday ? 'today' : ''} ${hasMenu ? 'has-menu' : ''}"
                         onclick="MenuManager.selectCalendarDate('${dateStr}')"
                         title="${hasMenu ? 'Menu available' : 'No menu'}">
                        <div class="menu-calendar-day-number">${day}</div>
                        <div class="menu-calendar-day-indicator">${hasMenu ? '✓' : ''}</div>
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;
        },

        navigateCalendar(direction) {
            this.calendarMonth += direction;
            
            if (this.calendarMonth < 0) {
                this.calendarMonth = 11;
                this.calendarYear--;
            } else if (this.calendarMonth > 11) {
                this.calendarMonth = 0;
                this.calendarYear++;
            }
            
            this.renderCalendar();
        },

        selectCalendarDate(dateStr) {
            // Set date in form and switch to create tab
            document.getElementById('formDate').value = dateStr;
            this.switchTab('create');
        },

        // Copy Menu Methods
        openCopyModal() {
            const modal = document.getElementById('copyMenuModal');
            if (modal) {
                modal.style.display = 'flex';
                // Set default dates
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('copySourceDate').value = today;
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                document.getElementById('copyTargetDate').value = tomorrow.toISOString().split('T')[0];
            }
        },

        closeCopyModal() {
            const modal = document.getElementById('copyMenuModal');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        async handleCopyMenu() {
            const sourceDate = document.getElementById('copySourceDate').value;
            const targetDate = document.getElementById('copyTargetDate').value;
            const hostel = document.getElementById('copyHostel').value;

            if (!sourceDate || !targetDate) {
                this.showToast('Please select both source and target dates', 'error');
                return;
            }

            try {
                const response = await this.fetchWithAuth(`${this.apiBase}/copy`, {
                    method: 'POST',
                    body: JSON.stringify({ sourceDate, targetDate, hostel })
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast(data.message, 'success');
                    this.closeCopyModal();
                    await this.loadMenus();
                } else {
                    this.showToast(data.message || 'Failed to copy menu', 'error');
                }
            } catch (error) {
                console.error('Error copying menu:', error);
                this.showToast('Error copying menu', 'error');
            }
        },

        // Edit Modal Methods
        openEditModal(menuId) {
            const menu = this.menus.find(m => m.id === menuId);
            if (!menu) {
                this.showToast('Menu not found', 'error');
                return;
            }

            this.editingMenuId = menuId;
            
            document.getElementById('editMenuId').value = menuId;
            document.getElementById('editDate').value = menu.menu_date;
            document.getElementById('editHostel').value = menu.hostel_name;
            document.getElementById('editBreakfast').value = menu.breakfast || '';
            document.getElementById('editLunch').value = menu.lunch || '';
            document.getElementById('editSnacks').value = menu.snacks || '';
            document.getElementById('editDinner').value = menu.dinner || '';

            document.getElementById('editMenuModal').style.display = 'flex';
        },

        closeEditModal() {
            document.getElementById('editMenuModal').style.display = 'none';
            this.editingMenuId = null;
        },

        async handleSaveEdit() {
            if (!this.editingMenuId) return;

            try {
                const formData = {
                    breakfast: document.getElementById('editBreakfast').value,
                    lunch: document.getElementById('editLunch').value,
                    snacks: document.getElementById('editSnacks').value,
                    dinner: document.getElementById('editDinner').value
                };

                const response = await this.fetchWithAuth(`${this.apiBase}/${this.editingMenuId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast('Menu updated successfully!', 'success');
                    this.closeEditModal();
                    await this.loadMenus();
                    if (this.currentTab === 'list') {
                        this.loadMenuList();
                    }
                } else {
                    this.showToast(data.message || 'Failed to update menu', 'error');
                }
            } catch (error) {
                console.error('Error updating menu:', error);
                this.showToast('Error updating menu', 'error');
            }
        },

        async deleteMenu(menuId) {
            if (!confirm('Are you sure you want to delete this menu?')) {
                return;
            }

            try {
                const response = await this.fetchWithAuth(`${this.apiBase}/${menuId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast('Menu deleted successfully!', 'success');
                    await this.loadMenus();
                    if (this.currentTab === 'list') {
                        this.loadMenuList();
                    }
                    if (this.currentTab === 'calendar') {
                        this.renderCalendar();
                    }
                } else {
                    this.showToast(data.message || 'Failed to delete menu', 'error');
                }
            } catch (error) {
                console.error('Error deleting menu:', error);
                this.showToast('Error deleting menu', 'error');
            }
        },

        // Bulk Upload Methods
        async handleFileSelect(file) {
            if (!file) return;

            const resultsContainer = document.getElementById('bulkUploadResults');
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = '<p class="loading-text">Processing CSV file...</p>';

            try {
                const text = await file.text();
                const menus = this.parseCSV(text);

                if (menus.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="menu-empty-state">
                            <div class="menu-empty-icon">⚠️</div>
                            <div class="menu-empty-title">No Valid Data</div>
                            <div class="menu-empty-text">The CSV file doesn't contain valid menu data.</div>
                        </div>
                    `;
                    return;
                }

                const response = await this.fetchWithAuth(`${this.apiBase}/bulk`, {
                    method: 'POST',
                    body: JSON.stringify({ menus })
                });

                const data = await response.json();

                if (data.success) {
                    let html = `
                        <div style="padding: 1.5rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-lg); border-left: 4px solid #10b981;">
                            <h4 style="color: #10b981; margin-bottom: 1rem;">✅ Bulk Upload Complete</h4>
                            <p>Created: ${data.data.created} menus</p>
                            <p>Skipped: ${data.data.skipped} menus</p>
                    `;

                    if (data.data.errors && data.data.errors.length > 0) {
                        html += `
                            <div style="margin-top: 1rem;">
                                <strong>Errors:</strong>
                                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                    ${data.data.errors.map(err => `<li style="color: #ef4444;">${this.escapeHtml(err)}</li>`).join('')}
                                </ul>
                            </div>
                        `;
                    }

                    html += '</div>';
                    resultsContainer.innerHTML = html;
                    await this.loadMenus();
                } else {
                    this.showToast(data.message || 'Bulk upload failed', 'error');
                    resultsContainer.innerHTML = `
                        <div class="menu-empty-state">
                            <div class="menu-empty-icon">❌</div>
                            <div class="menu-empty-title">Upload Failed</div>
                            <div class="menu-empty-text">${this.escapeHtml(data.message || 'Unknown error')}</div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error processing CSV:', error);
                resultsContainer.innerHTML = `
                    <div class="menu-empty-state">
                        <div class="menu-empty-icon">❌</div>
                        <div class="menu-empty-title">Error Processing File</div>
                        <div class="menu-empty-text">${this.escapeHtml(error.message)}</div>
                    </div>
                `;
            }
        },

        parseCSV(text) {
            const lines = text.trim().split('\n');
            if (lines.length < 2) return [];

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const menus = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length < headers.length) continue;

                const menu = {};
                headers.forEach((header, index) => {
                    menu[header] = values[index] || '';
                });

                if (menu.menu_date && menu.hostel_name) {
                    menus.push(menu);
                }
            }

            return menus;
        },

        parseCSVLine(line) {
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            return values;
        },

        downloadTemplate() {
            // Use dynamic dates (today and tomorrow) for the template
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const formatDate = (d) => d.toISOString().split('T')[0];
            const todayStr = formatDate(today);
            const tomorrowStr = formatDate(tomorrow);

            const template = `menu_date,hostel_type,hostel_name,breakfast,lunch,snacks,dinner
${todayStr},boys,BH1,"Bread,Butter,Jam,Milk,Banana","Rice,Dal,Aloo Gobi,Chapati,Salad","Samosa,Tea","Rice,Dal Tadka,Paneer Butter Masala,Chapati"
${todayStr},girls,LH1,"Bread,Butter,Jam,Milk,Banana","Rice,Dal,Aloo Gobi,Chapati,Salad","Samosa,Tea","Rice,Dal Tadka,Paneer Butter Masala,Chapati"
${tomorrowStr},boys,BH1,"Poha,Jalebi,Milk,Apple","Rice,Rajma,Jeera Aloo,Chapati,Pickle","Pakoda,Coffee","Rice,Yellow Dal,Egg Curry,Chapati,Curd"`;

            const blob = new Blob([template], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'menu_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        showToast(message, type = 'info') {
            if (typeof Toast !== 'undefined') {
                if (type === 'success') {
                    Toast.success(message);
                } else if (type === 'error') {
                    Toast.error(message);
                } else {
                    Toast.info(message);
                }
            } else {
                alert(message);
            }
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MenuManager.init());
    } else {
        MenuManager.init();
    }

    // Expose globally
    window.MenuManager = MenuManager;
})();
