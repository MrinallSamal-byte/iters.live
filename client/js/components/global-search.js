/**
 * Global Search Component
 * Advanced search with keyboard shortcuts (Ctrl+K / Cmd+K)
 * Part of ITER EduHub Enhancement Suite
 */
class GlobalSearch {
    constructor() {
        this.searchModal = null;
        this.searchInput = null;
        this.resultsContainer = null;
        this.selectedIndex = 0;
        this.results = [];
        this.recentSearches = [];
        this.searchHistory = [];
        this.debounceTimeout = null;
        this.isOpen = false;
        
        this.init();
    }

    init() {
        this.loadRecentSearches();
        this.createSearchModal();
        this.setupKeyboardShortcuts();
        this.setupEventListeners();
    }

    createSearchModal() {
        const modalHTML = `
            <div class="search-modal-overlay" id="searchModalOverlay" style="display: none;">
                <div class="search-modal glass-card">
                    <div class="search-header">
                        <div class="search-input-container">
                            <span class="search-icon">🔍</span>
                            <input 
                                type="text" 
                                id="globalSearchInput" 
                                placeholder="Search for files, users, events, assignments..."
                                autocomplete="off"
                                spellcheck="false"
                            />
                            <kbd class="search-kbd">ESC</kbd>
                        </div>
                        <div class="search-filters">
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="files">📄 Files</button>
                            <button class="filter-btn" data-filter="users">👤 Users</button>
                            <button class="filter-btn" data-filter="events">📅 Events</button>
                            <button class="filter-btn" data-filter="assignments">📝 Assignments</button>
                        </div>
                    </div>
                    
                    <div class="search-results" id="searchResults">
                        <div class="search-empty">
                            <div class="search-empty-icon">🔎</div>
                            <p>Start typing to search...</p>
                            <div class="search-shortcuts">
                                <div class="shortcut-item">
                                    <kbd>↑</kbd> <kbd>↓</kbd> <span>Navigate</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Enter</kbd> <span>Select</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>ESC</kbd> <span>Close</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="search-footer">
                        <div class="search-footer-left">
                            <span id="searchResultCount">0 results</span>
                        </div>
                        <div class="search-footer-right">
                            <span class="search-tip">
                                <kbd>Ctrl</kbd> + <kbd>K</kbd> to open
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        this.searchModal = document.getElementById('searchModalOverlay');
        this.searchInput = document.getElementById('globalSearchInput');
        this.resultsContainer = document.getElementById('searchResults');
    }

    setupKeyboardShortcuts() {
        // Global keyboard shortcut: Ctrl+K or Cmd+K
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to open
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
            
            // ESC to close
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
            
            // Arrow navigation when modal is open
            if (this.isOpen && this.results.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateResults(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateResults(-1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.selectResult();
                }
            }
        });
    }

    setupEventListeners() {
        // Click outside to close
        this.searchModal.addEventListener('click', (e) => {
            if (e.target === this.searchModal) {
                this.close();
            }
        });
        
        // Search input
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        // Filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.handleSearch(this.searchInput.value, btn.dataset.filter);
            });
        });
    }

    open() {
        this.isOpen = true;
        this.searchModal.style.display = 'flex';
        this.searchInput.focus();
        
        // Show recent searches if no query
        if (!this.searchInput.value && this.recentSearches.length > 0) {
            this.displayRecentSearches();
        }
        
        // Animate in
        setTimeout(() => {
            this.searchModal.classList.add('active');
        }, 10);
    }

    close() {
        this.isOpen = false;
        this.searchModal.classList.remove('active');
        setTimeout(() => {
            this.searchModal.style.display = 'none';
            this.searchInput.value = '';
            this.results = [];
            this.selectedIndex = 0;
        }, 200);
    }

    handleSearch(query, filter = 'all') {
        clearTimeout(this.debounceTimeout);
        
        if (!query.trim()) {
            this.displayRecentSearches();
            return;
        }
        
        // Debounce search
        this.debounceTimeout = setTimeout(() => {
            this.performSearch(query, filter);
        }, 300);
    }

    async performSearch(query, filter) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/search?q=${encodeURIComponent(query)}&filter=${filter}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            const data = await response.json();
            
            if (data.success) {
                this.results = data.results;
                this.displayResults(this.results);
                this.addToSearchHistory(query);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.displayError('Search failed. Please try again.');
        }
    }

    displayResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <div class="search-empty-icon">😕</div>
                    <p>No results found</p>
                    <small>Try different keywords or filters</small>
                </div>
            `;
            this.updateResultCount(0);
            return;
        }
        
        this.selectedIndex = 0;
        const groupedResults = this.groupResultsByType(results);
        
        let html = '';
        for (const [type, items] of Object.entries(groupedResults)) {
            if (items.length === 0) continue;
            
            html += `
                <div class="result-group">
                    <div class="result-group-header">${this.getTypeIcon(type)} ${this.capitalize(type)}</div>
                    <div class="result-group-items">
                        ${items.map((item, index) => this.renderResultItem(item, index)).join('')}
                    </div>
                </div>
            `;
        }
        
