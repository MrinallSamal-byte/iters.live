// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('student')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires student role');
  }
})();

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
  // Auto-refresh interval (120 seconds - balances freshness with performance)
  const AUTO_REFRESH_INTERVAL = 120000;
  let autoRefreshTimer = null;
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let deadlineFailures = 0;
  let deadlineRetryLink = null;
  
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

    // Pending assignments stat box navigates to the assignments page
    const pendingBox = document.getElementById('pendingAssignments')?.closest('.stat-box');
    if (pendingBox) {
      pendingBox.style.cursor = 'pointer';
      pendingBox.addEventListener('click', () => { window.location.href = '/dashboard/student-assignments.html'; });
    }

    // Render static content immediately
    renderTodaySchedule();
    renderRecentActivity();
    renderSoaPortalBanner();

    // Fetch all data in parallel for faster loading
    await Promise.all([
      refreshDashboardData(),
      loadNextDeadline(),
      loadBunkBudgetCell()
    ]);

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
    console.log('Dashboard auto-refresh started (every 120 seconds)');
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

    setStat('overallAttendance', attendance.percent != null ? attendance.percent + '%' : '--');
    setStat('currentCGPA', marks.gpa != null ? String(marks.gpa) : '--');
    setStat('pendingAssignments', assignments.pendingCount != null ? String(assignments.pendingCount) : '--');
    setStat('upcomingEvents', events.count != null ? String(events.count) : '--');

    updateStripAttendance(attendance);

    if (attendance.total > 0) {
      clearChartEmpty('attendanceChart');
      renderAttendanceChart(attendance.present, attendance.absent);
    } else {
      markChartEmpty('attendanceChart');
    }

    if (Array.isArray(marks.summary) && marks.summary.length) {
      clearChartEmpty('performanceChart');
      renderPerformanceChart(marks.summary);
    } else {
      markChartEmpty('performanceChart');
    }
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

    setStat('overallAttendance', attendance.percent != null ? attendance.percent + '%' : '--');
    setStat('currentCGPA', marks.gpa != null ? String(marks.gpa) : '--');
    updateStripAttendance(attendance);

    if (attendance.total > 0) {
      updateAttendanceChart(attendance.present, attendance.absent);
    }
    if (Array.isArray(marks.summary) && marks.summary.length) {
      updatePerformanceChart(marks.summary);
    }
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

  function setStat(id, txt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    el.classList.remove('loading-skeleton');
    const box = el.closest('.stat-box');
    if (!box) return;
    let link = box.querySelector('.stat-connect-link');
    if (txt === '--') {
      el.classList.add('stat-muted');
      if (!link) {
        link = document.createElement('a');
        link.className = 'stat-connect-link';
        link.href = '/connect-portal.html';
        link.textContent = 'CONNECT SOA PORTAL \u2192';
        box.appendChild(link);
      }
    } else {
      el.classList.remove('stat-muted');
      if (link) link.remove();
    }
  }

  function offlineCacheReady() {
    try {
      return Boolean(window.APP && window.APP.OfflineCache && window.APP.OfflineCache.available && window.APP.OfflineCache.available());
    } catch (_) {
      return false;
    }
  }

  async function offlineCachePut(key, value) {
    if (!offlineCacheReady()) return;
    try {
      await window.APP.OfflineCache.put(key, value);
      await window.APP.OfflineCache.setStamp(key, new Date().toISOString());
    } catch (_) { }
  }

  async function offlineCacheGet(key) {
    if (!offlineCacheReady()) return null;
    try {
      return await window.APP.OfflineCache.get(key);
    } catch (_) {
      return null;
    }
  }

  async function offlineCacheStamp(key) {
    if (!offlineCacheReady()) return null;
    try {
      return await window.APP.OfflineCache.getStamp(key);
    } catch (_) {
      return null;
    }
  }

  async function showCachedBadge() {
    const hero = document.querySelector('.page-hero .hero-content-inline > div');
    if (!hero || document.getElementById('dashboardCacheBadge')) return;
    const stamp = await offlineCacheStamp('attendance');
    const badge = document.createElement('div');
    badge.id = 'dashboardCacheBadge';
    badge.className = 'cache-badge';
    badge.textContent = formatStampLabel(stamp);
    hero.appendChild(badge);
  }

  function formatStampLabel(stamp) {
    const date = typeof stamp === 'string' && stamp ? new Date(stamp) : null;
    if (!date || Number.isNaN(date.getTime())) return 'CACHED';
    const pad = (value) => String(value).padStart(2, '0');
    return `CACHED \u00b7 SYNCED ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function istFormatter(options) {
    return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: 'Asia/Kolkata' }, options));
  }

  function istDayName() {
    const fallback = DAY_NAMES[new Date().getDay()];
    try {
      const part = istFormatter({ weekday: 'long' }).formatToParts(new Date()).find((item) => item.type === 'weekday');
      return part && DAY_NAMES.includes(part.value) ? part.value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function istMinutesOfDay() {
    try {
      const parts = istFormatter({ hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const hourPart = parts.find((item) => item.type === 'hour');
      const minutePart = parts.find((item) => item.type === 'minute');
      const hour = Number(hourPart && hourPart.value);
      const minute = Number(minutePart && minutePart.value);
      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        return (hour % 24) * 60 + minute;
      }
    } catch (_) { }
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function markChartEmpty(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.parentElement) return;
    const wrapper = canvas.parentElement;
    canvas.style.display = 'none';
    if (wrapper.querySelector('.chart-empty')) return;
    const empty = document.createElement('div');
    empty.className = 'chart-empty';
    empty.innerHTML = '<div class="chart-empty-label">NO DATA YET</div><a class="stat-connect-link" href="/connect-portal.html">CONNECT SOA PORTAL \u2192</a>';
    wrapper.appendChild(empty);
  }

  function clearChartEmpty(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.parentElement) return;
    const wrapper = canvas.parentElement;
    const empty = wrapper.querySelector('.chart-empty');
    if (empty) empty.remove();
    canvas.style.display = '';
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
      await offlineCachePut('attendance', r.data);
      return result;
    } catch (_) {
      const cachedSnapshot = await offlineCacheGet('attendance');
      if (cachedSnapshot && Array.isArray(cachedSnapshot.summary) && cachedSnapshot.summary.length) {
        const result = normalizeAttendance(cachedSnapshot);
        await showCachedBadge();
        return result;
      }
      return { present: 0, absent: 0, total: 0, percent: null, summary: [] };
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
    const percent = total ? Math.round((present / total) * 100) : null;
    return { present, total, absent, percent, summary };
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
      await offlineCachePut('marks', r.data);
      return result;
    } catch (_) {
      const cachedSnapshot = await offlineCacheGet('marks');
      if (cachedSnapshot && ((Array.isArray(cachedSnapshot.summary) && cachedSnapshot.summary.length) || cachedSnapshot.cgpa != null)) {
        const result = normalizeMarks(cachedSnapshot);
        await showCachedBadge();
        return result;
      }
      return { gpa: null, summary: [] };
    }
  }

  function normalizeMarks(data) {
    const summary = data?.summary || [];
    if (!summary.length) {
      return { gpa: data?.cgpa != null ? Number(data.cgpa) : null, summary };
    }
    let totalPct = 0;
    summary.forEach(s => {
      totalPct += (Number(s.avg_marks || 0) / Number(s.avg_total || 100)) * 100;
    });
    const avgPct = totalPct / summary.length;
    const gpa = data?.cgpa != null ? Number(data.cgpa) : Number((avgPct / 10).toFixed(2));
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
      return { pendingCount: null };
    }
  }

  function normalizeAssignments(list) {
    const arr = Array.isArray(list) ? list : (list?.data || []);
    if (!arr.length) return { pendingCount: null };
    const pendingCount = arr.filter(a => /pending|not submitted/i.test(String(a.submission_status || ''))).length;
    return { pendingCount };
  }

  async function getEvents() {
    // Check cache first
    const cached = dataCache.get('events');
    if (cached) return cached;

    try {
      const r = await APP.API.get('/events');
      const result = { count: Array.isArray(r.data) ? r.data.length : null };
      dataCache.set('events', result);
      return result;
    } catch (_) {
      return { count: null };
    }
  }

  // Store chart instances to destroy before re-creating
  let attendanceChartInstance = null;
  let performanceChartInstance = null;

  function isLightTheme() {
    return document.body.classList.contains('light-theme');
  }

  function chartTextColor() {
    return isLightTheme() ? '#1d1d20' : '#f6f3ee';
  }

  function chartGridColor() {
    return isLightTheme() ? 'rgba(29, 29, 32, 0.1)' : 'rgba(255,255,255,0.1)';
  }

  function renderAttendanceChart(present, absent) {
    const el = document.getElementById('attendanceChart');
    if (!el) return;
    clearChartEmpty('attendanceChart');
    
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
              labels: { color: chartTextColor() }
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
    clearChartEmpty('performanceChart');

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

    if (!summary || !summary.length) {
      return;
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
            backgroundColor: '#d71921',
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
              ticks: { color: chartTextColor() },
              grid: { color: chartGridColor() }
            },
            x: {
              ticks: { color: chartTextColor() },
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
      return;
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

  async function renderTodaySchedule() {
    const container = document.getElementById('todaySchedule');
    if (!container) return;

    let serverData = null;
    try {
      const r = await APP.API.get('/soa/me');
      serverData = r?.data || null;
    } catch (_) { }

    if (!serverData) {
      const cachedSnapshot = await offlineCacheGet('timetable');
      if (cachedSnapshot && buildTimetableModel(cachedSnapshot)) {
        serverData = cachedSnapshot;
        await showCachedBadge();
      }
    }

    if (serverData) {
      await offlineCachePut('timetable', serverData);
    }

    const model = serverData ? buildTimetableModel(serverData) : null;
    if (!model) {
      updateStripNextClass(null);
      container.innerHTML = `
        <div class="schedule-item">
          <div>
            <strong>NO TIMETABLE YET</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.25rem 0 0.6rem 0;">IMPORT YOUR TIMETABLE TO SEE TODAY</p>
            <a class="stat-connect-link" href="/connect-portal.html">CONNECT SOA PORTAL \u2192</a>
          </div>
          <div style="color: var(--text-secondary);">—</div>
        </div>
      `;
      return;
    }

    const day = istDayName();
    const entries = extractTodayEntries(model, day);
    const nowMinutes = istMinutesOfDay();
    const activeEntry = entries.find((entry) => entry.startTime != null && entry.endTime != null && nowMinutes >= entry.startTime && nowMinutes <= entry.endTime);
    const nextEntry = activeEntry ? null : entries.find((entry) => entry.startTime != null && entry.startTime > nowMinutes);
    updateStripNextClass(activeEntry ? Object.assign({}, activeEntry, { isNow: true }) : nextEntry);

    if (!entries.length) {
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

    container.innerHTML = entries.map((entry) => renderScheduleItem(entry, nowMinutes)).join('');
  }

  function renderScheduleItem(entry, nowMinutes) {
    const isNow = entry.startTime != null && entry.endTime != null && nowMinutes >= entry.startTime && nowMinutes <= entry.endTime;
    return `
      <div class="schedule-item"${isNow ? ' style="border-left: 2px solid var(--primary);"' : ''}>
        <div>
          <strong>${isNow ? '<span style="color: var(--primary);">NOW</span> \u00b7 ' : ''}${APP.sanitize(entry.subject || 'Saved class')}</strong>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.25rem 0 0 0;">
            ${APP.sanitize(entry.details || entry.rawText)}
          </p>
        </div>
        <div style="color: var(--primary); font-weight: 600;">${APP.sanitize(entry.timeLabel || '')}</div>
      </div>
    `;
  }

  function buildTimetableModel(data) {
    const rawSection = data?.raw?.sections?.timetable || null;
    const rawTable = Array.isArray(rawSection?.tables)
      ? rawSection.tables.find((table) => Array.isArray(table.rows) && table.rows.length)
      : null;

    if (rawTable) {
      const headers = Array.isArray(rawTable.headers) && rawTable.headers.length
        ? rawTable.headers.map((header) => String(header || '').trim())
        : Array.from({ length: Math.max(...rawTable.rows.map((row) => Array.isArray(row) ? row.length : 0), 0) }, (_, index) => `Column ${index + 1}`);
      const rows = rawTable.rows
        .filter((row) => Array.isArray(row) && row.some((cell) => hasText(cell)))
        .map((row) => headers.map((_, index) => String(row[index] || '').trim()));

      if (rows.length) {
        return { headers, rows };
      }
    }

    const timetable = Array.isArray(data?.timetable) ? data.timetable : [];
    if (!timetable.length) {
      return null;
    }

    if (Array.isArray(timetable[0])) {
      const width = Math.max(...timetable.map((row) => Array.isArray(row) ? row.length : 0), 0);
      return {
        headers: Array.from({ length: width }, (_, index) => `Column ${index + 1}`),
        rows: timetable.map((row) => Array.from({ length: width }, (_, index) => String((row || [])[index] || '').trim()))
      };
    }

    const headers = Array.from(timetable.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set()));

    if (!headers.length) {
      return null;
    }

    return {
      headers,
      rows: timetable.map((row) => headers.map((header) => String(row?.[header] || '').trim()))
    };
  }

  function extractTodayEntries(model, today) {
    const normalizeLabel = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const headerDayIndex = model.headers.findIndex((header) => normalizeLabel(header) === normalizeLabel(today));
    let cells = [];

    if (headerDayIndex !== -1) {
      cells = model.rows.map((row) => row[headerDayIndex]);
    } else {
      const rowForToday = model.rows.find((row) => normalizeLabel(row[0]) === normalizeLabel(today));
      if (rowForToday) {
        cells = rowForToday.slice(1).map((cell, index) => [cell, model.headers[index + 1]]).map(pair => pair.join(' \u2014 '));
      }
    }

    return cells.map(parseTimetableCell).filter(Boolean);
  }

  function parseTimetableCell(text) {
    const rawText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!hasText(rawText) || /^(-|break|lunch|free)$/i.test(rawText)) {
      return null;
    }

    const timeMatch = rawText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const subjectCodeMatch = rawText.match(/\b[A-Z]{2,}\d{3,}[A-Z]?\b/);
    const roomMatch = rawText.match(/\b[A-Z]-\d+(?:\/[A-Z ]+)?\b|\bCLASS ROOM\b|\bLAB\b/i);
    const timeLabel = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : null;
    const startTime = timeMatch ? parseTodayTime(timeMatch[1]) : null;
    const endTime = timeMatch ? parseTodayTime(timeMatch[2]) : null;
    const withoutTime = timeMatch ? rawText.replace(timeMatch[0], '').trim() : rawText;
    const subject = subjectCodeMatch ? subjectCodeMatch[0] : withoutTime.slice(0, 80);

    return {
      rawText,
      timeLabel,
      startTime,
      endTime,
      endLabel: timeMatch ? timeMatch[2].trim() : null,
      subject,
      details: roomMatch ? `${withoutTime} | ${roomMatch[0]}` : withoutTime
    };
  }

  function parseTodayTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridian = (match[3] || '').toUpperCase();

    if (meridian === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridian === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }

  function hasText(value) {
    return Boolean(String(value || '').trim());
  }

  function updateStripNextClass(entry) {
    const labelEl = document.getElementById('stripNextClass');
    if (entry && entry.isNow) {
      setText('stripNextClass', entry.subject ? `NOW: ${entry.subject}` : 'NOW');
      const timeEl = document.getElementById('stripNextClassTime');
      if (timeEl) {
        timeEl.textContent = entry.endLabel ? `until ${entry.endLabel}` : (entry.timeLabel || '');
      }
      if (labelEl) {
        labelEl.style.color = 'var(--primary)';
      }
      return;
    }
    setText('stripNextClass', entry?.subject || 'NO CLASS');
    const timeEl = document.getElementById('stripNextClassTime');
    if (timeEl) {
      timeEl.textContent = entry?.timeLabel || '';
    }
    if (labelEl) {
      labelEl.style.color = '';
    }
  }

  function updateStripAttendance(attendance) {
    setText('stripAttendance', attendance.percent != null ? attendance.percent + '%' : '--');
    const subEl = document.getElementById('stripAttendanceSub');
    if (subEl) {
      subEl.textContent = attendance.total > 0
        ? `${attendance.present}/${attendance.total} classes`
        : '';
    }
  }

  async function loadBunkBudgetCell() {
    const strip = document.getElementById('todayStrip');
    if (!strip || document.getElementById('stripBunkBudget')) return;
    const cell = document.createElement('div');
    cell.className = 'today-cell';
    cell.innerHTML = '<span class="today-label">BUNK BUDGET</span><span class="today-value" id="stripBunkBudget">--</span><span class="today-sub" id="stripBunkBudgetSub"></span>';
    strip.appendChild(cell);
    try {
      const r = await APP.API.get('/attendance/bunk-plan?threshold=75');
      const canMissValues = (Array.isArray(r?.subjects) ? r.subjects : [])
        .map((s) => Number(s.canMiss))
        .filter((v) => Number.isFinite(v));
      const el = document.getElementById('stripBunkBudget');
      if (el && canMissValues.length) {
        el.textContent = `${Math.min(...canMissValues)} classes`;
        const subEl = document.getElementById('stripBunkBudgetSub');
        if (subEl) subEl.textContent = 'at 75% target';
      }
    } catch (_) { }
  }

  async function loadNextDeadline() {
    try {
      const r = await APP.API.get('/agenda');
      deadlineFailures = 0;
      clearDeadlineRetry();
      const items = Array.isArray(r?.items) ? r.items : [];
      const now = Date.now();
      const next = items.find(item => item && item.dueAt && new Date(item.dueAt).getTime() > now);
      if (!next) {
        setDeadlineState('NONE', false);
        return;
      }
      setDeadlineState(next.title || 'Untitled', false);
      const dueEl = document.getElementById('stripDeadlineDue');
      if (dueEl) {
        dueEl.textContent = formatDueIn(new Date(next.dueAt).getTime());
      }
    } catch (_) {
      deadlineFailures += 1;
      const dueEl = document.getElementById('stripDeadlineDue');
      if (dueEl && !dueEl.textContent) {
        dueEl.textContent = '';
      }
      setDeadlineState(deadlineFailures >= 2 ? 'UNAVAILABLE' : '--', true);
      attachDeadlineRetry();
    }
  }

  function setDeadlineState(text, muted) {
    const el = document.getElementById('stripDeadline');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('stat-muted', Boolean(muted));
  }

  function attachDeadlineRetry() {
    const el = document.getElementById('stripDeadline');
    if (!el || deadlineRetryLink || !el.isConnected) return;
    const retry = document.createElement('a');
    retry.className = 'stat-connect-link';
    retry.href = '#';
    retry.style.marginLeft = '0.4rem';
    retry.textContent = 'RETRY';
    retry.addEventListener('click', (event) => {
      event.preventDefault();
      loadNextDeadline();
    });
    el.insertAdjacentElement('afterend', retry);
    deadlineRetryLink = retry;
  }

  function clearDeadlineRetry() {
    if (deadlineRetryLink) {
      deadlineRetryLink.remove();
      deadlineRetryLink = null;
    }
  }

  function formatDueIn(dueTime) {
    const diff = dueTime - Date.now();
    if (diff <= 0) return 'now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `due in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `due in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `due in ${days}d`;
  }

  function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    const section = container.closest('.dashboard-section') || container;
    section.style.display = 'none';
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
