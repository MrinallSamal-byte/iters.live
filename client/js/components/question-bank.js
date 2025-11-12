/**
 * Question Bank System
 * Comprehensive question management for teachers
 * Features: CRUD operations, tagging, import/export, random selection
 */

class QuestionBank {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.questions = [];
        this.filteredQuestions = [];
        this.currentView = 'list'; // 'list', 'create', 'edit', 'preview'
        this.currentQuestion = null;
        this.selectedTags = [];
        this.selectedDifficulty = 'all';
        this.selectedType = 'all';
        this.searchQuery = '';
        
        this.loadQuestions();
        this.render();
        this.attachEventListeners();
    }

    loadQuestions() {
        const saved = localStorage.getItem('questionBank');
        if (saved) {
            this.questions = JSON.parse(saved);
        } else {
            // Sample questions for demo
            this.questions = this.getSampleQuestions();
            this.saveQuestions();
        }
        this.filteredQuestions = [...this.questions];
    }

    saveQuestions() {
        localStorage.setItem('questionBank', JSON.stringify(this.questions));
    }

    getSampleQuestions() {
        return [
            {
                id: 'q-' + Date.now() + '-1',
                questionText: 'What is the time complexity of binary search?',
                type: 'mcq',
                options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
                correctAnswer: 'O(log n)',
                points: 2,
                difficulty: 'medium',
                tags: ['algorithms', 'data-structures', 'complexity'],
                explanation: 'Binary search divides the search space in half with each iteration.',
                createdAt: new Date().toISOString(),
                usageCount: 0,
                avgScore: 0
            },
            {
                id: 'q-' + Date.now() + '-2',
                questionText: 'JavaScript is a compiled language.',
                type: 'true_false',
                correctAnswer: 'false',
                points: 1,
                difficulty: 'easy',
                tags: ['javascript', 'basics'],
                explanation: 'JavaScript is an interpreted language, not compiled.',
                createdAt: new Date().toISOString(),
                usageCount: 0,
                avgScore: 0
            }
        ];
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="question-bank">
                <div class="qb-header">
                    <div class="qb-header-top">
                        <h2><i class="fas fa-brain"></i> Question Bank</h2>
                        <div class="qb-actions">
                            <button class="btn btn-secondary" id="importBtn">
                                <i class="fas fa-file-import"></i> Import CSV
                            </button>
                            <button class="btn btn-secondary" id="exportBtn">
                                <i class="fas fa-file-export"></i> Export CSV
                            </button>
                            <button class="btn btn-primary" id="createQuestionBtn">
                                <i class="fas fa-plus"></i> Create Question
                            </button>
                        </div>
                    </div>
                    
                    <div class="qb-filters">
                        <div class="qb-search">
                            <i class="fas fa-search"></i>
                            <input type="text" id="searchInput" placeholder="Search questions..." value="${this.searchQuery}">
                        </div>
                        
                        <select id="typeFilter" value="${this.selectedType}">
                            <option value="all">All Types</option>
                            <option value="mcq">Multiple Choice</option>
                            <option value="true_false">True/False</option>
                            <option value="short_answer">Short Answer</option>
                        </select>
                        
                        <select id="difficultyFilter" value="${this.selectedDifficulty}">
                            <option value="all">All Difficulties</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                        
                        <button class="btn btn-sm btn-secondary" id="clearFiltersBtn">
                            <i class="fas fa-times"></i> Clear Filters
                        </button>
                    </div>
                    
                    <div class="qb-stats">
                        <div class="stat-card">
                            <div class="stat-value">${this.questions.length}</div>
                            <div class="stat-label">Total Questions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${this.questions.filter(q => q.type === 'mcq').length}</div>
                            <div class="stat-label">MCQ</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${this.questions.filter(q => q.type === 'true_false').length}</div>
                            <div class="stat-label">True/False</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${this.questions.filter(q => q.difficulty === 'hard').length}</div>
                            <div class="stat-label">Hard Questions</div>
                        </div>
                    </div>
                </div>
                
                <div class="qb-content">
                    ${this.currentView === 'list' ? this.renderList() : ''}
                    ${this.currentView === 'create' ? this.renderCreateForm() : ''}
                    ${this.currentView === 'edit' ? this.renderEditForm() : ''}
                    ${this.currentView === 'preview' ? this.renderPreview() : ''}
                </div>
            </div>
        `;
    }

    renderList() {
        if (this.filteredQuestions.length === 0) {
            return `
                <div class="qb-empty">
                    <i class="fas fa-question-circle"></i>
                    <p>No questions found</p>
                    <button class="btn btn-primary" id="createFirstQuestionBtn">Create Your First Question</button>
                </div>
            `;
        }

        return `
            <div class="qb-list">
                ${this.filteredQuestions.map(q => this.renderQuestionCard(q)).join('')}
            </div>
        `;
    }

    renderQuestionCard(question) {
        const difficultyColor = {
            easy: 'success',
            medium: 'warning',
            hard: 'danger'
        }[question.difficulty];

        return `
            <div class="question-card" data-id="${question.id}">
                <div class="qc-header">
                    <div class="qc-type">
                        <span class="badge badge-${question.type === 'mcq' ? 'primary' : question.type === 'true_false' ? 'info' : 'secondary'}">
                            ${question.type === 'mcq' ? 'Multiple Choice' : question.type === 'true_false' ? 'True/False' : 'Short Answer'}
                        </span>
                        <span class="badge badge-${difficultyColor}">
                            ${question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                        </span>
                        <span class="qc-points">${question.points} pts</span>
                    </div>
                    <div class="qc-actions">
                        <button class="btn-icon" data-action="preview" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" data-action="edit" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" data-action="duplicate" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon btn-danger" data-action="delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="qc-question">${question.questionText}</div>
                
                ${question.type === 'mcq' ? `
                    <div class="qc-options">
                        ${question.options.map((opt, idx) => `
                            <div class="qc-option ${opt === question.correctAnswer ? 'correct' : ''}">
                                ${String.fromCharCode(65 + idx)}. ${opt}
                                ${opt === question.correctAnswer ? '<i class="fas fa-check"></i>' : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : question.type === 'true_false' ? `
                    <div class="qc-tf-answer">
                        Correct Answer: <strong>${question.correctAnswer.toUpperCase()}</strong>
                    </div>
                ` : ''}
                
                <div class="qc-footer">
                    <div class="qc-tags">
                        ${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <div class="qc-stats">
                        <span><i class="fas fa-chart-line"></i> Used ${question.usageCount || 0} times</span>
                        ${question.avgScore > 0 ? `<span><i class="fas fa-star"></i> Avg: ${question.avgScore.toFixed(1)}%</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderCreateForm() {
        return `
            <div class="qb-form">
                <div class="qb-form-header">
                    <h3>Create New Question</h3>
                    <button class="btn-icon" id="closeFormBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="questionForm">
                    <div class="form-group">
                        <label>Question Type *</label>
                        <select id="questionType" required>
                            <option value="mcq">Multiple Choice (MCQ)</option>
                            <option value="true_false">True/False</option>
                            <option value="short_answer">Short Answer</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Question Text *</label>
                        <textarea id="questionText" rows="3" placeholder="Enter your question here..." required></textarea>
                    </div>
                    
                    <div id="optionsContainer" class="form-group">
                        <label>Answer Options *</label>
                        <div class="options-list">
                            <div class="option-item">
                                <input type="text" class="option-input" placeholder="Option A" required>
                                <button type="button" class="btn-icon btn-success mark-correct" title="Mark as correct">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                            <div class="option-item">
                                <input type="text" class="option-input" placeholder="Option B" required>
                                <button type="button" class="btn-icon btn-success mark-correct">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                            <div class="option-item">
                                <input type="text" class="option-input" placeholder="Option C" required>
                                <button type="button" class="btn-icon btn-success mark-correct">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                            <div class="option-item">
                                <input type="text" class="option-input" placeholder="Option D" required>
                                <button type="button" class="btn-icon btn-success mark-correct">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" id="addOptionBtn">
                            <i class="fas fa-plus"></i> Add Option
                        </button>
                    </div>
                    
                    <div id="tfContainer" class="form-group" style="display: none;">
                        <label>Correct Answer *</label>
                        <div class="tf-buttons">
                            <button type="button" class="btn btn-secondary tf-btn" data-value="true">TRUE</button>
                            <button type="button" class="btn btn-secondary tf-btn" data-value="false">FALSE</button>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Points *</label>
                            <input type="number" id="points" min="0.5" step="0.5" value="1" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Difficulty *</label>
                            <select id="difficulty" required>
                                <option value="easy">Easy</option>
                                <option value="medium" selected>Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Tags (comma-separated)</label>
                        <input type="text" id="tags" placeholder="e.g., algorithms, sorting, arrays">
                        <small>Press Enter or comma to add tags</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Explanation (optional)</label>
                        <textarea id="explanation" rows="2" placeholder="Explain the correct answer..."></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelFormBtn">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save Question
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    renderEditForm() {
        // Similar to create form but pre-filled with current question data
        return this.renderCreateForm().replace('Create New Question', 'Edit Question');
    }

    renderPreview() {
        if (!this.currentQuestion) return '';
        
        return `
            <div class="qb-preview">
                <div class="qb-preview-header">
                    <h3>Question Preview</h3>
                    <button class="btn-icon" id="closePreviewBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="preview-content">
                    ${this.renderQuestionCard(this.currentQuestion)}
                    
                    ${this.currentQuestion.explanation ? `
                        <div class="preview-explanation">
                            <h4>Explanation:</h4>
                            <p>${this.currentQuestion.explanation}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="preview-actions">
                    <button class="btn btn-secondary" id="editFromPreviewBtn">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-primary" id="closePreviewBtn2">Close</button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const id = btn.id;
            const action = btn.dataset.action;
            const questionCard = btn.closest('.question-card');
            const questionId = questionCard?.dataset.id;
            
            // Header actions
            if (id === 'createQuestionBtn' || id === 'createFirstQuestionBtn') {
                this.currentView = 'create';
                this.render();
                this.setupFormHandlers();
            } else if (id === 'importBtn') {
                this.importCSV();
            } else if (id === 'exportBtn') {
                this.exportCSV();
            } else if (id === 'clearFiltersBtn') {
                this.clearFilters();
            }
            
            // Card actions
            else if (action === 'preview') {
                this.previewQuestion(questionId);
            } else if (action === 'edit') {
                this.editQuestion(questionId);
            } else if (action === 'duplicate') {
                this.duplicateQuestion(questionId);
            } else if (action === 'delete') {
                this.deleteQuestion(questionId);
            }
            
            // Form actions
            else if (id === 'closeFormBtn' || id === 'cancelFormBtn') {
                this.currentView = 'list';
                this.render();
            } else if (id === 'closePreviewBtn' || id === 'closePreviewBtn2') {
                this.currentView = 'list';
                this.render();
            } else if (id === 'editFromPreviewBtn') {
                this.editQuestion(this.currentQuestion.id);
            }
        });
        
        // Search and filters
        const searchInput = this.container.querySelector('#searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
            });
        }
        
        const typeFilter = this.container.querySelector('#typeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.selectedType = e.target.value;
                this.applyFilters();
            });
        }
        
        const difficultyFilter = this.container.querySelector('#difficultyFilter');
        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', (e) => {
                this.selectedDifficulty = e.target.value;
                this.applyFilters();
            });
        }
    }

    setupFormHandlers() {
        const form = this.container.querySelector('#questionForm');
        const typeSelect = this.container.querySelector('#questionType');
        const optionsContainer = this.container.querySelector('#optionsContainer');
        const tfContainer = this.container.querySelector('#tfContainer');
        
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'true_false') {
                    optionsContainer.style.display = 'none';
                    tfContainer.style.display = 'block';
                } else if (e.target.value === 'mcq') {
                    optionsContainer.style.display = 'block';
                    tfContainer.style.display = 'none';
                } else {
                    optionsContainer.style.display = 'none';
                    tfContainer.style.display = 'none';
                }
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveQuestion();
            });
        }
        
        // Mark correct answer
        this.container.querySelectorAll('.mark-correct').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.mark-correct').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // True/False buttons
        this.container.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    saveQuestion() {
        const type = this.container.querySelector('#questionType').value;
        const questionText = this.container.querySelector('#questionText').value;
        const points = parseFloat(this.container.querySelector('#points').value);
        const difficulty = this.container.querySelector('#difficulty').value;
        const tagsInput = this.container.querySelector('#tags').value;
        const explanation = this.container.querySelector('#explanation').value;
        
        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
        
        let correctAnswer = '';
        let options = [];
        
        if (type === 'mcq') {
            const optionInputs = this.container.querySelectorAll('.option-input');
            options = Array.from(optionInputs).map(input => input.value).filter(v => v);
            const activeBtn = this.container.querySelector('.mark-correct.active');
            if (!activeBtn) {
                alert('Please mark the correct answer');
                return;
            }
            const correctIndex = Array.from(this.container.querySelectorAll('.mark-correct')).indexOf(activeBtn);
            correctAnswer = options[correctIndex];
        } else if (type === 'true_false') {
            const activeBtn = this.container.querySelector('.tf-btn.active');
            if (!activeBtn) {
                alert('Please select the correct answer');
                return;
            }
            correctAnswer = activeBtn.dataset.value;
        }
        
        const question = {
            id: this.currentView === 'edit' ? this.currentQuestion.id : 'q-' + Date.now(),
            questionText,
            type,
            options,
            correctAnswer,
            points,
            difficulty,
            tags,
            explanation,
            createdAt: new Date().toISOString(),
            usageCount: 0,
            avgScore: 0
        };
        
        if (this.currentView === 'edit') {
            const index = this.questions.findIndex(q => q.id === question.id);
            this.questions[index] = question;
        } else {
            this.questions.unshift(question);
        }
        
        this.saveQuestions();
        this.currentView = 'list';
        this.applyFilters();
        this.render();
        
        this.showToast('Question saved successfully!', 'success');
    }

    previewQuestion(id) {
        this.currentQuestion = this.questions.find(q => q.id === id);
        this.currentView = 'preview';
        this.render();
    }

    editQuestion(id) {
        this.currentQuestion = this.questions.find(q => q.id === id);
        this.currentView = 'edit';
        this.render();
        this.setupFormHandlers();
        this.populateEditForm();
    }

    populateEditForm() {
        if (!this.currentQuestion) return;
        
        const q = this.currentQuestion;
        this.container.querySelector('#questionType').value = q.type;
        this.container.querySelector('#questionText').value = q.questionText;
        this.container.querySelector('#points').value = q.points;
        this.container.querySelector('#difficulty').value = q.difficulty;
        this.container.querySelector('#tags').value = q.tags.join(', ');
        this.container.querySelector('#explanation').value = q.explanation || '';
        
        if (q.type === 'mcq') {
            const optionInputs = this.container.querySelectorAll('.option-input');
            q.options.forEach((opt, idx) => {
                if (optionInputs[idx]) {
                    optionInputs[idx].value = opt;
                    if (opt === q.correctAnswer) {
                        this.container.querySelectorAll('.mark-correct')[idx].classList.add('active');
                    }
                }
            });
        } else if (q.type === 'true_false') {
            this.container.querySelector(`[data-value="${q.correctAnswer}"]`).classList.add('active');
        }
    }

    duplicateQuestion(id) {
        const question = this.questions.find(q => q.id === id);
        const duplicate = {
            ...question,
            id: 'q-' + Date.now(),
            questionText: question.questionText + ' (Copy)',
            createdAt: new Date().toISOString(),
            usageCount: 0,
            avgScore: 0
        };
        
        this.questions.unshift(duplicate);
        this.saveQuestions();
        this.applyFilters();
        this.render();
        this.showToast('Question duplicated!', 'success');
    }

    deleteQuestion(id) {
        if (!confirm('Are you sure you want to delete this question?')) return;
        
        this.questions = this.questions.filter(q => q.id !== id);
        this.saveQuestions();
        this.applyFilters();
        this.render();
        this.showToast('Question deleted!', 'success');
    }

    applyFilters() {
        let filtered = [...this.questions];
        
        if (this.searchQuery) {
            filtered = filtered.filter(q => 
                q.questionText.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                q.tags.some(tag => tag.toLowerCase().includes(this.searchQuery.toLowerCase()))
            );
        }
        
        if (this.selectedType !== 'all') {
            filtered = filtered.filter(q => q.type === this.selectedType);
        }
        
        if (this.selectedDifficulty !== 'all') {
            filtered = filtered.filter(q => q.difficulty === this.selectedDifficulty);
        }
        
        this.filteredQuestions = filtered;
        this.render();
    }

    clearFilters() {
        this.searchQuery = '';
        this.selectedType = 'all';
        this.selectedDifficulty = 'all';
        this.selectedTags = [];
        this.applyFilters();
    }

    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const csv = event.target.result;
                    const lines = csv.split('\n');
                    const imported = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const parts = lines[i].split(',');
                        if (parts.length < 5) continue;
                        
                        imported.push({
                            id: 'q-' + Date.now() + '-' + i,
                            questionText: parts[0].trim(),
                            type: parts[1].trim(),
                            correctAnswer: parts[2].trim(),
                            points: parseFloat(parts[3]) || 1,
                            difficulty: parts[4].trim() || 'medium',
                            tags: parts[5] ? parts[5].split(';').map(t => t.trim()) : [],
                            explanation: parts[6] || '',
                            options: parts[7] ? parts[7].split(';') : [],
                            createdAt: new Date().toISOString(),
                            usageCount: 0,
                            avgScore: 0
                        });
                    }
                    
                    this.questions = [...imported, ...this.questions];
                    this.saveQuestions();
                    this.applyFilters();
                    this.render();
                    this.showToast(`Imported ${imported.length} questions!`, 'success');
                } catch (error) {
                    this.showToast('Error importing CSV file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    exportCSV() {
        const csv = ['Question,Type,Correct Answer,Points,Difficulty,Tags,Explanation,Options'];
        
        this.filteredQuestions.forEach(q => {
            csv.push([
                q.questionText,
                q.type,
                q.correctAnswer,
                q.points,
                q.difficulty,
                q.tags.join(';'),
                q.explanation || '',
                q.options ? q.options.join(';') : ''
            ].join(','));
        });
        
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `question-bank-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Questions exported!', 'success');
    }

    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(message);
        }
    }

    // Generate random quiz
    generateQuiz(count = 10, difficulty = 'all', tags = []) {
        let pool = [...this.questions];
        
        if (difficulty !== 'all') {
            pool = pool.filter(q => q.difficulty === difficulty);
        }
        
        if (tags.length > 0) {
            pool = pool.filter(q => q.tags.some(tag => tags.includes(tag)));
        }
        
        // Shuffle and select
        const shuffled = pool.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.QuestionBank = QuestionBank;
}
