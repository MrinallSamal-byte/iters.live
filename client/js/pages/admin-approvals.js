// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('admin')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires admin role');
  }
})();

console.log('Admin Approvals Page Loaded');

document.addEventListener('DOMContentLoaded', () => {
    loadApprovals();
});

async function loadApprovals() {
    const tbody = document.getElementById('approvalsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading approval queue...</td></tr>';
    let items;
    try {
        const res = await APP.API.get('/admin/approvals');
        items = res?.data || [];
    } catch (err) {
        console.error('Error loading approvals:', err);
        tbody.innerHTML = `
            <tr><td colspan="7" class="loading-text">
                Failed to load approval queue${err?.message ? `: ${escapeHtml(err.message)}` : ''}
                <button class="btn btn-secondary btn-sm" onclick="loadApprovals()" style="margin-left: 0.75rem;">Retry</button>
            </td></tr>`;
        return;
    }

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em;">NO PENDING ITEMS</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const itemType = item.category || item.type || 'file';
        const typeClass = { note: 'primary', notes: 'primary', assignment: 'warning', assignments: 'warning', pyq: 'success', event: 'info', events: 'info', announcement: 'info', announcements: 'info' }[itemType] || 'primary';
        const priority = item.priority ? String(item.priority) : '';
        const priorityClass = priority === 'High' ? 'danger' : (priority === 'Medium' ? 'warning' : 'success');
        return `
        <tr data-id="${escapeHtml(String(item.id))}" data-type="${escapeHtml(itemType)}">
            <td><span class="badge ${typeClass}">${escapeHtml(itemType)}</span></td>
            <td>${escapeHtml(item.title || item.file_name || item.name || 'Untitled')}</td>
            <td>${escapeHtml(item.uploaded_by_name || item.uploaded_by || 'Unknown')}</td>
            <td>${escapeHtml(item.department || '--')}</td>
            <td>${item.created_at ? escapeHtml(new Date(item.created_at).toLocaleDateString()) : '--'}</td>
            <td>${priority ? `<span class="badge ${priorityClass}">${escapeHtml(priority)}</span>` : '--'}</td>
            <td class="action-btns">
                <button class="btn btn-success btn-sm" onclick="approveApproval('${escapeHtml(String(item.id))}')">✓ Approve</button>
                <button class="btn btn-danger btn-sm" onclick="rejectApproval('${escapeHtml(String(item.id))}')">✗ Reject</button>
                ${item.file_url ? `<a href="${escapeHtml(String(item.file_url))}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">View</a>` : ''}
            </td>
        </tr>
    `}).join('');
}

async function approveApproval(id) {
    const row = document.querySelector(`#approvalsTableBody tr[data-id="${CSS.escape(id)}"]`);
    const rollbackHtml = row ? row.outerHTML : null;
    if (row) {
        row.style.opacity = '0.45';
        row.querySelectorAll('button').forEach(b => b.disabled = true);
    }
    try {
        await APP.API.post(`/files/approve/${encodeURIComponent(id)}`, {});
        if (typeof showToast === 'function') showToast('Item approved', 'success');
        else if (window.Toast?.show) window.Toast.show({ type: 'success', message: 'Item approved' });
        if (row) row.remove();
        updateApprovalCount(-1);
    } catch (err) {
        console.error('Approve failed:', err);
        if (typeof showToast === 'function') showToast(`Approve failed: ${err.message || 'request failed'}`, 'error');
        else if (window.Toast?.show) window.Toast.show({ type: 'error', message: `Approve failed: ${err.message || 'request failed'}` });
        if (rollbackHtml && row) row.outerHTML = rollbackHtml;
    }
}

async function rejectApproval(id) {
    const row = document.querySelector(`#approvalsTableBody tr[data-id="${CSS.escape(id)}"]`);
    const rollbackHtml = row ? row.outerHTML : null;
    if (row) {
        row.style.opacity = '0.45';
        row.querySelectorAll('button').forEach(b => b.disabled = true);
    }
    try {
        await APP.API.post(`/admin/approvals/${encodeURIComponent(id)}/reject`, {});
        if (typeof showToast === 'function') showToast('Item rejected', 'success');
        else if (window.Toast?.show) window.Toast.show({ type: 'success', message: 'Item rejected' });
        if (row) row.remove();
        updateApprovalCount(-1);
    } catch (err) {
        console.error('Reject failed:', err);
        if (typeof showToast === 'function') showToast(`Reject failed: ${err.message || 'request failed'}`, 'error');
        else if (window.Toast?.show) window.Toast.show({ type: 'error', message: `Reject failed: ${err.message || 'request failed'}` });
        if (rollbackHtml && row) row.outerHTML = rollbackHtml;
    }
}

function updateApprovalCount(delta) {
    const badge = document.getElementById('approvalCount');
    if (!badge) return;
    const current = parseInt(badge.textContent, 10);
    if (!isNaN(current)) badge.textContent = Math.max(0, current + delta);
}

// File records carry `category` (note/assignment/pyq/...), so tabs map to category values
const APPROVAL_TAB_CATEGORIES = {
    all: null,
    notes: ['note', 'notes'],
    assignments: ['assignment', 'assignments'],
    events: ['event', 'events'],
    announcements: ['announcement', 'announcements']
};

function filterApprovals(filter) {
    const categories = APPROVAL_TAB_CATEGORIES[filter];
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === String(filter));
    });
    const tbody = document.getElementById('approvalsTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.style.display = !categories || categories.includes(row.dataset.type) ? '' : 'none';
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
