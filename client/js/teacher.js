(function(){
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'teacher') {
    try { 
      // Use encoded URL for navigation
      if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
        window.LinkEncoding.navigateTo('/login.html');
      } else {
        window.location.href = '/login.html';
      }
    } catch(_) {}
    return;
  }
  
  const user = APP.Storage.get('user') || {};

  // Client-side cache with TTL (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;
  const dataCache = {
    get(key) {
      try {
        const cached = sessionStorage.getItem(`teacher_${key}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            return data;
          }
          sessionStorage.removeItem(`teacher_${key}`);
        }
      } catch (_) {}
      return null;
    },
    set(key, data) {
      try {
        sessionStorage.setItem(`teacher_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (_) {}
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Welcome name - immediate
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.name || 'Teacher';

    // Render charts immediately (they use static data)
    renderAttendanceChart();
    renderPerformanceChart();

    // Load all data in parallel for faster loading
    const [result] = await Promise.all([
      getTeacherStats(),
      loadPendingSubmissions()
    ]);

    // Update stats as soon as data is available
    const stats = result.stats || {};
    setText('totalStudents', stats.totalStudents ?? '--');
    setText('avgAttendance', stats.avgAttendance != null ? stats.avgAttendance + '%' : '--');
    setText('pendingSubmissions', stats.pendingSubmissions ?? '--');
    setText('classAverage', stats.classAverage != null ? stats.classAverage + '%' : '--');

    if (!result.ok) {
      showConnectHint('totalStudents', '/dashboard/teacher-students.html', 'Connect: Students \u2192');
      showConnectHint('avgAttendance', '/dashboard/teacher-attendance.html', 'Connect: Attendance \u2192');
    }
  }

  function showConnectHint(statId, href, label){
    const el = document.getElementById(statId);
    if (!el || !el.parentElement) return;
    if (el.parentElement.querySelector('.stat-connect-hint')) return;
    const link = document.createElement('a');
    link.className = 'stat-connect-hint';
    link.href = href;
    link.textContent = label;
    link.style.cssText = 'display:inline-block;margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);text-decoration:underline dotted;';
    el.parentElement.appendChild(link);
  }

  function setText(id, txt){ 
    const el = document.getElementById(id); 
    if (el) el.textContent = txt; 
  }

  async function getTeacherStats(){
    // Check cache first
    const cached = dataCache.get('stats');
    if (cached) return { stats: cached, ok: true };

    try {
      const r = await APP.API.get('/teacher/stats');
      const stats = r.data || {};
      dataCache.set('stats', stats);
      return { stats, ok: true };
    } catch(_) {
      return { stats: {}, ok: false };
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
            borderRadius: 2
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
      const response = await APP.API.get('/teacher/submissions?status=pending');
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
            <td><strong>${escapeHtml(s.assignment_title)}</strong></td>
            <td>
              <div>${escapeHtml(s.student_name)}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(s.student_reg)}</div>
            </td>
            <td>${escapeHtml(s.subject || '—')}</td>
            <td>${dateStr}</td>
            <td>
              <button class="btn-small btn-primary" disabled title="Grading is not available yet">
                Grade
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch(err) {
      console.error('Error loading submissions:', err);
      if (countBadge) countBadge.textContent = '--';
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary);">Submissions unavailable - no teacher submissions endpoint exists.</td></tr>';
    }
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]
    ));
  }

  // Make function global for onclick handlers
  window.gradeSubmission = function() {
    if (window.Toast && typeof window.Toast.show === 'function') {
      window.Toast.show({ type: 'warning', title: 'Coming soon', message: 'Grading from the dashboard is not available yet.' });
    }
  };

})();
