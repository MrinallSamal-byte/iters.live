(function(){
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'teacher') {
    try { window.location.href = '/login.html'; } catch(_) {}
    return;
  }
  
  const user = APP.Storage.get('user') || {};

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Welcome name
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.name || 'Teacher';

    // Load stats
    const stats = await getTeacherStats();
    setText('totalStudents', stats.totalStudents || 120);
    setText('avgAttendance', (stats.avgAttendance || 87) + '%');
    setText('pendingSubmissions', stats.pendingSubmissions || 15);
    setText('classAverage', (stats.classAverage || 78) + '%');

    // Load charts
    renderAttendanceChart();
    renderPerformanceChart();

    // Load pending submissions
    loadPendingSubmissions();
  }

  function setText(id, txt){ 
    const el = document.getElementById(id); 
    if (el) el.textContent = txt; 
  }

  async function getTeacherStats(){
    try { 
      const r = await APP.API.get('/teacher/stats'); 
      return r.data || {};
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getTeacherStats(); 
        return r.data || {};
      }
      return {
        totalStudents: 120,
        avgAttendance: 87,
        pendingSubmissions: 15,
        classAverage: 78,
        totalClasses: 5
      };
    }
  }

  function renderAttendanceChart(){
    const el = document.getElementById('attendanceChart');
    if (!el || typeof Chart === 'undefined') return;

    try {
      new Chart(el, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Attendance %',
            data: [85, 88, 90, 87, 89, 86, 0],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true
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
              max: 100,
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

  function renderPerformanceChart(){
    const el = document.getElementById('performanceChart');
    if (!el || typeof Chart === 'undefined') return;

    try {
      new Chart(el, {
        type: 'bar',
        data: {
          labels: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'],
          datasets: [{
            label: 'Students',
            data: [15, 25, 30, 28, 15, 5, 2],
            backgroundColor: [
              '#22c55e', '#3b82f6', '#f59e0b', 
              '#ef4444', '#6b7280', '#94a3b8', '#64748b'
            ],
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

  async function loadPendingSubmissions(){
    const tbody = document.getElementById('submissionsTableBody');
    const countBadge = document.getElementById('submissionCount');
    if (!tbody) return;

    try {
      let response;
      try {
        response = await APP.API.get('/teacher/submissions?status=pending');
      } catch(error) {
        if (typeof DummyData !== 'undefined') {
          response = DummyData.getTeacherSubmissions('pending');
        } else {
          // Hardcoded fallback
          response = {
            success: true,
            data: [
              { id: 1, assignment_title: 'Data Structures Assignment 3', student_name: 'Aarav Sharma', student_reg: 'STU20250001', submitted_at: new Date().toISOString(), file_name: 'assignment.pdf', status: 'pending' },
              { id: 2, assignment_title: 'Algorithms Lab Report', student_name: 'Diya Patel', student_reg: 'STU20250002', submitted_at: new Date().toISOString(), file_name: 'report.pdf', status: 'pending' },
              { id: 3, assignment_title: 'DBMS Project', student_name: 'Rohan Kumar', student_reg: 'STU20250003', submitted_at: new Date().toISOString(), file_name: 'project.zip', status: 'pending' },
              { id: 4, assignment_title: 'OS Assignment 2', student_name: 'Ananya Singh', student_reg: 'STU20250004', submitted_at: new Date().toISOString(), file_name: 'os_assignment.pdf', status: 'pending' },
              { id: 5, assignment_title: 'Networks Lab Work', student_name: 'Vikram Reddy', student_reg: 'STU20250005', submitted_at: new Date().toISOString(), file_name: 'networks.pdf', status: 'pending' }
            ]
          };
        }
      }

      const submissions = response.data || [];
      
      if (countBadge) countBadge.textContent = submissions.length;

      if (submissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No pending submissions</td></tr>';
        return;
      }

      tbody.innerHTML = submissions.map(s => {
        const date = new Date(s.submitted_at);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `
          <tr>
            <td><strong>${s.assignment_title}</strong></td>
            <td>
              <div>${s.student_name}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">${s.student_reg}</div>
            </td>
            <td>Data Structures</td>
            <td>${dateStr}</td>
            <td>
              <button class="btn-small btn-primary" onclick="gradeSubmission(${s.id})">
                Grade
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch(err) {
      console.error('Error loading submissions:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Error loading submissions</td></tr>';
    }
  }

  // Make function global for onclick handlers
  window.gradeSubmission = function(id) {
    if (typeof Toast !== 'undefined') {
      Toast.info('Grade submission feature coming soon', 'Info');
    } else {
      alert('Grade submission feature coming soon');
    }
  };

})();
