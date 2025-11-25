console.log('Admin Approvals Page Loaded');

document.addEventListener('DOMContentLoaded', () => {
    loadApprovals();
});

async function loadApprovals() {
    const tbody = document.getElementById('approvalsTableBody');
    if (!tbody) return;
    let res;
    try { res = await APP.API.get('/admin/approvals'); }
    catch { res = DummyData?.getAdminApprovals?.(); }
    const items = res?.data || [];
    tbody.innerHTML = items.map(item => {
        // Determine priority based on item type or random for demo
        const priority = item.priority || (['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)]);
        const priorityClass = priority === 'High' ? 'danger' : (priority === 'Medium' ? 'warning' : 'success');

        return `
        <tr>
            <td><span class="badge primary">${item.type}</span></td>
            <td>${item.title}</td>
            <td>${item.uploaded_by}</td>
            <td>${item.department || 'CSE'}</td>
            <td>${new Date(item.created_at).toLocaleDateString()}</td>
            <td><span class="badge ${priorityClass}">${priority}</span></td>
            <td class="action-btns">
                <button class="btn btn-success btn-sm">✓ Approve</button>
                <button class="btn btn-danger btn-sm">✗ Reject</button>
                <a href="#" class="btn btn-secondary btn-sm">View</a>
            </td>
        </tr>
    `}).join('') || '<tr><td colspan="7">No pending approvals</td></tr>';
}
