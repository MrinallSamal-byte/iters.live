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

    const LABEL_ALIASES = {
        registrationCode: ['registrationcode'],
        examDescription: ['examdescription'],
        examCode: ['examcode']
    };

    let currentUser = APP.Storage.get('user') || null;
    let currentSnapshot = null;
    let currentSelections = {
        registrationCode: null,
        examDescription: null,
        examCode: null
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await loadSnapshot();
        setupEventListeners();
    }

    async function loadSnapshot() {
        try {
            const response = await APP.API.get('/soa/me');
            currentSnapshot = response?.data || null;
            populateStudentInfo(currentSnapshot?.profile || {});

            const admitSection = currentSnapshot?.raw?.sections?.admitCard || null;
            currentSelections = extractSelections(admitSection);
            populateSelect('registrationCode', currentSelections.registrationCode, 'Select registration code');
            populateSelect('examDescription', currentSelections.examDescription, 'Select exam description');
            populateSelect('examCode', currentSelections.examCode, 'Select exam code');
            updateDownloadState(Boolean(admitSection));

            if (!admitSection && typeof Toast !== 'undefined') {
                Toast.warning('No saved admit-card snapshot is available yet. Reconnect SOA to capture it.', 'Unavailable');
            }
        } catch (error) {
            console.error('Failed to load admit-card snapshot:', error);
            populateStudentInfo({});
            updateDownloadState(false);
            if (typeof Toast !== 'undefined') {
                Toast.error(error.message || 'Failed to load admit-card data', 'Error');
            }
        }
    }

    function populateStudentInfo(profile) {
        const storedUser = currentUser || {};
        const fields = {
            enrollmentNo: profile.registrationNumber || storedUser.registration_number || '--',
            studentNameDisplay: profile.studentName || storedUser.name || 'Student',
            program: profile.program || 'B.Tech',
            branch: profile.branch || storedUser.department || '--',
            semester: profile.semester || storedUser.semester || '--',
            academicYear: profile.academicYear || '--'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    function extractSelections(section) {
        if (!section) {
            return {
                registrationCode: null,
                examDescription: null,
                examCode: null
            };
        }

        const fields = section.fields || {};
        const pageText = String(section.pageText || '');

        return {
            registrationCode: extractValue(fields, pageText, LABEL_ALIASES.registrationCode),
            examDescription: extractValue(fields, pageText, LABEL_ALIASES.examDescription),
            examCode: extractValue(fields, pageText, LABEL_ALIASES.examCode)
        };
    }

    function extractValue(fields, pageText, aliases) {
        const match = Object.entries(fields).find(([label, value]) => {
            return aliases.includes(normalizeLabel(label)) && hasText(value);
        });

        if (match) {
            return String(match[1]).trim();
        }

        const lines = pageText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
        for (let index = 0; index < lines.length; index += 1) {
            const normalized = normalizeLabel(lines[index]);
            if (!aliases.includes(normalized)) continue;
            const nextLine = lines[index + 1];
            if (hasText(nextLine)) {
                return nextLine.trim();
            }
        }

        return null;
    }

    function populateSelect(id, value, placeholder) {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;

        if (hasText(value)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            option.selected = true;
            select.appendChild(option);
            select.disabled = false;
            return;
        }

        select.disabled = true;
    }

    function updateDownloadState(enabled) {
        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn) return;

        downloadBtn.disabled = !enabled;
        downloadBtn.textContent = enabled ? 'Download Saved Admit Snapshot' : 'No Saved Admit Snapshot';
    }

    function setupEventListeners() {
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownload);
        }
    }

    async function handleDownload() {
        const admitSection = currentSnapshot?.raw?.sections?.admitCard || null;
        if (!admitSection) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('Reconnect SOA to capture an admit-card snapshot first.', 'Unavailable');
            }
            return;
        }

        const registrationCode = document.getElementById('registrationCode')?.value || currentSelections.registrationCode;
        const examDescription = document.getElementById('examDescription')?.value || currentSelections.examDescription;
        const examCode = document.getElementById('examCode')?.value || currentSelections.examCode;

        const originalText = document.getElementById('downloadBtn')?.textContent || 'Download';
        updateBusyState(true, 'Preparing snapshot...');

        try {
            const html = buildSnapshotHtml({
                profile: currentSnapshot?.profile || {},
                registrationCode,
                examDescription,
                examCode,
                section: admitSection
            });

            const filename = `saved-soa-admit-card-${sanitizeFilePart(currentSnapshot?.profile?.registrationNumber || 'student')}.html`;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            URL.revokeObjectURL(url);

            if (typeof Toast !== 'undefined') {
                Toast.success('Saved admit-card snapshot downloaded successfully.', 'Success');
            }
        } catch (error) {
            console.error('Error downloading admit-card snapshot:', error);
            if (typeof Toast !== 'undefined') {
                Toast.error('Failed to download the saved admit-card snapshot.', 'Error');
            }
        } finally {
            updateBusyState(false, originalText);
        }
    }

    function buildSnapshotHtml({ profile, registrationCode, examDescription, examCode, section }) {
        const fieldEntries = Object.entries(section.fields || {})
            .filter(([, value]) => hasText(value))
            .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
            .join('');

        const tableBlocks = Array.isArray(section.tables)
            ? section.tables
                .filter((table) => Array.isArray(table.rows) && table.rows.length)
                .map((table) => {
                    const headers = Array.isArray(table.headers) && table.headers.length
                        ? table.headers
                        : Array.from({ length: Math.max(...table.rows.map((row) => row.length), 0) }, (_, index) => `Column ${index + 1}`);

                    return `
                        <section style="margin-top: 24px;">
                            ${table.title ? `<h2>${escapeHtml(table.title)}</h2>` : ''}
                            <table>
                                <thead>
                                    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                                </thead>
                                <tbody>
                                    ${table.rows.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}
                                </tbody>
                            </table>
                        </section>
                    `;
                })
                .join('')
            : '';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Saved SOA Admit Snapshot</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th, td { border: 1px solid #d0d0d0; padding: 10px; vertical-align: top; text-align: left; }
                    th { background: #f4f4f4; }
                    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
                    .card { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
                    h1, h2 { margin-bottom: 8px; }
                </style>
            </head>
            <body>
                <h1>Saved SOA Admit Snapshot</h1>
                <p>This file was generated from the latest saved SOA import inside ITERasn hub.</p>

                <div class="grid">
                    <div class="card"><strong>Student</strong><br>${escapeHtml(profile.studentName || '--')}</div>
                    <div class="card"><strong>Registration Number</strong><br>${escapeHtml(profile.registrationNumber || '--')}</div>
                    <div class="card"><strong>Program</strong><br>${escapeHtml(profile.program || '--')}</div>
                    <div class="card"><strong>Branch</strong><br>${escapeHtml(profile.branch || '--')}</div>
                    <div class="card"><strong>Semester</strong><br>${escapeHtml(profile.semester || '--')}</div>
                    <div class="card"><strong>Academic Year</strong><br>${escapeHtml(profile.academicYear || '--')}</div>
                </div>

                <table>
                    <tbody>
                        <tr><th>Registration Code</th><td>${escapeHtml(registrationCode || '--')}</td></tr>
                        <tr><th>Exam Description</th><td>${escapeHtml(examDescription || '--')}</td></tr>
                        <tr><th>Exam Code</th><td>${escapeHtml(examCode || '--')}</td></tr>
                    </tbody>
                </table>

                ${fieldEntries ? `<table><tbody>${fieldEntries}</tbody></table>` : ''}
                ${tableBlocks}
            </body>
            </html>
        `;
    }

    function updateBusyState(isBusy, label) {
        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn) return;
        downloadBtn.disabled = isBusy || !currentSnapshot?.raw?.sections?.admitCard;
        downloadBtn.textContent = label;
    }

    function normalizeLabel(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }

    function hasText(value) {
        return Boolean(String(value || '').trim());
    }

    function sanitizeFilePart(value) {
        return String(value || 'snapshot')
            .replace(/[^a-z0-9_-]+/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'snapshot';
    }

    function escapeHtml(value) {
        return APP.sanitize ? APP.sanitize(String(value || '')) : String(value || '');
    }
})();
