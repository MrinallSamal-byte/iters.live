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

    const PERSONAL_FIELDS = [
        ['Student name', 'studentName'],
        ['Registration number', 'registrationNumber'],
        ['Enrollment number', 'enrollmentNumber'],
        ['Institute code', 'instituteCode'],
        ['Academic year', 'academicYear'],
        ['Admission year', 'admissionYear'],
        ['Program', 'program'],
        ['Branch', 'branch'],
        ['Batch', 'batch'],
        ['Semester', 'semester'],
        ['Section', 'section'],
        ['Date of birth', 'dateOfBirth'],
        ['Blood group', 'bloodGroup'],
        ['Gender', 'gender'],
        ['Nationality', 'nationality'],
        ['Marital status', 'maritalStatus'],
        ['Category', 'category'],
        ['Bank name', 'bankName'],
        ['Bank account number', 'bankAccountNumber'],
        ['Father\'s name', 'fatherName'],
        ['Father\'s designation', 'fatherDesignation'],
        ['Mother\'s name', 'motherName'],
        ['Hostel name', 'hostelName'],
        ['Room number', 'roomNumber']
    ];

    const CONTACT_FIELDS = [
        ['Email', 'email'],
        ['Alternate email', 'alternateEmail'],
        ['Phone', 'phone'],
        ['Alternate phone', 'alternatePhone'],
        ['Guardian phone', 'guardianPhone'],
        ['Correspondence address', 'correspondenceAddress'],
        ['Permanent address', 'permanentAddress'],
        ['City', 'city'],
        ['District', 'district'],
        ['State', 'state'],
        ['Postal code', 'postalCode']
    ];

    let currentConnection = null;
    let currentData = null;

    const loadingState = document.getElementById('soaLoadingState');
    const emptyState = document.getElementById('soaEmptyState');
    const contentShell = document.getElementById('soaContentShell');
    const statusBadges = document.getElementById('soaStatusBadges');
    const heroCopy = document.getElementById('soaHeroCopy');
    const avatar = document.getElementById('soaAvatar');
    const studentName = document.getElementById('soaStudentName');
    const studentMeta = document.getElementById('soaStudentMeta');
    const metaGrid = document.getElementById('soaMetaGrid');
    const tabList = document.getElementById('soaTabList');
    const tabPanels = document.getElementById('soaTabPanels');
    const disconnectBtn = document.getElementById('disconnectSoaBtn');
    const disconnectNote = document.getElementById('disconnectNote');

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        disconnectBtn?.addEventListener('click', disconnectPortal);
        await loadPortalData();
    }

    async function loadPortalData() {
        let requestFailed = false;

        try {
            const response = await APP.API.get('/soa/me');
            currentConnection = response.connection || null;
            currentData = response.data || null;
        } catch (_) {
            requestFailed = true;
            currentConnection = null;
            currentData = null;
        }

        const user = APP.Storage.get('user') || {};
        const localData = normalizeLocalPortalData(user.portalData);
        const localConnection = user.portalStatus || buildLocalConnection(user, localData);

        if (currentData && localData?.dataSource === 'demo') {
            clearStoredPortalData();
        }

        // Fall back to locally-cached portal data when:
        // (a) the server request failed outright, OR
        // (b) the server returned no meaningful data but the local cache has real (non-demo) data.
        // This prevents data loss on server restarts when Firebase is not configured.
        const serverHasMeaningfulData = hasMeaningfulData(currentData);
        if (!serverHasMeaningfulData && shouldUseLocalPortalFallback(user, localData, currentConnection, localConnection, requestFailed)) {
            currentData = localData;
            currentConnection = currentConnection || localConnection;
        }

        render();
    }

    function render() {
        hideElement(loadingState);

        if (!hasMeaningfulData(currentData)) {
            showEmptyState();
            return;
        }

        hideElement(emptyState);
        showElement(contentShell);
        renderOverview();
        renderTabs();
    }

    function showEmptyState() {
        const hadFailedImport = Boolean(currentConnection?.connected || currentConnection?.lastSynced);
        statusBadges.innerHTML = hadFailedImport
            ? `
                <span class="soa-pill cached">Import needs retry</span>
                ${currentConnection?.lastSynced ? `<span class="soa-pill demo">Last attempt ${escapeHtml(formatDateTime(currentConnection.lastSynced))}</span>` : ''}
            `
            : `
                <span class="soa-pill demo">Not connected</span>
            `;
        heroCopy.textContent = hadFailedImport
            ? 'Your last SOA import did not return usable student data. Fetch a fresh CAPTCHA and connect again.'
            : 'Connect your SOA portal to import and save your student data inside ITERasn hub.';
        avatar.textContent = 'S';
        studentName.textContent = hadFailedImport ? 'SOA import needs retry' : 'SOA data not imported';
        studentMeta.textContent = hadFailedImport
            ? 'Connection metadata was saved, but no student profile details were imported yet.'
            : 'No saved SOA profile is available for this account yet.';
        metaGrid.innerHTML = '';
        hideElement(contentShell);
        showElement(emptyState);
        toggleVisibility(disconnectBtn, hadFailedImport);
        toggleVisibility(disconnectNote, hadFailedImport);
    }

    function renderOverview() {
        const profile = currentData.profile || {};
        const displayName = profile.studentName || 'Student';
        const branch = profile.branch || profile.program || profile.department || 'SOA student';
        const semester = profile.semester ? `Semester ${profile.semester}` : 'Semester not available';
        const photoUrl = profile.photoUrl || null;
        const dataSource = currentConnection?.dataSource || currentData.dataSource || 'saved_import';

        studentName.textContent = displayName;
        studentMeta.textContent = [
            branch,
            semester,
            currentConnection?.lastSynced ? `Last synced ${formatDateTime(currentConnection.lastSynced)}` : null
        ].filter(Boolean).join(' • ');

        if (photoUrl) {
            avatar.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}">`;
        } else {
            avatar.textContent = displayName.charAt(0).toUpperCase();
        }

        statusBadges.innerHTML = buildStatusBadges(dataSource);
        heroCopy.textContent = currentConnection?.connected
            ? 'This data was verified from the official SOA portal and saved into your ITERasn hub account.'
            : dataSource === 'demo'
                ? 'This is demo content loaded locally so you can explore the student-facing SOA data experience.'
                : 'This is the latest saved SOA data available inside ITERasn hub for your account.';

        metaGrid.innerHTML = [
            buildMetaCard('Registration number', profile.registrationNumber || 'Not available', 'Official SOA registration identifier.'),
            buildMetaCard('Branch and program', [profile.branch, profile.program].filter(Boolean).join(' • ') || 'Not available', 'Imported from your saved SOA profile.'),
            buildMetaCard('Semester and batch', [profile.semester ? `Semester ${profile.semester}` : null, profile.batch].filter(Boolean).join(' • ') || 'Not available', 'Academic position from the latest import.'),
            buildMetaCard('Import status', currentConnection?.lastSynced ? formatDateTime(currentConnection.lastSynced) : 'Not synced yet', currentConnection?.needsReconnect ? 'Reconnect to refresh this data from SOA.' : 'Saved in your ITERasn hub account.')
        ].join('');

        const canDisconnect = Boolean(currentConnection?.hasImportedData) && (dataSource !== 'demo');
        toggleVisibility(disconnectBtn, canDisconnect);
        toggleVisibility(disconnectNote, canDisconnect);
    }

    function buildStatusBadges(dataSource) {
        const badges = [];

        if (currentConnection?.connected) {
            badges.push('<span class="soa-pill connected">Verified from SOA</span>');
        } else if (dataSource === 'demo') {
            badges.push('<span class="soa-pill demo">Demo data</span>');
        } else {
            badges.push('<span class="soa-pill cached">Cached SOA data</span>');
        }

        if (currentConnection?.needsReconnect) {
            badges.push('<span class="soa-pill cached">Needs reconnect</span>');
        }

        if (currentConnection?.lastSynced) {
            badges.push(`<span class="soa-pill demo">Synced ${escapeHtml(formatDateTime(currentConnection.lastSynced))}</span>`);
        }

        return badges.join('');
    }

    function buildMetaCard(title, value, copy) {
        return `
            <article class="soa-meta-card">
                <h3>${escapeHtml(title)}</h3>
                <p><strong>${escapeHtml(value)}</strong></p>
                <p class="soa-muted">${escapeHtml(copy)}</p>
            </article>
        `;
    }

    function renderTabs() {
        const extraTabs = [];

        if (hasSubjectData()) {
            extraTabs.push({
                id: 'subjects',
                label: 'Subjects',
                content: renderSubjects()
            });
        }

        if (hasTimetableData()) {
            extraTabs.push({
                id: 'timetable',
                label: 'Timetable',
                content: renderTimetable()
            });
        }

        if (getRawSection('admitCard')) {
            extraTabs.push({
                id: 'admit-card',
                label: 'Admit Card',
                content: renderRawSection('admitCard', 'Admit card', 'Captured from the latest authenticated SOA exam information page.')
            });
        }

        const tabs = [
            {
                id: 'personal',
                label: 'Personal Info',
                content: renderFieldSection('personalInfo', 'Personal information', 'Imported directly from the saved SOA profile details.', PERSONAL_FIELDS, currentData.personalInfo || {})
            },
            {
                id: 'contact',
                label: 'Contact Info',
                content: renderFieldSection('contactInfo', 'Contact information', 'Contact and address details available from the latest import.', CONTACT_FIELDS, currentData.contactInfo || {})
            },
            {
                id: 'qualifications',
                label: 'Qualifications',
                content: renderQualifications()
            },
            {
                id: 'attendance',
                label: 'Attendance',
                content: renderAttendance()
            },
            {
                id: 'marks',
                label: 'Marks & Results',
                content: renderMarks()
            }
        ].concat(extraTabs);

        tabList.innerHTML = tabs.map((tab, index) => `
            <button type="button" class="soa-tab-btn ${index === 0 ? 'active' : ''}" data-tab="${escapeHtml(tab.id)}">
                ${escapeHtml(tab.label)}
            </button>
        `).join('');

        tabPanels.innerHTML = tabs.map((tab, index) => `
            <div class="soa-tab-panel ${index === 0 ? 'active' : ''}" id="panel-${escapeHtml(tab.id)}">
                ${tab.content}
            </div>
        `).join('');

        tabList.querySelectorAll('.soa-tab-btn').forEach((button) => {
            button.addEventListener('click', () => activateTab(button.dataset.tab));
        });
    }

    function activateTab(tabId) {
        document.querySelectorAll('.soa-tab-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });

        document.querySelectorAll('.soa-tab-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });
    }

    function renderFieldSection(sectionKey, title, copy, mapping, source) {
        const fields = mapping
            .map(([label, key]) => ({ label, value: source[key] || null }))
            .filter((item) => item.value);

        if (!fields.length) {
            return renderRawSection(
                sectionKey,
                title,
                copy
            );
        }

        return `
            <article class="soa-section-card">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(copy)}</p>
                <div class="soa-field-grid" style="margin-top: 1rem;">
                    ${fields.map((field) => `
                        <div class="soa-field">
                            <span class="soa-field-label">${escapeHtml(field.label)}</span>
                            <span class="soa-field-value">${escapeHtml(field.value)}</span>
                        </div>
                    `).join('')}
                </div>
            </article>
        `;
    }

    function renderQualifications() {
        const qualifications = Array.isArray(currentData.qualifications) ? currentData.qualifications : [];

        if (!qualifications.length) {
            return renderRawSection(
                'qualifications',
                'Qualifications',
                'Academic qualification rows captured from the latest SOA import.'
            );
        }

        const columns = Array.from(qualifications.reduce((set, item) => {
            Object.keys(item || {}).forEach((key) => set.add(key));
            return set;
        }, new Set()));

        return `
            <article class="soa-section-card">
                <h3>Qualifications</h3>
                <p>Academic qualification rows imported from the saved SOA data.</p>
                ${renderTable(
                    columns.map(prettyLabel),
                    qualifications.map((item) => columns.map((column) => item[column] || '—'))
                )}
            </article>
        `;
    }

    function renderAttendance() {
        const attendance = currentData.attendance || {};
        const summary = Array.isArray(attendance.summary) ? attendance.summary : [];
        const overall = attendance.overall || {};

        if (!summary.length) {
            return renderRawSection(
                'attendance',
                'Attendance',
                'Attendance rows captured from the latest SOA import.'
            );
        }

        return `
            <article class="soa-section-card">
                <h3>Attendance</h3>
                <p>These attendance summaries are also used as a fallback in the existing student dashboard when native attendance records are not available.</p>
                <div class="soa-meta-grid" style="margin-top: 1rem;">
                    ${buildMetaCard('Overall percentage', overall.percentage != null ? `${Number(overall.percentage).toFixed(2)}%` : '—', 'Calculated from the imported subject totals.')}
                    ${buildMetaCard('Present classes', overall.presentClasses != null ? String(overall.presentClasses) : '—', 'Total present classes from the imported summary.')}
                    ${buildMetaCard('Total classes', overall.totalClasses != null ? String(overall.totalClasses) : '—', 'Total classes counted across imported attendance rows.')}
                </div>
                ${renderTable(
                    ['Subject code', 'Subject', 'Present', 'Total', 'Percentage'],
                    summary.map((row) => [
                        row.subject_code || '—',
                        row.subject || '—',
                        row.present_count != null ? String(row.present_count) : '—',
                        row.total_classes != null ? String(row.total_classes) : '—',
                        row.percentage != null ? `${row.percentage}%` : '—'
                    ])
                )}
            </article>
        `;
    }

    function renderMarks() {
        const marks = currentData.marks || {};
        const summary = Array.isArray(marks.summary) ? marks.summary : [];
        const records = Array.isArray(marks.records) ? marks.records : [];
        const semesterResults = Array.isArray(currentData.semesterResults) ? currentData.semesterResults : [];

        if (!summary.length && !records.length && !semesterResults.length) {
            return renderRawSection(
                'marks',
                'Marks and results',
                'Result rows captured from the latest SOA import.'
            );
        }

        const semesterSection = semesterResults.length
            ? `
                <div style="margin-top: 1rem;">
                    <h3 style="margin-bottom: 0.75rem;">Semester results</h3>
                    ${renderTable(
                        ['Semester', 'Points secured', 'Course credits', 'Earned credits', 'SGPA', 'CGPA'],
                        semesterResults.map((row) => [
                            row.semester || '—',
                            row.pointsSecured != null ? String(row.pointsSecured) : '—',
                            row.courseCredits != null ? String(row.courseCredits) : '—',
                            row.earnedCredits != null ? String(row.earnedCredits) : '—',
                            row.sgpa != null ? String(row.sgpa) : '—',
                            row.cgpa != null ? String(row.cgpa) : '—'
                        ])
                    )}
                </div>
            `
            : '';

        const summarySection = summary.length
            ? `
                <div style="margin-top: 1rem;">
                    <h3 style="margin-bottom: 0.75rem;">Subject summary</h3>
                    ${renderTable(
                        ['Subject code', 'Subject', 'Average marks', 'Average total', 'Exam types'],
                        summary.map((row) => [
                            row.subject_code || '—',
                            row.subject || '—',
                            row.avg_marks != null ? String(row.avg_marks) : '—',
                            row.avg_total != null ? String(row.avg_total) : '—',
                            row.exam_type || '—'
                        ])
                    )}
                </div>
            `
            : '';

        const recordSection = records.length
            ? `
                <div style="margin-top: 1rem;">
                    <h3 style="margin-bottom: 0.75rem;">Detailed results</h3>
                    ${renderTable(
                        ['Subject code', 'Subject', 'Exam', 'Marks', 'Total', 'Grade', 'Published'],
                        records.map((row) => [
                            row.subjectCode || '—',
                            row.subject || '—',
                            row.examType || '—',
                            row.marksObtained != null ? String(row.marksObtained) : '—',
                            row.totalMarks != null ? String(row.totalMarks) : '—',
                            row.grade || '—',
                            row.publishedAt ? formatDateTime(row.publishedAt) : '—'
                        ])
                    )}
                </div>
            `
            : '';

        return `
            <article class="soa-section-card">
                <h3>Marks and results</h3>
                <p>These imported marks are also used as a fallback in the existing student dashboard when native marks records are not available.</p>
                <div class="soa-meta-grid" style="margin-top: 1rem;">
                    ${buildMetaCard('Estimated CGPA', marks.cgpa != null ? String(marks.cgpa) : '—', 'Derived from the saved imported marks summary.')}
                    ${buildMetaCard('Imported result rows', String(records.length || semesterResults.length), 'Detailed rows captured from the saved SOA results data.')}
                </div>
                ${semesterSection}
                ${summarySection}
                ${recordSection}
            </article>
        `;
    }

    function renderSubjects() {
        const subjects = Array.isArray(currentData.subjects) ? currentData.subjects : [];

        if (!subjects.length) {
            return renderRawSection(
                'subjects',
                'Registered subjects',
                'Registered subject data captured from the latest SOA import.'
            );
        }

        const columns = Array.from(subjects.reduce((set, item) => {
            Object.keys(item || {}).forEach((key) => set.add(key));
            return set;
        }, new Set()));

        return `
            <article class="soa-section-card">
                <h3>Registered subjects</h3>
                <p>Subject rows imported from the saved SOA data.</p>
                ${renderTable(
                    columns.map(prettyLabel),
                    subjects.map((item) => columns.map((column) => item[column] || '—'))
                )}
            </article>
        `;
    }

    function renderTimetable() {
        const timetable = Array.isArray(currentData.timetable) ? currentData.timetable : [];

        if (!timetable.length) {
            return renderRawSection(
                'timetable',
                'Class timetable',
                'Timetable data captured from the latest SOA import.'
            );
        }

        const firstRow = timetable[0];
        if (Array.isArray(firstRow)) {
            const width = Math.max(...timetable.map((row) => Array.isArray(row) ? row.length : 0), 0);
            const headers = Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
            return `
                <article class="soa-section-card">
                    <h3>Class timetable</h3>
                    <p>Timetable rows imported from the saved SOA data.</p>
                    ${renderTable(
                        headers,
                        timetable.map((row) => Array.from({ length: width }, (_, index) => row[index] || '—'))
                    )}
                </article>
            `;
        }

        const columns = Array.from(timetable.reduce((set, item) => {
            Object.keys(item || {}).forEach((key) => set.add(key));
            return set;
        }, new Set()));

        return `
            <article class="soa-section-card">
                <h3>Class timetable</h3>
                <p>Timetable rows imported from the saved SOA data.</p>
                ${renderTable(
                    columns.map(prettyLabel),
                    timetable.map((item) => columns.map((column) => item[column] || '—'))
                )}
            </article>
        `;
    }

    function renderRawSection(sectionKey, title, copy) {
        const section = getRawSection(sectionKey);
        if (!section) {
            return `
                <article class="soa-section-card">
                    <h3>${escapeHtml(title)}</h3>
                    <p class="soa-muted">No data is available in this section yet.</p>
                </article>
            `;
        }

        const fieldEntries = Object.entries(section.fields || {}).filter(([, value]) => value);
        const fieldGrid = fieldEntries.length
            ? `
                <div class="soa-field-grid" style="margin-top: 1rem;">
                    ${fieldEntries.map(([label, value]) => `
                        <div class="soa-field">
                            <span class="soa-field-label">${escapeHtml(label)}</span>
                            <span class="soa-field-value">${escapeHtml(value)}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : '';

        const tableBlocks = Array.isArray(section.tables)
            ? section.tables.filter((table) => Array.isArray(table.rows) && table.rows.length).map((table, index) => {
                const headers = Array.isArray(table.headers) && table.headers.length
                    ? table.headers
                    : Array.from({ length: Math.max(...table.rows.map((row) => row.length), 0) }, (_, headerIndex) => `Column ${headerIndex + 1}`);

                return `
                    <div style="margin-top: 1rem;">
                        ${table.title ? `<h3 style="margin-bottom: 0.75rem;">${escapeHtml(table.title)}</h3>` : index > 0 ? `<h3 style="margin-bottom: 0.75rem;">Table ${index + 1}</h3>` : ''}
                        ${renderTable(
                            headers.map(prettyLabel),
                            table.rows.map((row) => headers.map((_, cellIndex) => row[cellIndex] || '—'))
                        )}
                    </div>
                `;
            }).join('')
            : '';

        if (!fieldEntries.length && !tableBlocks) {
            return `
                <article class="soa-section-card">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(copy)}</p>
                    <p class="soa-muted" style="margin-top: 1rem;">The latest SOA page was captured, but it did not contain structured rows or visible field values.</p>
                </article>
            `;
        }

        return `
            <article class="soa-section-card">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(copy)}</p>
                ${fieldGrid}
                ${tableBlocks}
            </article>
        `;
    }

    function renderTable(headers, rows) {
        return `
            <div class="soa-table-wrap">
                <table class="soa-table">
                    <thead>
                        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows.map((row) => `
                            <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function disconnectPortal() {
        if (!window.confirm('Disconnect the SOA portal? Your last imported data will remain available inside the app.')) {
            return;
        }

        try {
            const response = await APP.API.post('/soa/disconnect', {});
            currentConnection = response.connection || currentConnection;
            currentData = response.data || currentData;
            const user = APP.Storage.get('user') || {};
            user.portalConnected = false;
            user.isVerified = false;
            user.portalStatus = currentConnection;
            delete user.portalData;
            APP.Storage.set('user', user);
            render();
            if (typeof Toast !== 'undefined') {
                Toast.success('SOA portal disconnected.');
            }
        } catch (error) {
            if (typeof Toast !== 'undefined') {
                Toast.error(error.message || 'Failed to disconnect SOA portal.');
            }
        }
    }

    function normalizeLocalPortalData(source) {
        if (!source) return null;
        if (source.personalInfo && source.contactInfo && source.attendance && source.marks) {
            return source;
        }

        const profile = source.profile || {};
        const attendanceRows = Array.isArray(source.attendance) ? source.attendance : [];
        const marksRows = Array.isArray(source.marks) ? source.marks : [];
        const attendanceSummary = attendanceRows.map((row) => {
            const present = toNumber(row.present_count || row.attended || row.present || row.attended_classes);
            const total = toNumber(row.total_classes || row.total || row.total_classes_held);
            return {
                subject: row.subject || '—',
                subject_code: row.subject_code || row.subjectCode || '—',
                present_count: present,
                total_classes: total,
                percentage: row.percentage != null
                    ? toNumber(row.percentage)
                    : (present !== null && total ? Number(((present / total) * 100).toFixed(2)) : null)
            };
        });
        const attendanceOverall = attendanceSummary.reduce((acc, row) => {
            acc.present += Number(row.present_count || 0);
            acc.total += Number(row.total_classes || 0);
            return acc;
        }, { present: 0, total: 0 });

        const marksRecords = marksRows.map((row) => ({
            subject: row.subject || '—',
            subjectCode: row.subject_code || row.subjectCode || null,
            examType: row.exam_type || row.examType || row.exam || null,
            marksObtained: toNumber(row.marks_obtained || row.marks || row.score),
            totalMarks: toNumber(row.total_marks || row.totalMarks || row.max_marks),
            grade: row.grade || null,
            publishedAt: row.exam_date || row.publishedAt || null
        }));

        const marksSummary = marksRecords.map((row) => ({
            subject: row.subject,
            subject_code: row.subjectCode,
            avg_marks: row.marksObtained,
            avg_total: row.totalMarks,
            exam_type: row.examType
        }));

        const validPercentages = marksSummary
            .filter((row) => row.avg_marks && row.avg_total)
            .map((row) => (Number(row.avg_marks) / Number(row.avg_total)) * 10);

        return {
            dataSource: source.dataSource || 'demo',
            profile: {
                studentName: profile.studentName || profile.name || 'Demo Student',
                registrationNumber: profile.registrationNumber || profile.registration_number || null,
                enrollmentNumber: profile.enrollmentNumber || profile.enrollment_number || null,
                program: profile.program || profile.department || null,
                branch: profile.branch || profile.department || null,
                semester: profile.semester || null,
                section: profile.section || null,
                dateOfBirth: profile.dateOfBirth || profile.dob || null,
                bloodGroup: profile.bloodGroup || profile.blood_group || null,
                gender: profile.gender || null,
                nationality: profile.nationality || null,
                category: profile.category || null,
                fatherName: profile.fatherName || profile.father_name || null,
                motherName: profile.motherName || profile.mother_name || null,
                permanentAddress: profile.address || null,
                phone: profile.phone || null,
                email: profile.email || null,
                hostelName: profile.hostel || null,
                photoUrl: profile.photoUrl || profile.photo_url || null
            },
            personalInfo: {
                studentName: profile.studentName || profile.name || 'Demo Student',
                registrationNumber: profile.registrationNumber || profile.registration_number || null,
                enrollmentNumber: profile.enrollmentNumber || profile.enrollment_number || null,
                program: profile.program || profile.department || null,
                branch: profile.branch || profile.department || null,
                semester: profile.semester || null,
                section: profile.section || null,
                dateOfBirth: profile.dateOfBirth || profile.dob || null,
                bloodGroup: profile.bloodGroup || profile.blood_group || null,
                gender: profile.gender || null,
                nationality: profile.nationality || null,
                category: profile.category || null,
                fatherName: profile.fatherName || profile.father_name || null,
                motherName: profile.motherName || profile.mother_name || null,
                hostelName: profile.hostel || null
            },
            contactInfo: {
                email: profile.email || null,
                phone: profile.phone || null,
                permanentAddress: profile.address || null
            },
            qualifications: Array.isArray(source.qualifications) ? source.qualifications : [],
            attendance: {
                records: attendanceSummary,
                summary: attendanceSummary,
                overall: {
                    presentClasses: attendanceOverall.present,
                    totalClasses: attendanceOverall.total,
                    percentage: attendanceOverall.total
                        ? Number(((attendanceOverall.present / attendanceOverall.total) * 100).toFixed(2))
                        : null
                }
            },
            marks: {
                records: marksRecords,
                summary: marksSummary,
                cgpa: validPercentages.length
                    ? Number((validPercentages.reduce((sum, value) => sum + value, 0) / validPercentages.length).toFixed(2))
                    : null
            },
            results: marksRecords,
            notifications: Array.isArray(source.notifications) ? source.notifications : [],
            timetable: Array.isArray(source.timetable) ? source.timetable : [],
            subjects: Array.isArray(source.subjects) ? source.subjects : (Array.isArray(source.courses) ? source.courses : [])
        };
    }

    function buildLocalConnection(user, data) {
        return {
            connected: Boolean(user.portalConnected),
            isVerified: Boolean(user.isVerified),
            portalProvider: user.portalProvider || (data?.dataSource === 'demo' ? null : 'soa'),
            lastSynced: user.portal_last_synced || null,
            hasImportedData: Boolean(data),
            needsReconnect: false,
            dataSource: data?.dataSource || 'demo',
            profileSummary: {
                studentName: data?.profile?.studentName || 'Student',
                registrationNumber: data?.profile?.registrationNumber || null,
                branch: data?.profile?.branch || null,
                semester: data?.profile?.semester || null
            }
        };
    }

    function shouldUseLocalPortalFallback(user, localData, serverConnection, localConnection, requestFailed) {
        if (!localData) return false;

        const localDataSource = localData.dataSource || localConnection?.dataSource || user?.dataSource || 'demo';
        const hasLiveMetadata = hasLivePortalMetadata(serverConnection) || hasLivePortalMetadata(localConnection) || Boolean(
            user?.portalProvider === 'soa' ||
            user?.portalConnected ||
            user?.portal_last_synced
        );

        if (localDataSource === 'demo') {
            // Only show demo data when there is no live SOA portal metadata anywhere
            return !hasLiveMetadata;
        }

        // Non-demo local data (real SOA import cached in localStorage):
        // always use it when the server has no data to show — covers request failures
        // AND the case where the server process restarted and its in-memory cache is gone.
        return true;
    }

    function hasLivePortalMetadata(connection) {
        if (!connection) return false;

        return Boolean(
            connection.portalProvider === 'soa' ||
            connection.connected ||
            connection.lastSynced ||
            connection.needsReconnect ||
            (connection.hasImportedData && connection.dataSource !== 'demo')
        );
    }

    function clearStoredPortalData() {
        const user = APP.Storage.get('user');
        if (!user || !user.portalData) return;
        delete user.portalData;
        APP.Storage.set('user', user);
    }

    function getRawSection(sectionKey) {
        return currentData?.raw?.sections?.[sectionKey] || null;
    }

    function hasSubjectData() {
        return Boolean(
            (Array.isArray(currentData?.subjects) && currentData.subjects.length) ||
            getRawSection('subjects')
        );
    }

    function hasTimetableData() {
        return Boolean(
            (Array.isArray(currentData?.timetable) && currentData.timetable.length) ||
            getRawSection('timetable')
        );
    }

    function hasMeaningfulData(data) {
        if (!data || typeof data !== 'object') return false;

        return Boolean(
            data.profile?.studentName ||
            data.profile?.registrationNumber ||
            data.profile?.enrollmentNumber ||
            data.profile?.branch ||
            data.profile?.program ||
            (Array.isArray(data.qualifications) && data.qualifications.length) ||
            (Array.isArray(data.attendance?.records) && data.attendance.records.length) ||
            (Array.isArray(data.marks?.records) && data.marks.records.length) ||
            (data.raw?.sections && Object.keys(data.raw.sections).length)
        );
    }

    function toNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
        return Number.isFinite(numeric) ? numeric : null;
    }

    function prettyLabel(key) {
        return String(key || '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^./, (match) => match.toUpperCase());
    }

    function formatDateTime(value) {
        if (!value) return 'Not synced yet';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function escapeHtml(value) {
        return APP.sanitize ? APP.sanitize(String(value || '')) : String(value || '');
    }

    function hideElement(element) {
        if (element) element.style.display = 'none';
    }

    function showElement(element) {
        if (element) element.style.display = '';
    }

    function toggleVisibility(element, visible) {
        if (!element) return;
        element.style.display = visible ? '' : 'none';
    }
})();
