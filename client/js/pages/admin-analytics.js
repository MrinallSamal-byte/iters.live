// Admin Analytics Page JavaScript
console.log('Admin Analytics Page Loaded');

document.addEventListener('DOMContentLoaded', () => {
    seedPrototypeIfNeeded();
    loadAnalytics();
});

function seedPrototypeIfNeeded() {
    // ensure DummyData/prototype available
    if (!localStorage.getItem('accessToken')) {
        try { localStorage.setItem('accessToken', JSON.stringify('demo-token')); } catch(e) {}
    }
}

async function loadAnalytics() {
    let res;
    try {
        res = await APP.API.get('/admin/stats');
    } catch (e) {
        console.warn('Using dummy stats for admin analytics');
        res = DummyData?.getAdminStats?.();
    }
    if (!res?.data) return;

    const ids = ['totalFiles','totalAssignments','totalEvents','avgAttendance'];
    const map = {
        totalFiles: res.data.totalFiles,
        totalAssignments: res.data.totalAssignments,
        totalEvents: res.data.totalEvents,
        avgAttendance: res.data.avgAttendance + '%'
    };
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = map[id] ?? '--'; });

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#888';

    const userCtx = document.getElementById('userChart');
    if (userCtx && window.Chart) {
        const existingChart = Chart.getChart(userCtx);
        if (existingChart) existingChart.destroy();
        new Chart(userCtx, {
            type: 'doughnut',
            data: {
                labels: ['Students', 'Teachers', 'Admins'],
                datasets: [{ data: [res.data.totalStudents, res.data.totalTeachers, res.data.totalAdmins || 0],
                    backgroundColor: ['rgba(255,0,0,0.7)', 'rgba(0,230,118,0.7)', 'rgba(255,179,0,0.7)'],
                    borderWidth: 0 }]
            },
            options: {
                cutout: '65%',
                plugins: { legend: { labels: { color: textColor } } }
            }
        });
    }

    const deptCtx = document.getElementById('deptChart');
    if (deptCtx && window.Chart) {
        const existingChart = Chart.getChart(deptCtx);
        if (existingChart) existingChart.destroy();
        new Chart(deptCtx, {
            type: 'bar',
            data: {
                labels: (res.data.departments||[]).map(d=>d.name),
                datasets: [{ label: 'Students', data: (res.data.departments||[]).map(d=>d.count),
                    backgroundColor: 'rgba(255,0,0,0.65)', hoverBackgroundColor: '#FF0000',
                    borderRadius: 4 }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: textColor }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    x: { ticks: { color: textColor }, grid: { display: false } }
                }
            }
        });
    }

    // Activity log
    const body = document.getElementById('activityLogBody');
    if (body) {
        let logRes;
        try { logRes = await APP.API.get('/admin/activity-log?limit=20'); }
        catch { logRes = null; }
        // Generate demo activity log if API unavailable
        const items = logRes?.data || [
          { timestamp: new Date(Date.now() - 120000).toISOString(), user_name: 'Admin User', action: 'LOGIN', details: 'Logged in from Chrome' },
          { timestamp: new Date(Date.now() - 600000).toISOString(), user_name: 'Dr. Priya Verma', action: 'UPLOAD', details: 'Uploaded Data Structures notes' },
          { timestamp: new Date(Date.now() - 1800000).toISOString(), user_name: 'Admin User', action: 'APPROVE', details: 'Approved 3 study materials' },
          { timestamp: new Date(Date.now() - 3600000).toISOString(), user_name: 'Aarav Sharma', action: 'REGISTER', details: 'New student registration' },
          { timestamp: new Date(Date.now() - 7200000).toISOString(), user_name: 'System', action: 'BACKUP', details: 'Automatic database backup completed' },
        ];
        body.innerHTML = items.map(l => `
            <tr>
                <td>${new Date(l.timestamp).toLocaleString('en-IN')}</td>
                <td>${l.user_name}</td>
                <td><span class="badge">${l.action}</span></td>
                <td>${l.details || '--'}</td>
            </tr>
        `).join('') || '<tr><td colspan="4">No activity</td></tr>';
    }
}
