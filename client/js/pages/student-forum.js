// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('student')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires student role');
  }
})();

// ponytail: wired to /api/forum (previously hardcoded prototype data)
/**
 * Student Forum Page
 * Q&A platform for students to ask questions and get answers
 */

(function() {
    'use strict';

    // Live data populated from /api/forum
    const forumData = {
        questions: [],
        contributors: []
    };

    let currentPage = 1;
    const itemsPerPage = 6;
    let filteredQuestions = [];
    let currentCategory = 'all';

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---- API -> renderer mapping ----
    // Server rows are flat (author_name, tags string, answer_count); renderers
    // expect an author object, tag arrays and camelCase dates, so map instead of rewrite.
    function initialsOf(name) {
        return String(name || '?').trim().split(/\s+/).slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') || '?';
    }

    function parseTags(raw) {
        return Array.isArray(raw) ? raw : String(raw || '').split(',').map(t => t.trim()).filter(Boolean);
    }

    function mapQuestion(raw) {
        const answerCount = typeof raw.answer_count === 'number'
            ? raw.answer_count
            : (Array.isArray(raw.answers) ? raw.answers.length : 0);
        const tags = parseTags(raw.tags);
        return {
            id: raw.id,
            title: raw.title,
            description: raw.description,
            category: raw.category,
            status: raw.status || (answerCount > 0 ? 'answered' : 'open'),
            views: raw.views || 0,
            upvotes: raw.upvotes || 0,
            tags: tags.length > 0 ? tags : [String(raw.category || 'general').toLowerCase()],
            author: {
                name: raw.author_name || 'Unknown User',
                avatar: initialsOf(raw.author_name),
                role: raw.author_role || 'student'
            },
            answers: answerCount,
            createdAt: raw.created_at,
            lastActivity: raw.updated_at || raw.created_at,
            userId: raw.user_id || null
        };
    }

    function mapAnswer(raw) {
        return {
            id: raw.id,
            content: raw.content,
            author: raw.author_name || 'Unknown User',
            role: raw.author_role || 'student',
            avatar: initialsOf(raw.author_name),
            upvotes: raw.upvotes || 0,
            accepted: Boolean(raw.is_accepted),
            createdAt: raw.created_at
        };
    }

    function toast(message, type) {
        if (window.APP && typeof window.APP.showToast === 'function') {
            window.APP.showToast(message, type);
        } else if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function getCurrentUserId() {
        try {
            const user = window.APP && window.APP.Storage.get('user');
            return user ? (user.id || user.uid || null) : null;
        } catch (e) {
            return null;
        }
    }

    // Initialize page
    function init() {
        setupEventListeners();
        loadStats();
        loadCategoryCounts();
        loadQuestions();
        loadContributors();
    }

    // Load statistics
    async function loadStats() {
        try {
            const res = await APP.API.get('/forum/stats');
            const stats = res.stats || {};
            document.getElementById('totalQuestions').textContent = stats.total_questions ?? 0;
            document.getElementById('answeredQuestions').textContent = stats.answered_questions ?? 0;
            document.getElementById('activeUsers').textContent = stats.active_users ?? 0;
        } catch (err) {
            console.error('Forum stats error:', err);
        }
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
    async function loadQuestions() {
        const container = document.getElementById('questionsList');
        container.innerHTML = '<div class="loading-text">LOADING...</div>';
        document.getElementById('pagination').innerHTML = '';

        try {
            const res = await APP.API.get('/forum/questions?page=1&limit=50');
            forumData.questions = (res.questions || []).map(mapQuestion);
        } catch (err) {
            console.error('Load questions error:', err);
            container.innerHTML = `
                <div class="loading-text">
                    <h3>Failed to load questions</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
            toast(err.message || 'Failed to load questions', 'error');
            return;
        }

        loadCategoryCounts();

        if (forumData.questions.length === 0) {
            container.innerHTML = `
                <div class="loading-text">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3>NO QUESTIONS YET</h3>
                    <p>Be the first to ask!</p>
                </div>
            `;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        filterQuestions();
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
        loadQuestionsPage();
        document.querySelector('.questions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Render current page of already-loaded questions
    function loadQuestionsPage() {
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
            <div class="question-card" onclick="openQuestionDetail('${esc(q.id)}')">
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

    // Load contributors
    async function loadContributors() {
        const container = document.getElementById('contributorsList');
        container.innerHTML = '<div class="loading-text">LOADING...</div>';

        try {
            const res = await APP.API.get('/forum/contributors');
            const badges = ['🏆', '🥇', '🥈', '🥉'];
            forumData.contributors = (res.contributors || []).map((c, i) => ({
                name: c.name || 'Anonymous',
                role: String(c.role || 'member').charAt(0).toUpperCase() + String(c.role || '').slice(1),
                answers: c.answer_count ?? c.answers ?? 0,
                badge: badges[i] || '⭐'
            }));

            const topEl = document.getElementById('topContributors');
            if (topEl) topEl.textContent = forumData.contributors.length;

            container.innerHTML = forumData.contributors.map(c => `
                <div class="contributor-card">
                    <div class="contributor-avatar">${esc(c.name.split(' ').map(n => n[0]).join(''))}</div>
                    <div class="contributor-info">
                        <div class="contributor-name">${esc(c.name)}</div>
                        <div class="contributor-stats">${esc(c.role)} • ${c.answers} answers</div>
                    </div>
                    <span class="contributor-badge">${c.badge}</span>
                </div>
            `).join('');
        } catch (err) {
            console.error('Load contributors error:', err);
            container.innerHTML = '<div class="loading-text">Failed to load contributors.</div>';
        }
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
        loadQuestionsPage();
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
    async function handleNewQuestion(e) {
        e.preventDefault();

        const title = document.getElementById('questionTitle').value.trim();
        const category = document.getElementById('questionCategory').value;
        const description = document.getElementById('questionDescription').value.trim();
        const tags = document.getElementById('questionTags').value.split(',').map(t => t.trim()).filter(Boolean);

        if (!title || !category || !description) {
            toast('Please fill in all required fields', 'error');
            return;
        }

        try {
            const res = await APP.API.post('/forum/questions', { title, description, category, tags });
            const newQuestion = mapQuestion(res.question || {});
            // Server does not echo author profile fields
            newQuestion.author = { name: 'You', avatar: initialsOf('You'), role: 'student' };
            newQuestion.createdAt = newQuestion.createdAt || new Date().toISOString();
            newQuestion.lastActivity = newQuestion.lastActivity || newQuestion.createdAt;

            forumData.questions.unshift(newQuestion);

            closeNewQuestionModal();
            loadStats();
            loadCategoryCounts();
            filterQuestions();

            toast(res.message || 'Question posted successfully!', 'success');
        } catch (err) {
            console.error('Create question error:', err);
            toast(err.message || 'Failed to post question', 'error');
        }
    }

    // Open question detail modal
    window.openQuestionDetail = async function(questionId) {
        const body = document.getElementById('questionDetailBody');

        document.getElementById('modalQuestionTitle').textContent = 'Loading...';
        body.innerHTML = '<div class="loading-text">LOADING...</div>';
        document.getElementById('questionDetailModal').style.display = 'flex';

        let question;
        let answers = [];
        try {
            const res = await APP.API.get(`/forum/questions/${encodeURIComponent(questionId)}`);
            question = mapQuestion((res && res.question) || {});
            answers = (Array.isArray(res.question && res.question.answers) ? res.question.answers : []).map(mapAnswer);
        } catch (err) {
            console.error('Get question error:', err);
            body.innerHTML = '<div class="loading-text">Failed to load question.</div>';
            toast(err.message || 'Failed to load question', 'error');
            return;
        }

        document.getElementById('modalQuestionTitle').textContent = question.title;

        const uid = getCurrentUserId();
        const isAuthor = Boolean(uid && question.userId && String(uid) === String(question.userId));

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
                        💬 ${answers.length} Answers
                    </h4>
                    ${renderAnswers(answers, question, isAuthor)}
                    
                    <div style="margin-top: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">✍️ Your Answer</h4>
                        <textarea id="answerContent" class="form-textarea" rows="4" 
                            placeholder="Share your knowledge or insights..."></textarea>
                        <div style="margin-top: 0.75rem;">
                            <button class="btn btn-primary" onclick="submitAnswer('${esc(question.id)}')">
                                📤 Post Answer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // Render answers for a question
    function renderAnswers(answers, question, isAuthor) {
        if (!answers || answers.length === 0) {
            return '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No answers yet. Be the first to answer!</p>';
        }

        return answers.map(a => `
            <div class="answer-card ${a.accepted ? 'accepted' : ''}">
                <div class="answer-header">
                    <div class="answer-author">
                        <span class="author-avatar">${esc(a.avatar)}</span>
                        <span style="font-weight: 600; color: var(--text-primary);">${esc(a.author)}</span>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">${esc(a.role)}</span>
                        ${a.accepted ? '<span style="color: #22c55e; font-weight: 600; margin-left: 0.5rem;">✅ Accepted</span>' : ''}
                    </div>
                </div>
                <p class="answer-content">${esc(a.content)}</p>
                <div class="answer-actions">
                    <button class="vote-btn" onclick="upvoteAnswer('${esc(a.id)}', this)">👍 ${a.upvotes}</button>
                    <button class="vote-btn">👎</button>
                    <button class="vote-btn">💬 Reply</button>
                    ${isAuthor && !a.accepted ? `<button class="vote-btn" onclick="acceptAnswer('${esc(question.id)}', '${esc(a.id)}')">✅ Accept</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Close question detail modal
    window.closeQuestionDetailModal = function() {
        document.getElementById('questionDetailModal').style.display = 'none';
    };

    // Upvote an answer
    window.upvoteAnswer = async function(answerId, btn) {
        try {
            const res = await APP.API.post(`/forum/answers/${encodeURIComponent(answerId)}/upvote`, {});
            if (btn && typeof res.upvotes === 'number') {
                btn.textContent = `👍 ${res.upvotes}`;
            }
        } catch (err) {
            console.error('Upvote error:', err);
            toast(err.message || 'Failed to upvote', 'error');
        }
    };

    // Accept an answer (question author only, enforced server-side)
    window.acceptAnswer = async function(questionId, answerId) {
        try {
            const res = await APP.API.post(`/forum/answers/${encodeURIComponent(answerId)}/accept`, {});
            toast((res && res.message) || 'Answer accepted', 'success');
            openQuestionDetail(questionId);
        } catch (err) {
            console.error('Accept answer error:', err);
            toast(err.message || 'Failed to accept answer', 'error');
        }
    };

    // Submit answer
    window.submitAnswer = async function(questionId) {
        const textarea = document.getElementById('answerContent');
        const content = textarea ? textarea.value.trim() : '';

        if (!content) {
            toast('Please write your answer first', 'error');
            return;
        }

        try {
            const res = await APP.API.post(`/forum/questions/${encodeURIComponent(questionId)}/answers`, { content });

            // Server list rows keep a denormalized answer_count; bump locally until next reload
            const local = forumData.questions.find(q => String(q.id) === String(questionId));
            if (local) {
                local.answers++;
                local.lastActivity = (res.answer && res.answer.created_at) || new Date().toISOString();
                filterQuestions();
            }

            toast(res.message || 'Answer submitted successfully!', 'success');
            openQuestionDetail(questionId);
        } catch (err) {
            console.error('Post answer error:', err);
            toast(err.message || 'Failed to post answer', 'error');
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
