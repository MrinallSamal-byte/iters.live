console.log('Admin Users Page Loaded');

document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('searchUsers');
    search?.addEventListener('input', debounce(() => loadUsers(), 300));
    loadUsers();
});

async function loadUsers() {
    const role = document.getElementById('filterRole')?.value;
    const dept = document.getElementById('filterDept')?.value;
    const search = document.getElementById('searchUsers')?.value;
    const tbody = document.getElementById('usersTableBody');
    const count = document.getElementById('userCount');
    if (!tbody) return;
    let res;
    try {
        let url = '/admin/users?';
        if (role) url += `role=${role}&`;
        if (dept) url += `department=${dept}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
        res = await APP.API.get(url);
    } catch {
        res = DummyData?.getAdminUsers?.({ role, department: dept, search });
    }
    const items = res?.data || [];
    tbody.innerHTML = items.map(u => `
        <tr>
            <td>${u.registration_number || '-'}</td>
            <td>${u.name}</td>
            <td><span class="badge ${u.role==='admin'?'warning':'primary'}">${u.role}</span></td>
            <td>${u.department || '--'}</td>
            <td>${u.email || '--'}</td>
            <td><span class="badge ${u.is_active ? 'success' : 'danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="action-btns">
                <button class="btn btn-primary btn-sm">Edit</button>
                <button class="btn btn-${u.is_active ? 'warning' : 'success'} btn-sm">${u.is_active ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-danger btn-sm">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7">No users found</td></tr>';
    if (count) count.textContent = `(${items.length})`;
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
    // simple CSV from current table rows
    const rows = [['Reg No','Name','Role','Department','Email','Status']];
    document.querySelectorAll('#usersTableBody tr').forEach(tr => {
        const cells = [...tr.children].slice(0,6).map(td => td.textContent.trim());
        if (cells.length) rows.push(cells);
    });
    const csv = rows.map(r=>r.map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users_demo.csv'; a.click();
    URL.revokeObjectURL(url);
}

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; }
