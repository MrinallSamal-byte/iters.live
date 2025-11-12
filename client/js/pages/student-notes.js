// Student Notes & Resources Page
(function() {
    'use strict';

    let currentResourceType = 'notes';
    let allResources = [];
    let currentUser = null;

    // Sample subjects data for demonstration
    const sampleSubjects = {
        'CSE': {
            '2': [
                { name: 'Data Structures', code: 'CSE201' },
                { name: 'Database Systems', code: 'CSE202' },
                { name: 'Computer Networks', code: 'CSE203' },
                { name: 'Software Engineering', code: 'CSE204' }
            ]
        }
    };

    // Sample resources for each subject
    const sampleResources = {
        'notes': {
            'CSE201': [
                { name: 'Arrays & Linked Lists', size: '2.5 MB', type: 'pdf' },
                { name: 'Stacks & Queues', size: '1.8 MB', type: 'pdf' },
                { name: 'Trees & Graphs', size: '3.2 MB', type: 'pdf' },
                { name: 'Sorting Algorithms', size: '2.1 MB', type: 'pdf' }
            ],
            'CSE202': [
                { name: 'ER Diagrams', size: '1.5 MB', type: 'pdf' },
                { name: 'SQL Queries', size: '2.0 MB', type: 'pdf' },
                { name: 'Normalization', size: '1.7 MB', type: 'pdf' },
                { name: 'Transactions', size: '1.9 MB', type: 'pdf' }
            ],
            'CSE203': [
                { name: 'OSI Model', size: '2.3 MB', type: 'pdf' },
                { name: 'TCP/IP Protocol', size: '2.8 MB', type: 'pdf' },
                { name: 'Routing Algorithms', size: '2.4 MB', type: 'pdf' },
                { name: 'Network Security', size: '3.1 MB', type: 'pdf' }
            ]
        },
        'pyq': {
            'CSE201': [
                { name: '2024 Mid Semester', size: '856 KB', type: 'pdf' },
                { name: '2024 End Semester', size: '942 KB', type: 'pdf' },
                { name: '2023 Mid Semester', size: '789 KB', type: 'pdf' }
            ],
            'CSE202': [
                { name: '2024 Mid Semester', size: '723 KB', type: 'pdf' },
                { name: '2024 End Semester', size: '891 KB', type: 'pdf' }
            ]
        },
        'books': {
            'CSE201': [
                { name: 'Introduction to Algorithms - CLRS', size: '15.2 MB', type: 'pdf' },
                { name: 'Data Structures Using C - Tanenbaum', size: '12.8 MB', type: 'pdf' }
            ],
            'CSE202': [
                { name: 'Database System Concepts - Korth', size: '18.5 MB', type: 'pdf' },
                { name: 'SQL Fundamentals', size: '8.3 MB', type: 'pdf' }
            ]
        },
        'syllabus': {
            'CSE201': [
                { name: 'Data Structures Syllabus 2024', size: '245 KB', type: 'pdf' }
            ],
            'CSE202': [
                { name: 'Database Systems Syllabus 2024', size: '198 KB', type: 'pdf' }
            ]
        }
    };

    async function init() {
        await loadUserData();
        setupEventListeners();
        loadResources();
    }

    async function loadUserData() {
        try {
            const token = localStorage.getItem('token');
            
            // Check authentication - use APP if available
            if (typeof APP !== 'undefined') {
                if (!APP.isAuthenticated()) {
                    console.warn('Not authenticated, returning to dashboard');
                    window.location.href = 'student.html';
                    return;
                }
                // Get user from APP
                currentUser = APP.Storage.get('user');
            } else if (!token) {
                console.warn('No token, returning to dashboard');
                window.location.href = 'student.html';
                return;
            } else {
                // Fetch user data with token
                const response = await fetch('/api/users/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) throw new Error('Failed to load user data');

                currentUser = await response.json();
            }
            
            // Set filters based on user data
            const branchFilter = document.getElementById('branchFilter');
            const semesterFilter = document.getElementById('semesterFilter');
            
            if (branchFilter && currentUser.department) {
                branchFilter.value = currentUser.department;
            }
            
            if (semesterFilter && currentUser.semester) {
                semesterFilter.value = currentUser.semester;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    function setupEventListeners() {
        // Resource tabs
        const tabs = document.querySelectorAll('.resource-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentResourceType = this.dataset.type;
                loadResources();
            });
        });

        // Apply filter button
        const applyBtn = document.getElementById('applyFilterBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', loadResources);
        }
    }

    async function loadResources() {
        const branch = document.getElementById('branchFilter').value || 'CSE';
        const semester = document.getElementById('semesterFilter').value || '2';
        
        try {
            // Try to fetch from API first
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files?file_type=${currentResourceType}&approved=true`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                allResources = data.data || [];
            }
        } catch (error) {
            console.log('Using sample data');
        }

        // Use sample data for demonstration
        displayResources(branch, semester);
    }

    function displayResources(branch, semester) {
        const contentEl = document.getElementById('resourceContent');
        if (!contentEl) return;

        const subjects = sampleSubjects[branch]?.[semester] || [];
        const resources = sampleResources[currentResourceType] || {};

        if (subjects.length === 0) {
            contentEl.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <p style="color: #888;">No subjects found for the selected filters.</p>
                </div>
            `;
            return;
        }

        let html = '';
        subjects.forEach(subject => {
            const subjectResources = resources[subject.code] || [];
            
            html += `
                <div class="subject-card">
                    <div class="subject-title">${subject.name}</div>
                    <div class="resource-list">
                        ${subjectResources.length > 0 
                            ? subjectResources.map(resource => `
                                <div class="resource-item">
                                    <span class="resource-icon">📄</span>
                                    <div class="resource-info">
                                        <div class="resource-name">${resource.name}</div>
                                        <div class="resource-meta">${resource.size} • ${resource.type.toUpperCase()}</div>
                                    </div>
                                    <button class="download-btn" onclick="handleDownload('${resource.name}')">
                                        ⬇️ Download
                                    </button>
                                </div>
                            `).join('')
                            : '<p style="color: #888; text-align: center; padding: 20px;">No resources available</p>'
                        }
                    </div>
                </div>
            `;
        });

        contentEl.innerHTML = html;
    }

    // Make download function globally accessible
    window.handleDownload = function(resourceName) {
        window.APP.showToast(`Downloading: ${resourceName}`, 'info');
        // Implement actual download logic here
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
