// Student Hostel Menu Page
(function() {
    'use strict';

    let selectedBlock = 'A';
    let selectedDate = new Date();

    function init() {
        setupEventListeners();
        setTodayDate();
        loadMenu();
    }

    function setTodayDate() {
        const dateInput = document.getElementById('menuDate');
        if (dateInput) {
            const today = new Date();
            dateInput.valueAsDate = today;
            selectedDate = today;
        }
    }

    function setupEventListeners() {
        // Block selection
        const blockTabs = document.querySelectorAll('.block-tab');
        blockTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                blockTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                selectedBlock = this.dataset.block;
                loadMenu();
            });
        });

        // Date navigation
        const prevDayBtn = document.getElementById('prevDay');
        const nextDayBtn = document.getElementById('nextDay');
        const dateInput = document.getElementById('menuDate');

        if (prevDayBtn) {
            prevDayBtn.addEventListener('click', () => {
                selectedDate.setDate(selectedDate.getDate() - 1);
                dateInput.valueAsDate = selectedDate;
                loadMenu();
            });
        }

        if (nextDayBtn) {
            nextDayBtn.addEventListener('click', () => {
                selectedDate.setDate(selectedDate.getDate() + 1);
                dateInput.valueAsDate = selectedDate;
                loadMenu();
            });
        }

        if (dateInput) {
            dateInput.addEventListener('change', function() {
                selectedDate = this.valueAsDate;
                loadMenu();
            });
        }
    }

    async function loadMenu() {
        try {
            const token = localStorage.getItem('token');
            const dateStr = selectedDate.toISOString().split('T')[0];
            
            const response = await fetch(`/api/hostel/menu?date=${dateStr}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load menu');
            }

            const data = await response.json();
            displayMenu(data.data);
        } catch (error) {
            console.error('Error loading menu:', error);
            showNoMenuMessage();
        }
    }

    function displayMenu(menuData) {
        const menuContainer = document.getElementById('menuContainer');
        const menuSection = document.getElementById('menuSection');
        const noMenuMessage = document.getElementById('noMenuMessage');

        if (!menuData || menuData.length === 0) {
            showNoMenuMessage();
            return;
        }

        // Hide no menu message and show menu
        if (noMenuMessage) noMenuMessage.style.display = 'none';
        if (menuSection) menuSection.style.display = 'block';

        const mealTypes = {
            'breakfast': '🌅 Breakfast',
            'lunch': '🍛 Lunch',
            'snacks': '☕ Snacks',
            'dinner': '🌙 Dinner'
        };

        let html = '';
        const groupedMenu = {};

        // Group by meal type
        menuData.forEach(item => {
            if (!groupedMenu[item.meal_type]) {
                groupedMenu[item.meal_type] = [];
            }
            groupedMenu[item.meal_type].push(item);
        });

        // Create meal cards
        Object.keys(mealTypes).forEach(mealType => {
            if (groupedMenu[mealType]) {
                html += `
                    <div class="meal-card">
                        <div class="meal-type">${mealTypes[mealType]}</div>
                        <div class="meal-items">
                            ${groupedMenu[mealType].map(item => 
                                `<div class="meal-item">${item.menu_items || item.description}</div>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }
        });

        if (menuContainer) {
            menuContainer.innerHTML = html || '<p>No menu items available for this date.</p>';
        }
    }

    function showNoMenuMessage() {
        const menuSection = document.getElementById('menuSection');
        const noMenuMessage = document.getElementById('noMenuMessage');
        const selectedBlockEl = document.getElementById('selectedBlock');
        const selectedDateEl = document.getElementById('selectedDate');

        if (menuSection) menuSection.style.display = 'none';
        if (noMenuMessage) noMenuMessage.style.display = 'block';
        
        if (selectedBlockEl) {
            selectedBlockEl.textContent = `Block ${selectedBlock}`;
        }
        
        if (selectedDateEl) {
            const dateStr = selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            selectedDateEl.textContent = dateStr;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
