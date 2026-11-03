// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('student')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires student role');
  }
})();

(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;

    let currentAssignments = [];
    let activeAssignment = null;

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
            currentAssignments = assignments;

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
        const status = resolveStatus(assignment);
        const deadline = formatDeadline(assignment.deadline);

        let actionBtn = '';
        if (assignment.submission_status === 'graded') {
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="openSubmissionModal('${escapeHtml(assignment.id)}')">View Grade</button>`;
        } else if (assignment.submission_status === 'submitted') {
            actionBtn = `<button class="btn btn-sm btn-outline" onclick="openSubmissionModal('${escapeHtml(assignment.id)}')">View / Edit Work</button>`;
        } else if (assignment.is_overdue && !assignment.allow_late) {
            actionBtn = `<button class="btn btn-sm btn-secondary" disabled>Submissions Closed</button>`;
        } else {
            actionBtn = `<button class="btn btn-sm btn-primary" onclick="openSubmissionModal('${escapeHtml(assignment.id)}')">Submit Work</button>`;
        }

        return `
            <article class="assignment-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div class="assignment-card-top">
                        <h4 class="assignment-title">${escapeHtml(assignment.title || 'Untitled assignment')}</h4>
                        <span class="status-pill ${status.className}">${status.label}</span>
                    </div>
                    <div class="assignment-meta" style="margin-top:0.5rem;">
                        <span>${escapeHtml(assignment.subject || 'GENERAL')}</span>
                        ${deadline ? `<span>DUE ${escapeHtml(deadline)}</span>` : ''}
                        <span>${escapeHtml(String(assignment.total_marks || 0))} MARKS</span>
                    </div>
                    ${assignment.description ? `<p class="assignment-desc" style="margin-top:0.75rem;">${escapeHtml(String(assignment.description))}</p>` : ''}
                </div>
                <div style="margin-top:1rem; display:flex; justify-content:flex-end;">
                    ${actionBtn}
                </div>
            </article>
        `;
    }

    function resolveStatus(assignment) {
        if (assignment.submission_status === 'graded') {
            return { label: 'GRADED', className: 'graded' };
        }
        if (assignment.submission_status === 'submitted') {
            return {
                label: assignment.submission_is_late ? 'SUBMITTED (LATE)' : 'SUBMITTED',
                className: 'submitted'
            };
        }
        if (assignment.is_overdue) {
            return {
                label: assignment.allow_late ? 'OVERDUE (LATE ACCEPTED)' : 'DEADLINE PASSED',
                className: assignment.allow_late ? 'pending' : 'error'
            };
        }
        return { label: 'PENDING', className: '' };
    }

    window.openSubmissionModal = async function openSubmissionModal(assignmentId) {
        const assignment = currentAssignments.find(a => String(a.id) === String(assignmentId));
        if (!assignment) return;
        activeAssignment = assignment;

        document.getElementById('subModalTitle').textContent = assignment.title || 'Assignment Details';
        document.getElementById('subAssignmentMeta').textContent = `${assignment.subject || 'General'} · Due ${formatDeadline(assignment.deadline)} · Total Marks: ${assignment.total_marks ?? '—'}`;
        document.getElementById('subAssignmentDesc').textContent = assignment.description || 'No detailed instructions provided.';

        const gradedSec = document.getElementById('subGradedSection');
        const prevSec = document.getElementById('subPreviousSection');
        const closedNotice = document.getElementById('subClosedNotice');
        const form = document.getElementById('assignmentSubmitForm');
        const textarea = document.getElementById('submissionText');

        gradedSec.style.display = 'none';
        prevSec.style.display = 'none';
        closedNotice.style.display = 'none';
        form.style.display = '';
        textarea.value = '';

        if (assignment.submission_status) {
            try {
                const resp = await APP.API.get(`/assignments/${assignment.id}/my-submission`);
                const sub = resp?.data;
                if (sub) {
                    if (sub.status === 'graded') {
                        gradedSec.style.display = 'block';
                        document.getElementById('subGradedMarks').textContent = `Score: ${sub.marks_obtained ?? '—'} / ${assignment.total_marks ?? '—'}`;
                        document.getElementById('subGradedFeedback').textContent = sub.feedback ? `Feedback: ${sub.feedback}` : 'No written feedback.';
                        prevSec.style.display = 'block';
                        document.getElementById('subPreviousText').textContent = sub.submission_text || (sub.file_id ? `File attachment: ${sub.file_id}` : '');
                        document.getElementById('subPreviousStatus').textContent = `Graded · Submitted ${new Date(sub.submitted_at).toLocaleString()}`;
                        form.style.display = 'none';
                    } else {
                        prevSec.style.display = 'block';
                        document.getElementById('subPreviousText').textContent = sub.submission_text || (sub.file_id ? `File attachment: ${sub.file_id}` : '');
                        document.getElementById('subPreviousStatus').textContent = `Submitted ${new Date(sub.submitted_at).toLocaleString()}${sub.is_late ? ' (Late)' : ''}`;
                        textarea.value = sub.submission_text || '';
                    }
                }
            } catch (_) {}
        } else if (assignment.is_overdue && !assignment.allow_late) {
            closedNotice.style.display = 'block';
            form.style.display = 'none';
        }

        document.getElementById('assignmentSubmissionModal').style.display = 'flex';
    };

    window.closeSubmissionModal = function closeSubmissionModal() {
        document.getElementById('assignmentSubmissionModal').style.display = 'none';
        activeAssignment = null;
    };

    window.handleAssignmentSubmit = async function handleAssignmentSubmit(event) {
        event.preventDefault();
        if (!activeAssignment) return;

        const text = document.getElementById('submissionText').value.trim();
        if (!text) return;

        const submitBtn = document.getElementById('subSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const resp = await APP.API.post(`/assignments/${activeAssignment.id}/submit`, { submission_text: text });
            if (typeof Toast !== 'undefined') {
                Toast.success(resp.message || 'Assignment submitted successfully');
            } else if (typeof APP.showToast === 'function') {
                APP.showToast(resp.message || 'Assignment submitted', 'success');
            }
            closeSubmissionModal();
            loadAssignments();
        } catch (err) {
            if (typeof Toast !== 'undefined') {
                Toast.error(err.message || 'Submission failed');
            } else if (typeof APP.showToast === 'function') {
                APP.showToast(err.message || 'Submission failed', 'error');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Work';
        }
    };

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
