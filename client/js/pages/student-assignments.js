(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof NavLoader !== 'undefined') {
            await NavLoader.load('student', 'assignments');
        }

        loadDeadlines();
        loadAssignments();
    });

    async function loadDeadlines() {
        const listEl = document.getElementById('deadlinesList');
        if (!listEl) return;

        try {
            const response = await APP.API.get('/agenda?limit=6');
            const items = Array.isArray(response?.items) ? response.items.slice(0, 6) : [];

            if (!items.length) {
                listEl.innerHTML = '<div class="empty-deadlines">NOTHING DUE - YOU ARE CLEAR</div>';
                return;
            }

            listEl.innerHTML = items.map((item) => renderDeadlineItem(item)).join('');
        } catch (error) {
            console.error('Failed to load deadlines:', error);
            showDeadlinesError('Deadlines could not be loaded right now.');
        }
    }

    function renderDeadlineItem(item) {
        const due = new Date(item.dueAt);
        const valid = item.dueAt && !Number.isNaN(due.getTime());
        const month = valid ? MONTHS[due.getMonth()] : '--';
        const day = valid ? String(due.getDate()).padStart(2, '0') : '--';
        const urgent = valid && (due.getTime() - Date.now()) <= URGENT_WINDOW_MS;
        const typeLabel = item.type === 'event' ? 'EVENT' : 'ASSIGNMENT';
        const dueLabel = valid
            ? due.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '';

        return `
            <div class="deadline-item${urgent ? ' is-urgent' : ''}">
                <div class="deadline-date">
                    <span class="deadline-month">${escapeHtml(month)}</span>
                    <span class="deadline-day">${escapeHtml(day)}</span>
                </div>
                <div class="deadline-body">
                    <p class="deadline-title">${escapeHtml(item.title || 'Untitled')}</p>
                    <span class="deadline-type">${typeLabel}</span>
                </div>
                ${dueLabel ? `<span class="deadline-due">${escapeHtml(dueLabel)}</span>` : ''}
            </div>
        `;
    }

    function showDeadlinesError(message) {
        const listEl = document.getElementById('deadlinesList');
        if (!listEl) return;

        listEl.innerHTML = `
            <div class="state-row">
                <p class="state-text">${escapeHtml(message)}</p>
                <button type="button" id="deadlinesRetry" class="reconnect-cta">RETRY</button>
            </div>
        `;

        const retry = document.getElementById('deadlinesRetry');
        if (retry) {
            retry.addEventListener('click', () => {
                listEl.innerHTML = '<div class="loading-text">Loading deadlines...</div>';
                loadDeadlines();
            });
        }
    }

    async function loadAssignments() {
        const listEl = document.getElementById('assignmentsList');
        if (!listEl) return;

        try {
            const response = await APP.API.get('/assignments/student');
            const assignments = Array.isArray(response?.data) ? response.data : [];

            setBadge(assignments.length ? `${assignments.length} SHARED` : 'NONE YET');

            if (!assignments.length) {
                listEl.innerHTML = '<div class="empty-assignments">NOTHING SHARED FOR YOUR CLASS YET</div>';
                return;
            }

            listEl.innerHTML = assignments.map((assignment) => renderAssignmentCard(assignment)).join('');
        } catch (error) {
            console.error('Failed to load assignments:', error);
            showAssignmentsError('Assignments could not be loaded right now.');
        }
    }

    function renderAssignmentCard(assignment) {
        const status = resolveStatus(assignment.submission_status);
        const deadline = formatDeadline(assignment.deadline);

        return `
            <article class="assignment-card">
                <div class="assignment-card-top">
                    <h4 class="assignment-title">${escapeHtml(assignment.title || 'Untitled assignment')}</h4>
                    <span class="status-pill ${status.className}">${status.label}</span>
                </div>
                <div class="assignment-meta">
                    <span>${escapeHtml(assignment.subject || 'GENERAL')}</span>
                    ${deadline ? `<span>DUE ${escapeHtml(deadline)}</span>` : ''}
                </div>
                ${assignment.description ? `<p class="assignment-desc">${escapeHtml(String(assignment.description))}</p>` : ''}
            </article>
        `;
    }

    function resolveStatus(submissionStatus) {
        if (submissionStatus === 'graded') {
            return { label: 'GRADED', className: 'graded' };
        }
        if (submissionStatus === 'submitted') {
            return { label: 'SUBMITTED', className: 'submitted' };
        }
        return { label: 'PENDING', className: '' };
    }

    function formatDeadline(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function showAssignmentsError(message) {
        const listEl = document.getElementById('assignmentsList');
        if (!listEl) return;

        setBadge('ERROR');

        listEl.innerHTML = `
            <div class="state-row">
                <p class="state-text">${escapeHtml(message)}</p>
                <button type="button" id="assignmentsRetry" class="reconnect-cta">RETRY</button>
            </div>
        `;

        const retry = document.getElementById('assignmentsRetry');
        if (retry) {
            retry.addEventListener('click', () => {
                listEl.innerHTML = '<div class="loading-text">Loading assignments...</div>';
                loadAssignments();
            });
        }
    }

    function setBadge(text) {
        const badge = document.getElementById('assignmentCountBadge');
        if (badge) {
            badge.textContent = text;
        }
    }

    function escapeHtml(value) {
        return APP.sanitize ? APP.sanitize(String(value || '')) : String(value || '');
    }
})();
