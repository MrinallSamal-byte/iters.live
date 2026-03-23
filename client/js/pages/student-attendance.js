(function () {
    'use strict';

    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        window.location.href = '/login.html';
        return;
    }

    const user = APP.Storage.get('user') || {};
    let attendanceChart = null;

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

        await loadAttendanceData();
    });

    async function loadAttendanceData() {
        const studentId = user.id || user.registration_number;

        if (!studentId) {
            showEmptyAttendance('Student account details are incomplete. Log in again and retry.');
            return;
        }

        try {
            const response = await APP.API.get(`/attendance/student/${encodeURIComponent(studentId)}`);
            if (response?.success && Array.isArray(response.data?.summary) && response.data.summary.length) {
                displayAttendance(response.data);
                return;
            }

            showEmptyAttendance('No imported attendance is saved for this account yet.');
        } catch (error) {
            console.error('Failed to load attendance:', error);
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
        setText('lowAttendanceWarning', message);
        setText('weeklyAttendance', 'No saved attendance snapshot is available.');

        const tbody = document.getElementById('attendanceTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${escapeHtml(message)}</td></tr>`;
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
                            color: '#fff',
                            font: { size: 14 }
                        }
                    }
                }
            }
        });
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
