'use strict';

let attendanceRoster = [];
let attendanceSubmitting = false;
let attendanceConfirmArmed = false;

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
});

function attendanceAuthHeaders() {
    let token = '';
    try {
        token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function attendanceEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function attendanceToast(type, message, title) {
    if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type, title, message });
    }
}

async function loadStudentsForAttendance() {
    const dept = document.getElementById('dept').value;
    const year = document.getElementById('year').value;
    const section = document.getElementById('section').value;
    const subject = document.getElementById('subject').value.trim();
    const date = document.getElementById('attDate').value;

    if (!dept || !year || !section || !subject || !date) {
        attendanceToast('warning', 'Select department, year, section, subject and date first.', 'Missing filters');
        return;
    }

    const listSection = document.getElementById('studentsList');
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Loading students...</td></tr>';
    listSection.style.display = '';
    attendanceRoster = [];
    attendanceConfirmArmed = false;
    updateAttendanceCounts();

    try {
        const resp = await fetch('/api/mobile/teacher/students', { headers: attendanceAuthHeaders() });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.success) {
            throw new Error(payload.message || `Request failed (${resp.status})`);
        }

        const all = Array.isArray(payload.data) ? payload.data : [];
        attendanceRoster = all.filter((s) =>
            String(s.department || '').toUpperCase() === dept.toUpperCase() &&
            String(s.year ?? '') === String(year) &&
            String(s.section || '').toUpperCase() === section.toUpperCase()
        );

        if (!attendanceRoster.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No students found for this class</td></tr>';
        } else {
            tbody.innerHTML = attendanceRoster.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${attendanceEscape(s.registration_number || '-')}</td>
                    <td>${attendanceEscape(s.name || '-')}</td>
                    <td><input type="radio" name="att_status_${i}" value="present" aria-label="Present for ${attendanceEscape(s.name)}" onchange="updateAttendanceCounts()"></td>
                    <td><input type="radio" name="att_status_${i}" value="absent" aria-label="Absent for ${attendanceEscape(s.name)}" onchange="updateAttendanceCounts()"></td>
                </tr>
            `).join('');
        }
        document.getElementById('studentCount').textContent = attendanceRoster.length ? `(${attendanceRoster.length})` : '';
        updateAttendanceCounts();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-text">${attendanceEscape(err.message || 'Failed to load students')}</td></tr>`;
        attendanceToast('error', err.message || 'Failed to load students', 'Load failed');
    }
}

function updateAttendanceCounts() {
    let present = 0;
    let absent = 0;
    for (let i = 0; i < attendanceRoster.length; i++) {
        const checked = document.querySelector(`input[name="att_status_${i}"]:checked`);
        if (checked && checked.value === 'present') present++;
        if (checked && checked.value === 'absent') absent++;
    }
    const presentEl = document.getElementById('presentCount');
    const absentEl = document.getElementById('absentCount');
    if (presentEl) presentEl.textContent = String(present);
    if (absentEl) absentEl.textContent = String(absent);
    attendanceConfirmArmed = false;
}

function setAllAttendance(status) {
    if (!attendanceRoster.length) {
        attendanceToast('warning', 'Load students first.', 'Nothing to mark');
        return;
    }
    for (let i = 0; i < attendanceRoster.length; i++) {
        const radio = document.querySelector(`input[name="att_status_${i}"][value="${status}"]`);
        if (radio) radio.checked = true;
    }
    updateAttendanceCounts();
}

function markAllPresent() {
    setAllAttendance('present');
}

function markAllAbsent() {
    setAllAttendance('absent');
}

async function submitAttendance() {
    if (attendanceSubmitting) return;

    const submitBtn = document.querySelector('#studentsList .btn-success');
    if (!attendanceRoster.length) {
        attendanceToast('warning', 'Load students first.', 'Nothing to submit');
        return;
    }

    const subject = document.getElementById('subject').value.trim();
    const date = document.getElementById('attDate').value;
    if (!subject || !date) {
        attendanceToast('warning', 'Subject and date are required.', 'Missing fields');
        return;
    }

    const entries = [];
    let unmarked = 0;
    for (let i = 0; i < attendanceRoster.length; i++) {
        const checked = document.querySelector(`input[name="att_status_${i}"]:checked`);
        if (checked) {
            entries.push({ student_id: String(attendanceRoster[i].id), status: checked.value });
        } else {
            unmarked++;
        }
    }

    if (!entries.length) {
        attendanceToast('warning', 'Mark at least one student before submitting.', 'Nothing selected');
        return;
    }

    if (unmarked > 0 && !attendanceConfirmArmed) {
        attendanceConfirmArmed = true;
        attendanceToast('warning', `${unmarked} student(s) left unmarked. Click Submit again to save the ${entries.length} marked entr${entries.length === 1 ? 'y' : 'ies'} only.`, 'Confirm submit');
        return;
    }

    attendanceSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
    }

    let saved = 0;
    let lastError = '';
    for (const entry of entries) {
        try {
            const resp = await fetch('/api/attendance/mark', {
                method: 'POST',
                headers: attendanceAuthHeaders(),
                body: JSON.stringify({
                    student_id: entry.student_id,
                    subject,
                    date,
                    status: entry.status
                })
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || !payload.success) {
                throw new Error(payload.message || `Request failed (${resp.status})`);
            }
            saved++;
        } catch (err) {
            lastError = err.message;
        }
    }

    attendanceSubmitting = false;
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Submit Attendance';
    }

    if (saved === entries.length) {
        attendanceToast('success', `Attendance saved for ${saved} student${saved === 1 ? '' : 's'}.`, 'Submitted');
        resetForm();
    } else {
        attendanceToast('error', `Saved ${saved}/${entries.length}. Last error: ${lastError || 'unknown'}`, 'Incomplete');
    }
}

function resetForm() {
    attendanceRoster = [];
    attendanceConfirmArmed = false;
    attendanceSubmitting = false;
    const form = document.getElementById('attendanceForm');
    if (form) form.reset();
    const dateInput = document.getElementById('attDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) tbody.innerHTML = '';
    const countEl = document.getElementById('studentCount');
    if (countEl) countEl.textContent = '';
    updateAttendanceCounts();
    const listSection = document.getElementById('studentsList');
    if (listSection) listSection.style.display = 'none';
}
