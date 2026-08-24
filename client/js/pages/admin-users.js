// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('admin')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires admin role');
  }
})();

console.log('Admin Users Page Loaded');

const USERS_PAGE_SIZE = 25;
let allUsers = [];
let usersLoadFailed = false;
let usersCurrentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('searchUsers');
    search?.addEventListener('input', debounce(() => { usersCurrentPage = 1; loadUsers(); }, 300));
    loadUsers();
});

function getFilteredUsers() {
    const role = document.getElementById('filterRole')?.value || '';
    const dept = document.getElementById('filterDept')?.value || '';
    const search = (document.getElementById('searchUsers')?.value || '').toLowerCase();
    return allUsers.filter(u => {
        if (role && u.role !== role) return false;
        if (dept && u.department !== dept) return false;
        if (search) {
            const haystack = `${u.name || ''} ${u.registration_number || ''} ${u.email || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    const count = document.getElementById('userCount');
    if (!tbody) return;

    if (usersLoadFailed) {
        renderUsersError(tbody);
        return;
    }

    if (!allUsers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading users...</td></tr>';
        try {
            const res = await APP.API.get('/admin/users?limit=5000');
            allUsers = res?.data || [];
        } catch (err) {
            console.error('Error loading users:', err);
            usersLoadFailed = true;
            renderUsersError(tbody, err);
            return;
        }
    }

    const items = getFilteredUsers();
    const totalPages = Math.max(1, Math.ceil(items.length / USERS_PAGE_SIZE));
    usersCurrentPage = Math.min(Math.max(1, usersCurrentPage), totalPages);
    const pageItems = items.slice((usersCurrentPage - 1) * USERS_PAGE_SIZE, usersCurrentPage * USERS_PAGE_SIZE);

    if (count) count.textContent = `(${items.length})`;
    renderPagination(items.length, totalPages);

    if (!pageItems.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map((u, i) => {
        const idx = (usersCurrentPage - 1) * USERS_PAGE_SIZE + i;
        return `
        <tr data-user-id="${escapeHtml(String(u.id))}">
            <td>${APP.sanitize(u.registration_number || '-')}</td>
            <td>${APP.sanitize(u.name)}</td>
            <td><span class="badge ${u.role === 'admin' ? 'warning' : 'primary'}">${APP.sanitize(u.role)}</span></td>
            <td>${APP.sanitize(u.department || '--')}</td>
            <td>${APP.sanitize(u.email || '--')}</td>
            <td><span class="badge ${u.is_active ? 'success' : 'danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="action-btns">
                <button class="btn btn-primary btn-sm" onclick="editUser('${escapeHtml(String(u.id))}', this)">Edit</button>
                <button class="btn btn-${u.is_active ? 'warning' : 'success'} btn-sm" onclick="toggleUserActive('${escapeHtml(String(u.id))}', this)">${u.is_active ? 'Deactivate' : 'Activate'}</button>
            </td>
        </tr>
    `}).join('');
}

function renderUsersError(tbody, err) {
    tbody.innerHTML = `
        <tr><td colspan="7" class="loading-text">
            Failed to load users${err?.message ? `: ${escapeHtml(err.message)}` : ''}
            <button class="btn btn-secondary btn-sm" onclick="retryUsersLoad()" style="margin-left: 0.75rem;">Retry</button>
        </td></tr>`;
}

function retryUsersLoad() {
    const tbody = document.getElementById('usersTableBody');
    usersLoadFailed = false;
    allUsers = [];
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading users...</td></tr>';
    loadUsers();
}

function renderPagination(total, totalPages) {
    let container = document.getElementById('usersPagination');
    const section = document.querySelector('#usersTableBody')?.closest('.table-responsive');
    if (!container && section) {
        container = document.createElement('div');
        container.id = 'usersPagination';
        container.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:1rem;font-family:\'IBM Plex Mono\',ui-monospace,monospace;';
        section.appendChild(container);
    }
    if (!container) return;
    if (total <= USERS_PAGE_SIZE) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="changeUsersPage(-1)" ${usersCurrentPage <= 1 ? 'disabled' : ''}>&larr; Prev</button>
        <span>PAGE ${usersCurrentPage}/${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeUsersPage(1)" ${usersCurrentPage >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
    `;
}

function changeUsersPage(delta) {
    usersCurrentPage += delta;
    loadUsers();
}

window.editUser = function(id, btn) {
    const tr = btn.closest('tr');
    const user = allUsers.find(u => String(u.id) === String(id));
    if (!tr || !user) return;
    if (tr.dataset.editing === 'true') return;
    tr.dataset.editing = 'true';

    const roles = ['student', 'teacher', 'admin'];
    tr.innerHTML = `
        <td>${APP.sanitize(user.registration_number || '-')}</td>
        <td><input type="text" class="form-input" value="${escapeAttr(user.name)}" data-field="name"></td>
        <td>
            <select class="form-select" data-field="role">
                ${roles.map(r => `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
        </td>
        <td><input type="text" class="form-input" value="${escapeAttr(user.department || '')}" data-field="department"></td>
        <td><input type="email" class="form-input" value="${escapeAttr(user.email || '')}" data-field="email"></td>
        <td><span class="badge ${user.is_active ? 'success' : 'danger'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
        <td class="action-btns">
            <button class="btn btn-success btn-sm" onclick="saveUserEdit('${escapeHtml(String(id))}', this)">Save</button>
            <button class="btn btn-secondary btn-sm" onclick="cancelUserEdit(this)">Cancel</button>
        </td>
    `;
};

window.saveUserEdit = async function(id, btn) {
    const tr = btn.closest('tr');
    const getVal = (field) => tr.querySelector(`[data-field="${field}"]`)?.value.trim() || '';
    const payload = {
        name: getVal('name'),
        email: getVal('email'),
        role: getVal('role'),
        department: getVal('department')
    };
    if (!payload.name || !payload.email) {
        notify('Name and email are required', 'warning');
        return;
    }
    btn.disabled = true;
    try {
        await apiPatchUser(id, payload);
        const user = allUsers.find(u => String(u.id) === String(id));
        if (user) Object.assign(user, payload);
        notify('User updated', 'success');
        usersCurrentPage = Math.max(1, usersCurrentPage);
        loadUsers();
    } catch (err) {
        console.error('User update failed:', err);
        notify(`Update failed: ${err.message || 'no server endpoint for editing users'}`, 'error');
        btn.disabled = false;
    }
};

async function apiPatchUser(id, payload) {
    const token = APP.Storage.get('accessToken');
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
}

window.cancelUserEdit = function(btn) {
    btn.disabled = true;
    loadUsers();
};

window.toggleUserActive = async function(id, btn) {
    const user = allUsers.find(u => String(u.id) === String(id));
    const tr = btn.closest('tr');
    if (!user) return;
    const rollbackState = user.is_active;
    user.is_active = !rollbackState;
    if (tr) {
        tr.style.opacity = '0.5';
        tr.querySelectorAll('button').forEach(b => b.disabled = true);
    }
    try {
        await APP.API.put(`/admin/users/${encodeURIComponent(id)}/toggle-active`);
        notify(`User ${user.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
        console.error('Toggle active failed:', err);
        user.is_active = rollbackState;
        notify(`Status change failed: ${err.message || 'request failed'}`, 'error');
    } finally {
        loadUsers();
    }
};

function notify(message, type) {
    if (typeof showToast === 'function') showToast(message, type);
    else if (window.Toast?.show) window.Toast.show({ type, message });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAddUserModal() {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function exportUsers() {
    const items = getFilteredUsers();
    if (!items.length) {
        notify('No users to export', 'info');
        return;
    }
    const rows = [['Reg No', 'Name', 'Role', 'Department', 'Email', 'Status']];
    items.forEach(u => {
        rows.push([
            u.registration_number || '-',
            u.name || '',
            u.role || '',
            u.department || '--',
            u.email || '--',
            u.is_active ? 'Active' : 'Inactive'
        ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users.csv'; a.click();
    URL.revokeObjectURL(url);
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
