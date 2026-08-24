// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('teacher')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires teacher role');
  }
})();

'use strict';

let createdAssignments = [];
let assignmentCreating = false;
let gradingContext = null;

document.addEventListener('DOMContentLoaded', () => {
    renderAssignmentStats();
    renderAssignmentsList();
    renderPendingSubmissions();

    const form = document.getElementById('createAssignmentForm');
    if (form) form.addEventListener('submit', handleCreateAssignment);

    const gradingForm = document.getElementById('gradingForm');
    if (gradingForm) gradingForm.addEventListener('submit', handleGradeSubmit);
});

function assignmentsAuthHeaders() {
    let token = '';
    try {
        token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function assignmentsEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function assignmentsToast(type, message, title) {
    if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type, title, message });
    }
}

const ASSIGN_MONO_ERROR_STYLE = 'font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; color: var(--danger, #ff6b6b); margin-top: 0.25rem; word-break: break-word;';

function setAssignmentFieldError(inputEl, message) {
    if (!inputEl || !inputEl.parentElement) return;
    clearAssignmentFieldError(inputEl);
    const err = document.createElement('div');
    err.className = 'field-mono-error';
    err.setAttribute('style', ASSIGN_MONO_ERROR_STYLE);
    err.textContent = message;
    inputEl.insertAdjacentElement('afterend', err);
    inputEl.addEventListener('input', () => clearAssignmentFieldError(inputEl), { once: true });
    inputEl.addEventListener('change', () => clearAssignmentFieldError(inputEl), { once: true });
}

function clearAssignmentFieldError(inputEl) {
    if (!inputEl || !inputEl.parentElement) return;
    const existing = inputEl.parentElement.querySelector('.field-mono-error');
    if (existing) existing.remove();
}

function setStat(statId, value) {
    const el = document.getElementById(statId);
    if (el) el.textContent = value;
}

function renderAssignmentStats() {
    setStat('totalAssignments', '--');
    setStat('activeAssignments', '--');
    setStat('pendingSubmissions', '--');
    setStat('avgSubmissionRate', '--');
}

function formatDeadline(deadline) {
    const parsed = Date.parse(deadline);
    if (Number.isNaN(parsed)) return String(deadline || '-');
    return new Date(parsed).toLocaleDateString();
}

function renderAssignmentsList() {
    const container = document.getElementById('assignmentsList');
    if (!container) return;

    if (!createdAssignments.length) {
        container.innerHTML = '<div class="loading-text">Nothing here yet.<br>Assignments you create will appear here.</div>';
        return;
    }

    container.innerHTML = createdAssignments.map((a) => `
        <div class="assignment-card">
            <div class="assignment-header">
                <div>
                    <h4 class="assignment-title">${assignmentsEscape(a.title)}</h4>
                    <p class="assignment-subject">${assignmentsEscape(a.subject)}</p>
                </div>
                <span class="assignment-status status-active">Active</span>
            </div>
            <div class="assignment-meta">
                <span class="meta-item">🎓 ${assignmentsEscape(a.department)} · Year ${assignmentsEscape(a.year)}</span>
                <span class="meta-item">🎯 ${assignmentsEscape(a.total_marks)} marks</span>
                <span class="meta-item">📅 Due ${assignmentsEscape(formatDeadline(a.deadline))}</span>
            </div>
            <p style="font-size: 0.875rem; color: var(--text-secondary);">${assignmentsEscape(a.description)}</p>
            <div class="assignment-actions">
                <button class="btn btn-sm btn-primary" onclick="viewAssignment('${assignmentsEscape(a.id)}')">View Details</button>
                <button class="btn btn-sm btn-secondary" onclick="openGradingModal('${assignmentsEscape(a.id)}')">Grade</button>
            </div>
        </div>
    `).join('');
}

function renderPendingSubmissions() {
    const tbody = document.getElementById('submissionsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Nothing to grade yet.<br>Open an assignment above and click Grade to review submissions.</td></tr>';
    }
    setStat('pendingCount', '0');
}

