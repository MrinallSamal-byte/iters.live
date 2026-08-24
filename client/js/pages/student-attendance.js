(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const user = APP.Storage.get('user') || {};
    let attendanceChart = null;
    let lastBunkSummary = null;

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof NavLoader !== 'undefined') {
            await NavLoader.load('student', 'attendance');
        }

        if (typeof ParticleSystem !== 'undefined' && document.getElementById('particleCanvas')) {
            new ParticleSystem('particleCanvas', {
                particleCount: 50,
                particleColor: 'rgba(99, 102, 241, 0.5)',
                speed: 0.3
            });
        }

        const breakdownToggle = document.getElementById('bunkBreakdownToggle');
        const breakdownWrap = document.getElementById('bunkBreakdownWrap');
        if (breakdownToggle && breakdownWrap) {
            breakdownToggle.addEventListener('click', () => {
                const expanded = breakdownToggle.getAttribute('aria-expanded') === 'true';
                breakdownToggle.setAttribute('aria-expanded', String(!expanded));
                breakdownWrap.hidden = expanded;
                breakdownToggle.textContent = expanded ? 'SHOW PER-SUBJECT BREAKDOWN' : 'HIDE PER-SUBJECT BREAKDOWN';
            });
        }

        const thresholdSelect = document.getElementById('bunkThreshold');
        if (thresholdSelect) {
            thresholdSelect.addEventListener('change', () => {
                renderBunkBudget(lastBunkSummary, Number(thresholdSelect.value) || 75);
            });
        }

        await loadAttendanceData();
    });

    function offlineCacheReady() {
        try {
            return Boolean(window.APP && window.APP.OfflineCache && window.APP.OfflineCache.available && window.APP.OfflineCache.available());
        } catch (_) {
            return false;
        }
    }

    async function offlineCachePut(key, value) {
        if (!offlineCacheReady()) return;
        try {
            await window.APP.OfflineCache.put(key, value);
            await window.APP.OfflineCache.setStamp(key, new Date().toISOString());
        } catch (_) { }
    }

    async function offlineCacheGet(key) {
        if (!offlineCacheReady()) return null;
        try {
            return await window.APP.OfflineCache.get(key);
        } catch (_) {
            return null;
        }
    }

    async function offlineCacheStamp(key) {
        if (!offlineCacheReady()) return null;
        try {
            return await window.APP.OfflineCache.getStamp(key);
        } catch (_) {
            return null;
        }
    }

    async function showCachedBadge() {
        const hero = document.querySelector('.page-hero .hero-content-inline > div');
        if (!hero || document.getElementById('attendanceCacheBadge')) return;
        const stamp = await offlineCacheStamp('attendance');
        const badge = document.createElement('div');
        badge.id = 'attendanceCacheBadge';
        badge.className = 'cache-badge';
        badge.textContent = formatStampLabel(stamp);
        hero.appendChild(badge);
    }

    function formatStampLabel(stamp) {
        const date = typeof stamp === 'string' && stamp ? new Date(stamp) : null;
        if (!date || Number.isNaN(date.getTime())) return 'CACHED';
        const pad = (value) => String(value).padStart(2, '0');
        return `CACHED \u00b7 SYNCED ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function reconnectCtaHtml() {
        return '<a class="reconnect-cta" href="/connect-portal.html">RECONNECT SOA PORTAL</a>';
    }

    function isLightTheme() {
        return document.body.classList.contains('light-theme');
    }

    function chartTextColor() {
        return isLightTheme() ? '#1d1d20' : '#f6f3ee';
    }

    async function loadAttendanceData() {
        const studentId = user.id || user.registration_number;

        if (!studentId) {
            showEmptyAttendance('Student account details are incomplete. Log in again and retry.');
            return;
        }

        try {
            const response = await APP.API.get(`/attendance/student/${encodeURIComponent(studentId)}`);
            if (response?.success && Array.isArray(response.data?.summary) && response.data.summary.length) {
                await offlineCachePut('attendance', response.data);
                displayAttendance(response.data);
                return;
            }

            showEmptyAttendance('No imported attendance is saved for this account yet.');
        } catch (error) {
            console.error('Failed to load attendance:', error);
            const cachedSnapshot = await offlineCacheGet('attendance');
            if (cachedSnapshot && Array.isArray(cachedSnapshot.summary) && cachedSnapshot.summary.length) {
                await showCachedBadge();
                displayAttendance(cachedSnapshot);
                return;
            }
            showEmptyAttendance('Attendance could not be loaded. Reconnect your SOA portal and try again.');
            if (typeof Toast !== 'undefined') {
                Toast.error(error.message || 'Failed to load attendance data', 'Error');
            }
        }
    }

    function showEmptyAttendance(message) {
        setText('overallAttendance', '--');
        setText('totalClasses', '--');
        setText('presentClasses', '--');
        setText('absentClasses', '--');

        const warningEl = document.getElementById('lowAttendanceWarning');
        if (warningEl) {
            warningEl.innerHTML = `${escapeHtml(message)}<br>${reconnectCtaHtml()}`;
        }
        setText('weeklyAttendance', 'No saved attendance snapshot is available.');

        const tbody = document.getElementById('attendanceTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${escapeHtml(message)}<div class="reconnect-cta-wrap">${reconnectCtaHtml()}</div></td></tr>`;
        }

        setBunkBudgetLine(null);
        lastBunkSummary = null;

        const bunkBody = document.getElementById('bunkTableBody');
        if (bunkBody) {
            bunkBody.innerHTML = '';
        }

        if (attendanceChart) {
            attendanceChart.destroy();
            attendanceChart = null;
        }
    }

    function displayAttendance(data) {
        const summary = Array.isArray(data?.summary) ? data.summary : [];
        if (!summary.length) {
            showEmptyAttendance('No imported attendance is saved for this account yet.');
            return;
        }

        let totalPresent = 0;
        let totalClasses = 0;
        summary.forEach((subject) => {
            totalPresent += Number(subject.present_count || 0);
            totalClasses += Number(subject.total_classes || 0);
        });

        const overallPercentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;
        const absentClasses = Math.max(totalClasses - totalPresent, 0);

        setText('overallAttendance', `${overallPercentage}%`);
        setText('totalClasses', String(totalClasses));
        setText('presentClasses', String(totalPresent));
        setText('absentClasses', String(absentClasses));

        renderAttendanceChart(totalPresent, absentClasses);
        renderAttendanceTable(summary);
        renderBunkBudget(summary);

        const lowAttendance = summary.filter((subject) => {
            const total = Number(subject.total_classes || 0);
            const present = Number(subject.present_count || 0);
            return total > 0 && ((present / total) * 100) < 75;
        });

        setText(
            'lowAttendanceWarning',
            lowAttendance.length
                ? `${lowAttendance.length} subject(s) are below 75% attendance.`
                : 'All imported subjects currently meet the 75% attendance target.'
        );
        setText('weeklyAttendance', `Latest imported overall attendance: ${overallPercentage}%`);
    }

    function renderAttendanceChart(totalPresent, absentClasses) {
        const canvas = document.getElementById('attendanceChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (attendanceChart) {
            attendanceChart.destroy();
        }

        attendanceChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [totalPresent, absentClasses],
                    backgroundColor: ['#22c55e', '#ef4444'],
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
                            font: { size: 14 }
                        }
                    }
                }
            }
        });
    }

    async function renderBunkBudget(summary, threshold = 75) {
        lastBunkSummary = Array.isArray(summary) ? summary : null;
        let rows = null;

        try {
            const response = await APP.API.get(`/attendance/bunk-plan?threshold=${encodeURIComponent(threshold)}`);
            if (response?.success && Array.isArray(response.subjects) && response.subjects.length) {
                rows = response.subjects.map((subject) => normalizeBunkRow(subject, Number(response.threshold) || threshold));
            }
        } catch (_) { }

        if (!rows || !rows.length) {
            rows = computeBunkRowsFromSummary(summary, threshold);
        }

        setBunkBudgetLine(bunkOverallLine(rows, threshold));
        renderBunkTable(rows);
    }

    function normalizeBunkRow(subject, threshold) {
        const attended = Number(subject.attended != null ? subject.attended : subject.present_count) || 0;
        const total = Number(subject.total != null ? subject.total : subject.total_classes) || 0;
        const percentage = subject.percentage != null
            ? Number(subject.percentage)
            : (total > 0 ? (attended / total) * 100 : 0);
        const canMissRaw = Number(subject.canMiss);
        return {
            subject: subject.subject || subject.subject_code || 'Unknown',
            attended,
            total,
            percentage,
            canMiss: Number.isNaN(canMissRaw) ? null : canMissRaw,
            recoverNeeded: Math.max(0, Math.ceil(Number(subject.recoverNeeded) || 0)),
            below: total > 0 && percentage < threshold
        };
    }

    function computeBunkRowsFromSummary(summary, threshold) {
        const fraction = threshold / 100;
        return (Array.isArray(summary) ? summary : []).map((subject) => {
            const attended = Number(subject.present_count || 0);
            const total = Number(subject.total_classes || 0);
            const percentage = total > 0 ? (attended / total) * 100 : 0;
            let canMiss = null;
            let recoverNeeded = 0;

            if (total > 0 && attended / total >= fraction) {
                canMiss = Math.max(0, Math.floor(attended / fraction - total));
            } else if (total > 0) {
                recoverNeeded = Math.max(1, Math.ceil((fraction * total - attended) / (1 - fraction)));
            }

            return {
                subject: subject.subject || subject.subject_code || 'Unknown',
                attended,
                total,
                percentage,
                canMiss,
                recoverNeeded,
                below: recoverNeeded > 0
            };
        });
    }

    function bunkOverallLine(rows, threshold) {
        let minCanMiss = Infinity;
        let maxRecover = 0;
        rows.forEach((row) => {
            if (row.canMiss != null) minCanMiss = Math.min(minCanMiss, row.canMiss);
            maxRecover = Math.max(maxRecover, row.recoverNeeded);
            if (row.below) maxRecover = Math.max(maxRecover, 1);
        });
        return {
            threshold,
            below: maxRecover > 0,
            canMiss: Number.isFinite(minCanMiss) ? minCanMiss : null,
            recover: maxRecover
        };
    }

    function setBunkBudgetLine(plan) {
        const el = document.getElementById('bunkBudgetLine');
        if (!el) return;

        if (!plan) {
            el.textContent = '';
            el.classList.remove('below');
            return;
        }

        el.classList.toggle('below', plan.below);
        if (plan.below && plan.recover > 0) {
            el.textContent = `ATTEND ${plan.recover} MORE CLASSES TO RECOVER TO ${plan.threshold}%`;
        } else if (!plan.below && plan.canMiss != null) {
            el.textContent = `YOU CAN MISS ${plan.canMiss} MORE CLASSES AND STAY ABOVE ${plan.threshold}%`;
        } else {
            el.textContent = '';
        }
    }

    function renderBunkTable(rows) {
        const tbody = document.getElementById('bunkTableBody');
        if (!tbody) return;

        tbody.innerHTML = rows.map((row) => `
            <tr>
                <td>${escapeHtml(row.subject)}</td>
                <td>${row.attended}</td>
                <td><strong>${row.total > 0 ? row.percentage.toFixed(2) : '0.00'}%</strong></td>
                <td${row.below ? ' class="bunk-needs"' : ''}>${row.below ? `NEEDS ${row.recoverNeeded || 1}` : (row.canMiss != null ? row.canMiss : '-')}</td>
                <td>${row.recoverNeeded > 0 ? row.recoverNeeded : '-'}</td>
            </tr>
        `).join('');
    }

    function renderAttendanceTable(summary) {
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;

        tbody.innerHTML = summary.map((subject) => {
            const presentCount = Number(subject.present_count || 0);
            const totalCount = Number(subject.total_classes || 0);
            const percentage = subject.percentage != null
                ? Number(subject.percentage)
                : (totalCount > 0 ? Number(((presentCount / totalCount) * 100).toFixed(2)) : 0);
            const status = percentage >= 75 ? 'Good' : percentage >= 65 ? 'Warning' : 'Critical';
            const statusClass = percentage >= 75 ? 'status-good' : percentage >= 65 ? 'status-warning' : 'status-critical';

            return `
                <tr>
                    <td><strong>${escapeHtml(subject.subject_code || 'N/A')}</strong></td>
                    <td>${escapeHtml(subject.subject || 'Unknown')}</td>
                    <td>${presentCount}</td>
                    <td>${totalCount}</td>
                    <td><strong>${percentage.toFixed(2)}%</strong></td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                </tr>
            `;
        }).join('');

        attachAttendanceCsvExport(summary);
    }

    function attachAttendanceCsvExport(summary) {
        const headerEl = document.querySelector('#attendanceTableBody')?.closest('.table-responsive')?.previousElementSibling;
        if (!summary.length || !headerEl || !headerEl.classList.contains('section-header-formal') || document.getElementById('exportAttendanceCsv')) return;

        const btn = document.createElement('button');
        btn.id = 'exportAttendanceCsv';
        btn.type = 'button';
        btn.textContent = 'EXPORT CSV';
        btn.style.cssText = 'background:transparent;border:1px solid var(--border-color,rgba(128,128,128,0.35));color:inherit;font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;padding:0.4rem 0.7rem;border-radius:0;cursor:pointer;';
        btn.addEventListener('click', () => {
            const rows = [['Subject Code', 'Subject Name', 'Present', 'Total Classes', 'Percentage']];
            summary.forEach((s) => rows.push([s.subject_code || '', s.subject || '', Number(s.present_count || 0), Number(s.total_classes || 0), (Number(s.present_count || 0) / Math.max(Number(s.total_classes || 0), 1) * 100).toFixed(2)]));
            const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'attendance.csv';
            link.click();
            URL.revokeObjectURL(url);
        });
        headerEl.appendChild(btn);
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
