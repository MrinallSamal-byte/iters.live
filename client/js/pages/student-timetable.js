(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let timetableState = null;

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof NavLoader !== 'undefined') {
            await NavLoader.load('student', 'timetable');
        }

        await loadTimetable();
    });

    async function loadTimetable() {
        let serverData = null;

        try {
            const response = await APP.API.get('/soa/me');
            serverData = response?.data || null;
        } catch (error) {
            console.error('Failed to load timetable from server:', error);
        }

        // Fall back to locally-cached portal data when the server has no data
        // (covers server restart + in-memory cache eviction before SQL was populated).
        if (!serverData && !buildTimetableModel(serverData)) {
            const user = APP.Storage.get('user') || {};
            const localPortalData = user.portalData || null;
            if (localPortalData && (localPortalData.timetable || localPortalData.raw?.sections?.timetable)) {
                serverData = localPortalData;
            }
        }

        const data = serverData;
        const model = buildTimetableModel(data);

        if (!model) {
            showEmptyTimetable('No imported timetable is saved for this account yet.');
            return;
        }

        timetableState = {
            model,
            profile: data?.profile || {}
        };

        renderTimetableTable(model);
        renderTodaySchedule(model);
        updateStats(model);
    }

    function buildTimetableModel(data) {
        const rawSection = data?.raw?.sections?.timetable || null;
        const rawTable = Array.isArray(rawSection?.tables)
            ? rawSection.tables.find((table) => Array.isArray(table.rows) && table.rows.length)
            : null;

        if (rawTable) {
            const headers = Array.isArray(rawTable.headers) && rawTable.headers.length
                ? rawTable.headers.map((header) => String(header || '').trim())
                : Array.from({ length: Math.max(...rawTable.rows.map((row) => Array.isArray(row) ? row.length : 0), 0) }, (_, index) => `Column ${index + 1}`);
            const rows = rawTable.rows
                .filter((row) => Array.isArray(row) && row.some((cell) => hasText(cell)))
                .map((row) => headers.map((_, index) => String(row[index] || '').trim()));

            if (rows.length) {
                return { headers, rows, source: 'raw_section' };
            }
        }

        const timetable = Array.isArray(data?.timetable) ? data.timetable : [];
        if (!timetable.length) {
            return null;
        }

        if (Array.isArray(timetable[0])) {
            const width = Math.max(...timetable.map((row) => Array.isArray(row) ? row.length : 0), 0);
            return {
                headers: Array.from({ length: width }, (_, index) => `Column ${index + 1}`),
                rows: timetable.map((row) => Array.from({ length: width }, (_, index) => String((row || [])[index] || '').trim())),
                source: 'normalized_rows'
            };
        }

        const headers = Array.from(timetable.reduce((set, row) => {
            Object.keys(row || {}).forEach((key) => set.add(key));
            return set;
        }, new Set()));

        if (!headers.length) {
            return null;
        }

        return {
            headers,
            rows: timetable.map((row) => headers.map((header) => String(row?.[header] || '').trim())),
            source: 'normalized_objects'
        };
    }

    function renderTimetableTable(model) {
        const table = document.getElementById('timetableTable');
        if (!table) return;

        const currentDay = DAY_NAMES[new Date().getDay()];
        const currentDayIndex = findDayIndex(model.headers, currentDay);

        table.innerHTML = `
            <thead>
                <tr>
                    ${model.headers.map((header, index) => `
                        <th class="${index === currentDayIndex ? 'day-column' : ''}">
                            ${escapeHtml(header)}
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${model.rows.map((row) => `
                    <tr>
                        ${row.map((cell, index) => renderTableCell(cell, index === currentDayIndex)).join('')}
                    </tr>
                `).join('')}
            </tbody>
        `;
    }

    function renderTableCell(value, isTodayColumn) {
        const text = String(value || '').trim();
        const baseClass = isTodayColumn ? ' class-cell current-day-cell' : 'class-cell';

        if (!hasText(text)) {
            return '<td>-</td>';
        }

        if (/^(-|break|lunch|free)$/i.test(text)) {
            return `<td>${escapeHtml(text)}</td>`;
        }

        return `<td class="${baseClass}">${escapeHtml(text)}</td>`;
    }

    function renderTodaySchedule(model) {
        const todaySchedule = document.getElementById('todaySchedule');
        const todayDate = document.getElementById('todayDate');
        const currentClassName = document.getElementById('currentClassName');
        if (!todaySchedule) return;

        const today = DAY_NAMES[new Date().getDay()];
        if (todayDate) {
            todayDate.textContent = new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }

        const entries = extractTodayEntries(model, today);
        if (!entries.length) {
            todaySchedule.innerHTML = '<div class="schedule-item"><div>No saved classes are available for today.</div></div>';
            if (currentClassName) {
                currentClassName.textContent = 'No class now';
            }
            return;
        }

        const now = Date.now();
        const activeEntry = entries.find((entry) => entry.startTime && entry.endTime && now >= entry.startTime && now <= entry.endTime);
        const nextEntry = entries.find((entry) => entry.startTime && entry.startTime > now);
        if (currentClassName) {
            currentClassName.textContent = activeEntry?.subject || nextEntry?.subject || 'No class now';
        }

        todaySchedule.innerHTML = entries.map((entry) => `
            <div class="schedule-item">
                <div style="min-width: 140px;">
                    <strong>${escapeHtml(entry.timeLabel || 'Saved slot')}</strong>
                </div>
                <div style="flex: 1;">
                    <div class="class-name">${escapeHtml(entry.subject || 'Saved class')}</div>
                    <div class="class-room">${escapeHtml(entry.details || entry.rawText)}</div>
                </div>
            </div>
        `).join('');
    }

    function updateStats(model) {
        const today = DAY_NAMES[new Date().getDay()];
        const todayEntries = extractTodayEntries(model, today);
        const allEntries = extractAllEntries(model);
        const uniqueSubjects = new Set(allEntries.map((entry) => entry.subjectCode || entry.subject).filter(Boolean));
        const now = Date.now();
        const nextEntry = todayEntries.find((entry) => entry.startTime && entry.startTime > now);

        setText('todayClasses', String(todayEntries.length));
        setText('weeklyClasses', String(allEntries.length));
        setText('totalSubjects', String(uniqueSubjects.size));
        setText('nextClassTime', nextEntry?.timeLabel || '--');
    }

    function extractAllEntries(model) {
        const entries = [];
        model.headers.forEach((header, index) => {
            if (findDayIndex(model.headers, header) !== index) {
                return;
            }

            model.rows.forEach((row) => {
                const entry = parseTimetableCell(row[index]);
                if (entry) {
                    entries.push(entry);
                }
            });
        });

        if (entries.length) {
            return entries;
        }

        return model.rows
            .flatMap((row) => row.map((cell) => parseTimetableCell(cell)))
            .filter(Boolean);
    }

    function extractTodayEntries(model, today) {
        const headerDayIndex = findDayIndex(model.headers, today);
        if (headerDayIndex !== -1) {
            return model.rows
                .map((row) => parseTimetableCell(row[headerDayIndex]))
                .filter(Boolean);
        }

        const rowForToday = model.rows.find((row) => normalizeLabel(row[0]) === normalizeLabel(today));
        if (!rowForToday) {
            return [];
        }

        return rowForToday
            .slice(1)
            .map((cell, index) => parseTimetableCell(cell, model.headers[index + 1]))
            .filter(Boolean);
    }

    function parseTimetableCell(text, labelHint) {
        const rawText = String(text || '').replace(/\s+/g, ' ').trim();
        if (!hasText(rawText) || /^(-|break|lunch|free)$/i.test(rawText)) {
            return null;
        }

        const timeMatch = rawText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        const subjectCodeMatch = rawText.match(/\b[A-Z]{2,}\d{3,}[A-Z]?\b/);
        const roomMatch = rawText.match(/\b[A-Z]-\d+(?:\/[A-Z ]+)?\b|\bCLASS ROOM\b|\bLAB\b/i);
        const timeLabel = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : (labelHint || null);
        const startTime = timeMatch ? parseTodayTime(timeMatch[1]) : null;
        const endTime = timeMatch ? parseTodayTime(timeMatch[2]) : null;
        const withoutTime = timeMatch ? rawText.replace(timeMatch[0], '').trim() : rawText;
        const subject = subjectCodeMatch ? subjectCodeMatch[0] : withoutTime.slice(0, 80);

        return {
            rawText,
            timeLabel,
            startTime,
            endTime,
            subject,
            subjectCode: subjectCodeMatch ? subjectCodeMatch[0] : null,
            details: roomMatch ? `${withoutTime} | ${roomMatch[0]}` : withoutTime
        };
    }

    function parseTodayTime(value) {
        const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return null;

        let hours = Number(match[1]);
        const minutes = Number(match[2]);
        const meridian = (match[3] || '').toUpperCase();

        if (meridian === 'PM' && hours < 12) {
            hours += 12;
        } else if (meridian === 'AM' && hours === 12) {
            hours = 0;
        }

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date.getTime();
    }

    function showEmptyTimetable(message) {
        const table = document.getElementById('timetableTable');
        if (table) {
            table.innerHTML = `
                <tbody>
                    <tr><td style="text-align:center; padding:3rem;">${escapeHtml(message)}</td></tr>
                </tbody>
            `;
        }

        const todaySchedule = document.getElementById('todaySchedule');
        if (todaySchedule) {
            todaySchedule.innerHTML = `<div class="schedule-item"><div>${escapeHtml(message)}</div></div>`;
        }

        setText('todayClasses', '--');
        setText('nextClassTime', '--');
        setText('weeklyClasses', '--');
        setText('totalSubjects', '--');
        setText('currentClassName', 'No class now');
    }

    function findDayIndex(headers, dayName) {
        return headers.findIndex((header) => normalizeLabel(header) === normalizeLabel(dayName));
    }

    function normalizeLabel(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }

    function hasText(value) {
        return Boolean(String(value || '').trim());
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

    window.downloadTimetable = function downloadTimetable() {
        const table = document.getElementById('timetableTable');
        if (!table || !timetableState) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('No saved timetable is available to download.', 'Unavailable');
            }
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Saved Timetable Snapshot</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
                    th { background: #f4f4f4; }
                </style>
            </head>
            <body>
                <h1>Saved SOA Timetable Snapshot</h1>
                <p>Generated from the latest imported SOA data.</p>
                ${table.outerHTML}
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'saved-soa-timetable.html';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    window.syncToCalendar = function syncToCalendar() {
        if (typeof Toast !== 'undefined') {
            Toast.info('Calendar sync is not available yet. Use the saved timetable download for now.', 'Not Implemented');
        }
    };
})();