        this.resultsContainer.innerHTML = html;
        this.updateResultCount(results.length);
        this.attachResultListeners();
    }

    renderResultItem(item, index) {
        const isSelected = index === this.selectedIndex;
        return `
            <div class="result-item ${isSelected ? 'selected' : ''}" data-index="${index}" data-id="${item.id}" data-type="${item.type}">
                <div class="result-icon">${this.getTypeIcon(item.type)}</div>
                <div class="result-content">
                    <div class="result-title">${this.highlightMatch(item.title, this.searchInput.value)}</div>
                    ${item.description ? `<div class="result-description">${item.description}</div>` : ''}
                    ${item.metadata ? `<div class="result-metadata">${item.metadata}</div>` : ''}
                </div>
                <div class="result-action">
                    <kbd>↵</kbd>
                </div>
            </div>
        `;
    }

    attachResultListeners() {
        const resultItems = this.resultsContainer.querySelectorAll('.result-item');
        resultItems.forEach(item => {
            item.addEventListener('click', () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.selectResult();
            });
            
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.updateSelectedResult();
            });
        });
    }

    navigateResults(direction) {
        this.selectedIndex += direction;
        
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.results.length - 1;
        } else if (this.selectedIndex >= this.results.length) {
            this.selectedIndex = 0;
        }
        
        this.updateSelectedResult();
    }

    updateSelectedResult() {
        const items = this.resultsContainer.querySelectorAll('.result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectResult() {
        if (!this.results[this.selectedIndex]) return;
        
        const result = this.results[this.selectedIndex];
        this.addToRecentSearches(result);
        this.navigateToResult(result);
        this.close();
    }

    navigateToResult(result) {
        const routes = {
            files: `/dashboard/file-manager.html?file=${result.id}`,
            users: `/dashboard/profile.html?user=${result.id}`,
            events: `/dashboard/events.html?event=${result.id}`,
            assignments: `/dashboard/assignments.html?assignment=${result.id}`
        };
        
        const url = routes[result.type];
        if (url) {
            window.location.href = url;
        }
    }

    displayRecentSearches() {
        if (this.recentSearches.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <div class="search-empty-icon">🔎</div>
                    <p>No recent searches</p>
                </div>
            `;
            return;
        }
        
        const html = `
            <div class="result-group">
                <div class="result-group-header">
                    🕒 Recent Searches
                    <button class="clear-history-btn" onclick="globalSearch.clearHistory()">Clear</button>
                </div>
                <div class="result-group-items">
                    ${this.recentSearches.map(item => this.renderResultItem(item, 0)).join('')}
                </div>
            </div>
        `;
        
        this.resultsContainer.innerHTML = html;
        this.attachResultListeners();
    }

    groupResultsByType(results) {
        return results.reduce((groups, result) => {
            const type = result.type || 'other';
            if (!groups[type]) groups[type] = [];
            groups[type].push(result);
            return groups;
        }, {});
    }

    highlightMatch(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    getTypeIcon(type) {
        const icons = {
            files: '📄',
            users: '👤',
            events: '📅',
            assignments: '📝',
            other: '📌'
        };
        return icons[type] || icons.other;
    }

    addToSearchHistory(query) {
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > 10) {
                this.searchHistory.pop();
            }
            localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
        }
    }

    addToRecentSearches(result) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(r => 
            !(r.type === result.type && r.id === result.id)
        );
        
        // Add to beginning
        this.recentSearches.unshift(result);
        
        // Limit to 5 recent searches
        if (this.recentSearches.length > 5) {
            this.recentSearches.pop();
        }
        
        this.saveRecentSearches();
    }

    loadRecentSearches() {
        try {
            const saved = localStorage.getItem('recentSearches');
            if (saved) {
                this.recentSearches = JSON.parse(saved);
            }
            
            const history = localStorage.getItem('searchHistory');
            if (history) {
                this.searchHistory = JSON.parse(history);
            }
        } catch (error) {
            console.error('Failed to load search history:', error);
        }
    }

    saveRecentSearches() {
        try {
            localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
        } catch (error) {
            console.error('Failed to save search history:', error);
        }
    }

    clearHistory() {
        this.recentSearches = [];
        this.searchHistory = [];
        localStorage.removeItem('recentSearches');
        localStorage.removeItem('searchHistory');
        this.displayRecentSearches();
    }

    updateResultCount(count) {
        const countEl = document.getElementById('searchResultCount');
        if (countEl) {
            countEl.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        }
    }

    displayError(message) {
        this.resultsContainer.innerHTML = `
            <div class="search-error">
                <div class="search-empty-icon">⚠️</div>
                <p>${message}</p>
            </div>
        `;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Initialize global search
let globalSearch;
document.addEventListener('DOMContentLoaded', () => {
    globalSearch = new GlobalSearch();
    console.log('Global search initialized. Press Ctrl+K to open.');
});
