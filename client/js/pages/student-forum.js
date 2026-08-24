// ponytail: hardcoded prototype data -> wire to /api/forum when the forum backend is live
/**
 * Student Forum Page
 * Q&A platform for students to ask questions and get answers
 */

(function() {
    'use strict';

    // Sample forum data
    const forumData = {
        questions: [
            {
                id: 1,
                title: 'How to implement Binary Search Tree in Java?',
                description: 'I\'m trying to implement a BST in Java for my Data Structures assignment. Can someone explain the insert and delete operations with code examples?',
                category: 'technical',
                author: { name: 'Rahul Kumar', avatar: 'RK', role: 'student' },
                tags: ['java', 'dsa', 'trees'],
                status: 'answered',
                views: 234,
                upvotes: 15,
                answers: 3,
                createdAt: '2024-11-25T10:30:00',
                lastActivity: '2024-11-26T14:20:00'
            },
            {
                id: 2,
                title: 'Best resources for Machine Learning preparation?',
                description: 'I want to start learning ML for placements. What are the best courses, books, and projects I should focus on? Any roadmap suggestions?',
                category: 'placement',
                author: { name: 'Priya Singh', avatar: 'PS', role: 'student' },
                tags: ['ml', 'placement', 'career'],
                status: 'answered',
                views: 456,
                upvotes: 32,
                answers: 7,
                createdAt: '2024-11-24T15:45:00',
                lastActivity: '2024-11-26T16:10:00'
            },
            {
                id: 3,
                title: 'DBMS Normalization - Need help with 3NF',
                description: 'Can someone explain the difference between 2NF and 3NF with a practical example? I\'m confused about transitive dependencies.',
                category: 'academic',
                author: { name: 'Amit Patel', avatar: 'AP', role: 'student' },
                tags: ['dbms', 'normalization', 'exam'],
                status: 'open',
                views: 123,
                upvotes: 8,
                answers: 2,
                createdAt: '2024-11-26T09:15:00',
                lastActivity: '2024-11-26T12:30:00'
            },
            {
                id: 4,
                title: 'When is the deadline for hostel fee payment?',
                description: 'I missed the notice about hostel fee. Can someone tell me the last date and if there\'s any late fee?',
                category: 'campus',
                author: { name: 'Sneha Reddy', avatar: 'SR', role: 'student' },
                tags: ['hostel', 'fee', 'deadline'],
                status: 'answered',
                views: 89,
                upvotes: 5,
                answers: 2,
                createdAt: '2024-11-25T18:00:00',
                lastActivity: '2024-11-26T10:45:00'
            },
            {
                id: 5,
                title: 'Tips for TCS NQT preparation?',
                description: 'TCS NQT exam is coming up next month. What topics should I focus on? Any previous year patterns or important areas?',
                category: 'placement',
                author: { name: 'Vikram Sharma', avatar: 'VS', role: 'student' },
                tags: ['tcs', 'placement', 'aptitude'],
                status: 'answered',
                views: 678,
                upvotes: 45,
                answers: 12,
                createdAt: '2024-11-20T14:30:00',
                lastActivity: '2024-11-26T15:00:00'
            },
            {
                id: 6,
                title: 'How to solve time complexity questions in interviews?',
                description: 'I struggle with calculating time complexity of recursive algorithms. Any tips or standard approaches to follow?',
                category: 'technical',
                author: { name: 'Neha Gupta', avatar: 'NG', role: 'student' },
                tags: ['dsa', 'interview', 'algorithms'],
                status: 'open',
                views: 198,
                upvotes: 22,
                answers: 4,
                createdAt: '2024-11-24T11:20:00',
                lastActivity: '2024-11-26T08:15:00'
            },
            {
                id: 7,
                title: 'Operating System - Process vs Thread difference',
                description: 'I\'m preparing for my OS exam. Can someone explain the key differences between process and thread with examples?',
                category: 'academic',
                author: { name: 'Arjun Nair', avatar: 'AN', role: 'student' },
                tags: ['os', 'exam', 'theory'],
                status: 'answered',
                views: 312,
                upvotes: 18,
                answers: 5,
                createdAt: '2024-11-23T16:45:00',
                lastActivity: '2024-11-25T20:30:00'
            },
            {
                id: 8,
                title: 'Best club to join for coding skills?',
                description: 'I\'m a first year student interested in competitive programming. Which technical club should I join?',
                category: 'general',
                author: { name: 'Kavya Iyer', avatar: 'KI', role: 'student' },
                tags: ['clubs', 'coding', 'freshers'],
                status: 'answered',
                views: 145,
                upvotes: 10,
                answers: 6,
                createdAt: '2024-11-22T10:00:00',
                lastActivity: '2024-11-24T14:20:00'
            },
            {
                id: 9,
                title: 'Python vs Java - Which is better for placements?',
                description: 'I\'m comfortable with both languages. Which one should I focus more on for placement preparation?',
                category: 'placement',
                author: { name: 'Ravi Teja', avatar: 'RT', role: 'student' },
                tags: ['python', 'java', 'placement'],
                status: 'open',
                views: 423,
                upvotes: 28,
                answers: 9,
                createdAt: '2024-11-21T13:30:00',
                lastActivity: '2024-11-26T11:00:00'
            },
            {
                id: 10,
                title: 'How to apply for internships through college?',
                description: 'What is the process to apply for internships through the Training & Placement cell? Are there any eligibility criteria?',
                category: 'placement',
                author: { name: 'Simran Kaur', avatar: 'SK', role: 'student' },
                tags: ['internship', 'placement', 'process'],
                status: 'answered',
                views: 267,
                upvotes: 15,
                answers: 4,
                createdAt: '2024-11-19T09:00:00',
                lastActivity: '2024-11-23T16:45:00'
            }
        ],
        contributors: [
            { name: 'Dr. Ramesh Kumar', role: 'Professor', answers: 156, badge: '🏆' },
            { name: 'Ankit Verma', role: 'Student - 4th Year', answers: 89, badge: '🥇' },
            { name: 'Prof. Sunita Patel', role: 'Assistant Professor', answers: 78, badge: '🥈' },
            { name: 'Deepak Sharma', role: 'Student - 3rd Year', answers: 67, badge: '🥉' },
            { name: 'Meera Krishnan', role: 'Student - Final Year', answers: 54, badge: '⭐' }
        ]
    };

    let currentPage = 1;
    const itemsPerPage = 6;
    let filteredQuestions = [...forumData.questions];
    let currentCategory = 'all';

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Initialize page
    function init() {
        loadStats();
        loadCategoryCounts();
        loadQuestions();
        loadContributors();
        setupEventListeners();
    }

    // Load statistics
    function loadStats() {
        const totalQuestions = forumData.questions.length;
        const answeredQuestions = forumData.questions.filter(q => q.status === 'answered').length;
        const uniqueAuthors = new Set(forumData.questions.map(q => q.author.name)).size;
        const topContributors = forumData.contributors.length;

        document.getElementById('totalQuestions').textContent = totalQuestions;
        document.getElementById('answeredQuestions').textContent = answeredQuestions;
        document.getElementById('activeUsers').textContent = uniqueAuthors;
        document.getElementById('topContributors').textContent = topContributors;
    }

    // Load category counts
    function loadCategoryCounts() {
        const counts = {
            all: forumData.questions.length,
            academic: forumData.questions.filter(q => q.category === 'academic').length,
            technical: forumData.questions.filter(q => q.category === 'technical').length,
            placement: forumData.questions.filter(q => q.category === 'placement').length,
            campus: forumData.questions.filter(q => q.category === 'campus').length,
            general: forumData.questions.filter(q => q.category === 'general').length
        };

        document.getElementById('countAll').textContent = counts.all;
        document.getElementById('countAcademic').textContent = counts.academic;
        document.getElementById('countTechnical').textContent = counts.technical;
        document.getElementById('countPlacement').textContent = counts.placement;
        document.getElementById('countCampus').textContent = counts.campus;
        document.getElementById('countGeneral').textContent = counts.general;
    }

    // Load questions
    function loadQuestions() {
        const container = document.getElementById('questionsList');
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const questions = filteredQuestions.slice(start, end);

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="loading-text">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3>No questions found</h3>
                    <p>Try adjusting your filters or be the first to ask!</p>
                </div>
            `;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        container.innerHTML = questions.map(q => `
            <div class="question-card" onclick="openQuestionDetail(${q.id})">
                <div class="question-header">
                    <h3 class="question-title">${esc(q.title)}</h3>
                    <span class="question-status ${q.status === 'answered' ? 'status-answered' : 'status-open'}">
                        ${q.status === 'answered' ? '✅ Answered' : '❓ Open'}
                    </span>
                </div>
                <p class="question-excerpt">${esc(q.description)}</p>
                <div class="question-meta">
                    <div class="question-author">
                        <span class="author-avatar">${esc(q.author.avatar)}</span>
                        <span>${esc(q.author.name)}</span>
                    </div>
                    <div class="question-stats">
                        <span class="stat-item">💬 ${q.answers} answers</span>
                        <span class="stat-item">👁️ ${q.views} views</span>
                        <span class="stat-item">👍 ${q.upvotes}</span>
                    </div>
                    <div class="question-tags">
                        ${q.tags.map(tag => `<span class="question-tag">${esc(tag)}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        renderPagination();
    }

    // Render pagination
    function renderPagination() {
        const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
        if (totalPages <= 1) {
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        let paginationHTML = `
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1})">← Prev</button>
        `;

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

        paginationHTML += `
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1})">Next →</button>
        `;

        document.getElementById('pagination').innerHTML = paginationHTML;
    }

    // Change page
    window.changePage = function(page) {
        const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        loadQuestions();
        document.querySelector('.questions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Load contributors
    function loadContributors() {
        const container = document.getElementById('contributorsList');
        container.innerHTML = forumData.contributors.map(c => `
            <div class="contributor-card">
                <div class="contributor-avatar">${c.name.split(' ').map(n => n[0]).join('')}</div>
                <div class="contributor-info">
                    <div class="contributor-name">${c.name}</div>
                    <div class="contributor-stats">${c.role} • ${c.answers} answers</div>
                </div>
                <span class="contributor-badge">${c.badge}</span>
            </div>
        `).join('');
    }

    // Setup event listeners
    function setupEventListeners() {
        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const category = this.dataset.category;
                currentCategory = category;
                
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                filterQuestions();
            });
        });

        // Search input
        document.getElementById('forumSearch').addEventListener('input', debounce(filterQuestions, 300));

        // Filter selects
        document.getElementById('filterStatus').addEventListener('change', filterQuestions);
        document.getElementById('sortOrder').addEventListener('change', filterQuestions);

        // Filter tags
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                this.classList.toggle('active');
                filterQuestions();
            });
        });

        // New question form
        document.getElementById('newQuestionForm').addEventListener('submit', handleNewQuestion);
    }

    // Filter questions
    function filterQuestions() {
        const searchTerm = document.getElementById('forumSearch').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;
        const sortOrder = document.getElementById('sortOrder').value;
        const activeTags = Array.from(document.querySelectorAll('.filter-tag.active'))
            .map(tag => tag.dataset.tag);

        filteredQuestions = forumData.questions.filter(q => {
            // Category filter
            if (currentCategory !== 'all' && q.category !== currentCategory) return false;

            // Search filter
            if (searchTerm && !q.title.toLowerCase().includes(searchTerm) &&
                !q.description.toLowerCase().includes(searchTerm)) return false;

            // Status filter
            if (statusFilter) {
                if (statusFilter === 'unanswered' && q.answers > 0) return false;
                if (statusFilter === 'answered' && q.status !== 'answered') return false;
                if (statusFilter === 'open' && q.status !== 'open') return false;
            }

            // Tags filter
            if (activeTags.length > 0 && !activeTags.some(tag => q.tags.includes(tag))) return false;

            return true;
        });

        // Sort
        switch (sortOrder) {
            case 'newest':
                filteredQuestions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'popular':
                filteredQuestions.sort((a, b) => b.upvotes - a.upvotes);
                break;
            case 'unanswered':
                filteredQuestions.sort((a, b) => a.answers - b.answers);
                break;
            case 'recent-activity':
                filteredQuestions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
                break;
        }

        currentPage = 1;
        loadQuestions();
    }

    // Open new question modal
    window.openNewQuestionModal = function() {
        document.getElementById('newQuestionModal').style.display = 'flex';
    };

    // Close new question modal
    window.closeNewQuestionModal = function() {
        document.getElementById('newQuestionModal').style.display = 'none';
        document.getElementById('newQuestionForm').reset();
    };

    // Handle new question submission
    function handleNewQuestion(e) {
        e.preventDefault();

        const title = document.getElementById('questionTitle').value.trim();
        const category = document.getElementById('questionCategory').value;
        const description = document.getElementById('questionDescription').value.trim();
        const tags = document.getElementById('questionTags').value.split(',').map(t => t.trim()).filter(Boolean);

        if (!title || !category || !description) {
            if (window.showToast) {
                window.showToast('Please fill in all required fields', 'error');
            }
            return;
        }

        // Create new question (in production, this would be an API call)
        const newQuestion = {
            id: forumData.questions.length + 1,
            title,
            description,
            category,
            author: { name: 'Current User', avatar: 'CU', role: 'student' },
            tags: tags.length > 0 ? tags : [category],
            status: 'open',
            views: 0,
            upvotes: 0,
            answers: 0,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        forumData.questions.unshift(newQuestion);
        filteredQuestions = [...forumData.questions];

        closeNewQuestionModal();
        loadStats();
        loadCategoryCounts();
        loadQuestions();

        if (window.showToast) {
            window.showToast('Question posted successfully!', 'success');
        }
    }

    // Open question detail modal
    window.openQuestionDetail = function(questionId) {
        const question = forumData.questions.find(q => q.id === questionId);
        if (!question) return;

        document.getElementById('modalQuestionTitle').textContent = question.title;
        
        const body = document.getElementById('questionDetailBody');
        body.innerHTML = `
            <div class="question-detail">
                <div class="question-meta" style="margin-bottom: 1rem;">
                    <div class="question-author">
                        <span class="author-avatar">${esc(question.author.avatar)}</span>
                        <span>${esc(question.author.name)}</span>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">
                            • ${formatTimeAgo(question.createdAt)}
                        </span>
                    </div>
                </div>
                <p style="color: var(--text-primary); line-height: 1.7; margin-bottom: 1rem;">
                    ${esc(question.description)}
                </p>
                <div class="question-tags" style="margin-bottom: 1rem;">
                    ${question.tags.map(tag => `<span class="question-tag">${esc(tag)}</span>`).join('')}
                </div>
                <div class="question-stats" style="margin-bottom: 1.5rem;">
                    <span class="stat-item">👁️ ${question.views} views</span>
                    <span class="stat-item">👍 ${question.upvotes} upvotes</span>
                </div>
                
                <div class="answer-section">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">
                        💬 ${question.answers} Answers
                    </h4>
                    ${generateSampleAnswers(question)}
                    
                    <div style="margin-top: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">✍️ Your Answer</h4>
                        <textarea class="form-textarea" rows="4" 
                            placeholder="Share your knowledge or insights..."></textarea>
                        <div style="margin-top: 0.75rem;">
                            <button class="btn btn-primary" onclick="submitAnswer(${question.id})">
                                📤 Post Answer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('questionDetailModal').style.display = 'flex';
    };

    // Generate sample answers for demo
    function generateSampleAnswers(question) {
        if (question.answers === 0) {
            return '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No answers yet. Be the first to answer!</p>';
        }

        const sampleAnswers = [
            {
                author: 'Dr. Ramesh Kumar',
                role: 'Professor',
                avatar: 'RK',
                content: 'Great question! Here\'s a comprehensive explanation that should help you understand the concept better. The key points to remember are...',
                upvotes: 12,
                accepted: question.status === 'answered'
            },
            {
                author: 'Ankit Verma',
                role: 'Student',
                avatar: 'AV',
                content: 'I had the same doubt! I found this approach works well. You can also check out the additional resources on our notes section.',
                upvotes: 8,
                accepted: false
            }
        ];

        return sampleAnswers.slice(0, Math.min(question.answers, 2)).map(a => `
            <div class="answer-card ${a.accepted ? 'accepted' : ''}">
                <div class="answer-header">
                    <div class="answer-author">
                        <span class="author-avatar">${a.avatar}</span>
                        <span style="font-weight: 600; color: var(--text-primary);">${a.author}</span>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">${a.role}</span>
                        ${a.accepted ? '<span style="color: #22c55e; font-weight: 600; margin-left: 0.5rem;">✅ Accepted</span>' : ''}
                    </div>
                </div>
                <p class="answer-content">${a.content}</p>
                <div class="answer-actions">
                    <button class="vote-btn">👍 ${a.upvotes}</button>
                    <button class="vote-btn">👎</button>
                    <button class="vote-btn">💬 Reply</button>
                </div>
            </div>
        `).join('');
    }

    // Close question detail modal
    window.closeQuestionDetailModal = function() {
        document.getElementById('questionDetailModal').style.display = 'none';
    };

    // Submit answer
    window.submitAnswer = function(questionId) {
        if (window.showToast) {
            window.showToast('Answer submitted successfully!', 'success');
        }
        closeQuestionDetailModal();
        
        // Update answer count
        const question = forumData.questions.find(q => q.id === questionId);
        if (question) {
            question.answers++;
            loadQuestions();
        }
    };

    // Utility functions
    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
