// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('teacher')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires teacher role');
  }
})();

'use strict';

let marksRoster = [];
let marksSubmitting = false;

document.addEventListener('DOMContentLoaded', () => {
    const csvInput = document.getElementById('csvFileInput');
    if (csvInput) {
        csvInput.addEventListener('change', () => {
            const file = csvInput.files && csvInput.files[0];
            if (file) parseMarksCsv(file);
            csvInput.value = '';
        });
    }
});

function marksAuthHeaders() {
    let token = '';
    try {
        token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function marksEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function marksToast(type, message, title) {
    if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type, title, message });
    }
}

const MONO_ERROR_STYLE = 'font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; color: var(--danger, #ff6b6b); margin-top: 0.25rem; word-break: break-word;';

function setFieldError(inputEl, message) {
    if (!inputEl || !inputEl.parentElement) return;
    clearFieldError(inputEl);
    const err = document.createElement('div');
    err.className = 'field-mono-error';
    err.setAttribute('style', MONO_ERROR_STYLE);
    err.textContent = message;
    inputEl.insertAdjacentElement('afterend', err);
    inputEl.addEventListener('input', () => clearFieldError(inputEl), { once: true });
}

function clearFieldError(inputEl) {
    if (!inputEl || !inputEl.parentElement) return;
    const existing = inputEl.parentElement.querySelector('.field-mono-error');
    if (existing) existing.remove();
}

async function loadStudentsForMarks() {
    const examType = document.getElementById('examType').value;
    const subject = document.getElementById('subject').value.trim();
    const maxMarks = Number(document.getElementById('maxMarks').value);
    const passingMarks = Number(document.getElementById('passingMarks').value);
    const dept = document.getElementById('dept').value;
    const year = document.getElementById('year').value;
    const section = document.getElementById('section').value;

    let valid = true;
    if (!examType) { setFieldError(document.getElementById('examType'), 'Select an exam type'); valid = false; }
    if (!subject) { setFieldError(document.getElementById('subject'), 'Subject is required'); valid = false; }
    if (!Number.isFinite(maxMarks) || maxMarks < 1) { setFieldError(document.getElementById('maxMarks'), 'Max marks must be at least 1'); valid = false; }
    if (!Number.isFinite(passingMarks) || passingMarks < 1) { setFieldError(document.getElementById('passingMarks'), 'Passing marks must be at least 1'); valid = false; }
    else if (Number.isFinite(maxMarks) && passingMarks > maxMarks) { setFieldError(document.getElementById('passingMarks'), 'Passing marks cannot exceed max marks'); valid = false; }
    if (!dept) { setFieldError(document.getElementById('dept'), 'Department is required'); valid = false; }
    if (!year) { setFieldError(document.getElementById('year'), 'Year is required'); valid = false; }
    if (!section) { setFieldError(document.getElementById('section'), 'Section is required'); valid = false; }
    if (!valid) return;

    const listSection = document.getElementById('studentsList');
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="loading-text">Loading students...</td></tr>`;
    listSection.style.display = '';
    marksRoster = [];
    updateMarksSummary();

    try {
        const resp = await fetch('/api/mobile/teacher/students', { headers: marksAuthHeaders() });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.success) {
            throw new Error(payload.message || `Request failed (${resp.status})`);
        }

        const all = Array.isArray(payload.data) ? payload.data : [];
        marksRoster = all.filter((s) =>
            String(s.department || '').toUpperCase() === dept.toUpperCase() &&
            String(s.year ?? '') === String(year) &&
            String(s.section || '').toUpperCase() === section.toUpperCase()
        );

        const maxDisplay = document.getElementById('maxMarksDisplay');
        if (maxDisplay) maxDisplay.textContent = String(maxMarks);

        if (!marksRoster.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No students found for this class</td></tr>';
        } else {
            tbody.innerHTML = marksRoster.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${marksEscape(s.registration_number || '-')}</td>
                    <td>${marksEscape(s.name || '-')}</td>
                    <td><input type="number" class="marks-input" min="0" max="${maxMarks}" data-index="${i}" aria-label="Marks for ${marksEscape(s.name)}" oninput="onMarksInput(${i})"></td>
                    <td id="marks_status_${i}"><span style="color: var(--text-secondary);">Not entered</span></td>
                </tr>
            `).join('');
        }
        document.getElementById('studentCount').textContent = marksRoster.length ? `(${marksRoster.length})` : '';
        updateMarksSummary();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-text">${marksEscape(err.message || 'Failed to load students')}</td></tr>`;
        marksToast('error', err.message || 'Failed to load students', 'Load failed');
    }
}

