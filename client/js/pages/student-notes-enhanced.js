// ============================================
// ENHANCED STUDENT NOTES PAGE
// With Branch, Semester, and Type Filters
// ============================================

(function() {
    'use strict';

    const NotesManager = {
        currentFilters: {
            branch: '',
            semester: '',
            type: '',
            search: ''
        },
        allNotes: [],
        filteredNotes: [],

        init() {
            this.setupEventListeners();
            this.loadNotes();
            this.loadStats();
            this.loadRecentDownloads();
        },

        setupEventListeners() {
            // Apply Filter Button
            const applyBtn = document.getElementById('applyFilterBtn');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    this.applyFilters();
                });
            }

            // Reset Filter Button
            const resetBtn = document.getElementById('resetFilterBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetFilters();
                });
            }

            // Search Input with debounce
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        this.currentFilters.search = e.target.value.trim();
                        this.filterNotes();
                    }, 300);
                });
            }

            // Filter selects - apply on Enter key
            ['branchFilter', 'semesterFilter', 'typeFilter'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            this.applyFilters();
                        }
                    });
                }
            });
        },

        async loadNotes() {
            this.showLoading();
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/notes', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.allNotes = data.notes || [];
                    this.filteredNotes = [...this.allNotes];
                    this.renderNotes();
                } else {
                    throw new Error('Failed to fetch notes');
                }
            } catch (error) {
                console.error('Error loading notes:', error);
                console.log('Loading dummy data as fallback...');
                // Load dummy data for demo - don't show error if dummy data loads successfully
                this.loadDummyData();
            }
        },

        loadDummyData() {
            // Sample data for demonstration
            this.allNotes = [
                {
                    id: 1,
                    title: 'Data Structures Complete Notes',
                    subject: 'Data Structures',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.5 MB',
                    uploaded_by: 'Prof. Kumar',
                    uploaded_at: '2025-10-05',
                    downloads: 145
                },
                {
                    id: 2,
                    title: 'DBMS Previous Year Questions 2024',
                    subject: 'Database Management',
                    branch: 'CSE',
                    semester: 4,
                    type: 'pyqs',
                    file_type: 'PDF',
                    file_size: '1.8 MB',
                    uploaded_by: 'Prof. Sharma',
                    uploaded_at: '2025-10-08',
                    downloads: 89
                },
                {
                    id: 3,
                    title: 'Operating Systems Assignment 3',
                    subject: 'Operating Systems',
                    branch: 'CSE',
                    semester: 5,
                    type: 'assignments',
                    file_type: 'PDF',
                    file_size: '0.8 MB',
                    uploaded_by: 'Prof. Patel',
                    uploaded_at: '2025-10-10',
                    downloads: 67
                },
                {
                    id: 4,
                    title: 'Computer Networks Reference Book',
                    subject: 'Computer Networks',
                    branch: 'CSE',
                    semester: 5,
                    type: 'books',
                    file_type: 'PDF',
                    file_size: '15.2 MB',
                    uploaded_by: 'Library',
                    uploaded_at: '2025-09-20',
                    downloads: 234
                },
                {
                    id: 5,
                    title: 'Digital Electronics Notes',
                    subject: 'Digital Electronics',
                    branch: 'ECE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.1 MB',
                    uploaded_by: 'Prof. Reddy',
                    uploaded_at: '2025-10-02',
                    downloads: 112
                }
            ];
            this.filteredNotes = [...this.allNotes];
            this.hideLoading();
            this.renderNotes();
            console.log('Dummy data loaded successfully:', this.allNotes.length, 'notes');
        },

        applyFilters() {
            // Get filter values
            const branchSelect = document.getElementById('branchFilter');
            const semesterSelect = document.getElementById('semesterFilter');
            const typeSelect = document.getElementById('typeFilter');

            this.currentFilters.branch = branchSelect ? branchSelect.value : '';
            this.currentFilters.semester = semesterSelect ? semesterSelect.value : '';
            this.currentFilters.type = typeSelect ? typeSelect.value : '';

            // Show loading animation
            this.showLoading();

            // Animate filter application
            setTimeout(() => {
                this.filterNotes();
                if (typeof Toast !== 'undefined') {
                    Toast.success('Filters applied successfully!');
                }
            }, 500);
        },

        resetFilters() {
            // Reset all filter controls
            const branchSelect = document.getElementById('branchFilter');
            const semesterSelect = document.getElementById('semesterFilter');
            const typeSelect = document.getElementById('typeFilter');
            const searchInput = document.getElementById('searchInput');

            if (branchSelect) branchSelect.value = '';
            if (semesterSelect) semesterSelect.value = '';
            if (typeSelect) typeSelect.value = '';
            if (searchInput) searchInput.value = '';

            // Reset filter state
            this.currentFilters = {
                branch: '',
                semester: '',
                type: '',
                search: ''
            };

            // Show all notes
            this.filteredNotes = [...this.allNotes];
            this.renderNotes();

            if (typeof Toast !== 'undefined') {
                Toast.info('Filters reset');
            }
        },

        filterNotes() {
            this.filteredNotes = this.allNotes.filter(note => {
                // Branch filter
                if (this.currentFilters.branch && note.branch !== this.currentFilters.branch) {
                    return false;
                }

                // Semester filter
                if (this.currentFilters.semester && note.semester.toString() !== this.currentFilters.semester) {
                    return false;
                }

                // Type filter
                if (this.currentFilters.type && note.type !== this.currentFilters.type) {
                    return false;
                }

                // Search filter
                if (this.currentFilters.search) {
                    const searchLower = this.currentFilters.search.toLowerCase();
                    const titleMatch = note.title.toLowerCase().includes(searchLower);
                    const subjectMatch = note.subject.toLowerCase().includes(searchLower);
                    return titleMatch || subjectMatch;
                }

                return true;
            });

            this.renderNotes();
        },

        renderNotes() {
            const grid = document.getElementById('resourcesGrid');
            const loading = document.getElementById('loadingState');
            const noResults = document.getElementById('noResultsState');
            const resultCount = document.getElementById('resultCount');

            // Hide loading
            if (loading) loading.style.display = 'none';

            if (this.filteredNotes.length === 0) {
                // Show no results
                if (grid) grid.style.display = 'none';
                if (noResults) noResults.style.display = 'block';
                if (resultCount) resultCount.textContent = '';
                return;
            }

            // Show results
            if (noResults) noResults.style.display = 'none';
            if (grid) {
                grid.style.display = 'grid';
                grid.innerHTML = this.filteredNotes.map(note => this.createNoteCard(note)).join('');
            }

            // Update result count
            if (resultCount) {
                resultCount.textContent = `(${this.filteredNotes.length} result${this.filteredNotes.length !== 1 ? 's' : ''})`;
            }

            // Add animation to cards
            setTimeout(() => {
                document.querySelectorAll('.resource-card').forEach((card, index) => {
                    card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s both`;
                });
            }, 10);
        },

        createNoteCard(note) {
            const typeIcons = {
                notes: '📝',
                pyqs: '📋',
                assignments: '📄',
                books: '📚'
            };

            const typeLabels = {
                notes: 'Notes',
                pyqs: 'PYQs',
                assignments: 'Assignment',
                books: 'Book'
            };

            return `
                <div class="resource-card" data-id="${note.id}">
                    <div class="resource-header">
                        <div class="resource-icon">${typeIcons[note.type] || '📄'}</div>
                        <div class="resource-badge">${typeLabels[note.type] || 'Resource'}</div>
                    </div>
                    <h4 class="resource-title">${note.title}</h4>
                    <div class="resource-meta">
                        <span class="resource-meta-item">
                            <span>📚</span> ${note.subject}
                        </span>
                        <span class="resource-meta-item">
                            <span>🎓</span> ${note.branch} - Sem ${note.semester}
                        </span>
                        <span class="resource-meta-item">
                            <span>📊</span> ${note.file_type} - ${note.file_size}
                        </span>
                        <span class="resource-meta-item">
                            <span>📥</span> ${note.downloads} downloads
                        </span>
                    </div>
                    <div class="resource-actions">
                        <button class="btn btn-primary" onclick="NotesManager.downloadNote(${note.id})">
                            📥 Download
                        </button>
                        <button class="btn btn-secondary" onclick="NotesManager.viewNote(${note.id})">
                            👁️ View
                        </button>
                    </div>
                </div>
            `;
        },

        showLoading() {
            const loading = document.getElementById('loadingState');
            const grid = document.getElementById('resourcesGrid');
            const noResults = document.getElementById('noResultsState');

            if (loading) loading.style.display = 'block';
            if (grid) grid.style.display = 'none';
            if (noResults) noResults.style.display = 'none';
        },

        showError(message) {
            if (typeof Toast !== 'undefined') {
                Toast.error(message);
            } else {
                alert(message);
            }
        },

        async downloadNote(noteId) {
            const note = this.allNotes.find(n => n.id === noteId);
            if (!note) return;

            try {
                if (typeof Toast !== 'undefined') {
                    Toast.info(`Downloading ${note.title}...`);
                }

                const token = localStorage.getItem('token');
                const response = await fetch(`/api/notes/${noteId}/download`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = note.title + '.' + note.file_type.toLowerCase();
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);

                    if (typeof Toast !== 'undefined') {
                        Toast.success('Download started successfully!');
                    }

                    // Update recent downloads
                    this.addToRecentDownloads(note);
                } else {
                    throw new Error('Download failed');
                }
            } catch (error) {
                console.error('Download error:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.error('Failed to download file. Please try again.');
                }
            }
        },

        async viewNote(noteId) {
            const note = this.allNotes.find(n => n.id === noteId);
            if (!note) return;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/notes/${noteId}/view`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    window.open(data.viewUrl, '_blank');
                } else {
                    throw new Error('View failed');
                }
            } catch (error) {
                console.error('View error:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.error('Failed to open file preview.');
                }
            }
        },

        addToRecentDownloads(note) {
            let recent = JSON.parse(localStorage.getItem('recentDownloads') || '[]');
            
            // Add to beginning, remove if already exists
            recent = recent.filter(r => r.id !== note.id);
            recent.unshift({
                ...note,
                downloadedAt: new Date().toISOString()
            });

            // Keep only last 10
            recent = recent.slice(0, 10);
            
            localStorage.setItem('recentDownloads', JSON.stringify(recent));
            this.loadRecentDownloads();
        },

        loadRecentDownloads() {
            const container = document.getElementById('recentDownloads');
            if (!container) return;

            const recent = JSON.parse(localStorage.getItem('recentDownloads') || '[]');

            if (recent.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No recent downloads yet
                    </div>
                `;
                return;
            }

            container.innerHTML = recent.map(note => `
                <div class="recent-item">
                    <div class="recent-icon">📥</div>
                    <div class="recent-details">
                        <div class="recent-name">${note.title}</div>
                        <div class="recent-time">${this.formatDate(note.downloadedAt)}</div>
                    </div>
                </div>
            `).join('');
        },

        async loadStats() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/notes/stats', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const stats = await response.json();
                    this.updateStats(stats);
                } else {
                    // Use dummy stats
                    this.updateStats({
                        totalNotes: this.allNotes.length,
                        downloadedNotes: 12,
                        savedNotes: 8,
                        totalSubjects: new Set(this.allNotes.map(n => n.subject)).size
                    });
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        },

        updateStats(stats) {
            const elements = {
                totalNotes: document.getElementById('totalNotes'),
                downloadedNotes: document.getElementById('downloadedNotes'),
                savedNotes: document.getElementById('savedNotes'),
                totalSubjects: document.getElementById('totalSubjects')
            };

            if (elements.totalNotes) elements.totalNotes.textContent = stats.totalNotes || 0;
            if (elements.downloadedNotes) elements.downloadedNotes.textContent = stats.downloadedNotes || 0;
            if (elements.savedNotes) elements.savedNotes.textContent = stats.savedNotes || 0;
            if (elements.totalSubjects) elements.totalSubjects.textContent = stats.totalSubjects || 0;
        },

        formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
            
            return date.toLocaleDateString();
        }
    };

    // CSS Animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NotesManager.init();
        });
    } else {
        NotesManager.init();
    }

    // Expose globally
    window.NotesManager = NotesManager;
})();
