(function () {
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
    try { window.location.href = '/login.html'; } catch (_) { }
    return;
  }
  const user = APP.Storage.get('user') || {};

  // Client-side cache with TTL (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;
  // Auto-refresh interval (30 seconds - balances freshness with performance)
  const AUTO_REFRESH_INTERVAL = 30000;
  let autoRefreshTimer = null;
  
  const dataCache = {
    get(key) {
      try {
        const cached = sessionStorage.getItem(`dashboard_${key}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            return data;
          }
          sessionStorage.removeItem(`dashboard_${key}`);
        }
      } catch (_) {}
      return null;
    },
    set(key, data) {
      try {
        sessionStorage.setItem(`dashboard_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (_) {}
    },
    clear(key) {
      try {
        sessionStorage.removeItem(`dashboard_${key}`);
      } catch (_) {}
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Welcome name - immediate
    const w = document.getElementById('studentWelcomeName');
    if (w) w.textContent = user.name || 'Student';

    // Show loading states immediately
    showLoadingStates();

    // Render static content immediately
    renderTodaySchedule();
    renderRecentActivity();
    renderSoaPortalBanner();

    // Fetch all data in parallel for faster loading
    await refreshDashboardData();

    // Start auto-refresh for charts
    startAutoRefresh();

    // Clean up on page unload
    window.addEventListener('beforeunload', stopAutoRefresh);
    
    // Handle visibility change to pause/resume refresh
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  /**
   * Start auto-refresh timer for charts
   */
  function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing timer
    autoRefreshTimer = setInterval(async () => {
      // Only refresh if page is visible
      if (!document.hidden) {
        await refreshChartsData();
      }
    }, AUTO_REFRESH_INTERVAL);
    console.log('Dashboard auto-refresh started (every 30 seconds)');
  }

  /**
   * Stop auto-refresh timer
   */
  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  /**
   * Handle page visibility change
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      // Pause refresh when page is hidden
      stopAutoRefresh();
    } else {
      // Resume refresh when page is visible
      startAutoRefresh();
    }
  }

  /**
   * Refresh all dashboard data
   */
  async function refreshDashboardData() {
    const [attendance, marks, assignments, events] = await Promise.all([
      getAttendance(),
      getMarks(),
      getAssignments(),
      getEvents()
    ]);

    // Update stats as soon as data is available
    setText('overallAttendance', attendance.percent != null ? attendance.percent + '%' : '85%');
    setText('currentCGPA', marks.gpa != null ? String(marks.gpa) : '8.5');
    setText('pendingAssignments', String(assignments.pendingCount || 5));
    setText('upcomingEvents', String(events.count || 8));

    // Charts
    renderAttendanceChart(attendance.present || 320, attendance.absent || 45);
    renderPerformanceChart(marks.summary || []);
  }

  /**
   * Refresh only charts data (for auto-refresh)
   */
  async function refreshChartsData() {
    // Clear cache to get fresh data
    dataCache.clear('attendance');
    dataCache.clear('marks');
    
    const [attendance, marks] = await Promise.all([
      getAttendance(true), // Force fresh data
      getMarks(true)
    ]);

    // Update charts with new data
    updateAttendanceChart(attendance.present || 320, attendance.absent || 45);
    updatePerformanceChart(marks.summary || []);
    
    // Also update stats
    setText('overallAttendance', attendance.percent != null ? attendance.percent + '%' : '85%');
    setText('currentCGPA', marks.gpa != null ? String(marks.gpa) : '8.5');
  }

  function showLoadingStates() {
    // Show skeleton loading for stats
    const statElements = ['overallAttendance', 'currentCGPA', 'pendingAssignments', 'upcomingEvents'];
    statElements.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '--') {
        el.classList.add('loading-skeleton');
      }
    });
  }

  function setText(id, txt) { 
    const el = document.getElementById(id); 
    if (el) {
      el.textContent = txt;
      el.classList.remove('loading-skeleton');
    }
  }

  function formatDateTime(value) {
    if (!value) return 'recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  async function getAttendance(forceFresh = false) {
    // Check cache first (unless forcing fresh)
    if (!forceFresh) {
      const cached = dataCache.get('attendance');
      if (cached) return cached;
    }
    
    try {
      const r = await APP.API.get(`/attendance/student/${user.id}`);
      const result = normalizeAttendance(r.data);
      dataCache.set('attendance', result);
      return result;
    } catch (_) {
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getStudentAttendance();
        const result = normalizeAttendance(r.data);
        dataCache.set('attendance', result);
        return result;
      }
      return { present: 320, absent: 45, total: 365, percent: 88, summary: [] };
    }
  }

  function normalizeAttendance(data) {
    const summary = data?.summary || [];
    let present = 0, total = 0;
    summary.forEach(s => {
      present += Number(s.present_count || 0);
      total += Number(s.total_classes || 0);
    });
    const absent = Math.max(0, total - present);
    const percent = total ? Math.round((present / total) * 100) : 88;
    return { present: present || 320, total: total || 365, absent: absent || 45, percent, summary };
  }

  async function getMarks(forceFresh = false) {
    // Check cache first (unless forcing fresh)
    if (!forceFresh) {
      const cached = dataCache.get('marks');
      if (cached) return cached;
    }
    
    try {
      const r = await APP.API.get(`/marks/student/${user.id}`);
      const result = normalizeMarks(r.data);
      dataCache.set('marks', result);
      return result;
    } catch (_) {
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getStudentMarks();
        const result = normalizeMarks(r.data);
        dataCache.set('marks', result);
        return result;
      }
      return { gpa: 8.5, summary: [] };
    }
  }

  function normalizeMarks(data) {
    const summary = data?.summary || [];
    if (!summary.length) {
      // Return dummy data if no summary
      return {
        gpa: 8.14,
        summary: [
          { subject: 'Data Structures', avg_marks: 85, avg_total: 100 },
          { subject: 'Algorithms', avg_marks: 88, avg_total: 100 },
          { subject: 'Database Systems', avg_marks: 82, avg_total: 100 },
          { subject: 'Operating Systems', avg_marks: 90, avg_total: 100 },
          { subject: 'Computer Networks', avg_marks: 78, avg_total: 100 },
          { subject: 'Web Development', avg_marks: 92, avg_total: 100 }
        ]
      };
    }
    let totalPct = 0;
    summary.forEach(s => {
      totalPct += (Number(s.avg_marks || 0) / Number(s.avg_total || 100)) * 100;
    });
    const avgPct = summary.length ? totalPct / summary.length : 85;
    const gpa = Number((avgPct / 10).toFixed(2));
    return { gpa, summary };
  }

  async function getAssignments() {
    // Check cache first
    const cached = dataCache.get('assignments');
    if (cached) return cached;
    
    try {
      const r = await APP.API.get('/assignments/student');
      const result = normalizeAssignments(r.data);
      dataCache.set('assignments', result);
      return result;
    } catch (_) {
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getAssignments();
        const result = normalizeAssignments(r.data);
        dataCache.set('assignments', result);
        return result;
      }
      return { pendingCount: 5 };
    }
  }

  function normalizeAssignments(list) {
    const arr = Array.isArray(list) ? list : (list?.data || []);
    const pendingCount = arr.filter(a => /pending|not submitted/i.test(String(a.submission_status || ''))).length || 5;
    return { pendingCount };
  }

  async function getEvents() {
    // Check cache first
    const cached = dataCache.get('events');
    if (cached) return cached;
    
    try {
      const r = await APP.API.get('/events');
      const result = { count: (r.data || []).length || 8 };
      dataCache.set('events', result);
      return result;
    } catch (_) {
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getEvents();
        const result = { count: (r.data || []).length || 8 };
        dataCache.set('events', result);
        return result;
      }
      return { count: 8 };
    }
  }

  // Store chart instances to destroy before re-creating
  let attendanceChartInstance = null;
  let performanceChartInstance = null;

  function renderAttendanceChart(present, absent) {
    const el = document.getElementById('attendanceChart');
    if (!el) return;
    
    // Destroy existing chart if it exists
    if (attendanceChartInstance) {
      attendanceChartInstance.destroy();
      attendanceChartInstance = null;
    }
    
    // Also check for Chart.js internal reference
    const existingChart = Chart.getChart(el);
    if (existingChart) {
      existingChart.destroy();
    }
    
    try {
      attendanceChartInstance = new Chart(el, {
        type: 'doughnut',
        data: {
          labels: ['Present', 'Absent'],
          datasets: [{
            data: [present, absent],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { color: '#fff' }
            }
          },
          animation: {
            duration: 300 // Faster animation for smooth updates
          }
        }
      });
    } catch (err) {
      console.error('Chart error:', err);
    }
  }

  /**
   * Update attendance chart data without destroying it
   */
  function updateAttendanceChart(present, absent) {
    if (attendanceChartInstance) {
      // Use proper Chart.js data update - splice and push for proper reactivity
      attendanceChartInstance.data.datasets[0].data.splice(0, attendanceChartInstance.data.datasets[0].data.length);
      attendanceChartInstance.data.datasets[0].data.push(present, absent);
      attendanceChartInstance.update('none'); // Update without animation for smooth refresh
    } else {
      renderAttendanceChart(present, absent);
    }
  }

  function renderPerformanceChart(summary) {
    const el = document.getElementById('performanceChart');
    if (!el) return;

    // Destroy existing chart if it exists
    if (performanceChartInstance) {
      performanceChartInstance.destroy();
      performanceChartInstance = null;
    }
    
    // Also check for Chart.js internal reference
    const existingChart = Chart.getChart(el);
    if (existingChart) {
      existingChart.destroy();
    }

    // Use dummy data if summary is empty
    if (!summary || !summary.length) {
      summary = [
        { subject: 'Structural Analysis', avg_marks: 78, avg_total: 100 },
        { subject: 'Concrete Technology', avg_marks: 85, avg_total: 100 },
        { subject: 'Surveying', avg_marks: 88, avg_total: 100 },
        { subject: 'Fluid Mechanics', avg_marks: 82, avg_total: 100 },
        { subject: 'Geotechnical Eng', avg_marks: 80, avg_total: 100 },
        { subject: 'Computer Aided Design', avg_marks: 75, avg_total: 100 },
        { subject: 'Const. Management', avg_marks: 92, avg_total: 100 },
        { subject: 'A.I. & ML', avg_marks: 86, avg_total: 100 },
        { subject: 'Big Data Analytics', avg_marks: 83, avg_total: 100 },
        { subject: 'Discrete Mathematics', avg_marks: 89, avg_total: 100 },
        { subject: 'Database Mgmt Systems', avg_marks: 81, avg_total: 100 },
        { subject: 'Operating Systems', avg_marks: 87, avg_total: 100 },
        { subject: 'Computer Networks', avg_marks: 84, avg_total: 100 },
        { subject: 'Machine Learning', avg_marks: 91, avg_total: 100 }
      ];
    }

    const labels = summary.map(s => s.subject || 'Unknown');
    const data = summary.map(s => {
      const marks = Number(s.avg_marks || 0);
      const total = Number(s.avg_total || 100);
      return Number(((marks / total) * 100).toFixed(1));
    });

    try {
      performanceChartInstance = new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Percentage',
            data,
            backgroundColor: '#6366f1',
            borderRadius: 6
          }]
        },
        options: {
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
          },
          animation: {
            duration: 300 // Faster animation for smooth updates
          }
        }
      });
    } catch (err) {
      console.error('Chart error:', err);
    }
  }

  /**
   * Update performance chart data without destroying it
   */
  function updatePerformanceChart(summary) {
    if (!summary || !summary.length) {
      summary = [
        { subject: 'Structural Analysis', avg_marks: 78, avg_total: 100 },
        { subject: 'Concrete Technology', avg_marks: 85, avg_total: 100 },
        { subject: 'Surveying', avg_marks: 88, avg_total: 100 },
        { subject: 'Fluid Mechanics', avg_marks: 82, avg_total: 100 },
        { subject: 'Geotechnical Eng', avg_marks: 80, avg_total: 100 },
        { subject: 'Computer Aided Design', avg_marks: 75, avg_total: 100 }
      ];
    }

    const data = summary.map(s => {
      const marks = Number(s.avg_marks || 0);
      const total = Number(s.avg_total || 100);
      return Number(((marks / total) * 100).toFixed(1));
    });

    if (performanceChartInstance) {
      // Use proper Chart.js data update - splice and push for proper reactivity
      performanceChartInstance.data.datasets[0].data.splice(0, performanceChartInstance.data.datasets[0].data.length);
      data.forEach(val => performanceChartInstance.data.datasets[0].data.push(val));
      performanceChartInstance.update('none'); // Update without animation for smooth refresh
    } else {
      renderPerformanceChart(summary);
    }
  }

  function renderTodaySchedule() {
    const container = document.getElementById('todaySchedule');
    if (!container) return;

    let res;
    try {
      if (typeof DummyData !== 'undefined') {
        res = DummyData.getTimetable();
      }
    } catch (_) { }

    const items = res?.data || [];
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    const today = items.filter(x => x.day_of_week === day);

    if (!today.length) {
      container.innerHTML = `
        <div class="schedule-item">
          <div>
            <strong>No classes today</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0 0 0;">Enjoy your day off!</p>
          </div>
          <div style="color: var(--text-secondary);">—</div>
        </div>
      `;
      return;
    }

    container.innerHTML = today.map(s => `
      <div class="schedule-item">
        <div>
          <strong>${APP.sanitize(s.subject)}</strong>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.25rem 0 0 0;">
            ${APP.sanitize(s.teacher_name)} • Room ${APP.sanitize(s.room_number)}
          </p>
        </div>
        <div style="color: var(--primary); font-weight: 600;">${s.time_slot}</div>
      </div>
    `).join('');
  }

  function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const activities = [
      { icon: '📝', title: 'Assignment Submitted', description: 'Data Structures Assignment 3', time: '2 hours ago' },
      { icon: '✅', title: 'Attendance Marked', description: 'Present in Database Systems', time: '3 hours ago' },
      { icon: '📊', title: 'Marks Updated', description: 'Algorithms Mid-term results', time: '1 day ago' },
      { icon: '📢', title: 'New Announcement', description: 'Mid-term exam schedule released', time: '2 days ago' },
      { icon: '📚', title: 'Notes Downloaded', description: 'Operating Systems Unit 4', time: '3 days ago' }
    ];

    container.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
          <div style="font-size: 1.5rem;">${a.icon}</div>
          <div style="flex: 1;">
            <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">${APP.sanitize(a.title)}</h4>
            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">${APP.sanitize(a.description)}</p>
          </div>
          <span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${a.time}</span>
        </div>
      </div>
    `).join('');
  }

  async function renderSoaPortalBanner() {
    const container = document.getElementById('soaPortalBanner');
    if (!container) return;

    try {
      const response = await APP.API.get('/soa/status');
      const connection = response.connection || {};
      const portalEnabled = response.portalEnabled !== false;
      const hasImportedData = Boolean(connection.hasImportedData);
      const isConnected = Boolean(connection.connected);

      let title = 'Connect your SOA portal';
      let copy = 'Import personal info, contact info, qualifications, attendance, and marks from the official SOA portal into ITERasn hub.';
      let primaryLabel = 'Connect SOA Portal';
      let primaryHref = '/connect-portal.html';
      let secondaryLabel = hasImportedData ? 'Open SOA Data' : 'Student Dashboard';
      let secondaryHref = hasImportedData ? '/dashboard/student-personal-info.html' : '/dashboard/student.html';

      if (!portalEnabled && hasImportedData) {
        title = 'Saved SOA data is available';
        copy = `Live SOA import is unavailable right now, but your saved SOA data${connection.lastSynced ? ` from ${formatDateTime(connection.lastSynced)}` : ''} is still available inside the app.`;
        primaryLabel = 'Open SOA Data';
        primaryHref = '/dashboard/student-personal-info.html';
        secondaryLabel = 'Connect Later';
        secondaryHref = '/connect-portal.html';
      } else if (!portalEnabled) {
        title = 'Live SOA import is unavailable';
        copy = 'You can keep using the dashboard and switch to demo mode from the connect page until live SOA import becomes available again.';
        primaryLabel = 'Open Connect Page';
        primaryHref = '/connect-portal.html';
        secondaryLabel = 'View Marks';
        secondaryHref = '/dashboard/student-marks.html';
      } else if (isConnected) {
        title = 'SOA portal connected';
        copy = `Your SOA data is linked${connection.lastSynced ? ` and was last synced on ${formatDateTime(connection.lastSynced)}` : ''}. Attendance and marks will fall back to this import when native records are missing.`;
        primaryLabel = 'Open SOA Data';
        primaryHref = '/dashboard/student-personal-info.html';
        secondaryLabel = 'Refresh Import';
        secondaryHref = '/connect-portal.html';
      } else if (hasImportedData) {
        title = 'Saved SOA import available';
        copy = `You have saved SOA data${connection.lastSynced ? ` from ${formatDateTime(connection.lastSynced)}` : ''}. Reconnect to refresh it from the official portal.`;
        primaryLabel = 'Open SOA Data';
        primaryHref = '/dashboard/student-personal-info.html';
        secondaryLabel = 'Reconnect';
        secondaryHref = '/connect-portal.html';
      }

      container.innerHTML = `
        <div class="soa-banner-shell">
          <div class="soa-banner-copy">
            <h3>${APP.sanitize(title)}</h3>
            <p>${APP.sanitize(copy)}</p>
          </div>
          <div class="soa-banner-actions">
            <a class="soa-banner-btn" href="${primaryHref}">${APP.sanitize(primaryLabel)}</a>
            <a class="soa-banner-link" href="${secondaryHref}">${APP.sanitize(secondaryLabel)}</a>
          </div>
        </div>
      `;
    } catch (_) {
      container.innerHTML = `
        <div class="soa-banner-shell">
          <div class="soa-banner-copy">
            <h3>Connect your SOA portal</h3>
            <p>Import your official SOA attendance, marks, and personal information into ITERasn hub.</p>
          </div>
          <div class="soa-banner-actions">
            <a class="soa-banner-btn" href="/connect-portal.html">Connect SOA Portal</a>
          </div>
        </div>
      `;
    }
  }
})();
