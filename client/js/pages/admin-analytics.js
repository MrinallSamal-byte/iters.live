// Admin Analytics Page JavaScript
console.log('Admin Analytics Page Loaded');

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
});

async function loadAnalytics() {
    let res;
    try {
        res = await APP.API.get('/admin/stats');
    } catch (e) {
        console.error('Error loading admin stats:', e);
        renderStatsError(e);
        return;
    }
    if (!res?.data) { renderStatsError(new Error('Empty response')); return; }

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
        catch (e) {
            console.error('Error loading activity log:', e);
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">ACTIVITY UNAVAILABLE</td></tr>';
            return;
        }
        const items = logRes?.data || [];
        body.innerHTML = items.map(l => `
            <tr>
                <td>${l.created_at || l.timestamp ? new Date(l.created_at || l.timestamp).toLocaleString() : '--'}</td>
                <td>${escapeHtml(l.user_name)}</td>
                <td><span class="badge primary">${escapeHtml(l.action)}</span></td>
                <td>${escapeHtml(l.details || '--')}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">NO ACTIVITY RECORDED</td></tr>';
    }
}

function renderStatsError(error) {
    ['totalFiles','totalAssignments','totalEvents'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });
    const avg = document.getElementById('avgAttendance');
    if (avg) avg.textContent = '--';

    const userCtx = document.getElementById('userChart');
    if (userCtx) userCtx.outerHTML = `<p style="text-align:center; padding: 2rem; font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">STATS UNAVAILABLE — ${escapeHtml(error.message || 'request failed')}</p>`;
    const deptCtx = document.getElementById('deptChart');
    if (deptCtx) deptCtx.outerHTML = `<p style="text-align:center; padding: 2rem; font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">DEPARTMENT DATA UNAVAILABLE</p>`;
}

function escapeHtml(value) { // ponytail: tiny local escaper
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
