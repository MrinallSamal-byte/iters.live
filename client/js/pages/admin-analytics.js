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

    const userCtx = document.getElementById('userChart');
    if (userCtx && window.Chart) {
        new Chart(userCtx, {
            type: 'pie',
            data: {
                labels: ['Students', 'Teachers', 'Admins'],
                datasets: [{ data: [res.data.totalStudents, res.data.totalTeachers, res.data.totalAdmins || 0], backgroundColor: ['#6366f1','#22c55e','#f59e0b'] }]
            }
        });
    }

    const deptCtx = document.getElementById('deptChart');
    if (deptCtx && window.Chart) {
        new Chart(deptCtx, {
            type: 'bar',
            data: {
                labels: (res.data.departments||[]).map(d=>d.name),
                datasets: [{ label: 'Students', data: (res.data.departments||[]).map(d=>d.count), backgroundColor: '#6366f1' }]
            },
            options: { plugins: { legend: { display: false } } }
        });
    }

    // Activity log
    const body = document.getElementById('activityLogBody');
    if (body) {
        let logRes;
        try { logRes = await APP.API.get('/admin/activity-log?limit=20'); }
        catch { logRes = DummyData?.getAdminActivityLog?.(20); }
        const items = logRes?.data || [];
        body.innerHTML = items.map(l => `
            <tr>
                <td>${new Date(l.timestamp).toLocaleString()}</td>
                <td>${l.user_name}</td>
                <td><span class="badge primary">${l.action}</span></td>
                <td>${l.details || '--'}</td>
            </tr>
        `).join('') || '<tr><td colspan="4">No activity</td></tr>';
    }
}
