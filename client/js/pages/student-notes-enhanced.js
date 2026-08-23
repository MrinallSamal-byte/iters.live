// ============================================
// ENHANCED STUDENT NOTES PAGE
// With Branch, Semester, Type, PYQ Features
// and Google Drive Resources Integration
// ============================================

(function() {
    'use strict';

    // Google Drive folder configuration - Semester-specific folders
    const DRIVE_BASE_URL = 'https://drive.google.com';
    const DRIVE_VIEW_URL = `${DRIVE_BASE_URL}/file/d/`;
    const DRIVE_FOLDER_URL = `${DRIVE_BASE_URL}/drive/folders/`;
    
    // Semester-specific Google Drive folder IDs
    const SEMESTER_FOLDER_IDS = {
        1: '19eD6lO_ZITSCaFdD2cH3oaSOwu6QlcZd',
        2: '1ajqpRqYCntqOO6MnS_IYezU_3i_HPMdD',
        3: '1rY3THSdETNyJ-40J4olVVB5BgoW19nYA',
        4: '1lCp6gst04w-QWR6hBVKDlIRk3H_jsWen',
        5: '1WjEVA_KqnbLN1Lr4O_UnqZJyg24lhZHZ'
    };
    
    // Default folder ID for semesters 6-8 (uses semester 5 folder as fallback)
    const DEFAULT_FOLDER_ID = SEMESTER_FOLDER_IDS[5];
    
    // Helper function to get folder ID for a semester
    function getSemesterFolderId(semester) {
        return SEMESTER_FOLDER_IDS[semester] || DEFAULT_FOLDER_ID;
    }

    // Shared constant for link type labels (used in createNoteCard and openTypeLink)
    const LINK_TYPE_LABELS = {
        previousYearQuestions: { label: 'PYQ', icon: '📋', tooltip: 'Previous Year Questions' },
        classNotes: { label: 'Notes', icon: '📝', tooltip: 'Class Notes' },
        midTerm: { label: 'Mid-Term', icon: '📄', tooltip: 'Mid-Term Papers' }
    };

    // Whitelist of valid link type keys for security
    const VALID_LINK_TYPES = Object.keys(LINK_TYPE_LABELS);

    const NotesManager = {
        currentFilters: {
            branch: '',
            semester: '',
            type: '',
            examType: '',
            search: ''
        },
        allNotes: [],
        filteredNotes: [],

        esc(str) {
            return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        },

        jsId(id) {
            return String(id ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        },

        findNote(noteId) {
            return this.allNotes.find(n => String(n.id) === String(noteId));
        },

        init() {
            this.setupEventListeners();
            this.handleUrlParams();
            this.loadNotes();
            this.loadStats();
            this.loadRecentDownloads();
        },

        handleUrlParams() {
            // Check for URL parameters to pre-select filters
            const urlParams = new URLSearchParams(window.location.search);
            const typeParam = urlParams.get('type');
            
            if (typeParam) {
                const typeSelect = document.getElementById('typeFilter');
                if (typeSelect) {
                    typeSelect.value = typeParam;
                    this.currentFilters.type = typeParam;
                    
                    // Show PYQ-specific elements if type is pyqs
                    if (typeParam === 'pyqs') {
                        this.togglePYQElements(true);
                    }
                }
            }
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

            // Type filter - show/hide PYQ-specific elements
            const typeFilter = document.getElementById('typeFilter');
            if (typeFilter) {
                typeFilter.addEventListener('change', (e) => {
                    this.togglePYQElements(e.target.value === 'pyqs');
                });
            }

            // Exam Type filter for PYQs
            const examTypeFilter = document.getElementById('examTypeFilter');
            if (examTypeFilter) {
                examTypeFilter.addEventListener('change', () => {
                    this.applyFilters();
                });
            }

            // Popular Subject Tags
            document.querySelectorAll('.subject-tag').forEach(tag => {
                tag.addEventListener('click', (e) => {
                    const subject = e.currentTarget.dataset.subject;
                    this.filterBySubject(subject);
                    // Toggle active state
                    document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                });
            });

            // Filter selects - apply on Enter key
            ['branchFilter', 'semesterFilter', 'typeFilter', 'examTypeFilter'].forEach(id => {
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

        togglePYQElements(show) {
            const examTypeGroup = document.getElementById('examTypeFilterGroup');
            const popularSubjects = document.getElementById('popularSubjectsSection');
            const requestSection = document.getElementById('requestPaperSection');

            if (examTypeGroup) examTypeGroup.style.display = show ? 'flex' : 'none';
            if (popularSubjects) popularSubjects.style.display = show ? 'block' : 'none';
            if (requestSection) requestSection.style.display = show ? 'block' : 'none';
        },

        filterBySubject(subject) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                const subjectNames = {
                    'data-structures': 'Data Structures',
                    'algorithms': 'Algorithms',
                    'dbms': 'Database',
                    'os': 'Operating Systems',
                    'cn': 'Computer Networks',
                    'ml': 'Machine Learning',
                    'oops': 'Object Oriented',
                    'se': 'Software Engineering'
                };
                searchInput.value = subjectNames[subject] || subject;
                this.currentFilters.search = subjectNames[subject] || subject;
                this.filterNotes();
            }
        },

        async requestPaper() {
            const subject = document.getElementById('requestSubject')?.value;
            const year = document.getElementById('requestYear')?.value;
            const examType = document.getElementById('requestExamType')?.value;

            if (!subject || !year) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('Please enter subject name and year');
                } else {
                    console.warn('Please enter subject name and year');
                }
                return;
            }

            try {
                const token = APP.Storage.get('accessToken');
                const response = await fetch('/api/pyq/requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ subject, year, examType })
                });

                if (response.ok) {
                    if (typeof Toast !== 'undefined') {
                        Toast.success('Request submitted successfully! We will try to add this paper.');
                    }
                    // Clear form
                    document.getElementById('requestSubject').value = '';
                    document.getElementById('requestYear').value = '';
                    document.getElementById('requestExamType').value = '';
                } else {
                    throw new Error('Request failed');
                }
            } catch (error) {
                console.error('Request error:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.info('Request noted! We will try to add this paper to our collection.');
                }
                // Clear form anyway for demo
                document.getElementById('requestSubject').value = '';
                document.getElementById('requestYear').value = '';
                document.getElementById('requestExamType').value = '';
            }
        },

        async loadNotes() {
            this.showLoading();
            
            try {
                const token = APP.Storage.get('accessToken');
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
            // Academic Subject Data organized by semester (1-6)
            // Each subject has: subject code, full name, and direct Google Drive link
            // NOTE: Some subjects share Google Drive folders as per the source dataset:
            // - DLD (Sem 3) and COA (Sem 4) share the same folder
            // - IES (Sem 3) and IDM (Sem 4) share the same folder
            // - IM (Introduction to Microeconomics) appears in both Sem 3 and Sem 4 with the same folder
            this.allNotes = [
                // ===============================
                // SEMESTER 1 - Subject Notes
                // ===============================
                {
                    id: 101,
                    title: 'Universal Physics and Mechanics',
                    subjectCode: 'UPM',
                    subject: 'Universal Physics and Mechanics',
                    branch: 'CSE',
                    semester: 1,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-15',
                    downloads: 245,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1EI_Pr2QIAENS4t4lqdJpRqTYjMejy0co',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1EI_Pr2QIAENS4t4lqdJpRqTYjMejy0co?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1EI_Pr2QIAENS4t4lqdJpRqTYjMejy0co?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1EI_Pr2QIAENS4t4lqdJpRqTYjMejy0co',
                    drivePath: 'Semester 1/UPM/'
                },
                {
                    id: 102,
                    title: 'Calculus A',
                    subjectCode: 'CALCULUS A',
                    subject: 'Calculus A',
                    branch: 'CSE',
                    semester: 1,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-10',
                    downloads: 189,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1qHImcccEFqyRmDV6yBv1oBnMvdo2w07j',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1qHImcccEFqyRmDV6yBv1oBnMvdo2w07j?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1qHImcccEFqyRmDV6yBv1oBnMvdo2w07j?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1qHImcccEFqyRmDV6yBv1oBnMvdo2w07j?midterm'
                        }
                    },
                    driveFolderId: '1qHImcccEFqyRmDV6yBv1oBnMvdo2w07j',
                    drivePath: 'Semester 1/Calculus A/'
                },
                {
                    id: 103,
                    title: 'Universal Human Values',
                    subjectCode: 'UHV',
                    subject: 'Universal Human Values',
                    branch: 'CSE',
                    semester: 1,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '1.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-08',
                    downloads: 156,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1w12sn8Q3MZq4SZ-L-2BAiOyI8pfCbHtX',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/1w12sn8Q3MZq4SZ-L-2BAiOyI8pfCbHtX?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1w12sn8Q3MZq4SZ-L-2BAiOyI8pfCbHtX',
                    drivePath: 'Semester 1/UHV/'
                },
                {
                    id: 104,
                    title: 'Introduction to Computer Programming',
                    subjectCode: 'ICP',
                    subject: 'Introduction to Computer Programming',
                    branch: 'CSE',
                    semester: 1,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-05',
                    downloads: 312,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1qDS9s575O8EWHluJklhjwggXTQIjFn6a',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1qDS9s575O8EWHluJklhjwggXTQIjFn6a?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1qDS9s575O8EWHluJklhjwggXTQIjFn6a?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1qDS9s575O8EWHluJklhjwggXTQIjFn6a?midterm'
                        }
                    },
                    driveFolderId: '1qDS9s575O8EWHluJklhjwggXTQIjFn6a',
                    drivePath: 'Semester 1/ICP/'
                },
                {
                    id: 105,
                    title: 'Discrete Mathematics',
                    subjectCode: 'DM',
                    subject: 'Discrete Mathematics',
                    branch: 'CSE',
                    semester: 1,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.4 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-12',
                    downloads: 278,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1Ydwgzm-bzsTTMGY8uFfUkUNSUvoOil6q',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1Ydwgzm-bzsTTMGY8uFfUkUNSUvoOil6q?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1Ydwgzm-bzsTTMGY8uFfUkUNSUvoOil6q?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1Ydwgzm-bzsTTMGY8uFfUkUNSUvoOil6q',
                    drivePath: 'Semester 1/DM/'
                },

                // ===============================
                // SEMESTER 2 - Subject Notes
                // ===============================
                {
                    id: 201,
                    title: 'Universal Physics Electrics and Mechanics',
                    subjectCode: 'UPEM',
                    subject: 'Universal Physics Electrics and Mechanics',
                    branch: 'CSE',
                    semester: 2,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-20',
                    downloads: 267,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1vWTmv1IFnxzP2iJXpfpyduIYBLU2mkz1',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1vWTmv1IFnxzP2iJXpfpyduIYBLU2mkz1?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1vWTmv1IFnxzP2iJXpfpyduIYBLU2mkz1?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1vWTmv1IFnxzP2iJXpfpyduIYBLU2mkz1?midterm'
                        }
                    },
                    driveFolderId: '1vWTmv1IFnxzP2iJXpfpyduIYBLU2mkz1',
                    drivePath: 'Semester 2/UPEM/'
                },
                {
                    id: 202,
                    title: 'Calculus B',
                    subjectCode: 'CALCULUS B',
                    subject: 'Calculus B',
                    branch: 'CSE',
                    semester: 2,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.9 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-18',
                    downloads: 198,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1wrg-ZXp36GBcFNBL5Zm7xbje7a2ET0Hc',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1wrg-ZXp36GBcFNBL5Zm7xbje7a2ET0Hc?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1wrg-ZXp36GBcFNBL5Zm7xbje7a2ET0Hc?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1wrg-ZXp36GBcFNBL5Zm7xbje7a2ET0Hc?midterm'
                        }
                    },
                    driveFolderId: '1wrg-ZXp36GBcFNBL5Zm7xbje7a2ET0Hc',
                    drivePath: 'Semester 2/Calculus B/'
                },
                {
                    id: 203,
                    title: 'Introduction to Technical Writing',
                    subjectCode: 'ITW',
                    subject: 'Introduction to Technical Writing',
                    branch: 'CSE',
                    semester: 2,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '1.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-15',
                    downloads: 145,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/13XNoaqgL8VK6qRnHgdfJfjLUqaoHMKmc',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/13XNoaqgL8VK6qRnHgdfJfjLUqaoHMKmc?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '13XNoaqgL8VK6qRnHgdfJfjLUqaoHMKmc',
                    drivePath: 'Semester 2/ITW/'
                },
                {
                    id: 204,
                    title: 'Data Structures and Algorithms',
                    subjectCode: 'DSA',
                    subject: 'Data Structures and Algorithms',
                    branch: 'CSE',
                    semester: 2,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-22',
                    downloads: 534,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1FBRMN47L049gPx2C4MVkBXRwUeDjgCUD',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1FBRMN47L049gPx2C4MVkBXRwUeDjgCUD?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1FBRMN47L049gPx2C4MVkBXRwUeDjgCUD?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1FBRMN47L049gPx2C4MVkBXRwUeDjgCUD?midterm'
                        }
                    },
                    driveFolderId: '1FBRMN47L049gPx2C4MVkBXRwUeDjgCUD',
                    drivePath: 'Semester 2/DSA/'
                },
                {
                    id: 205,
                    title: 'Introduction to Graph Theory',
                    subjectCode: 'IGT',
                    subject: 'Introduction to Graph Theory',
                    branch: 'CSE',
                    semester: 2,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.3 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-01-25',
                    downloads: 223,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1737Jx4RIWRUGgLKJQgl4Jj4ocXJCb7fc',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1737Jx4RIWRUGgLKJQgl4Jj4ocXJCb7fc?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1737Jx4RIWRUGgLKJQgl4Jj4ocXJCb7fc?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1737Jx4RIWRUGgLKJQgl4Jj4ocXJCb7fc',
                    drivePath: 'Semester 2/IGT/'
                },

                // ===============================
                // SEMESTER 3 - Subject Notes
                // ===============================
                {
                    id: 301,
                    title: 'Field Programmable Gate Array',
                    subjectCode: 'FPGA',
                    subject: 'Field Programmable Gate Array',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-01',
                    downloads: 189,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1f2D9jn0kn8mT2GZyD5nWdEaJOwXXi9tF',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1f2D9jn0kn8mT2GZyD5nWdEaJOwXXi9tF?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1f2D9jn0kn8mT2GZyD5nWdEaJOwXXi9tF?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1f2D9jn0kn8mT2GZyD5nWdEaJOwXXi9tF',
                    drivePath: 'Semester 3/FPGA/'
                },
                {
                    id: 302,
                    title: 'Computer Science Workshop - I',
                    subjectCode: 'CSW',
                    subject: 'Computer Science Workshop - I',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-03',
                    downloads: 312,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/11y8iBePAW1ailt6rxHpulm5ctrFpFjB2',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/11y8iBePAW1ailt6rxHpulm5ctrFpFjB2?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '11y8iBePAW1ailt6rxHpulm5ctrFpFjB2',
                    drivePath: 'Semester 3/CSW/'
                },
                {
                    id: 303,
                    title: 'Probability and Statistics',
                    subjectCode: 'PS',
                    subject: 'Probability and Statistics',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-05',
                    downloads: 267,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/12N_tI3O0Ul0J7Wqd9ZUzW3dAzwdbhZJa',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/12N_tI3O0Ul0J7Wqd9ZUzW3dAzwdbhZJa?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/12N_tI3O0Ul0J7Wqd9ZUzW3dAzwdbhZJa?notes',
                            midTerm: 'https://drive.google.com/drive/folders/12N_tI3O0Ul0J7Wqd9ZUzW3dAzwdbhZJa?midterm'
                        }
                    },
                    driveFolderId: '12N_tI3O0Ul0J7Wqd9ZUzW3dAzwdbhZJa',
                    drivePath: 'Semester 3/PS/'
                },
                {
                    id: 304,
                    title: 'Digital Logic and Design',
                    subjectCode: 'DLD',
                    subject: 'Digital Logic and Design',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.4 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-07',
                    downloads: 345,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?midterm'
                        }
                    },
                    driveFolderId: '1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x',
                    drivePath: 'Semester 3/DLD/'
                },
                {
                    id: 305,
                    title: 'Introduction to Environmental Science',
                    subjectCode: 'IES',
                    subject: 'Introduction to Environmental Science',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '1.9 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-08',
                    downloads: 156,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr',
                    drivePath: 'Semester 3/IES/'
                },
                {
                    id: 306,
                    title: 'Algorithms and Design - I',
                    subjectCode: 'AD 1',
                    subject: 'Algorithms and Design - I',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-10',
                    downloads: 423,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1cmt1FArJDZ5e0jGJvWN2qxhQ-hpCdKZW',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1cmt1FArJDZ5e0jGJvWN2qxhQ-hpCdKZW?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1cmt1FArJDZ5e0jGJvWN2qxhQ-hpCdKZW?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1cmt1FArJDZ5e0jGJvWN2qxhQ-hpCdKZW?midterm'
                        }
                    },
                    driveFolderId: '1cmt1FArJDZ5e0jGJvWN2qxhQ-hpCdKZW',
                    drivePath: 'Semester 3/AD1/'
                },
                {
                    id: 307,
                    title: 'Introduction to Microeconomics',
                    subjectCode: 'IM',
                    subject: 'Introduction to Microeconomics',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-12',
                    downloads: 178,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc',
                    drivePath: 'Semester 3/IM/'
                },
                {
                    id: 308,
                    title: 'Introduction to Artificial Intelligence',
                    subjectCode: 'AI',
                    subject: 'Introduction to Artificial Intelligence',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-14',
                    downloads: 567,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1kuvQDq39YI6DG_hmejcs4whOhplYD7yw',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1kuvQDq39YI6DG_hmejcs4whOhplYD7yw?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1kuvQDq39YI6DG_hmejcs4whOhplYD7yw?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1kuvQDq39YI6DG_hmejcs4whOhplYD7yw?midterm'
                        }
                    },
                    driveFolderId: '1kuvQDq39YI6DG_hmejcs4whOhplYD7yw',
                    drivePath: 'Semester 3/AI/'
                },
                {
                    id: 309,
                    title: 'Machine Learning Workshop - I',
                    subjectCode: 'MLW',
                    subject: 'Machine Learning Workshop - I',
                    branch: 'CSE',
                    semester: 3,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-16',
                    downloads: 489,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1fSvQ67HCm28t6LN7cZ9Lb8-nKd2d5J64',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/1fSvQ67HCm28t6LN7cZ9Lb8-nKd2d5J64?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1fSvQ67HCm28t6LN7cZ9Lb8-nKd2d5J64',
                    drivePath: 'Semester 3/MLW/'
                },

                // ===============================
                // SEMESTER 4 - Subject Notes
                // ===============================
                {
                    id: 401,
                    title: 'Computer Science Workshop - II',
                    subjectCode: 'CSW-II',
                    subject: 'Computer Science Workshop - II',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.7 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-18',
                    downloads: 334,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1Q4ssemkq7RWy4mgZtxm0roydqdVD9tjS',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/1Q4ssemkq7RWy4mgZtxm0roydqdVD9tjS?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1Q4ssemkq7RWy4mgZtxm0roydqdVD9tjS',
                    drivePath: 'Semester 4/CSW-II/'
                },
                {
                    id: 402,
                    title: 'Applied Linear Algebra',
                    subjectCode: 'ALA',
                    subject: 'Applied Linear Algebra',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-20',
                    downloads: 289,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1S4fMwpVETQ_3hjIfh47pl4LSicZprFAm',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1S4fMwpVETQ_3hjIfh47pl4LSicZprFAm?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1S4fMwpVETQ_3hjIfh47pl4LSicZprFAm?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1S4fMwpVETQ_3hjIfh47pl4LSicZprFAm?midterm'
                        }
                    },
                    driveFolderId: '1S4fMwpVETQ_3hjIfh47pl4LSicZprFAm',
                    drivePath: 'Semester 4/ALA/'
                },
                {
                    id: 403,
                    title: 'Computer Organisation and Architecture',
                    subjectCode: 'COA',
                    subject: 'Computer Organisation and Architecture',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.9 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-22',
                    downloads: 456,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x?midterm'
                        }
                    },
                    driveFolderId: '1UYnyiLal-bwoe28iw6RHyZCmEa9fRi4x',
                    drivePath: 'Semester 4/COA/'
                },
                {
                    id: 404,
                    title: 'Introduction to Disaster Management',
                    subjectCode: 'IDM',
                    subject: 'Introduction to Disaster Management',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-24',
                    downloads: 167,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr',
                        types: {
                            previousYearQuestions: null,
                            classNotes: 'https://drive.google.com/drive/folders/1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1-7yeL6GxA8DZsdEh0sh-JlLVQxKdPvfr',
                    drivePath: 'Semester 4/IDM/'
                },
                {
                    id: 405,
                    title: 'Algorithms and Design - II',
                    subjectCode: 'AD 2',
                    subject: 'Algorithms and Design - II',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.0 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-26',
                    downloads: 512,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1KcT-lVag-kV5OpZA_dxT4JTRcPaIxDn6',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1KcT-lVag-kV5OpZA_dxT4JTRcPaIxDn6?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1KcT-lVag-kV5OpZA_dxT4JTRcPaIxDn6?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1KcT-lVag-kV5OpZA_dxT4JTRcPaIxDn6?midterm'
                        }
                    },
                    driveFolderId: '1KcT-lVag-kV5OpZA_dxT4JTRcPaIxDn6',
                    drivePath: 'Semester 4/AD2/'
                },
                {
                    id: 406,
                    title: 'Introduction to Microeconomics',
                    subjectCode: 'IM',
                    subject: 'Introduction to Microeconomics',
                    branch: 'CSE',
                    semester: 4,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.3 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-02-28',
                    downloads: 198,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1ZY5rPHL44JrilDc-XZZ43F7_NqaWMroPc',
                    drivePath: 'Semester 4/IM/'
                },

                // ===============================
                // SEMESTER 5 - Subject Notes
                // ===============================
                {
                    id: 501,
                    title: 'Practical Programming with C',
                    subjectCode: 'C',
                    subject: 'Practical Programming with C',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-01',
                    downloads: 423,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/10Rz8FR5mP1o9HH-MdmZnSJsed_7ZvnCT',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/10Rz8FR5mP1o9HH-MdmZnSJsed_7ZvnCT?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/10Rz8FR5mP1o9HH-MdmZnSJsed_7ZvnCT?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '10Rz8FR5mP1o9HH-MdmZnSJsed_7ZvnCT',
                    drivePath: 'Semester 5/C/'
                },
                {
                    id: 502,
                    title: 'Design of Operating System',
                    subjectCode: 'OS',
                    subject: 'Design of Operating System',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-03',
                    downloads: 567,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1TANZsdRdsNAXTqJvjTI2gFY6h6kbbmtW',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1TANZsdRdsNAXTqJvjTI2gFY6h6kbbmtW?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1TANZsdRdsNAXTqJvjTI2gFY6h6kbbmtW?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1TANZsdRdsNAXTqJvjTI2gFY6h6kbbmtW?midterm'
                        }
                    },
                    driveFolderId: '1TANZsdRdsNAXTqJvjTI2gFY6h6kbbmtW',
                    drivePath: 'Semester 5/OS/'
                },
                {
                    id: 503,
                    title: 'Computer Networking: Concepts',
                    subjectCode: 'Networking',
                    subject: 'Computer Networking: Concepts',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-05',
                    downloads: 489,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1ffp0UK0i4G8pD1mKjPIC6EOufPs2GQHb',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1ffp0UK0i4G8pD1mKjPIC6EOufPs2GQHb?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1ffp0UK0i4G8pD1mKjPIC6EOufPs2GQHb?notes',
                            midTerm: 'https://drive.google.com/drive/folders/1ffp0UK0i4G8pD1mKjPIC6EOufPs2GQHb?midterm'
                        }
                    },
                    driveFolderId: '1ffp0UK0i4G8pD1mKjPIC6EOufPs2GQHb',
                    drivePath: 'Semester 5/Networking/'
                },
                {
                    id: 504,
                    title: 'Python Programming',
                    subjectCode: 'Python',
                    subject: 'Python Programming',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-07',
                    downloads: 612,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1x81F5_NGrNutR7u8NTW4kKg7UftAL5GA',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1x81F5_NGrNutR7u8NTW4kKg7UftAL5GA?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1x81F5_NGrNutR7u8NTW4kKg7UftAL5GA?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1x81F5_NGrNutR7u8NTW4kKg7UftAL5GA',
                    drivePath: 'Semester 5/Python/'
                },
                {
                    id: 505,
                    title: 'Introduction to Theory of Computation',
                    subjectCode: 'Theory Computation',
                    subject: 'Introduction to Theory of Computation',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '2.9 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-09',
                    downloads: 345,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/14Vd4nADRgnRLJU_DrpYIuq3rETIGj3YY',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/14Vd4nADRgnRLJU_DrpYIuq3rETIGj3YY?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/14Vd4nADRgnRLJU_DrpYIuq3rETIGj3YY?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '14Vd4nADRgnRLJU_DrpYIuq3rETIGj3YY',
                    drivePath: 'Semester 5/Theory Computation/'
                },
                {
                    id: 506,
                    title: 'Foundation of Machine Learning',
                    subjectCode: 'Machine Learning',
                    subject: 'Foundation of Machine Learning',
                    branch: 'CSE',
                    semester: 5,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.2 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-11',
                    downloads: 534,
                    isGoogleDrive: true,
                    links: {
                        root: null,
                        types: {
                            previousYearQuestions: null,
                            classNotes: null,
                            midTerm: null
                        }
                    },
                    driveFolderId: null,
                    drivePath: 'Semester 5/Machine Learning/',
                    noLinkAvailable: true
                },

                // ===============================
                // SEMESTER 6 - Subject Notes
                // ===============================
                {
                    id: 601,
                    title: 'Game Programming with C++',
                    subjectCode: 'C++',
                    subject: 'Game Programming with C++',
                    branch: 'CSE',
                    semester: 6,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.6 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-13',
                    downloads: 278,
                    isGoogleDrive: true,
                    links: {
                        root: null,
                        types: {
                            previousYearQuestions: null,
                            classNotes: null,
                            midTerm: null
                        }
                    },
                    driveFolderId: null,
                    drivePath: 'Semester 6/C++/',
                    noLinkAvailable: true
                },
                {
                    id: 602,
                    title: 'Introduction to Databases',
                    subjectCode: 'Databases',
                    subject: 'Introduction to Databases',
                    branch: 'CSE',
                    semester: 6,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.1 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-15',
                    downloads: 456,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/13uZPTMbGcSqpIRCabrusaQ07ECwR-zrF',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/13uZPTMbGcSqpIRCabrusaQ07ECwR-zrF?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/13uZPTMbGcSqpIRCabrusaQ07ECwR-zrF?notes',
                            midTerm: 'https://drive.google.com/drive/folders/13uZPTMbGcSqpIRCabrusaQ07ECwR-zrF?midterm'
                        }
                    },
                    driveFolderId: '13uZPTMbGcSqpIRCabrusaQ07ECwR-zrF',
                    drivePath: 'Semester 6/Databases/'
                },
                {
                    id: 603,
                    title: 'Computer Networking: Security',
                    subjectCode: 'Security',
                    subject: 'Computer Networking: Security',
                    branch: 'CSE',
                    semester: 6,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '3.4 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-17',
                    downloads: 389,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1h54x1_TMzOGv9vC9B8eF0GbPLi-Umkff',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1h54x1_TMzOGv9vC9B8eF0GbPLi-Umkff?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1h54x1_TMzOGv9vC9B8eF0GbPLi-Umkff?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1h54x1_TMzOGv9vC9B8eF0GbPLi-Umkff',
                    drivePath: 'Semester 6/Security/'
                },
                {
                    id: 604,
                    title: 'Compiler Principles, Techniques and Tools',
                    subjectCode: 'Compilers',
                    subject: 'Compiler Principles, Techniques and Tools',
                    branch: 'CSE',
                    semester: 6,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.8 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-19',
                    downloads: 312,
                    isGoogleDrive: true,
                    links: {
                        root: 'https://drive.google.com/drive/folders/1R9ljdlD8LZNLqsOWcsaZaBlTncTeAmnX',
                        types: {
                            previousYearQuestions: 'https://drive.google.com/drive/folders/1R9ljdlD8LZNLqsOWcsaZaBlTncTeAmnX?pyq',
                            classNotes: 'https://drive.google.com/drive/folders/1R9ljdlD8LZNLqsOWcsaZaBlTncTeAmnX?notes',
                            midTerm: null
                        }
                    },
                    driveFolderId: '1R9ljdlD8LZNLqsOWcsaZaBlTncTeAmnX',
                    drivePath: 'Semester 6/Compilers/'
                },
                {
                    id: 605,
                    title: 'Fundamentals of Machine Learning',
                    subjectCode: 'Machine Learning',
                    subject: 'Fundamentals of Machine Learning',
                    branch: 'CSE',
                    semester: 6,
                    type: 'notes',
                    file_type: 'PDF',
                    file_size: '4.5 MB',
                    uploaded_by: 'Google Drive',
                    uploaded_at: '2025-03-21',
                    downloads: 467,
                    isGoogleDrive: true,
                    links: {
                        root: null,
                        types: {
                            previousYearQuestions: null,
                            classNotes: null,
                            midTerm: null
                        }
                    },
                    driveFolderId: null,
                    drivePath: 'Semester 6/Machine Learning/',
                    noLinkAvailable: true
                }
            ];
            this.filteredNotes = [...this.allNotes];
            this.hideLoading();
            this.renderNotes();
            console.log('Data loaded successfully:', this.allNotes.length, 'notes (including Google Drive resources)');
        },

        applyFilters() {
            // Get filter values
            const branchSelect = document.getElementById('branchFilter');
            const semesterSelect = document.getElementById('semesterFilter');
            const typeSelect = document.getElementById('typeFilter');
            const examTypeSelect = document.getElementById('examTypeFilter');

            this.currentFilters.branch = branchSelect ? branchSelect.value : '';
            this.currentFilters.semester = semesterSelect ? semesterSelect.value : '';
            this.currentFilters.type = typeSelect ? typeSelect.value : '';
            this.currentFilters.examType = examTypeSelect ? examTypeSelect.value : '';

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
            const examTypeSelect = document.getElementById('examTypeFilter');
            const searchInput = document.getElementById('searchInput');

            if (branchSelect) branchSelect.value = '';
            if (semesterSelect) semesterSelect.value = '';
            if (typeSelect) typeSelect.value = '';
            if (examTypeSelect) examTypeSelect.value = '';
            if (searchInput) searchInput.value = '';

            // Hide PYQ-specific elements
            this.togglePYQElements(false);

            // Reset filter state
            this.currentFilters = {
                branch: '',
                semester: '',
                type: '',
                examType: '',
                search: ''
            };

            // Clear active tags
            document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));

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

                // Exam Type filter (for PYQs)
                if (this.currentFilters.examType && note.type === 'pyqs' && note.examType !== this.currentFilters.examType) {
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

            const examTypeLabels = {
                midterm: 'Mid-Term',
                endterm: 'End-Term',
                internal: 'Internal',
                quiz: 'Quiz'
            };

            // Solution badge for PYQs
            const solutionBadge = (note.type === 'pyqs' && note.hasSolution) 
                ? '<span class="solution-badge">✅ With Solution</span>' 
                : '';

            // Google Drive badge
            const driveBadge = note.isGoogleDrive 
                ? '<span class="drive-badge">📁 Drive</span>' 
                : '';

            // No link available badge
            const noLinkBadge = note.noLinkAvailable 
                ? '<span class="no-link-badge">⚠️ Coming Soon</span>' 
                : '';

            // Subject code badge
            const subjectCodeBadge = note.subjectCode 
                ? `<span class="subject-code-badge">${this.esc(note.subjectCode)}</span>` 
                : '';

            // Exam type info for PYQs
            const examTypeInfo = (note.type === 'pyqs' && note.examType) 
                ? `<span class="resource-meta-item"><span>📝</span> ${examTypeLabels[note.examType] || this.esc(note.examType)}</span>` 
                : '';

            // Drive path info
            const drivePathInfo = note.isGoogleDrive && note.drivePath
                ? `<span class="resource-meta-item drive-path"><span>📂</span> ${this.esc(note.drivePath)}</span>`
                : '';

            // Action buttons - different for Google Drive files and unavailable links
            let actionButtons;
            let actionRowClass = 'resource-primary-actions';
            if (note.noLinkAvailable) {
                actionRowClass += ' single-action';
                actionButtons = `<div class="${actionRowClass}">
                        <button class="btn btn-secondary" disabled>
                            ⏳ Link Coming Soon
                        </button>
                    </div>`;
            } else if (note.isGoogleDrive) {
                // Primary action - Open in Drive (using root link)
                const rootLink = note.links?.root;
                const primaryButton = rootLink 
                    ? `<button class="btn btn-primary" onclick="NotesManager.openInDrive('${this.jsId(note.id)}')">
                           🔗 Open in Drive
                       </button>`
                    : '';
                
                // Generate Quick Access chips dynamically from links.types
                let quickAccessButtons = '';
                if (note.links?.types) {
                    Object.entries(note.links.types).forEach(([key, url]) => {
                        // Only process valid link types (security: prevents XSS from invalid keys)
                        if (url && VALID_LINK_TYPES.includes(key)) {
                            const typeInfo = LINK_TYPE_LABELS[key];
                            quickAccessButtons += `<button class="btn btn-quick-access" 
                                onclick="NotesManager.openTypeLink('${this.jsId(note.id)}', '${key}')" 
                                title="${this.esc(typeInfo.tooltip)}">
                                ${typeInfo.icon} ${typeInfo.label}
                            </button>`;
                        }
                    });
                }
                
                actionRowClass += ' single-action';
                actionButtons = `
                    <div class="${actionRowClass}">
                        ${primaryButton}
                    </div>
                    ${quickAccessButtons ? `<div class="quick-access-container">${quickAccessButtons}</div>` : ''}
                    <button class="btn btn-secondary btn-browse-semester" onclick="NotesManager.openDriveFolder(${Number(note.semester) || 0})">
                        📂 Open Semester ${this.esc(note.semester)} Folder
                    </button>`;
            } else {
                actionButtons = `
                    <div class="${actionRowClass}">
                        <button class="btn btn-primary" onclick="NotesManager.downloadNote('${this.jsId(note.id)}')">
                            📥 Download
                        </button>
                        <button class="btn btn-secondary" onclick="NotesManager.viewNote('${this.jsId(note.id)}')">
                            👁️ Preview
                        </button>
                    </div>`;
            }

            return `
                <div class="resource-card ${note.isGoogleDrive ? 'drive-resource' : ''} ${note.noLinkAvailable ? 'no-link' : ''}" data-id="${this.esc(note.id)}" ${note.isGoogleDrive && !note.noLinkAvailable ? `onclick="NotesManager.openInDrive('${this.jsId(note.id)}')"` : ''}>
                    <div class="resource-header">
                        <div class="resource-icon-shell">
                            <div class="resource-icon">${typeIcons[note.type] || '📄'}</div>
                        </div>
                        <div class="resource-badge-row">
                            ${subjectCodeBadge}
                            <div class="resource-badge">${typeLabels[note.type] || 'Resource'}</div>
                            ${driveBadge}
                            ${solutionBadge}
                            ${noLinkBadge}
                        </div>
                    </div>
                    <div class="resource-context">
                        ${this.esc(note.subject)} • ${this.esc(note.branch)} • Semester ${this.esc(note.semester)}
                    </div>
                    <h4 class="resource-title">${this.esc(note.title)}</h4>
                    <div class="resource-meta-grid">
                        <span class="resource-meta-item">
                            <span>📚</span> ${this.esc(note.subject)}
                        </span>
                        <span class="resource-meta-item">
                            <span>🎓</span> ${this.esc(note.branch)} - Sem ${this.esc(note.semester)}
                        </span>
                        ${examTypeInfo}
                        ${drivePathInfo}
                        <span class="resource-meta-item">
                            <span>📊</span> ${this.esc(note.file_type)} - ${this.esc(note.file_size)}
                        </span>
                        <span class="resource-meta-item">
                            <span>📥</span> ${this.formatDownloads(note.downloads)} downloads
                        </span>
                    </div>
                    <div class="resource-actions" onclick="event.stopPropagation()">
                        ${actionButtons}
                    </div>
                </div>
            `;
        },

        // Open file directly in Google Drive using subject-specific folder
        openInDrive(noteId) {
            const note = this.findNote(noteId);
            if (!note || !note.isGoogleDrive) return;

            // Check if note has no link available (use links.root)
            const rootLink = note.links?.root;
            if (note.noLinkAvailable || !rootLink) {
                if (typeof Toast !== 'undefined') {
                    Toast.warning(`No Google Drive link available for "${note.title}"`);
                }
                return;
            }

            // Show toast notification
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening "${note.title}" in Google Drive...`);
            }

            // Use the note's root drive link
            window.open(rootLink, '_blank');

            // Add to recent downloads
            this.addToRecentDownloads(note);
        },

        // Open a specific type link (PYQ, Notes, Mid-Term)
        openTypeLink(noteId, typeKey) {
            const note = this.findNote(noteId);
            if (!note || !note.isGoogleDrive || !note.links?.types) return;

            // Security: Validate typeKey against whitelist
            if (!VALID_LINK_TYPES.includes(typeKey)) {
                console.warn(`Invalid link type: ${typeKey}`);
                return;
            }

            const typeUrl = note.links.types[typeKey];
            if (!typeUrl) {
                if (typeof Toast !== 'undefined') {
                    Toast.warning(`No link available for this resource type`);
                }
                return;
            }

            // Use shared constant for tooltip (which contains full label)
            const typeInfo = LINK_TYPE_LABELS[typeKey];

            // Show toast notification
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening ${typeInfo?.tooltip || typeKey} for "${note.title}"...`);
            }

            // Open the specific type link
            window.open(typeUrl, '_blank');

            // Add to recent downloads
            this.addToRecentDownloads(note);
        },

        // Open semester-specific Google Drive folder (based on current filter)
        openDriveFolder(semester = null) {
            // Get semester from filter if not provided
            if (!semester) {
                const semesterSelect = document.getElementById('semesterFilter');
                semester = semesterSelect ? parseInt(semesterSelect.value) : null;
            }
            
            // Get the appropriate folder ID
            const folderId = semester ? getSemesterFolderId(semester) : DEFAULT_FOLDER_ID;
            const folderUrl = `${DRIVE_FOLDER_URL}${folderId}`;
            
            const semesterText = semester ? `Semester ${semester}` : 'default (Semester 5)';
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening ${semesterText} Google Drive folder...`);
            }
            
            window.open(folderUrl, '_blank');
        },

        // Open a specific semester folder directly
        openSemesterFolder(semester) {
            const folderId = getSemesterFolderId(semester);
            const folderUrl = `${DRIVE_FOLDER_URL}${folderId}`;
            
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening Semester ${semester} folder in Google Drive...`);
            }
            
            window.open(folderUrl, '_blank');
        },

        formatDownloads(count) {
            if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count;
        },

        showLoading() {
            const loading = document.getElementById('loadingState');
            const grid = document.getElementById('resourcesGrid');
            const noResults = document.getElementById('noResultsState');

            if (loading) loading.style.display = 'block';
            if (grid) grid.style.display = 'none';
            if (noResults) noResults.style.display = 'none';
        },

        hideLoading() {
            const loading = document.getElementById('loadingState');
            if (loading) loading.style.display = 'none';
        },

        showError(message) {
            if (typeof Toast !== 'undefined') {
                Toast.error(message);
            } else {
                console.warn(message);
            }
        },

        async downloadNote(noteId) {
            const note = this.findNote(noteId);
            if (!note) return;

            try {
                if (typeof Toast !== 'undefined') {
                    Toast.info(`Downloading ${note.title}...`);
                }

                const token = APP.Storage.get('accessToken');
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
            const note = this.findNote(noteId);
            if (!note) return;

            try {
                const token = APP.Storage.get('accessToken');
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
                        <div class="recent-name">${this.esc(note.title)}</div>
                        <div class="recent-time">${this.formatDate(note.downloadedAt)}</div>
                    </div>
                </div>
            `).join('');
        },

        async loadStats() {
            try {
                const token = APP.Storage.get('accessToken');
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
