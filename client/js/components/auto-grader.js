/**
 * Auto-Grading MCQ Engine
 * Instant grading system for multiple choice questions
 * Features: Configurable points, negative marking, grade distribution
 */

class AutoGrader {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.quizzes = [];
        this.currentQuiz = null;
        this.submissions = [];
        this.currentView = 'list'; // 'list', 'create', 'results', 'statistics'
        this.gradeSettings = {
            negativeMarking: false,
            negativePoints: 0.25,
            partialCredit: true
        };
        
        this.loadData();
        this.render();
        this.attachEventListeners();
    }

    loadData() {
        const savedQuizzes = localStorage.getItem('autoGraderQuizzes');
        const savedSubmissions = localStorage.getItem('autoGraderSubmissions');
        const savedSettings = localStorage.getItem('gradeSettings');
        
        if (savedQuizzes) this.quizzes = JSON.parse(savedQuizzes);
        if (savedSubmissions) this.submissions = JSON.parse(savedSubmissions);
        if (savedSettings) this.gradeSettings = JSON.parse(savedSettings);
    }

    saveData() {
        localStorage.setItem('autoGraderQuizzes', JSON.stringify(this.quizzes));
        localStorage.setItem('autoGraderSubmissions', JSON.stringify(this.submissions));
        localStorage.setItem('gradeSettings', JSON.stringify(this.gradeSettings));
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="auto-grader">
                <div class="ag-header">
                    <h2><i class="fas fa-calculator"></i> Auto-Grading Engine</h2>
                    <div class="ag-actions">
                        <button class="btn btn-secondary" id="settingsBtn">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                        <button class="btn btn-primary" id="createQuizBtn">
                            <i class="fas fa-plus"></i> Create Quiz
                        </button>
                    </div>
                </div>

                <div class="ag-tabs">
                    <button class="tab-btn ${this.currentView === 'list' ? 'active' : ''}" data-view="list">
                        <i class="fas fa-list"></i> Quizzes
                    </button>
                    <button class="tab-btn ${this.currentView === 'results' ? 'active' : ''}" data-view="results">
                        <i class="fas fa-chart-bar"></i> Results
                    </button>
                    <button class="tab-btn ${this.currentView === 'statistics' ? 'active' : ''}" data-view="statistics">
                        <i class="fas fa-analytics"></i> Statistics
                    </button>
                </div>

                <div class="ag-content">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    renderContent() {
        switch (this.currentView) {
            case 'list':
                return this.renderQuizList();
            case 'create':
                return this.renderCreateQuiz();
            case 'results':
                return this.renderResults();
            case 'statistics':
                return this.renderStatistics();
            default:
                return '';
        }
    }

    renderQuizList() {
        if (this.quizzes.length === 0) {
            return `
                <div class="ag-empty">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No quizzes created yet</p>
                    <button class="btn btn-primary" id="createFirstQuizBtn">Create Your First Quiz</button>
                </div>
            `;
        }

        return `
            <div class="quiz-list">
                ${this.quizzes.map(quiz => this.renderQuizCard(quiz)).join('')}
            </div>
        `;
    }

    renderQuizCard(quiz) {
        const submissionCount = this.submissions.filter(s => s.quizId === quiz.id).length;
        const avgScore = this.calculateAverageScore(quiz.id);

        return `
            <div class="quiz-card" data-id="${quiz.id}">
                <div class="qc-header">
                    <div class="qc-info">
                        <h3>${quiz.title}</h3>
                        <p class="qc-meta">${quiz.questions.length} questions • ${quiz.totalPoints} points • ${quiz.duration} min</p>
                    </div>
                    <div class="qc-actions">
                        <button class="btn btn-sm btn-secondary" data-action="view-results">
                            <i class="fas fa-chart-line"></i> Results (${submissionCount})
                        </button>
                        <button class="btn btn-sm btn-secondary" data-action="edit">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-secondary" data-action="export">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="delete">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>

                <div class="qc-stats">
                    <div class="stat">
                        <i class="fas fa-users"></i>
                        <span>${submissionCount} submissions</span>
                    </div>
                    ${avgScore !== null ? `
                        <div class="stat">
                            <i class="fas fa-star"></i>
                            <span>Avg: ${avgScore.toFixed(1)}%</span>
                        </div>
                    ` : ''}
                    <div class="stat">
                        <i class="fas fa-calendar"></i>
                        <span>${new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                ${quiz.description ? `<p class="qc-description">${quiz.description}</p>` : ''}
            </div>
        `;
    }

    renderCreateQuiz() {
        return `
            <div class="ag-form">
                <div class="ag-form-header">
                    <h3>Create New Quiz</h3>
                    <button class="btn-icon" id="closeFormBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <form id="quizForm">
                    <div class="form-group">
                        <label>Quiz Title *</label>
                        <input type="text" id="quizTitle" placeholder="e.g., Data Structures Midterm" required>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="quizDescription" rows="2" placeholder="Brief description of the quiz..."></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Duration (minutes) *</label>
                            <input type="number" id="quizDuration" min="5" value="30" required>
                        </div>
                        <div class="form-group">
                            <label>Pass Percentage *</label>
                            <input type="number" id="passPercentage" min="0" max="100" value="40" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Select Questions from Question Bank</label>
                        <button type="button" class="btn btn-secondary" id="selectQuestionsBtn">
                            <i class="fas fa-search"></i> Browse Question Bank
                        </button>
                        <div id="selectedQuestions" class="selected-questions">
                            <p class="text-muted">No questions selected</p>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelQuizBtn">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Create Quiz
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    renderResults() {
        if (this.submissions.length === 0) {
            return `
                <div class="ag-empty">
                    <i class="fas fa-chart-bar"></i>
                    <p>No quiz submissions yet</p>
                </div>
            `;
        }

        const quizGroups = this.groupSubmissionsByQuiz();

        return `
            <div class="results-container">
                <div class="results-header">
                    <h3>Quiz Results</h3>
                    <button class="btn btn-secondary" id="exportAllResultsBtn">
                        <i class="fas fa-file-csv"></i> Export All to CSV
                    </button>
                </div>

                ${Object.entries(quizGroups).map(([quizId, subs]) => {
                    const quiz = this.quizzes.find(q => q.id === quizId);
                    if (!quiz) return '';

                    return `
                        <div class="results-group">
                            <h4>${quiz.title}</h4>
                            <div class="results-table-container">
                                <table class="results-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Score</th>
                                            <th>Percentage</th>
                                            <th>Grade</th>
                                            <th>Time Taken</th>
                                            <th>Submitted</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${subs.map(sub => this.renderSubmissionRow(sub, quiz)).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderSubmissionRow(submission, quiz) {
        const percentage = (submission.score / quiz.totalPoints * 100).toFixed(1);
        const grade = this.calculateGrade(percentage);
        const gradeClass = this.getGradeClass(grade);

        return `
            <tr class="submission-row" data-id="${submission.id}">
                <td>${submission.studentName}</td>
                <td>${submission.score.toFixed(2)} / ${quiz.totalPoints}</td>
                <td>${percentage}%</td>
                <td><span class="grade-badge ${gradeClass}">${grade}</span></td>
                <td>${submission.timeTaken ? Math.round(submission.timeTaken / 60) : 'N/A'} min</td>
                <td>${new Date(submission.submittedAt).toLocaleString()}</td>
                <td>
                    <button class="btn-icon" data-action="view-details" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    renderStatistics() {
        if (this.submissions.length === 0) {
            return `
                <div class="ag-empty">
                    <i class="fas fa-chart-pie"></i>
                    <p>No statistics available yet</p>
                </div>
            `;
        }

        return `
            <div class="statistics-container">
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-clipboard-list"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${this.quizzes.length}</div>
                            <div class="stat-label">Total Quizzes</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${this.submissions.length}</div>
                            <div class="stat-label">Total Submissions</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${this.calculateOverallAverage().toFixed(1)}%</div>
                            <div class="stat-label">Overall Average</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-trophy"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${this.calculatePassRate().toFixed(0)}%</div>
                            <div class="stat-label">Pass Rate</div>
                        </div>
                    </div>
                </div>

                <div class="grade-distribution">
                    <h3>Grade Distribution</h3>
                    ${this.renderGradeDistribution()}
                </div>

                <div class="quiz-performance">
                    <h3>Quiz-wise Performance</h3>
                    ${this.renderQuizPerformance()}
                </div>
            </div>
        `;
    }

    renderGradeDistribution() {
        const distribution = { 'O': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        
        this.submissions.forEach(sub => {
            const quiz = this.quizzes.find(q => q.id === sub.quizId);
            if (!quiz) return;
            const percentage = (sub.score / quiz.totalPoints * 100);
            const grade = this.calculateGrade(percentage);
            distribution[grade]++;
        });

        const max = Math.max(...Object.values(distribution));

        return `
            <div class="distribution-chart">
                ${Object.entries(distribution).map(([grade, count]) => {
                    const percentage = max > 0 ? (count / max * 100) : 0;
                    const gradeClass = this.getGradeClass(grade);
                    
                    return `
                        <div class="distribution-bar">
                            <div class="bar-label">${grade}</div>
                            <div class="bar-container">
                                <div class="bar-fill ${gradeClass}" style="width: ${percentage}%"></div>
                            </div>
                            <div class="bar-count">${count}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderQuizPerformance() {
        return `
            <div class="performance-table">
                <table>
                    <thead>
                        <tr>
                            <th>Quiz Title</th>
                            <th>Attempts</th>
                            <th>Avg Score</th>
                            <th>Highest</th>
                            <th>Lowest</th>
                            <th>Pass Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.quizzes.map(quiz => {
                            const quizSubs = this.submissions.filter(s => s.quizId === quiz.id);
                            if (quizSubs.length === 0) return '';

                            const scores = quizSubs.map(s => (s.score / quiz.totalPoints * 100));
                            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                            const highest = Math.max(...scores);
                            const lowest = Math.min(...scores);
                            const passed = quizSubs.filter(s => (s.score / quiz.totalPoints * 100) >= quiz.passPercentage).length;
                            const passRate = (passed / quizSubs.length * 100);

                            return `
                                <tr>
                                    <td>${quiz.title}</td>
                                    <td>${quizSubs.length}</td>
                                    <td>${avgScore.toFixed(1)}%</td>
                                    <td>${highest.toFixed(1)}%</td>
                                    <td>${lowest.toFixed(1)}%</td>
                                    <td>${passRate.toFixed(0)}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    attachEventListeners() {
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const id = btn.id;
            const action = btn.dataset.action;
            const view = btn.dataset.view;

            if (view) {
                this.currentView = view;
                this.render();
            } else if (id === 'createQuizBtn' || id === 'createFirstQuizBtn') {
                this.currentView = 'create';
                this.render();
            } else if (id === 'settingsBtn') {
                this.showSettingsModal();
            } else if (id === 'closeFormBtn' || id === 'cancelQuizBtn') {
                this.currentView = 'list';
                this.render();
            } else if (id === 'exportAllResultsBtn') {
                this.exportAllResults();
            } else if (action === 'delete') {
                this.deleteQuiz(btn.closest('.quiz-card').dataset.id);
            } else if (action === 'export') {
                this.exportQuizResults(btn.closest('.quiz-card').dataset.id);
            } else if (action === 'view-results') {
                this.currentView = 'results';
                this.render();
            }
        });

        const form = this.container.querySelector('#quizForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createQuiz();
            });
        }
    }

    createQuiz() {
        const title = this.container.querySelector('#quizTitle').value;
        const description = this.container.querySelector('#quizDescription').value;
        const duration = parseInt(this.container.querySelector('#quizDuration').value);
        const passPercentage = parseInt(this.container.querySelector('#passPercentage').value);

        // For demo, create a quiz with sample questions
        const sampleQuestions = [
            {
                id: 'q1',
                text: 'What is the time complexity of binary search?',
                options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
                correctAnswer: 'O(log n)',
                points: 2
            },
            {
                id: 'q2',
                text: 'Which data structure uses LIFO?',
                options: ['Queue', 'Stack', 'Array', 'Tree'],
                correctAnswer: 'Stack',
                points: 2
            }
        ];

        const quiz = {
            id: 'quiz-' + Date.now(),
            title,
            description,
            duration,
            passPercentage,
            questions: sampleQuestions,
            totalPoints: sampleQuestions.reduce((sum, q) => sum + q.points, 0),
            createdAt: new Date().toISOString()
        };

        this.quizzes.unshift(quiz);
        this.saveData();
        this.currentView = 'list';
        this.render();
        this.showToast('Quiz created successfully!', 'success');
    }

    gradeSubmission(quizId, answers) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return null;

        let totalScore = 0;
        const results = [];

        quiz.questions.forEach((question, index) => {
            const userAnswer = answers[question.id];
            const isCorrect = userAnswer === question.correctAnswer;
            let pointsEarned = 0;

            if (isCorrect) {
                pointsEarned = question.points;
            } else if (this.gradeSettings.negativeMarking && userAnswer) {
                pointsEarned = -question.points * this.gradeSettings.negativePoints;
            }

            totalScore += pointsEarned;

            results.push({
                questionId: question.id,
                userAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect,
                pointsEarned
            });
        });

        return {
            score: Math.max(0, totalScore),
            results,
            percentage: (totalScore / quiz.totalPoints * 100)
        };
    }

    calculateGrade(percentage) {
        if (percentage >= 90) return 'O';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
    }

    getGradeClass(grade) {
        const classes = {
            'O': 'grade-o',
            'A': 'grade-a',
            'B': 'grade-b',
            'C': 'grade-c',
            'D': 'grade-d',
            'F': 'grade-f'
        };
        return classes[grade] || '';
    }

    calculateAverageScore(quizId) {
        const quizSubs = this.submissions.filter(s => s.quizId === quizId);
        if (quizSubs.length === 0) return null;

        const quiz = this.quizzes.find(q => q.id === quizId);
        const scores = quizSubs.map(s => (s.score / quiz.totalPoints * 100));
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    calculateOverallAverage() {
        if (this.submissions.length === 0) return 0;

        const percentages = this.submissions.map(sub => {
            const quiz = this.quizzes.find(q => q.id === sub.quizId);
            return quiz ? (sub.score / quiz.totalPoints * 100) : 0;
        });

        return percentages.reduce((a, b) => a + b, 0) / percentages.length;
    }

    calculatePassRate() {
        if (this.submissions.length === 0) return 0;

        const passed = this.submissions.filter(sub => {
            const quiz = this.quizzes.find(q => q.id === sub.quizId);
            if (!quiz) return false;
            const percentage = (sub.score / quiz.totalPoints * 100);
            return percentage >= quiz.passPercentage;
        }).length;

        return (passed / this.submissions.length * 100);
    }

    groupSubmissionsByQuiz() {
        const groups = {};
        this.submissions.forEach(sub => {
            if (!groups[sub.quizId]) {
                groups[sub.quizId] = [];
            }
            groups[sub.quizId].push(sub);
        });
        return groups;
    }

    deleteQuiz(quizId) {
        if (!confirm('Are you sure you want to delete this quiz and all its submissions?')) return;

        this.quizzes = this.quizzes.filter(q => q.id !== quizId);
        this.submissions = this.submissions.filter(s => s.quizId !== quizId);
        this.saveData();
        this.render();
        this.showToast('Quiz deleted!', 'success');
    }

    exportQuizResults(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        const quizSubs = this.submissions.filter(s => s.quizId === quizId);

        const csv = ['Student Name,Score,Percentage,Grade,Time Taken,Submitted'];
        quizSubs.forEach(sub => {
            const percentage = (sub.score / quiz.totalPoints * 100).toFixed(1);
            const grade = this.calculateGrade(percentage);
            const timeTaken = sub.timeTaken ? Math.round(sub.timeTaken / 60) : 'N/A';
            csv.push([
                sub.studentName,
                `${sub.score.toFixed(2)}/${quiz.totalPoints}`,
                percentage + '%',
                grade,
                timeTaken + ' min',
                new Date(sub.submittedAt).toLocaleString()
            ].join(','));
        });

        this.downloadCSV(csv.join('\n'), `${quiz.title}-results.csv`);
        this.showToast('Results exported!', 'success');
    }

    exportAllResults() {
        const csv = ['Quiz Title,Student Name,Score,Percentage,Grade,Submitted'];
        this.submissions.forEach(sub => {
            const quiz = this.quizzes.find(q => q.id === sub.quizId);
            if (!quiz) return;
            const percentage = (sub.score / quiz.totalPoints * 100).toFixed(1);
            const grade = this.calculateGrade(percentage);
            csv.push([
                quiz.title,
                sub.studentName,
                `${sub.score.toFixed(2)}/${quiz.totalPoints}`,
                percentage + '%',
                grade,
                new Date(sub.submittedAt).toLocaleString()
            ].join(','));
        });

        this.downloadCSV(csv.join('\n'), 'all-quiz-results.csv');
        this.showToast('All results exported!', 'success');
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    showSettingsModal() {
        // Implementation for settings modal
        this.showToast('Settings modal - implement as needed', 'info');
    }

    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(message);
        }
    }
}

if (typeof window !== 'undefined') {
    window.AutoGrader = AutoGrader;
}
