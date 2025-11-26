/**
 * Student PYQ (Previous Year Questions) Page
 * Provides access to question papers from previous exams
 */

(function() {
    'use strict';

    // Sample PYQ data (will be replaced with API data in production)
    const pyqData = [
        {
            id: 1,
            subject: 'Data Structures',
            code: 'CS301',
            year: 2024,
            semester: 3,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1245,
            uploadedAt: '2024-06-15',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 2,
            subject: 'Database Management Systems',
            code: 'CS401',
            year: 2024,
            semester: 4,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 987,
            uploadedAt: '2024-06-10',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 3,
            subject: 'Operating Systems',
            code: 'CS402',
            year: 2024,
            semester: 4,
            examType: 'midterm',
            duration: '1.5 hours',
            maxMarks: 50,
            downloads: 856,
            uploadedAt: '2024-03-20',
            fileUrl: '#',
            hasSolution: false
        },
        {
            id: 4,
            subject: 'Computer Networks',
            code: 'CS501',
            year: 2023,
            semester: 5,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1567,
            uploadedAt: '2023-12-05',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 5,
            subject: 'Design & Analysis of Algorithms',
            code: 'CS302',
            year: 2024,
            semester: 3,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1123,
            uploadedAt: '2024-06-15',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 6,
            subject: 'Machine Learning',
            code: 'CS601',
            year: 2023,
            semester: 6,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 2134,
            uploadedAt: '2023-12-10',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 7,
            subject: 'Software Engineering',
            code: 'CS502',
            year: 2023,
            semester: 5,
            examType: 'midterm',
            duration: '1.5 hours',
            maxMarks: 50,
            downloads: 645,
            uploadedAt: '2023-09-25',
            fileUrl: '#',
            hasSolution: false
        },
        {
            id: 8,
            subject: 'Artificial Intelligence',
            code: 'CS602',
            year: 2023,
            semester: 6,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1876,
            uploadedAt: '2023-12-12',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 9,
            subject: 'Object Oriented Programming',
            code: 'CS201',
            year: 2024,
            semester: 2,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1432,
            uploadedAt: '2024-05-20',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 10,
            subject: 'Discrete Mathematics',
            code: 'MA201',
            year: 2024,
            semester: 2,
            examType: 'midterm',
            duration: '1.5 hours',
            maxMarks: 50,
            downloads: 543,
            uploadedAt: '2024-03-10',
            fileUrl: '#',
            hasSolution: false
        },
        {
            id: 11,
            subject: 'Data Structures',
            code: 'CS301',
            year: 2023,
            semester: 3,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 2345,
            uploadedAt: '2023-06-15',
            fileUrl: '#',
            hasSolution: true
        },
        {
            id: 12,
            subject: 'Database Management Systems',
            code: 'CS401',
            year: 2023,
            semester: 4,
            examType: 'endterm',
            duration: '3 hours',
            maxMarks: 100,
            downloads: 1987,
            uploadedAt: '2023-06-10',
            fileUrl: '#',
            hasSolution: true
        }
    ];

    let currentPage = 1;
    const itemsPerPage = 8;
    let filteredData = [...pyqData];

    // Initialize page
    function init() {
        loadStats();
        loadPapers();
        setupEventListeners();
    }

    // Load statistics
    function loadStats() {
        const uniqueSubjects = new Set(pyqData.map(p => p.subject)).size;
        const years = pyqData.map(p => p.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const totalDownloads = pyqData.reduce((sum, p) => sum + p.downloads, 0);

        document.getElementById('totalPapers').textContent = pyqData.length;
        document.getElementById('totalSubjects').textContent = uniqueSubjects;
        document.getElementById('yearRange').textContent = `${minYear}-${maxYear}`;
        document.getElementById('totalDownloads').textContent = formatNumber(totalDownloads);
    }

    // Format large numbers
    function formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Load papers into the grid
    function loadPapers() {
        const container = document.getElementById('papersList');
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const papers = filteredData.slice(start, end);

        if (papers.length === 0) {
            container.innerHTML = `
                <div class="loading-text">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <h3>No papers found</h3>
                    <p>Try adjusting your filters or search query</p>
                </div>
            `;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        container.innerHTML = papers.map(paper => `
            <div class="paper-card">
                <div class="paper-header">
                    <div class="paper-subject">${paper.subject}</div>
                    <div class="paper-code">${paper.code}</div>
                </div>
                <div class="paper-body">
                    <div class="paper-meta">
                        <span class="meta-badge">📅 ${paper.year}</span>
                        <span class="meta-badge">📚 Sem ${paper.semester}</span>
                        <span class="meta-badge">${getExamTypeBadge(paper.examType)}</span>
                        ${paper.hasSolution ? '<span class="meta-badge" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">✅ With Solution</span>' : ''}
                    </div>
                    <div class="paper-info">
                        <strong>Duration:</strong> ${paper.duration} | <strong>Max Marks:</strong> ${paper.maxMarks}
                        <br>
                        <small>⬇️ ${formatNumber(paper.downloads)} downloads</small>
                    </div>
                    <div class="paper-actions">
                        <button class="btn btn-primary btn-sm" onclick="downloadPaper(${paper.id})">
                            ⬇️ Download
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="previewPaper(${paper.id})">
                            👁️ Preview
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        renderPagination();
    }

    // Get exam type badge
    function getExamTypeBadge(type) {
        const badges = {
            'midterm': '📝 Mid-Term',
            'endterm': '📄 End-Term',
            'internal': '📋 Internal',
            'quiz': '❓ Quiz'
        };
        return badges[type] || type;
    }

    // Render pagination
    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (totalPages <= 1) {
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1})">← Prev</button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                paginationHTML += `
                    <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})">${i}</button>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                paginationHTML += '<span style="padding: 0.5rem;">...</span>';
            }
        }

        // Next button
        paginationHTML += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1})">Next →</button>
        `;

        document.getElementById('pagination').innerHTML = paginationHTML;
    }

    // Change page
    window.changePage = function(page) {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        loadPapers();
        document.querySelector('.papers-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Setup event listeners
    function setupEventListeners() {
        // Subject tags
        document.querySelectorAll('.subject-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                const subject = this.dataset.subject;
                document.getElementById('subjectFilter').value = subject;
                searchPYQ();
                
                // Toggle active class
                document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Search on Enter
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchPYQ();
            }
        });

        // Filter changes
        ['subjectFilter', 'yearFilter', 'examTypeFilter', 'semesterFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', searchPYQ);
        });
    }

    // Search/filter PYQ
    window.searchPYQ = function() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const subjectFilter = document.getElementById('subjectFilter').value;
        const yearFilter = document.getElementById('yearFilter').value;
        const examTypeFilter = document.getElementById('examTypeFilter').value;
        const semesterFilter = document.getElementById('semesterFilter').value;

        filteredData = pyqData.filter(paper => {
            // Text search
            const matchesSearch = !searchTerm || 
                paper.subject.toLowerCase().includes(searchTerm) ||
                paper.code.toLowerCase().includes(searchTerm);

            // Subject filter
            const matchesSubject = !subjectFilter || 
                paper.subject.toLowerCase().includes(subjectFilter.replace(/-/g, ' '));

            // Year filter
            const matchesYear = !yearFilter || paper.year.toString() === yearFilter;

            // Exam type filter
            const matchesExamType = !examTypeFilter || paper.examType === examTypeFilter;

            // Semester filter
            const matchesSemester = !semesterFilter || paper.semester.toString() === semesterFilter;

            return matchesSearch && matchesSubject && matchesYear && matchesExamType && matchesSemester;
        });

        currentPage = 1;
        loadPapers();
    };

    // Reset filters
    window.resetFilters = function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('subjectFilter').value = '';
        document.getElementById('yearFilter').value = '';
        document.getElementById('examTypeFilter').value = '';
        document.getElementById('semesterFilter').value = '';
        document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
        
        filteredData = [...pyqData];
        currentPage = 1;
        loadPapers();
    };

    // Sort papers
    window.sortPapers = function() {
        const sortBy = document.getElementById('sortBy').value;
        
        switch(sortBy) {
            case 'newest':
                filteredData.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
                break;
            case 'oldest':
                filteredData.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
                break;
            case 'popular':
                filteredData.sort((a, b) => b.downloads - a.downloads);
                break;
            case 'subject':
                filteredData.sort((a, b) => a.subject.localeCompare(b.subject));
                break;
        }

        currentPage = 1;
        loadPapers();
    };

    // Download paper
    window.downloadPaper = function(paperId) {
        const paper = pyqData.find(p => p.id === paperId);
        if (paper) {
            // In production, this would trigger actual download
            if (window.showToast) {
                window.showToast(`Downloading ${paper.subject} (${paper.year}) question paper...`, 'success');
            }
            
            // Simulate download (in production, redirect to actual file)
            console.log('Downloading paper:', paper);
            
            // Track download (in production, this would call API)
            paper.downloads++;
            loadStats();
        }
    };

    // Preview paper
    window.previewPaper = function(paperId) {
        const paper = pyqData.find(p => p.id === paperId);
        if (paper) {
            if (window.showToast) {
                window.showToast(`Opening preview for ${paper.subject} (${paper.year})...`, 'info');
            }
            // In production, this would open a PDF viewer modal
            console.log('Previewing paper:', paper);
        }
    };

    // Request paper
    window.requestPaper = function() {
        const subject = document.getElementById('requestSubject').value.trim();
        const year = document.getElementById('requestYear').value.trim();
        const examType = document.getElementById('requestExamType').value;

        if (!subject || !year) {
            if (window.showToast) {
                window.showToast('Please fill in subject and year', 'error');
            }
            return;
        }

        // In production, this would submit to API
        if (window.showToast) {
            window.showToast(`Request submitted for ${subject} (${year}). We'll notify you when it's available!`, 'success');
        }

        // Clear form
        document.getElementById('requestSubject').value = '';
        document.getElementById('requestYear').value = '';
        document.getElementById('requestExamType').value = '';
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
