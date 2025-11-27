// ============================================
// STUDENT DRIVE RESOURCES PAGE
// Google Drive Resources with Filtering
// Files open directly from Google Drive
// ============================================

(function() {
    'use strict';

    // Google Drive folder ID from the URL
    const DRIVE_FOLDER_ID = '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7';
    
    // Base URLs for Google Drive
    const DRIVE_BASE_URL = 'https://drive.google.com';
    const DRIVE_VIEW_URL = `${DRIVE_BASE_URL}/file/d/`;
    const DRIVE_FOLDER_URL = `${DRIVE_BASE_URL}/drive/folders/`;

    const DriveResourcesManager = {
        currentFilters: {
            category: '',
            subject: '',
            fileType: '',
            search: ''
        },
        allResources: [],
        filteredResources: [],
        categories: [],

        init() {
            this.setupEventListeners();
            this.loadResources();
            this.loadRecentFiles();
            this.setupEmbedToggle();
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
                        this.filterResources();
                    }, 300);
                });
            }

            // Category filter change
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.addEventListener('change', (e) => {
                    this.currentFilters.category = e.target.value;
                    this.updateSubjectFilter();
                });
            }

            // Subject filter change
            const subjectFilter = document.getElementById('subjectFilter');
            if (subjectFilter) {
                subjectFilter.addEventListener('change', (e) => {
                    this.currentFilters.subject = e.target.value;
                });
            }

            // File type filter change
            const fileTypeFilter = document.getElementById('fileTypeFilter');
            if (fileTypeFilter) {
                fileTypeFilter.addEventListener('change', (e) => {
                    this.currentFilters.fileType = e.target.value;
                });
            }

            // Filter selects - apply on Enter key
            ['categoryFilter', 'subjectFilter', 'fileTypeFilter'].forEach(id => {
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

        setupEmbedToggle() {
            const toggleBtn = document.getElementById('toggleEmbedBtn');
            const embedContainer = document.getElementById('driveEmbedContainer');
            const toggleIcon = document.getElementById('embedToggleIcon');

            if (toggleBtn && embedContainer) {
                toggleBtn.addEventListener('click', () => {
                    embedContainer.classList.toggle('collapsed');
                    if (toggleIcon) {
                        toggleIcon.textContent = embedContainer.classList.contains('collapsed') ? '▶' : '▼';
                    }
                });
            }
        },

        async loadResources() {
            this.showLoading();
            
            // Since we can't directly access Google Drive API without OAuth,
            // we'll use a predefined resource structure that maps to the Google Drive folder
            // This data should be updated when new files are added to the Drive folder
            this.loadResourceData();
        },

        loadResourceData() {
            // Resource data structure based on Google Drive folder
            // Each resource has a driveFileId that allows direct opening from Google Drive
            // Categories and subjects are extracted from folder names
            
            this.allResources = [
                // ===============================
                // SEMESTER 1 RESOURCES
                // ===============================
                {
                    id: 1,
                    name: 'Mathematics-I Complete Notes',
                    category: 'Semester 1',
                    subject: 'Mathematics-I',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_1',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 1/Mathematics-I/',
                    description: 'Complete notes for Engineering Mathematics-I',
                    uploadedBy: 'Faculty',
                    uploadedAt: '2025-01-15'
                },
                {
                    id: 2,
                    name: 'Physics-I Lecture Notes',
                    category: 'Semester 1',
                    subject: 'Physics-I',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_2',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 1/Physics-I/',
                    description: 'Engineering Physics lecture notes',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-01-10'
                },
                {
                    id: 3,
                    name: 'Chemistry Lab Manual',
                    category: 'Semester 1',
                    subject: 'Chemistry',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_3',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 1/Chemistry/',
                    description: 'Complete lab manual for Chemistry practicals',
                    uploadedBy: 'Lab Department',
                    uploadedAt: '2025-01-08'
                },
                {
                    id: 4,
                    name: 'Basic Electrical Engineering Notes',
                    category: 'Semester 1',
                    subject: 'Basic Electrical',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_4',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 1/Basic Electrical/',
                    description: 'Fundamentals of electrical engineering',
                    uploadedBy: 'Prof. Sharma',
                    uploadedAt: '2025-01-05'
                },

                // ===============================
                // SEMESTER 2 RESOURCES
                // ===============================
                {
                    id: 5,
                    name: 'Mathematics-II Complete Notes',
                    category: 'Semester 2',
                    subject: 'Mathematics-II',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_5',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 2/Mathematics-II/',
                    description: 'Complete notes for Engineering Mathematics-II',
                    uploadedBy: 'Faculty',
                    uploadedAt: '2025-01-20'
                },
                {
                    id: 6,
                    name: 'Physics-II Lecture Notes',
                    category: 'Semester 2',
                    subject: 'Physics-II',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_6',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 2/Physics-II/',
                    description: 'Advanced physics concepts and applications',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-01-18'
                },
                {
                    id: 7,
                    name: 'Programming in C Notes',
                    category: 'Semester 2',
                    subject: 'Programming',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_7',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 2/Programming/',
                    description: 'Complete C programming language notes',
                    uploadedBy: 'Prof. Patel',
                    uploadedAt: '2025-01-15'
                },

                // ===============================
                // SEMESTER 3 RESOURCES (CSE)
                // ===============================
                {
                    id: 8,
                    name: 'Data Structures Complete Notes',
                    category: 'Semester 3',
                    subject: 'Data Structures',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_8',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 3/Data Structures/',
                    description: 'Arrays, Linked Lists, Trees, Graphs, and more',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-02-01'
                },
                {
                    id: 9,
                    name: 'Data Structures PYQ 2024',
                    category: 'PYQ Papers',
                    subject: 'Data Structures',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_9',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'PYQ Papers/Data Structures/',
                    description: 'Previous year question paper with solutions',
                    uploadedBy: 'Exam Cell',
                    uploadedAt: '2025-01-25'
                },
                {
                    id: 10,
                    name: 'Discrete Mathematics Notes',
                    category: 'Semester 3',
                    subject: 'Discrete Mathematics',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_10',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 3/Discrete Mathematics/',
                    description: 'Logic, Sets, Relations, Functions, and Graph Theory',
                    uploadedBy: 'Prof. Reddy',
                    uploadedAt: '2025-01-28'
                },
                {
                    id: 11,
                    name: 'Digital Electronics Notes',
                    category: 'Semester 3',
                    subject: 'Digital Electronics',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_11',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 3/Digital Electronics/',
                    description: 'Boolean Algebra, Logic Gates, Flip-Flops, Counters',
                    uploadedBy: 'Prof. Singh',
                    uploadedAt: '2025-01-22'
                },

                // ===============================
                // SEMESTER 4 RESOURCES
                // ===============================
                {
                    id: 12,
                    name: 'DBMS Complete Notes',
                    category: 'Semester 4',
                    subject: 'Database Management',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_12',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 4/DBMS/',
                    description: 'SQL, Normalization, ER Models, Transactions',
                    uploadedBy: 'Prof. Sharma',
                    uploadedAt: '2025-02-05'
                },
                {
                    id: 13,
                    name: 'DBMS PYQ 2024',
                    category: 'PYQ Papers',
                    subject: 'Database Management',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_13',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'PYQ Papers/DBMS/',
                    description: 'Previous year question paper',
                    uploadedBy: 'Exam Cell',
                    uploadedAt: '2025-01-30'
                },
                {
                    id: 14,
                    name: 'Operating Systems Notes',
                    category: 'Semester 4',
                    subject: 'Operating Systems',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_14',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 4/Operating Systems/',
                    description: 'Process Management, Memory, File Systems',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-02-08'
                },
                {
                    id: 15,
                    name: 'Algorithms Design Notes',
                    category: 'Semester 4',
                    subject: 'Algorithms',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_15',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 4/Algorithms/',
                    description: 'Sorting, Searching, DP, Greedy, Graph Algorithms',
                    uploadedBy: 'Prof. Patel',
                    uploadedAt: '2025-02-10'
                },

                // ===============================
                // SEMESTER 5 RESOURCES
                // ===============================
                {
                    id: 16,
                    name: 'Computer Networks Notes',
                    category: 'Semester 5',
                    subject: 'Computer Networks',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_16',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 5/Computer Networks/',
                    description: 'OSI Model, TCP/IP, Routing, Network Security',
                    uploadedBy: 'Prof. Reddy',
                    uploadedAt: '2025-02-15'
                },
                {
                    id: 17,
                    name: 'Software Engineering Notes',
                    category: 'Semester 5',
                    subject: 'Software Engineering',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_17',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 5/Software Engineering/',
                    description: 'SDLC, Agile, Testing, Project Management',
                    uploadedBy: 'Prof. Singh',
                    uploadedAt: '2025-02-12'
                },
                {
                    id: 18,
                    name: 'Computer Networks PYQ 2024',
                    category: 'PYQ Papers',
                    subject: 'Computer Networks',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_18',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'PYQ Papers/Computer Networks/',
                    description: 'Previous year question paper with solutions',
                    uploadedBy: 'Exam Cell',
                    uploadedAt: '2025-02-01'
                },

                // ===============================
                // SEMESTER 6 RESOURCES
                // ===============================
                {
                    id: 19,
                    name: 'Machine Learning Notes',
                    category: 'Semester 6',
                    subject: 'Machine Learning',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_19',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 6/Machine Learning/',
                    description: 'Supervised, Unsupervised, Deep Learning basics',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-02-20'
                },
                {
                    id: 20,
                    name: 'Compiler Design Notes',
                    category: 'Semester 6',
                    subject: 'Compiler Design',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_20',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 6/Compiler Design/',
                    description: 'Lexical Analysis, Parsing, Code Generation',
                    uploadedBy: 'Prof. Sharma',
                    uploadedAt: '2025-02-18'
                },
                {
                    id: 21,
                    name: 'Machine Learning PYQ 2024',
                    category: 'PYQ Papers',
                    subject: 'Machine Learning',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_21',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'PYQ Papers/Machine Learning/',
                    description: 'Previous year question paper',
                    uploadedBy: 'Exam Cell',
                    uploadedAt: '2025-02-05'
                },

                // ===============================
                // SEMESTER 7 RESOURCES
                // ===============================
                {
                    id: 22,
                    name: 'Artificial Intelligence Notes',
                    category: 'Semester 7',
                    subject: 'Artificial Intelligence',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_22',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 7/AI/',
                    description: 'Search Algorithms, Knowledge Representation, Expert Systems',
                    uploadedBy: 'Prof. Patel',
                    uploadedAt: '2025-02-25'
                },
                {
                    id: 23,
                    name: 'Cloud Computing Notes',
                    category: 'Semester 7',
                    subject: 'Cloud Computing',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_23',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 7/Cloud Computing/',
                    description: 'AWS, Azure, GCP, Virtualization, Containers',
                    uploadedBy: 'Prof. Reddy',
                    uploadedAt: '2025-02-22'
                },

                // ===============================
                // SEMESTER 8 RESOURCES
                // ===============================
                {
                    id: 24,
                    name: 'Big Data Analytics Notes',
                    category: 'Semester 8',
                    subject: 'Big Data',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_24',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Semester 8/Big Data/',
                    description: 'Hadoop, Spark, MapReduce, Data Mining',
                    uploadedBy: 'Prof. Singh',
                    uploadedAt: '2025-03-01'
                },

                // ===============================
                // LAB MANUALS
                // ===============================
                {
                    id: 25,
                    name: 'Data Structures Lab Manual',
                    category: 'Lab Manuals',
                    subject: 'Data Structures',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_25',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Lab Manuals/Data Structures/',
                    description: 'Complete lab experiments and programs',
                    uploadedBy: 'Lab Department',
                    uploadedAt: '2025-01-20'
                },
                {
                    id: 26,
                    name: 'DBMS Lab Manual',
                    category: 'Lab Manuals',
                    subject: 'Database Management',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_26',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Lab Manuals/DBMS/',
                    description: 'SQL queries and database experiments',
                    uploadedBy: 'Lab Department',
                    uploadedAt: '2025-01-22'
                },
                {
                    id: 27,
                    name: 'Operating Systems Lab Manual',
                    category: 'Lab Manuals',
                    subject: 'Operating Systems',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_27',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Lab Manuals/Operating Systems/',
                    description: 'Shell scripting and OS experiments',
                    uploadedBy: 'Lab Department',
                    uploadedAt: '2025-01-25'
                },

                // ===============================
                // PRESENTATIONS
                // ===============================
                {
                    id: 28,
                    name: 'Data Structures Overview Presentation',
                    category: 'Presentations',
                    subject: 'Data Structures',
                    fileType: 'ppt',
                    driveFileId: '1example_file_id_28',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Presentations/Data Structures/',
                    description: 'Visual overview of all data structures',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-02-01'
                },
                {
                    id: 29,
                    name: 'Machine Learning Introduction PPT',
                    category: 'Presentations',
                    subject: 'Machine Learning',
                    fileType: 'ppt',
                    driveFileId: '1example_file_id_29',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Presentations/Machine Learning/',
                    description: 'Introduction to ML concepts and algorithms',
                    uploadedBy: 'Prof. Sharma',
                    uploadedAt: '2025-02-15'
                },

                // ===============================
                // REFERENCE BOOKS
                // ===============================
                {
                    id: 30,
                    name: 'Introduction to Algorithms - CLRS',
                    category: 'Reference Books',
                    subject: 'Algorithms',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_30',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Reference Books/Algorithms/',
                    description: 'Standard reference book for algorithms',
                    uploadedBy: 'Library',
                    uploadedAt: '2025-01-01'
                },
                {
                    id: 31,
                    name: 'Database System Concepts - Silberschatz',
                    category: 'Reference Books',
                    subject: 'Database Management',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_31',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Reference Books/DBMS/',
                    description: 'Comprehensive database systems textbook',
                    uploadedBy: 'Library',
                    uploadedAt: '2025-01-01'
                },

                // ===============================
                // ASSIGNMENTS
                // ===============================
                {
                    id: 32,
                    name: 'Data Structures Assignment 1',
                    category: 'Assignments',
                    subject: 'Data Structures',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_32',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Assignments/Data Structures/',
                    description: 'Arrays and Linked Lists problems',
                    uploadedBy: 'Prof. Kumar',
                    uploadedAt: '2025-02-10'
                },
                {
                    id: 33,
                    name: 'DBMS Assignment 2',
                    category: 'Assignments',
                    subject: 'Database Management',
                    fileType: 'doc',
                    driveFileId: '1example_file_id_33',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Assignments/DBMS/',
                    description: 'SQL queries and normalization problems',
                    uploadedBy: 'Prof. Sharma',
                    uploadedAt: '2025-02-12'
                },

                // ===============================
                // SYLLABUS
                // ===============================
                {
                    id: 34,
                    name: 'CSE Semester 3 Syllabus',
                    category: 'Syllabus',
                    subject: 'All Subjects',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_34',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Syllabus/Semester 3/',
                    description: 'Complete syllabus for CSE 3rd semester',
                    uploadedBy: 'Academic Office',
                    uploadedAt: '2025-01-01'
                },
                {
                    id: 35,
                    name: 'CSE Semester 4 Syllabus',
                    category: 'Syllabus',
                    subject: 'All Subjects',
                    fileType: 'pdf',
                    driveFileId: '1example_file_id_35',
                    driveFolderId: '1rZ3bB5Ozjtfv0RyxlqPw33pDS8LmiPs7',
                    path: 'Syllabus/Semester 4/',
                    description: 'Complete syllabus for CSE 4th semester',
                    uploadedBy: 'Academic Office',
                    uploadedAt: '2025-01-01'
                }
            ];

            this.filteredResources = [...this.allResources];
            
            // Extract unique categories and subjects
            this.extractCategoriesAndSubjects();
            
            // Populate filter dropdowns
            this.populateFilters();
            
            // Render categories and resources
            this.renderCategories();
            this.renderResources();
            
            // Update stats
            this.updateStats();
            
            this.hideLoading();
        },

        extractCategoriesAndSubjects() {
            // Get unique categories
            const categorySet = new Set(this.allResources.map(r => r.category));
            this.categories = Array.from(categorySet).map(cat => ({
                name: cat,
                count: this.allResources.filter(r => r.category === cat).length,
                icon: this.getCategoryIcon(cat)
            }));

            // Get unique subjects
            const subjectSet = new Set(this.allResources.map(r => r.subject));
            this.subjects = Array.from(subjectSet);
        },

        getCategoryIcon(category) {
            const icons = {
                'Semester 1': '📗',
                'Semester 2': '📘',
                'Semester 3': '📙',
                'Semester 4': '📕',
                'Semester 5': '📓',
                'Semester 6': '📔',
                'Semester 7': '📒',
                'Semester 8': '📚',
                'PYQ Papers': '📋',
                'Lab Manuals': '🔬',
                'Presentations': '📊',
                'Reference Books': '📖',
                'Assignments': '📝',
                'Syllabus': '📜'
            };
            return icons[category] || '📁';
        },

        getFileTypeIcon(fileType) {
            const icons = {
                'pdf': '📄',
                'doc': '📝',
                'ppt': '📊',
                'xls': '📈',
                'image': '🖼️',
                'video': '🎬',
                'other': '📁'
            };
            return icons[fileType] || '📄';
        },

        populateFilters() {
            // Populate category filter
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.innerHTML = '<option value="">All Categories</option>';
                this.categories.forEach(cat => {
                    categoryFilter.innerHTML += `<option value="${cat.name}">${cat.icon} ${cat.name} (${cat.count})</option>`;
                });
            }

            // Populate subject filter
            this.updateSubjectFilter();
        },

        updateSubjectFilter() {
            const subjectFilter = document.getElementById('subjectFilter');
            if (!subjectFilter) return;

            // Get subjects based on selected category
            let subjects;
            if (this.currentFilters.category) {
                const filtered = this.allResources.filter(r => r.category === this.currentFilters.category);
                subjects = [...new Set(filtered.map(r => r.subject))];
            } else {
                subjects = this.subjects;
            }

            subjectFilter.innerHTML = '<option value="">All Subjects</option>';
            subjects.sort().forEach(subject => {
                subjectFilter.innerHTML += `<option value="${subject}">${subject}</option>`;
            });
        },

        renderCategories() {
            const grid = document.getElementById('categoriesGrid');
            if (!grid) return;

            grid.innerHTML = this.categories.map(cat => `
                <div class="category-card" data-category="${cat.name}" onclick="DriveResourcesManager.selectCategory('${cat.name}')">
                    <div class="category-icon">${cat.icon}</div>
                    <div class="category-name">${cat.name}</div>
                    <div class="category-count">${cat.count} files</div>
                </div>
            `).join('');
        },

        selectCategory(categoryName) {
            // Update filter
            this.currentFilters.category = categoryName;
            
            // Update UI
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter) {
                categoryFilter.value = categoryName;
            }

            // Toggle active state on cards
            document.querySelectorAll('.category-card').forEach(card => {
                card.classList.toggle('active', card.dataset.category === categoryName);
            });

            // Update subject filter and apply filters
            this.updateSubjectFilter();
            this.applyFilters();
        },

        applyFilters() {
            // Get filter values
            const categorySelect = document.getElementById('categoryFilter');
            const subjectSelect = document.getElementById('subjectFilter');
            const fileTypeSelect = document.getElementById('fileTypeFilter');

            this.currentFilters.category = categorySelect ? categorySelect.value : '';
            this.currentFilters.subject = subjectSelect ? subjectSelect.value : '';
            this.currentFilters.fileType = fileTypeSelect ? fileTypeSelect.value : '';

            // Show loading animation
            this.showLoading();

            // Animate filter application
            setTimeout(() => {
                this.filterResources();
                if (typeof Toast !== 'undefined') {
                    Toast.success('Filters applied successfully!');
                }
            }, 300);
        },

        resetFilters() {
            // Reset all filter controls
            const categorySelect = document.getElementById('categoryFilter');
            const subjectSelect = document.getElementById('subjectFilter');
            const fileTypeSelect = document.getElementById('fileTypeFilter');
            const searchInput = document.getElementById('searchInput');

            if (categorySelect) categorySelect.value = '';
            if (subjectSelect) subjectSelect.value = '';
            if (fileTypeSelect) fileTypeSelect.value = '';
            if (searchInput) searchInput.value = '';

            // Reset filter state
            this.currentFilters = {
                category: '',
                subject: '',
                fileType: '',
                search: ''
            };

            // Clear active category cards
            document.querySelectorAll('.category-card').forEach(card => {
                card.classList.remove('active');
            });

            // Reset subject filter options
            this.updateSubjectFilter();

            // Show all resources
            this.filteredResources = [...this.allResources];
            this.renderResources();

            if (typeof Toast !== 'undefined') {
                Toast.info('Filters reset');
            }
        },

        filterResources() {
            this.filteredResources = this.allResources.filter(resource => {
                // Category filter
                if (this.currentFilters.category && resource.category !== this.currentFilters.category) {
                    return false;
                }

                // Subject filter
                if (this.currentFilters.subject && resource.subject !== this.currentFilters.subject) {
                    return false;
                }

                // File type filter
                if (this.currentFilters.fileType && resource.fileType !== this.currentFilters.fileType) {
                    return false;
                }

                // Search filter
                if (this.currentFilters.search) {
                    const searchLower = this.currentFilters.search.toLowerCase();
                    const nameMatch = resource.name.toLowerCase().includes(searchLower);
                    const subjectMatch = resource.subject.toLowerCase().includes(searchLower);
                    const descMatch = resource.description.toLowerCase().includes(searchLower);
                    const pathMatch = resource.path.toLowerCase().includes(searchLower);
                    return nameMatch || subjectMatch || descMatch || pathMatch;
                }

                return true;
            });

            this.renderResources();
        },

        renderResources() {
            const grid = document.getElementById('resourcesGrid');
            const loading = document.getElementById('loadingState');
            const noResults = document.getElementById('noResultsState');
            const resultCount = document.getElementById('resultCount');

            // Hide loading
            if (loading) loading.style.display = 'none';

            if (this.filteredResources.length === 0) {
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
                grid.innerHTML = this.filteredResources.map(resource => this.createResourceCard(resource)).join('');
            }

            // Update result count
            if (resultCount) {
                resultCount.textContent = `(${this.filteredResources.length} result${this.filteredResources.length !== 1 ? 's' : ''})`;
            }

            // Add animation to cards
            setTimeout(() => {
                document.querySelectorAll('.resource-card').forEach((card, index) => {
                    card.style.animation = `fadeInUp 0.5s ease ${index * 0.05}s both`;
                });
            }, 10);
        },

        createResourceCard(resource) {
            const fileIcon = this.getFileTypeIcon(resource.fileType);
            const categoryIcon = this.getCategoryIcon(resource.category);

            return `
                <div class="resource-card" data-id="${resource.id}" onclick="DriveResourcesManager.openFile(${resource.id})">
                    <div class="resource-header">
                        <div class="resource-icon">${fileIcon}</div>
                        <div class="resource-badge">${resource.fileType.toUpperCase()}</div>
                    </div>
                    <h4 class="resource-title">${resource.name}</h4>
                    <div class="resource-meta">
                        <span class="resource-meta-item">
                            <span>${categoryIcon}</span> ${resource.category}
                        </span>
                        <span class="resource-meta-item">
                            <span>📚</span> ${resource.subject}
                        </span>
                    </div>
                    <div class="resource-path">📁 ${resource.path}</div>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        ${resource.description}
                    </p>
                    <div class="resource-actions">
                        <button class="btn btn-primary" onclick="event.stopPropagation(); DriveResourcesManager.openFile(${resource.id})">
                            🔗 Open in Drive
                        </button>
                        <button class="btn btn-secondary" onclick="event.stopPropagation(); DriveResourcesManager.openFolder(${resource.id})">
                            📂 View Folder
                        </button>
                    </div>
                </div>
            `;
        },

        // ==========================================
        // OPEN FILE DIRECTLY FROM GOOGLE DRIVE
        // ==========================================
        openFile(resourceId) {
            const resource = this.allResources.find(r => r.id === resourceId);
            if (!resource) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('Resource not found');
                }
                return;
            }

            // Add to recent files
            this.addToRecentFiles(resource);

            // Construct Google Drive URL for the file
            // For files: https://drive.google.com/file/d/{fileId}/view
            // Since we're using example IDs, we'll open the main folder
            // In production, replace driveFileId with actual Google Drive file IDs
            
            let fileUrl;
            if (resource.driveFileId && !resource.driveFileId.startsWith('1example')) {
                // If we have a real file ID, open the file directly
                fileUrl = `${DRIVE_VIEW_URL}${resource.driveFileId}/view`;
            } else {
                // Fallback: Open the main Drive folder with a search for the file name
                // This allows users to find the file in the Drive folder
                const encodedName = encodeURIComponent(resource.name);
                fileUrl = `${DRIVE_FOLDER_URL}${DRIVE_FOLDER_ID}?q=${encodedName}`;
            }

            // Show toast notification
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening "${resource.name}" in Google Drive...`);
            }

            // Open in new tab
            window.open(fileUrl, '_blank');
        },

        // Open the folder containing the resource
        openFolder(resourceId) {
            const resource = this.allResources.find(r => r.id === resourceId);
            if (!resource) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('Resource not found');
                }
                return;
            }

            // Open the main Google Drive folder
            const folderUrl = `${DRIVE_FOLDER_URL}${DRIVE_FOLDER_ID}`;

            // Show toast notification
            if (typeof Toast !== 'undefined') {
                Toast.info(`Opening folder in Google Drive...`);
            }

            // Open in new tab
            window.open(folderUrl, '_blank');
        },

        // Add file to recent files list
        addToRecentFiles(resource) {
            let recent = JSON.parse(localStorage.getItem('recentDriveFiles') || '[]');
            
            // Add to beginning, remove if already exists
            recent = recent.filter(r => r.id !== resource.id);
            recent.unshift({
                ...resource,
                accessedAt: new Date().toISOString()
            });

            // Keep only last 10
            recent = recent.slice(0, 10);
            
            localStorage.setItem('recentDriveFiles', JSON.stringify(recent));
            this.loadRecentFiles();
        },

        loadRecentFiles() {
            const container = document.getElementById('recentFiles');
            if (!container) return;

            const recent = JSON.parse(localStorage.getItem('recentDriveFiles') || '[]');

            if (recent.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No recently accessed files
                    </div>
                `;
                return;
            }

            container.innerHTML = recent.map(resource => `
                <div class="recent-item" onclick="DriveResourcesManager.openFile(${resource.id})">
                    <div class="recent-icon">${this.getFileTypeIcon(resource.fileType)}</div>
                    <div class="recent-details">
                        <div class="recent-name">${resource.name}</div>
                        <div class="recent-time">${this.formatDate(resource.accessedAt)} • ${resource.category}</div>
                    </div>
                </div>
            `).join('');
        },

        updateStats() {
            const totalFolders = document.getElementById('totalFolders');
            const totalFiles = document.getElementById('totalFiles');
            const totalSubjects = document.getElementById('totalSubjects');
            const lastUpdated = document.getElementById('lastUpdated');

            if (totalFolders) totalFolders.textContent = this.categories.length;
            if (totalFiles) totalFiles.textContent = this.allResources.length;
            if (totalSubjects) totalSubjects.textContent = this.subjects.length;
            if (lastUpdated) lastUpdated.textContent = 'Today';
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
            DriveResourcesManager.init();
        });
    } else {
        DriveResourcesManager.init();
    }

    // Expose globally
    window.DriveResourcesManager = DriveResourcesManager;
})();
