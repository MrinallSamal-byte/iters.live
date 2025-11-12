/**
 * Rubric Creator Component
 * Grid-based assessment rubric builder
 */

class RubricCreator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.rubrics = [];
        this.currentRubric = null;
        this.currentView = 'list';
        
        this.loadRubrics();
        this.render();
        this.attachEventListeners();
    }

    loadRubrics() {
        const saved = localStorage.getItem('rubrics');
        if (saved) {
            this.rubrics = JSON.parse(saved);
        }
    }

    saveRubrics() {
        localStorage.setItem('rubrics', JSON.stringify(this.rubrics));
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="rubric-creator">
                <div class="rc-header">
                    <h2><i class="fas fa-table"></i> Rubric Creator</h2>
                    <button class="btn btn-primary" id="createRubricBtn">
                        <i class="fas fa-plus"></i> Create Rubric
                    </button>
                </div>

                <div class="rc-content">
                    ${this.currentView === 'list' ? this.renderList() : ''}
                    ${this.currentView === 'create' ? this.renderCreateForm() : ''}
                    ${this.currentView === 'preview' ? this.renderPreview() : ''}
                </div>
            </div>
        `;
    }

    renderList() {
        if (this.rubrics.length === 0) {
            return `
                <div class="rc-empty">
                    <i class="fas fa-table"></i>
                    <p>No rubrics created yet</p>
                    <button class="btn btn-primary" id="createFirstRubricBtn">Create Your First Rubric</button>
                </div>
            `;
        }

        return `
            <div class="rubric-list">
                ${this.rubrics.map(rubric => this.renderRubricCard(rubric)).join('')}
            </div>
        `;
    }

    renderRubricCard(rubric) {
        return `
            <div class="rubric-card" data-id="${rubric.id}">
                <div class="rc-card-header">
                    <h3>${rubric.name}</h3>
                    <div class="rc-card-actions">
                        <button class="btn-icon" data-action="preview"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" data-action="edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" data-action="duplicate"><i class="fas fa-copy"></i></button>
                        <button class="btn-icon btn-danger" data-action="delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="rc-card-info">
                    <span><i class="fas fa-list"></i> ${rubric.criteria.length} criteria</span>
                    <span><i class="fas fa-star"></i> ${rubric.totalPoints} points</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(rubric.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }

    renderCreateForm() {
        return `
            <div class="rc-form">
                <div class="rc-form-header">
                    <h3>${this.currentRubric ? 'Edit' : 'Create'} Rubric</h3>
                    <button class="btn-icon" id="closeFormBtn"><i class="fas fa-times"></i></button>
                </div>

                <form id="rubricForm">
                    <div class="form-group">
                        <label>Rubric Name *</label>
                        <input type="text" id="rubricName" placeholder="e.g., Essay Evaluation Rubric" required>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="rubricDescription" rows="2" placeholder="Brief description..."></textarea>
                    </div>

                    <div class="rubric-grid-section">
                        <h4>Criteria & Performance Levels</h4>
                        <div id="criteriaContainer"></div>
                        <button type="button" class="btn btn-secondary" id="addCriterionBtn">
                            <i class="fas fa-plus"></i> Add Criterion
                        </button>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save Rubric
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    renderPreview() {
        if (!this.currentRubric) return '';

        return `
            <div class="rc-preview">
                <div class="rc-preview-header">
                    <h3>${this.currentRubric.name}</h3>
                    <button class="btn-icon" id="closePreviewBtn"><i class="fas fa-times"></i></button>
                </div>

                ${this.currentRubric.description ? `<p class="rubric-description">${this.currentRubric.description}</p>` : ''}

                <div class="rubric-table-container">
                    <table class="rubric-table">
                        <thead>
                            <tr>
                                <th>Criteria</th>
                                ${['Excellent', 'Good', 'Fair', 'Poor'].map(level => `<th>${level}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.currentRubric.criteria.map(criterion => `
                                <tr>
                                    <td class="criterion-name"><strong>${criterion.name}</strong></td>
                                    ${criterion.levels.map(level => `
                                        <td class="level-cell">
                                            <div class="level-points">${level.points} pts</div>
                                            <div class="level-description">${level.description}</div>
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="rubric-total">
                    <strong>Total Points: ${this.currentRubric.totalPoints}</strong>
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

            if (id === 'createRubricBtn' || id === 'createFirstRubricBtn') {
                this.currentView = 'create';
                this.render();
                this.setupFormHandlers();
            } else if (id === 'closeFormBtn' || id === 'cancelBtn' || id === 'closePreviewBtn') {
                this.currentView = 'list';
                this.currentRubric = null;
                this.render();
            } else if (action === 'preview') {
                const rubricId = btn.closest('.rubric-card').dataset.id;
                this.previewRubric(rubricId);
            } else if (action === 'delete') {
                const rubricId = btn.closest('.rubric-card').dataset.id;
                this.deleteRubric(rubricId);
            }
        });
    }

    setupFormHandlers() {
        const form = this.container.querySelector('#rubricForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRubric();
            });
        }

        const addBtn = this.container.querySelector('#addCriterionBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addCriterion());
        }

        // Add default criterion
        this.addCriterion();
    }

    addCriterion() {
        const container = this.container.querySelector('#criteriaContainer');
        const index = container.children.length;

        const criterionHtml = `
            <div class="criterion-item" data-index="${index}">
                <div class="criterion-header">
                    <input type="text" placeholder="Criterion name (e.g., Content Quality)" class="criterion-name-input" required>
                    <button type="button" class="btn-icon btn-danger remove-criterion">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="criterion-levels">
                    ${[4, 3, 2, 1].map(points => `
                        <div class="level-input">
                            <label>${points === 4 ? 'Excellent' : points === 3 ? 'Good' : points === 2 ? 'Fair' : 'Poor'} (${points} pts)</label>
                            <textarea rows="2" placeholder="Description..." class="level-desc" data-points="${points}"></textarea>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', criterionHtml);

        // Add remove handler
        const removeBtn = container.lastElementChild.querySelector('.remove-criterion');
        removeBtn.addEventListener('click', () => {
            removeBtn.closest('.criterion-item').remove();
        });
    }

    saveRubric() {
        const name = this.container.querySelector('#rubricName').value;
        const description = this.container.querySelector('#rubricDescription').value;

        const criteria = [];
        const criterionItems = this.container.querySelectorAll('.criterion-item');

        criterionItems.forEach(item => {
            const criterionName = item.querySelector('.criterion-name-input').value;
            const levels = [];

            item.querySelectorAll('.level-desc').forEach(textarea => {
                levels.push({
                    points: parseInt(textarea.dataset.points),
                    description: textarea.value
                });
            });

            criteria.push({ name: criterionName, levels });
        });

        const totalPoints = criteria.length * 4; // Max points

        const rubric = {
            id: this.currentRubric?.id || 'rubric-' + Date.now(),
            name,
            description,
            criteria,
            totalPoints,
            createdAt: this.currentRubric?.createdAt || new Date().toISOString()
        };

        if (this.currentRubric) {
            const index = this.rubrics.findIndex(r => r.id === rubric.id);
            this.rubrics[index] = rubric;
        } else {
            this.rubrics.unshift(rubric);
        }

        this.saveRubrics();
        this.currentView = 'list';
        this.currentRubric = null;
        this.render();
        this.showToast('Rubric saved successfully!', 'success');
    }

    previewRubric(id) {
        this.currentRubric = this.rubrics.find(r => r.id === id);
        this.currentView = 'preview';
        this.render();
    }

    deleteRubric(id) {
        if (!confirm('Delete this rubric?')) return;
        this.rubrics = this.rubrics.filter(r => r.id !== id);
        this.saveRubrics();
        this.render();
        this.showToast('Rubric deleted!', 'success');
    }

    showToast(message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(message);
        }
    }
}

if (typeof window !== 'undefined') {
    window.RubricCreator = RubricCreator;
}
