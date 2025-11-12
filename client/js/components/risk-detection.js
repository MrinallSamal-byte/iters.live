/**
 * At-Risk Student Detection System
 * Identifies students needing intervention
 */

class RiskDetection {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.students = [];
        this.riskThresholds = {
            attendance: 75,
            grade: 60,
            inactivityDays: 14
        };
        
        this.loadData();
        this.analyzeRisks();
        this.render();
        this.attachEventListeners();
    }

    loadData() {
        const saved = localStorage.getItem('studentData');
        if (saved) {
            this.students = JSON.parse(saved);
        } else {
            this.students = this.getSampleData();
            localStorage.setItem('studentData', JSON.stringify(this.students));
        }
    }

    getSampleData() {
        return [
            {
                id: 's1',
                name: 'John Doe',
                email: 'john@example.com',
                attendance: 68,
                avgGrade: 55,
                lastSubmission: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                riskLevel: 'high',
                riskFactors: ['low_attendance', 'failing_grade', 'no_submissions'],
                interventions: []
            },
            {
                id: 's2',
                name: 'Jane Smith',
                email: 'jane@example.com',
                attendance: 85,
                avgGrade: 78,
                lastSubmission: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                riskLevel: 'low',
                riskFactors: [],
                interventions: []
            }
        ];
    }

    analyzeRisks() {
        this.students.forEach(student => {
            const factors = [];
            let riskScore = 0;

            if (student.attendance < this.riskThresholds.attendance) {
                factors.push('low_attendance');
                riskScore += 30;
            }

            if (student.avgGrade < this.riskThresholds.grade) {
                factors.push('failing_grade');
                riskScore += 40;
            }

            const daysSinceSubmission = (Date.now() - new Date(student.lastSubmission)) / (1000 * 60 * 60 * 24);
            if (daysSinceSubmission > this.riskThresholds.inactivityDays) {
                factors.push('no_submissions');
                riskScore += 30;
            }

            student.riskFactors = factors;
            student.riskScore = riskScore;
            
            if (riskScore >= 60) student.riskLevel = 'high';
            else if (riskScore >= 30) student.riskLevel = 'medium';
            else student.riskLevel = 'low';
        });

        localStorage.setItem('studentData', JSON.stringify(this.students));
    }

    render() {
        if (!this.container) return;

        const highRisk = this.students.filter(s => s.riskLevel === 'high').length;
        const mediumRisk = this.students.filter(s => s.riskLevel === 'medium').length;
        const lowRisk = this.students.filter(s => s.riskLevel === 'low').length;

        this.container.innerHTML = `
            <div class="risk-detection">
                <div class="rd-header">
                    <h2><i class="fas fa-exclamation-triangle"></i> At-Risk Student Detection</h2>
                    <button class="btn btn-primary" id="refreshAnalysisBtn">
                        <i class="fas fa-sync"></i> Refresh Analysis
                    </button>
                </div>

                <div class="rd-stats">
                    <div class="stat-card risk-high">
                        <div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${highRisk}</div>
                            <div class="stat-label">High Risk</div>
                        </div>
                    </div>

                    <div class="stat-card risk-medium">
                        <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${mediumRisk}</div>
                            <div class="stat-label">Medium Risk</div>
                        </div>
                    </div>

                    <div class="stat-card risk-low">
                        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${lowRisk}</div>
                            <div class="stat-label">Low Risk</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${this.students.length}</div>
                            <div class="stat-label">Total Students</div>
                        </div>
                    </div>
                </div>

                <div class="rd-filters">
                    <select id="riskFilter">
                        <option value="all">All Risk Levels</option>
                        <option value="high">High Risk Only</option>
                        <option value="medium">Medium Risk Only</option>
                        <option value="low">Low Risk Only</option>
                    </select>

                    <button class="btn btn-secondary" id="exportRiskReportBtn">
                        <i class="fas fa-file-export"></i> Export Report
                    </button>
                </div>

                <div class="student-list">
                    ${this.renderStudentList()}
                </div>
            </div>
        `;
    }

    renderStudentList() {
        const filter = this.container?.querySelector('#riskFilter')?.value || 'all';
        let filtered = this.students;

        if (filter !== 'all') {
            filtered = this.students.filter(s => s.riskLevel === filter);
        }

        if (filtered.length === 0) {
            return '<div class="rd-empty"><p>No students found</p></div>';
        }

        return filtered.map(student => `
            <div class="student-card risk-${student.riskLevel}" data-id="${student.id}">
                <div class="sc-header">
                    <div class="sc-info">
                        <h3>${student.name}</h3>
                        <span class="risk-badge risk-${student.riskLevel}">${student.riskLevel.toUpperCase()} RISK</span>
                    </div>
                    <div class="sc-actions">
                        <button class="btn btn-sm btn-secondary" data-action="view-details">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <button class="btn btn-sm btn-primary" data-action="add-intervention">
                            <i class="fas fa-plus"></i> Add Intervention
                        </button>
                        <button class="btn btn-sm btn-secondary" data-action="send-email">
                            <i class="fas fa-envelope"></i> Email
                        </button>
                    </div>
                </div>

                <div class="sc-metrics">
                    <div class="metric">
                        <i class="fas fa-calendar-check"></i>
                        <span>Attendance: <strong>${student.attendance}%</strong></span>
                    </div>
                    <div class="metric">
                        <i class="fas fa-chart-line"></i>
                        <span>Avg Grade: <strong>${student.avgGrade}%</strong></span>
                    </div>
                    <div class="metric">
                        <i class="fas fa-clock"></i>
                        <span>Last Active: <strong>${this.getTimeAgo(student.lastSubmission)}</strong></span>
                    </div>
                </div>

                ${student.riskFactors.length > 0 ? `
                    <div class="sc-risk-factors">
                        <strong>Risk Factors:</strong>
                        <div class="risk-tags">
                            ${student.riskFactors.map(factor => `
                                <span class="risk-tag">${this.formatFactor(factor)}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${student.interventions.length > 0 ? `
                    <div class="sc-interventions">
                        <strong>Interventions (${student.interventions.length}):</strong>
                        <ul>
                            ${student.interventions.slice(0, 2).map(i => `
                                <li>${i.type}: ${i.note} <small>(${new Date(i.date).toLocaleDateString()})</small></li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    attachEventListeners() {
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.dataset.action;
            const studentCard = btn.closest('.student-card');
            const studentId = studentCard?.dataset.id;

            if (btn.id === 'refreshAnalysisBtn') {
                this.analyzeRisks();
                this.render();
                this.showToast('Analysis refreshed!', 'success');
            } else if (btn.id === 'exportRiskReportBtn') {
                this.exportReport();
            } else if (action === 'add-intervention') {
                this.addIntervention(studentId);
            } else if (action === 'send-email') {
                this.sendEmail(studentId);
            }
        });

        const riskFilter = this.container.querySelector('#riskFilter');
        if (riskFilter) {
            riskFilter.addEventListener('change', () => {
                const listContainer = this.container.querySelector('.student-list');
                listContainer.innerHTML = this.renderStudentList();
            });
        }
    }

    addIntervention(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        const note = prompt('Intervention notes:');
        if (!note) return;

        const type = prompt('Intervention type (e.g., Email, Meeting, Call):') || 'Other';

        student.interventions.push({
            type,
            note,
            date: new Date().toISOString()
        });

        localStorage.setItem('studentData', JSON.stringify(this.students));
        this.render();
        this.showToast('Intervention recorded!', 'success');
    }

    sendEmail(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        const subject = `Important: Academic Support Available`;
        const body = `Dear ${student.name},\n\nWe've noticed you may need some additional support. Please reach out to discuss how we can help you succeed.`;

        window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        this.addIntervention(studentId);
    }

    exportReport() {
        const csv = ['Name,Email,Risk Level,Attendance,Avg Grade,Last Active,Risk Factors'];
        
        this.students.forEach(s => {
            csv.push([
                s.name,
                s.email,
                s.riskLevel,
                s.attendance + '%',
                s.avgGrade + '%',
                new Date(s.lastSubmission).toLocaleDateString(),
                s.riskFactors.map(f => this.formatFactor(f)).join('; ')
            ].join(','));
        });

        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `at-risk-students-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Report exported!', 'success');
    }

    getTimeAgo(dateString) {
        const days = Math.floor((Date.now() - new Date(dateString)) / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    }

    formatFactor(factor) {
        const labels = {
            'low_attendance': 'Low Attendance',
            'failing_grade': 'Failing Grade',
            'no_submissions': 'Inactive'
        };
        return labels[factor] || factor;
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
    window.RiskDetection = RiskDetection;
}