async function handleCreateAssignment(e) {
    e.preventDefault();
    if (assignmentCreating) return;

    const form = document.getElementById('createAssignmentForm');
    const titleInput = document.getElementById('assignmentTitle');
    const subjectInput = document.getElementById('subject');
    const descInput = document.getElementById('description');
    const deptSelect = document.getElementById('department');
    const yearSelect = document.getElementById('year');
    const maxMarksInput = document.getElementById('maxMarks');
    const dueDateInput = document.getElementById('dueDate');
    const dueTimeInput = document.getElementById('dueTime');

    const title = titleInput.value.trim();
    const subject = subjectInput.value.trim();
    const description = descInput.value.trim();
    const department = deptSelect.value;
    const year = yearSelect.value;
    const totalMarks = Number(maxMarksInput.value);
    const dueDate = dueDateInput.value;
    const dueTime = dueTimeInput.value;

    let valid = true;
    if (title.length < 3) { setAssignmentFieldError(titleInput, 'Title must be at least 3 characters'); valid = false; }
    if (!subject) { setAssignmentFieldError(subjectInput, 'Subject is required'); valid = false; }
    if (description.length < 10) { setAssignmentFieldError(descInput, 'Description must be at least 10 characters'); valid = false; }
    if (!department) { setAssignmentFieldError(deptSelect, 'Department is required'); valid = false; }
    if (!year) { setAssignmentFieldError(yearSelect, 'Year is required'); valid = false; }
    if (!Number.isFinite(totalMarks) || totalMarks < 1) { setAssignmentFieldError(maxMarksInput, 'Max marks must be at least 1'); valid = false; }
    if (!dueDate) { setAssignmentFieldError(dueDateInput, 'Due date is required'); valid = false; }
    if (!dueTime) { setAssignmentFieldError(dueTimeInput, 'Due time is required'); valid = false; }
    if (!valid) return;

    const deadline = `${dueDate}T${dueTime}:00`;
    const submitBtn = form.querySelector('button[type="submit"]');

    assignmentCreating = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
    }

    try {
        const resp = await fetch('/api/assignments', {
            method: 'POST',
            headers: assignmentsAuthHeaders(),
            body: JSON.stringify({
                title,
                description,
                subject,
                department,
                year,
                total_marks: totalMarks,
                deadline
            })
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.success) {
            throw new Error(payload.message || `Request failed (${resp.status})`);
        }

        createdAssignments.unshift({
            id: payload.data?.id ?? `local-${Date.now()}`,
            title,
            description,
            subject,
            department,
            year,
            total_marks: totalMarks,
            deadline
        });

        assignmentsToast('success', 'Assignment created successfully.', 'Created');
        renderAssignmentsList();
        form.reset();
    } catch (err) {
        assignmentsToast('error', err.message || 'Failed to create assignment', 'Create failed');
    } finally {
        assignmentCreating = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'Create Assignment';
        }
    }
}

function resetForm() {
    const form = document.getElementById('createAssignmentForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.field-mono-error').forEach((el) => el.remove());
    }
}

function viewAssignment(id) {
    const assignment = createdAssignments.find((a) => String(a.id) === String(id));
    if (!assignment) return;

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (modalTitle) modalTitle.textContent = assignment.title;
    if (modalBody) {
        modalBody.innerHTML = `
            <p class="assignment-subject">📖 ${assignmentsEscape(assignment.subject)}</p>
            <div class="assignment-meta">
                <span class="meta-item">🎓 ${assignmentsEscape(assignment.department)} · Year ${assignmentsEscape(assignment.year)}</span>
                <span class="meta-item">🎯 ${assignmentsEscape(assignment.total_marks)} marks</span>
                <span class="meta-item">📅 Due ${assignmentsEscape(formatDeadline(assignment.deadline))}</span>
            </div>
            <p style="color: var(--text-primary);">${assignmentsEscape(assignment.description)}</p>
            <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">Click Grade on this assignment to review and score student submissions.</p>
        `;
    }
    openModal('assignmentModal');
}