function getMarksConfig() {
    return {
        maxMarks: Number(document.getElementById('maxMarks').value),
        passingMarks: Number(document.getElementById('passingMarks').value)
    };
}

function onMarksInput(index) {
    const input = document.querySelector(`input.marks-input[data-index="${index}"]`);
    const statusCell = document.getElementById(`marks_status_${index}`);
    if (!input || !statusCell) return;
    recalcMarksRow(input, statusCell);
    updateMarksSummary();
}

function recalcMarksRow(input, statusCell) {
    const { maxMarks, passingMarks } = getMarksConfig();
    const raw = input.value.trim();
    input.classList.remove('pass', 'fail');

    if (raw === '') {
        statusCell.innerHTML = '<span style="color: var(--text-secondary);">Not entered</span>';
        return null;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (Number.isFinite(maxMarks) && value > maxMarks)) {
        statusCell.innerHTML = `<span style="${MONO_ERROR_STYLE}">ERR: enter 0-${Number.isFinite(maxMarks) ? maxMarks : '?'}</span>`;
        return null;
    }

    const passed = Number.isFinite(passingMarks) ? value >= passingMarks : true;
    input.classList.add(passed ? 'pass' : 'fail');
    statusCell.innerHTML = passed
        ? '<span class="status-badge pass">Pass</span>'
        : '<span class="status-badge fail">Fail</span>';
    return value;
}

function collectEnteredMarks() {
    const rows = [];
    document.querySelectorAll('input.marks-input[data-index]').forEach((input) => {
        const index = Number(input.dataset.index);
        const statusCell = document.getElementById(`marks_status_${index}`);
        const value = recalcMarksRow(input, statusCell);
        if (value !== null && marksRoster[index]) {
            rows.push({ student: marksRoster[index], marks: value });
        }
    });
    return rows;
}

function updateMarksSummary() {
    const entered = collectEnteredMarks();
    const { maxMarks } = getMarksConfig();
    const passed = entered.filter((r) => {
        const passingMarks = Number(document.getElementById('passingMarks').value);
        return Number.isFinite(passingMarks) ? r.marks >= passingMarks : true;
    });

    const passedEl = document.getElementById('passedCount');
    const failedEl = document.getElementById('failedCount');
    const avgEl = document.getElementById('avgMarks');
    if (passedEl) passedEl.textContent = String(entered.length ? passed.length : 0);
    if (failedEl) failedEl.textContent = String(entered.length - passed.length);
    if (avgEl) {
        const avg = entered.length
            ? (entered.reduce((sum, r) => sum + r.marks, 0) / entered.length).toFixed(2)
            : '0';
        avgEl.textContent = String(avg);
    }

    const buckets = [
        { fill: 'gradeA', count: 'countA', min: 90 },
        { fill: 'gradeB', count: 'countB', min: 80 },
        { fill: 'gradeC', count: 'countC', min: 70 },
        { fill: 'gradeD', count: 'countD', min: 60 },
        { fill: 'gradeE', count: 'countE', min: 50 },
        { fill: 'gradeF', count: 'countF', min: -1 }
    ];
    const counts = buckets.map(() => 0);
    entered.forEach((r) => {
        const pct = maxMarks > 0 ? (r.marks / maxMarks) * 100 : 0;
        const idx = buckets.findIndex((b) => pct >= b.min);
        counts[idx === -1 ? buckets.length - 1 : idx]++;
    });
    buckets.forEach((b, i) => {
        const fill = document.getElementById(b.fill);
        const count = document.getElementById(b.count);
        if (fill) fill.style.width = entered.length ? `${Math.round((counts[i] / entered.length) * 100)}%` : '0%';
        if (count) count.textContent = String(counts[i]);
    });
}

function autoCalculateGrade() {
    updateMarksSummary();
    marksToast('info', 'Grades recalculated from entered marks.', 'Recalculated');
}

