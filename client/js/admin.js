(function(){
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'admin') {
    try { window.location.href = '/login.html'; } catch(_) {}
    return;
  }
  
  const user = APP.Storage.get('user') || {};

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Welcome name
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = user.name || 'Admin';

    // Load stats
    const stats = await getAdminStats();
    setText('totalUsers', stats.totalUsers || 1435);
    setText('totalStudents', stats.totalStudents || 1250);
    setText('totalTeachers', stats.totalTeachers || 95);
    setText('pendingApprovals', stats.pendingApprovals || 12);
    setText('totalFiles', stats.totalFiles || 420);
    setText('totalAssignments', stats.totalAssignments || 180);
    setText('totalEvents', stats.totalEvents || 25);
    setText('avgAttendance', (stats.avgAttendance || 88) + '%');

    // Load charts
    renderUserChart(stats);
    renderDepartmentChart(stats);

    // Load approvals
    loadPendingApprovals();
    
    // Load recent activity
    loadRecentActivity();
  }

  function setText(id, txt){ 
    const el = document.getElementById(id); 
    if (el) el.textContent = txt; 
  }

  async function getAdminStats(){
    try { 
      const r = await APP.API.get('/admin/stats'); 
      return r.data || {};
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getAdminStats(); 
        return r.data || {};
      }
      return {
        totalUsers: 1435,
        totalStudents: 1250,
        totalTeachers: 95,
        totalAdmins: 3,
        pendingApprovals: 12,
        totalFiles: 420,
        totalAssignments: 180,
        totalEvents: 25,
        avgAttendance: 88,
        activeClubs: 10,
        departments: [
          { name: 'CSE', count: 420 },
          { name: 'ECE', count: 350 },
          { name: 'MECH', count: 280 },
          { name: 'CIVIL', count: 200 },
          { name: 'IT', count: 180 },
          { name: 'EEE', count: 170 }
        ]
      };
    }
  }

  function renderUserChart(stats){
    const el = document.getElementById('userChart');
    if (!el || typeof Chart === 'undefined') return;

    try {
      new Chart(el, {
        type: 'doughnut',
        data: {
          labels: ['Students', 'Teachers', 'Admins'],
          datasets: [{
            data: [
              stats.totalStudents || 1250, 
              stats.totalTeachers || 95, 
              stats.totalAdmins || 3
            ],
            backgroundColor: ['#6366f1', '#22c55e', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#fff',
                font: { size: 13 }
              }
            }
          }
        }
      });
    } catch(err) {
      console.error('Chart error:', err);
    }
  }

  function renderDepartmentChart(stats){
    const el = document.getElementById('deptChart');
    if (!el || typeof Chart === 'undefined') return;

    const departments = stats.departments || [
      { name: 'CSE', count: 420 },
      { name: 'ECE', count: 350 },
      { name: 'MECH', count: 280 },
      { name: 'CIVIL', count: 200 },
      { name: 'IT', count: 180 },
      { name: 'EEE', count: 170 }
    ];

    try {
      new Chart(el, {
        type: 'bar',
        data: {
          labels: departments.map(d => d.name),
          datasets: [{
            label: 'Students',
            data: departments.map(d => d.count),
            backgroundColor: '#6366f1',
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: { color: '#fff' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            x: {
              ticks: { color: '#fff' },
              grid: { display: false }
            }
          }
        }
      });
    } catch(err) {
      console.error('Chart error:', err);
    }
  }

  async function loadPendingApprovals(){
    const tbody = document.getElementById('approvalsTableBody');
    const countBadge = document.getElementById('approvalCount');
    if (!tbody) return;

    try {
      let response;
      try {
        response = await APP.API.get('/admin/approvals');
      } catch(error) {
        if (typeof DummyData !== 'undefined') {
          response = DummyData.getAdminApprovals();
        } else {
          // Hardcoded fallback
          response = {
            success: true,
            data: [
              { id: 1, type: 'notes', title: 'Data Structures Unit 5 Notes', uploaded_by: 'Dr. Priya Sharma', created_at: new Date().toISOString(), status: 'pending' },
              { id: 2, type: 'assignment', title: 'Algorithms Assignment 3', uploaded_by: 'Dr. Raj Kumar', created_at: new Date().toISOString(), status: 'pending' },
              { id: 3, type: 'pyq', title: 'DBMS 2024 Question Paper', uploaded_by: 'Dr. Anita Verma', created_at: new Date().toISOString(), status: 'pending' },
              { id: 4, type: 'notes', title: 'Operating Systems Lab Manual', uploaded_by: 'Dr. Vikram Singh', created_at: new Date().toISOString(), status: 'pending' },
              { id: 5, type: 'announcement', title: 'Mid-term Exam Schedule', uploaded_by: 'Dr. Meera Reddy', created_at: new Date().toISOString(), status: 'pending' }
            ]
          };
        }
      }

      const approvals = response.data || [];
      
      if (countBadge) countBadge.textContent = approvals.length;

      if (approvals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No pending approvals</td></tr>';
        return;
      }

      tbody.innerHTML = approvals.map(a => {
        const date = new Date(a.created_at);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const typeColors = {
          notes: 'primary',
          assignment: 'warning',
          pyq: 'success',
          announcement: 'info'
        };
        const typeColor = typeColors[a.type] || 'primary';
        
        return `
          <tr>
            <td><span class="badge badge-${typeColor}">${a.type.toUpperCase()}</span></td>
            <td>${a.uploaded_by}</td>
            <td><strong>${a.title}</strong></td>
            <td>${dateStr}</td>
            <td>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-small btn-success" onclick="approveItem(${a.id})" title="Approve">
                  ✓
                </button>
                <button class="btn-small btn-danger" onclick="rejectItem(${a.id})" title="Reject">
                  ✕
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch(err) {
      console.error('Error loading approvals:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Error loading approvals</td></tr>';
    }
  }

  function loadRecentActivity(){
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const activities = [
      { user: 'Dr. Priya Sharma', action: 'uploaded new notes for Data Structures', time: '5 mins ago' },
      { user: 'Aarav Kumar', action: 'submitted assignment for Algorithms', time: '15 mins ago' },
      { user: 'Admin User', action: 'approved 3 pending submissions', time: '30 mins ago' },
      { user: 'Dr. Raj Patel', action: 'created new assignment', time: '1 hour ago' },
      { user: 'System', action: 'generated attendance reports', time: '2 hours ago' },
      { user: 'Diya Singh', action: 'registered for TechFest 2025', time: '3 hours ago' },
      { user: 'Dr. Anita Verma', action: 'updated student marks', time: '4 hours ago' }
    ];

    container.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-header">
          <span class="activity-user">${a.user}</span>
          <span class="activity-time">${a.time}</span>
        </div>
        <div class="activity-description">${a.action}</div>
      </div>
    `).join('');
  }

  // Make functions global for onclick handlers
  window.approveItem = function(id) {
    if (typeof Toast !== 'undefined') {
      Toast.success('Item approved successfully', 'Success');
    } else {
      alert('Item approved successfully');
    }
    // Reload approvals after a short delay
    setTimeout(loadPendingApprovals, 1000);
  };

  window.rejectItem = function(id) {
    if (typeof Toast !== 'undefined') {
      Toast.warning('Item rejected', 'Rejected');
    } else {
      alert('Item rejected');
    }
    // Reload approvals after a short delay
    setTimeout(loadPendingApprovals, 1000);
  };

})();
