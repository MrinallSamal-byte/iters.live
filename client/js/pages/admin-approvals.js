// Admin Approvals page: pending queue, approve/reject, filters and recent approvals
(function () {
    'use strict';

    let approvals = [];
    let recentApprovals = [];
    let activeFilter = 'all';
    let usingDemoData = false;

    const FILTER_TYPES = {
        notes: ['notes', 'note', 'pyq', 'pyqs', 'question_paper'],
        assignments: ['assignment', 'assignments'],
        events: ['event', 'events'],
        announcements: ['announcement', 'announcements']
    };

    document.addEventListener('DOMContentLoaded', () => {
        const tbody = document.getElementById('approvalsTableBody');
        if (tbody) {
            tbody.addEventListener('click', onTableClick);
        }
        loadApprovals();
        loadRecentApprovals();
    });

    async function loadApprovals() {
        let res;
        try {
            res = await APP.API.get('/admin/approvals');
            usingDemoData = false;
        } catch (error) {
            res = window.DummyData?.getAdminApprovals?.();
            usingDemoData = Boolean(res);
        }

        approvals = (res?.data || []).map(normalizeItem);
        renderApprovals();
        renderStats();
    }

    async function loadRecentApprovals() {
        if (!usingDemoData) {
            try {
                const res = await APP.API.get('/admin/approvals/recent');
                recentApprovals = (res?.data || []).map(normalizeItem);
            } catch (error) {
                recentApprovals = [];
            }
        }
        renderRecent();
        renderStats();
    }

    // Server rows are files (original_name/category/uploaded_by_name); demo rows use title/type/uploaded_by
    function normalizeItem(item) {
        return {
            id: item.id,
            type: String(item.type || item.category || 'file').toLowerCase(),
            title: item.title || item.original_name || 'Untitled',
            uploadedBy: item.uploaded_by_name || item.uploaded_by || 'Unknown',
            department: item.department || '—',
            createdAt: item.created_at,
            approvedAt: item.approved_at || null,
            priority: item.priority || null,
            url: item.public_url || null
        };
    }

    function matchesFilter(item) {
        if (activeFilter === 'all') return true;
        return (FILTER_TYPES[activeFilter] || []).includes(item.type);
    }

    function renderApprovals() {
        const tbody = document.getElementById('approvalsTableBody');
        if (!tbody) return;

        const visible = approvals.filter(matchesFilter);
        const count = document.getElementById('approvalCount');
        if (count) count.textContent = `(${visible.length})`;

        if (!visible.length) {
            tbody.innerHTML = `
                <tr><td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon">🎉</div>
                        <p>${approvals.length ? 'Nothing pending in this category.' : 'All caught up. Nothing is waiting for approval.'}</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = visible.map((item) => {
            const priority = item.priority || 'Normal';
            const priorityClass = priority === 'High' ? 'danger' : (priority === 'Medium' ? 'warning' : 'success');
            const view = item.url
                ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">View</a>`
                : '';

            return `
            <tr data-id="${escapeAttr(item.id)}">
                <td><span class="badge primary">${escapeHtml(item.type)}</span></td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.uploadedBy)}</td>
                <td>${escapeHtml(item.department)}</td>
                <td>${formatDate(item.createdAt)}</td>
                <td><span class="badge ${priorityClass}">${escapeHtml(priority)}</span></td>
                <td class="action-btns">
                    <button type="button" class="btn btn-success btn-sm" data-action="approve">✓ Approve</button>
                    <button type="button" class="btn btn-danger btn-sm" data-action="reject">✗ Reject</button>
                    ${view}
                </td>
            </tr>`;
        }).join('');
    }

    async function onTableClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const row = button.closest('tr[data-id]');
        const id = row?.dataset.id;
        const item = approvals.find((entry) => String(entry.id) === id);
        if (!item) return;

        const decision = button.dataset.action;
        let reason = null;
        if (decision === 'reject') {
            reason = window.prompt(`Reject "${item.title}"? Add an optional reason for the uploader:`, '');
            if (reason === null) return; // cancelled
        }

        row.querySelectorAll('button').forEach((btn) => { btn.disabled = true; });

        try {
            if (!usingDemoData) {
                await APP.API.post(`/admin/approvals/${encodeURIComponent(id)}/${decision}`, { reason });
            }

            approvals = approvals.filter((entry) => entry !== item);
            if (decision === 'approve') {
                recentApprovals.unshift({ ...item, approvedAt: new Date().toISOString() });
                recentApprovals = recentApprovals.slice(0, 10);
            }

            renderApprovals();
            renderRecent();
            renderStats();
            notify('success', `${decision === 'approve' ? 'Approved' : 'Rejected'} "${item.title}"${usingDemoData ? ' (demo data, not saved)' : ''}`);
        } catch (error) {
            row.querySelectorAll('button').forEach((btn) => { btn.disabled = false; });
            notify('error', error.message || 'Could not update this item. Please try again.');
        }
    }

    function renderRecent() {
        const list = document.getElementById('recentlyApproved');
        if (!list) return;

        if (!recentApprovals.length) {
            list.innerHTML = '<div class="empty-state"><p>No approvals yet. Items you approve will show up here.</p></div>';
            return;
        }

        list.innerHTML = recentApprovals.map((item) => `
            <div class="approved-item">
                <span class="badge success">${escapeHtml(item.type)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <span class="approved-meta">by ${escapeHtml(item.uploadedBy)} · ${formatDate(item.approvedAt)}</span>
            </div>
        `).join('');
    }

    function renderStats() {
        const countType = (types) => approvals.filter((item) => types.includes(item.type)).length;
        const today = new Date().toDateString();
        const approvedToday = recentApprovals.filter((item) => item.approvedAt && new Date(item.approvedAt).toDateString() === today);

        setText('pendingNotes', String(countType(FILTER_TYPES.notes)));
        setText('pendingAssignments', String(countType(FILTER_TYPES.assignments)));
        setText('approvedToday', String(approvedToday.length));

        const waits = recentApprovals
            .filter((item) => item.approvedAt && item.createdAt)
            .map((item) => new Date(item.approvedAt) - new Date(item.createdAt))
            .filter((ms) => Number.isFinite(ms) && ms >= 0);
        setText('avgResponseTime', waits.length ? formatDuration(waits.reduce((a, b) => a + b, 0) / waits.length) : '—');
    }

    // Called from the filter buttons in admin-approvals.html
    window.filterApprovals = function (filter) {
        activeFilter = filter;
        document.querySelectorAll('.filter-buttons-container .filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        renderApprovals();
    };

    function formatDuration(ms) {
        const hours = ms / 3600000;
        if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
        if (hours < 48) return `${Math.round(hours)}h`;
        return `${Math.round(hours / 24)}d`;
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
    }

    function notify(type, message) {
        if (window.Toast && typeof window.Toast[type] === 'function') {
            window.Toast[type](message);
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function escapeHtml(value) {
        return APP.sanitize ? APP.sanitize(String(value ?? '')) : String(value ?? '');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/"/g, '&quot;');
    }
})();