async function openGradingModal(assignmentId) {
    const assignment = createdAssignments.find((a) => String(a.id) === String(assignmentId));
    if (!assignment) return;

    gradingContext = { assignmentId, submissions: [] };

    const studentSelect = document.getElementById('gradeStudent');
    const marksInput = document.getElementById('marksObtained');
    const feedbackInput = document.getElementById('feedback');
    if (marksInput) {
        marksInput.value = '';
        marksInput.max = assignment.total_marks || undefined;
        clearAssignmentFieldError(marksInput);
    }
    if (feedbackInput) feedbackInput.value = '';
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Loading submissions...</option>';
        studentSelect.disabled = true;
    }

    openModal('gradingModal');

    try {
        const resp = await fetch(`/api/assignments/${encodeURIComponent(assignmentId)}/submissions`, { headers: assignmentsAuthHeaders() });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.success) throw new Error(payload.message || `Request failed (${resp.status})`);
        gradingContext.submissions = payload.data || [];

        if (studentSelect) {
            if (!gradingContext.submissions.length) {
                studentSelect.innerHTML = '<option value="">No submissions yet</option>';
            } else {
                studentSelect.innerHTML = gradingContext.submissions.map((s) => {
                    const graded = s.status === 'graded' ? ` — graded (${Number(s.marks_obtained || 0)})` : '';
                    return `<option value="${assignmentsEscape(s.student_id)}">${assignmentsEscape(s.student_id)}${graded}</option>`;
                }).join('');
                studentSelect.disabled = false;
            }
        }
    } catch (err) {
        if (studentSelect) studentSelect.innerHTML = '<option value="">Failed to load submissions</option>';
        assignmentsToast('error', err.message || 'Failed to load submissions', 'Grading');
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('assignmentModal');
    if (modal) modal.style.display = 'none';
}

function closeGradingModal() {
    const modal = document.getElementById('gradingModal');
    if (modal) modal.style.display = 'none';
    gradingContext = null;
}

async function handleGradeSubmit(e) {
    e.preventDefault();
    if (!gradingContext) {
        assignmentsToast('warning', 'No submission selected for grading.', 'Nothing to grade');
        return;
    }

    const studentSelect = document.getElementById('gradeStudent');
    const marksInput = document.getElementById('marksObtained');
    const feedbackInput = document.getElementById('feedback');

    if (studentSelect && !studentSelect.value) {
        assignmentsToast('warning', 'No submission selected for grading.', 'Nothing to grade');
        return;
    }
    gradingContext.studentId = studentSelect.value;

    const marksObtained = Number(marksInput.value);
    if (!Number.isFinite(marksObtained) || marksInput.value === '') {
        setAssignmentFieldError(marksInput, 'Enter a numeric score');
        return;
    }
    const maxMarks = Number(marksInput.max);
    if (Number.isFinite(maxMarks) && maxMarks > 0 && marksObtained > maxMarks) {
        setAssignmentFieldError(marksInput, `Score cannot exceed ${maxMarks}`);
        return;
    }

    try {
        const resp = await fetch(`/api/assignments/${encodeURIComponent(gradingContext.assignmentId)}/grade`, {
            method: 'POST',
            headers: assignmentsAuthHeaders(),
            body: JSON.stringify({
                student_id: gradingContext.studentId,
                marks_obtained: marksObtained,
                feedback: feedbackInput.value.trim() || null
            })
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.success) {
            throw new Error(payload.message || `Request failed (${resp.status})`);
        }
        assignmentsToast('success', payload.message || 'Submission graded.', 'Graded');
        closeGradingModal();
    } catch (err) {
        assignmentsToast('error', err.message || 'Failed to save grade', 'Grade failed');
    }
}
