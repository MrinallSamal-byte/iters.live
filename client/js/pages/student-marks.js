(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const user = APP.Storage.get('user') || {};
    let performanceChart = null;
    let gradeChart = null;
    let lastProjectionTarget = null;
    let projectionDefaulted = false;

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof NavLoader !== 'undefined') {
            await NavLoader.load('student', 'marks');
        }

        if (typeof ParticleSystem !== 'undefined' && document.getElementById('particleCanvas')) {
            new ParticleSystem('particleCanvas', {
                particleCount: 50,
                particleColor: 'rgba(99, 102, 241, 0.5)',
                speed: 0.3
            });
        }

        initCgpaPlanner();
        await loadMarksData();
    });

    function initCgpaPlanner() {
        const form = document.getElementById('projectionForm');
        const input = document.getElementById('targetCgpaInput');

        if (!form || !input || form.dataset.projectionBound === 'true') return;
        form.dataset.projectionBound = 'true';

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            runCgpaProjection(input.value);
        });
    }

    function setCgpaPlannerDefault(cgpa) {
        if (projectionDefaulted) return;
        const input = document.getElementById('targetCgpaInput');
        if (!input || !Number.isFinite(cgpa) || cgpa <= 0) return;
        input.value = (Math.ceil(cgpa * 2) / 2).toFixed(1);
        projectionDefaulted = true;
    }

    async function runCgpaProjection(rawValue) {
        const resultEl = document.getElementById('projectionResult');
        const button = document.getElementById('projectButton');
        if (!resultEl || !button) return;

        const target = Number(rawValue);
        if (!Number.isFinite(target) || target < 0 || target > 10) {
            showProjectionMessage('Enter a target CGPA between 0 and 10.');
            return;
        }

        lastProjectionTarget = target;
        button.disabled = true;
        resultEl.classList.add('is-visible');
        resultEl.innerHTML = '<span class="projection-muted">PROJECTING...</span>';

        try {
            const response = await APP.API.get(`/marks/projection?target=${encodeURIComponent(String(target))}`);
            if (response && response.success) {
                renderCgpaProjection(response);
            } else {
                showProjectionMessage((response && response.message) || 'Credit information unavailable for projection');
            }
        } catch (error) {
            console.error('CGPA projection failed:', error);
            showProjectionError(error && error.message ? error.message : 'Projection could not be loaded.');
        } finally {
            button.disabled = false;
        }
    }

    function renderCgpaProjection(data) {
        const resultEl = document.getElementById('projectionResult');
        if (!resultEl) return;

        const current = Number(data.currentCgpa).toFixed(2);
        const target = Number(data.targetCgpa).toFixed(1);
        const needed = Number(data.requiredAverageSgpa).toFixed(2);
        const feasible = Boolean(data.feasible);

        resultEl.innerHTML = `
            <span class="projection-line">CURRENT ${escapeHtml(current)} / TARGET ${escapeHtml(target)} / NEED AVG SGPA ${escapeHtml(needed)} NEXT SEM</span>
            <span class="${feasible ? 'proj-tag feasible' : 'proj-tag not-feasible'}">${feasible ? 'FEASIBLE' : 'NOT FEASIBLE'}</span>
        `;
    }

    function showProjectionMessage(message) {
        const resultEl = document.getElementById('projectionResult');
        if (!resultEl) return;
        resultEl.classList.add('is-visible');
        resultEl.innerHTML = `<span class="projection-muted">${escapeHtml(message)}</span>`;
    }

    function showProjectionError(message) {
        const resultEl = document.getElementById('projectionResult');
        if (!resultEl) return;
        resultEl.classList.add('is-visible');
        resultEl.innerHTML = `
            <span class="projection-muted">${escapeHtml(message)}</span>
            <button type="button" id="projectionRetry" class="projection-retry">RETRY</button>
        `;

        const retry = document.getElementById('projectionRetry');
        if (retry) {
            retry.addEventListener('click', () => runCgpaProjection(lastProjectionTarget));
        }
    }

    async function loadMarksData() {
        const studentId = user.id || user.registration_number;

        if (!studentId) {
            showEmptyMarks('Student account details are incomplete. Log in again and retry.');
            return;
        }

        try {
            const response = await APP.API.get(`/marks/student/${encodeURIComponent(studentId)}`);
            const summary = Array.isArray(response?.data?.summary) ? response.data.summary : [];
            const semesterResults = Array.isArray(response?.data?.semesterResults) ? response.data.semesterResults : [];

            if (response?.success && (summary.length || semesterResults.length)) {
                displayMarks(response.data);
                return;
            }

            showEmptyMarks('No imported marks or semester results are saved for this account yet.');
        } catch (error) {
            console.error('Failed to load marks:', error);
            showEmptyMarks('Marks could not be loaded. Reconnect your SOA portal and try again.');
            if (typeof Toast !== 'undefined') {
                Toast.error(error.message || 'Failed to load marks data', 'Error');
            }
        }
    }

    function showEmptyMarks(message) {
        setText('currentCGPA', '--');
        setText('currentSGPA', '--');
        setText('totalSubjects', '--');
        setText('classRank', '--');
        setText('topSubject', 'No marks snapshot');
        setText('averageScore', message);
        setText('weakSubject', 'Reconnect SOA to import marks again.');

        const tbody = document.getElementById('marksTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${escapeHtml(message)}</td></tr>`;
        }

        const historyEl = document.getElementById('semesterHistory');
        if (historyEl) {
            historyEl.innerHTML = `<div class="semester-card"><p style="margin:0;">${escapeHtml(message)}</p></div>`;
        }

        destroyCharts();
    }

    function displayMarks(data) {
        const summary = Array.isArray(data?.summary) ? data.summary : [];
        const semesterResults = Array.isArray(data?.semesterResults) ? data.semesterResults : [];
        const cgpa = data?.cgpa != null ? Number(data.cgpa) : null;

        if (!summary.length && !semesterResults.length) {
            showEmptyMarks('No imported marks or semester results are saved for this account yet.');
            return;
        }

        const subjectStats = buildSubjectStats(summary);
        const resolvedCgpa = cgpa != null ? cgpa : (subjectStats.averagePercentage / 10);
        const latestSemester = semesterResults.length ? semesterResults[semesterResults.length - 1] : null;
        const resolvedSgpa = latestSemester?.sgpa != null ? Number(latestSemester.sgpa) : (subjectStats.averagePercentage / 10);

        setText('currentCGPA', resolvedCgpa ? resolvedCgpa.toFixed(2) : '--');
        setText('currentSGPA', resolvedSgpa ? resolvedSgpa.toFixed(2) : '--');
        setText('totalSubjects', summary.length ? String(summary.length) : String(semesterResults.length));
        setText('classRank', '--');
        setText(
            'topSubject',
            subjectStats.topSubject
                ? `${subjectStats.topSubject} with ${subjectStats.topPercentage.toFixed(1)}%`
                : 'No subject summary available'
        );
        setText(
            'averageScore',
            summary.length
                ? `${subjectStats.averagePercentage.toFixed(1)}% across imported subject summaries`
                : 'Semester result rows were imported without subject-level marks.'
        );
        setText(
            'weakSubject',
            subjectStats.weakSubject
                ? `${subjectStats.weakSubject} needs the most attention`
                : 'No weak subject could be derived from the imported data.'
        );

        renderMarksTable(summary);
        renderSemesterHistory(semesterResults, resolvedCgpa, resolvedSgpa);
        renderPerformanceChart(semesterResults, resolvedSgpa);
        renderGradeChart(summary);
        setCgpaPlannerDefault(resolvedCgpa);
    }

    function buildSubjectStats(summary) {
        if (!summary.length) {
            return {
                averagePercentage: 0,
                topSubject: null,
                topPercentage: 0,
                weakSubject: null
            };
        }

        let totalPercentage = 0;
        let topSubject = null;
        let topPercentage = -1;
        let weakSubject = null;
        let weakPercentage = 101;

        summary.forEach((subject) => {
            const marks = Number(subject.avg_marks || 0);
            const total = Number(subject.avg_total || 0);
            const percentage = total > 0 ? (marks / total) * 100 : 0;
            totalPercentage += percentage;

            if (percentage > topPercentage) {
                topPercentage = percentage;
                topSubject = subject.subject || subject.subject_code || 'Unknown';
            }

            if (percentage < weakPercentage) {
                weakPercentage = percentage;
                weakSubject = subject.subject || subject.subject_code || 'Unknown';
            }
        });

        return {
            averagePercentage: totalPercentage / summary.length,
            topSubject,
            topPercentage: topPercentage < 0 ? 0 : topPercentage,
            weakSubject
        };
    }

    function renderMarksTable(summary) {
        const tbody = document.getElementById('marksTableBody');
        if (!tbody) return;

        if (!summary.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No imported subject summary is available.</td></tr>';
            return;
        }

        tbody.innerHTML = summary.map((subject) => {
            const marks = Number(subject.avg_marks || 0);
            const total = Number(subject.avg_total || 0);
            const percentage = total > 0 ? (marks / total) * 100 : 0;
            const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B+' : percentage >= 60 ? 'B' : 'C';
            const internal = Math.round(marks * 0.3);
            const external = Math.round(marks * 0.7);
            const credits = subject.credits || '--';

            return `
                <tr>
                    <td><strong>${escapeHtml(subject.subject_code || 'N/A')}</strong></td>
                    <td>${escapeHtml(subject.subject || 'Unknown')}</td>
                    <td>${internal}</td>
                    <td>${external}</td>
                    <td><strong>${marks.toFixed(1)}</strong></td>
                    <td><span class="badge badge-${grade.replace('+', '')}">${grade}</span></td>
                    <td>${escapeHtml(String(credits))}</td>
                </tr>
            `;
        }).join('');
    }

    function renderSemesterHistory(semesterResults, fallbackCgpa, fallbackSgpa) {
        const historyEl = document.getElementById('semesterHistory');
        if (!historyEl) return;

        const rows = semesterResults.length
            ? semesterResults
            : [{
                semester: 'Latest',
                sgpa: fallbackSgpa,
                cgpa: fallbackCgpa,
                courseCredits: null
            }];

        historyEl.innerHTML = rows.map((item) => `
            <div class="semester-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 style="margin:0; color: var(--primary);">Semester ${escapeHtml(item.semester || 'Latest')}</h4>
                    <span style="color: var(--text-secondary); font-size:0.85rem;">
                        ${item.courseCredits != null ? `${escapeHtml(String(item.courseCredits))} credits` : 'Imported snapshot'}
                    </span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <p style="margin:0; color: var(--text-secondary); font-size:0.85rem;">SGPA</p>
                        <p style="margin:0.25rem 0 0 0; font-size:1.5rem; font-weight:700; color: var(--text-primary);">
                            ${item.sgpa != null ? escapeHtml(Number(item.sgpa).toFixed(2)) : '--'}
                        </p>
                    </div>
                    <div>
                        <p style="margin:0; color: var(--text-secondary); font-size:0.85rem;">CGPA</p>
                        <p style="margin:0.25rem 0 0 0; font-size:1.5rem; font-weight:700; color: var(--text-primary);">
                            ${item.cgpa != null ? escapeHtml(Number(item.cgpa).toFixed(2)) : '--'}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderPerformanceChart(semesterResults, fallbackSgpa) {
        const canvas = document.getElementById('performanceChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const points = semesterResults.length
            ? semesterResults.map((item) => ({
                label: `Sem ${item.semester || '?'}`,
                value: Number(item.sgpa || 0)
            }))
            : [{
                label: 'Latest',
                value: Number(fallbackSgpa || 0)
            }];

        if (performanceChart) {
            performanceChart.destroy();
        }

        performanceChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: points.map((item) => item.label),
                datasets: [{
                    label: 'SGPA',
                    data: points.map((item) => item.value),
                    borderColor: '#d71921',
                    backgroundColor: 'rgba(215, 25, 33, 0.16)',
                    tension: 0.35,
                    fill: true,
                    borderWidth: 3,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: Math.max(Math.min(...points.map((item) => item.value).filter(Boolean), 7) - 1, 0),
                        max: 10
                    }
                }
            }
        });
    }

    function renderGradeChart(summary) {
        const canvas = document.getElementById('gradeDistChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (gradeChart) {
            gradeChart.destroy();
        }

        if (!summary.length) {
            return;
        }

        const grades = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0 };
        summary.forEach((subject) => {
            const marks = Number(subject.avg_marks || 0);
            const total = Number(subject.avg_total || 0);
            const percentage = total > 0 ? (marks / total) * 100 : 0;
            if (percentage >= 90) grades['A+'] += 1;
            else if (percentage >= 80) grades['A'] += 1;
            else if (percentage >= 70) grades['B+'] += 1;
            else if (percentage >= 60) grades['B'] += 1;
            else grades['C'] += 1;
        });

        gradeChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(grades),
                datasets: [{
                    data: Object.values(grades),
                    backgroundColor: ['#d71921', '#ffffff', '#8a8a8a', '#4a4a4a', '#7b7b7b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: chartTextColor(),
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }

    function isLightTheme() {
        return document.body.classList.contains('light-theme');
    }

    function chartTextColor() {
        return isLightTheme() ? '#1d1d20' : '#f6f3ee';
    }

    function destroyCharts() {
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        if (gradeChart) {
            gradeChart.destroy();
            gradeChart = null;
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function escapeHtml(value) {
        return APP.sanitize ? APP.sanitize(String(value || '')) : String(value || '');
    }
})();