async function submitMarks() {
    if (marksSubmitting) return;

    const examType = document.getElementById('examType').value;
    const subject = document.getElementById('subject').value.trim();
    const maxMarks = Number(document.getElementById('maxMarks').value);

    let valid = true;
    if (!examType) { setFieldError(document.getElementById('examType'), 'Select an exam type'); valid = false; }
    if (!subject) { setFieldError(document.getElementById('subject'), 'Subject is required'); valid = false; }
    if (!Number.isFinite(maxMarks) || maxMarks < 1) { setFieldError(document.getElementById('maxMarks'), 'Max marks must be at least 1'); valid = false; }
    if (!marksRoster.length) {
        marksToast('warning', 'Load students and enter marks first.', 'Nothing to upload');
        return;
    }
    if (!valid) return;

    const entries = [];
    let invalidCount = 0;
    document.querySelectorAll('input.marks-input[data-index]').forEach((input) => {
        const index = Number(input.dataset.index);
        const statusCell = document.getElementById(`marks_status_${index}`);
        const value = recalcMarksRow(input, statusCell);
        if (value === null) {
            if (input.value.trim() !== '') invalidCount++;
        } else if (marksRoster[index]) {
            entries.push({ student_id: String(marksRoster[index].id), marks_obtained: value });
        }
    });

    if (!entries.length) {
        marksToast('warning', invalidCount ? `${invalidCount} invalid mark(s) highlighted.` : 'Enter at least one mark.', 'Nothing to upload');
        return;
    }
    if (invalidCount) {
        marksToast('warning', `${invalidCount} invalid mark(s) highlighted. Fix them or clear the fields.`, 'Fix errors');
        return;
    }

    const submitBtn = document.querySelector('#studentsList .btn-success');
    marksSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';
    }

    let uploaded = 0;
    let lastError = '';
    for (const entry of entries) {
        try {
            const resp = await fetch('/api/marks/upload', {
                method: 'POST',
                headers: marksAuthHeaders(),
                body: JSON.stringify({
                    student_id: entry.student_id,
                    subject,
                    exam_type: examType,
                    marks_obtained: entry.marks_obtained,
                    total_marks: maxMarks
                })
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || !payload.success) {
                throw new Error(payload.message || payload.error || `Request failed (${resp.status})`);
            }
            uploaded++;
        } catch (err) {
            lastError = err.message;
        }
    }

    marksSubmitting = false;
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Submit Marks';
    }

    if (uploaded === entries.length) {
        marksToast('success', `Uploaded marks for ${uploaded} student${uploaded === 1 ? '' : 's'}.`, 'Submitted');
        resetForm();
    } else {
        marksToast('error', `Uploaded ${uploaded}/${entries.length}. Last error: ${lastError || 'unknown'}`, 'Incomplete');
    }
}

function importCSV() {
    const modal = document.getElementById('csvModal');
    if (modal) modal.style.display = 'flex';
}

function closeCsvModal() {
    const modal = document.getElementById('csvModal');
    if (modal) modal.style.display = 'none';
}

function parseMarksCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const lines = String(reader.result || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const regToMark = new Map();
        lines.forEach((line, i) => {
            const cols = line.split(',').map((c) => c.trim());
            if (i === 0 && /[^0-9.,-]/.test(cols[cols.length - 1] || '')) return;
            if (cols.length >= 2 && cols[0]) regToMark.set(cols[0].toUpperCase(), cols[1]);
        });

        let applied = 0;
        marksRoster.forEach((s, i) => {
            const reg = String(s.registration_number || '').toUpperCase();
            const input = document.querySelector(`input.marks-input[data-index="${i}"]`);
            if (regToMark.has(reg) && input) {
                input.value = regToMark.get(reg);
                onMarksInput(i);
                applied++;
            }
        });
        closeCsvModal();
        marksToast(applied ? 'success' : 'warning', `${applied} row(s) matched loaded students.`, 'CSV import');
    };
    reader.onerror = () => marksToast('error', 'Could not read the CSV file.', 'CSV import');
    reader.readAsText(file);
}

function downloadTemplate() {
    const rows = ['registration_number,marks'];
    marksRoster.forEach((s) => rows.push(`${s.registration_number || ''},`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'marks-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function resetForm() {
    marksRoster = [];
    marksSubmitting = false;
    const form = document.getElementById('marksForm');
    if (form) form.reset();
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) tbody.innerHTML = '';
    const countEl = document.getElementById('studentCount');
    if (countEl) countEl.textContent = '';
    const maxDisplay = document.getElementById('maxMarksDisplay');
    if (maxDisplay) maxDisplay.textContent = '--';
    updateMarksSummary();
    closeCsvModal();
    const listSection = document.getElementById('studentsList');
    if (listSection) listSection.style.display = 'none';
}
