(function(){
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'admin') {
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
  const AI_STATUS_REFRESH_INTERVAL_MS = 60 * 1000;
  let aiStatusRefreshTimer = null;

  // Client-side cache with TTL (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;
  const dataCache = {
    get(key) {
      try {
        const cached = sessionStorage.getItem(`admin_${key}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            return data;
          }
          sessionStorage.removeItem(`admin_${key}`);
        }
      } catch (_) {}
      return null;
    },
    set(key, data) {
      try {
        sessionStorage.setItem(`admin_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (_) {}
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Welcome name - immediate
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = user.name || 'Admin';

    bindAiStatusActions();
    loadAiServiceStatus();
    aiStatusRefreshTimer = window.setInterval(() => {
      loadAiServiceStatus({ silent: true });
    }, AI_STATUS_REFRESH_INTERVAL_MS);

    // Render static content immediately
    loadRecentActivity();

    // Load all data in parallel for faster loading
    const [stats, approvals] = await Promise.all([
      getAdminStats(),
      loadPendingApprovals()
    ]);
    
    // Update stats as soon as data is available
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
  }

  function bindAiStatusActions() {
    const refreshButton = document.getElementById('refreshAiStatusBtn');
    if (!refreshButton || refreshButton.dataset.bound === 'true') return;

    refreshButton.addEventListener('click', () => {
      loadAiServiceStatus();
    });
    refreshButton.dataset.bound = 'true';

    window.addEventListener('pagehide', () => {
      if (aiStatusRefreshTimer) {
        clearInterval(aiStatusRefreshTimer);
        aiStatusRefreshTimer = null;
      }
    }, { once: true });
  }

  function setText(id, txt){ 
    const el = document.getElementById(id); 
    if (el) el.textContent = txt; 
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function formatCheckedAt(timestamp) {
    if (!timestamp) return 'Checked just now';

    try {
      return `Checked ${new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    } catch (_) {
      return 'Checked just now';
    }
  }

  function applyAiBadge(elementId, text, tone) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = `ai-service-pill ai-service-pill-${tone}`;
    element.textContent = text;
  }

  function renderAiRecommendations(items) {
    const container = document.getElementById('aiServiceRecommendations');
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = '<div class="ai-recommendation-item">No immediate action needed. The AI providers look usable from the health endpoint.</div>';
      return;
    }

    container.innerHTML = items.map((item) => `
      <div class="ai-recommendation-item">${escapeHtml(item)}</div>
    `).join('');
  }

  function renderAiStatus(state) {
    setText('aiServiceStatusText', state.statusText);
    setText('aiOpenRouterState', state.openRouterText);
    setText('aiGeminiState', state.geminiText);
    setText('aiServiceCheckedAt', state.checkedAtText);
    setText('aiServiceSummary', state.summary);
    setText('aiDiagnosticsText', state.diagnosticsPath || '/api/health/ai-service');

    const diagnosticsLink = document.getElementById('aiDiagnosticsLink');
    if (diagnosticsLink) {
      diagnosticsLink.href = state.diagnosticsPath || '/api/health/ai-service';
    }

    applyAiBadge('aiServiceStatusBadge', state.statusBadgeText, state.statusTone);
    applyAiBadge('aiOpenRouterBadge', state.openRouterBadgeText, state.openRouterTone);
    applyAiBadge('aiGeminiBadge', state.geminiBadgeText, state.geminiTone);
    renderAiRecommendations(state.recommendations);
  }

  async function loadAiServiceStatus(options = {}) {
    const silent = options.silent === true;
    const refreshButton = document.getElementById('refreshAiStatusBtn');

    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = silent ? 'Auto Refreshing...' : 'Refreshing...';
    }

    if (!silent) {
      renderAiStatus({
        statusText: 'Checking live provider status...',
        openRouterText: 'Checking...',
        geminiText: 'Checking...',
        checkedAtText: 'Checking...',
        summary: 'Requesting the latest AI diagnostics from the server.',
        diagnosticsPath: '/api/health/ai-service',
        statusBadgeText: 'Pending',
        statusTone: 'pending',
        openRouterBadgeText: 'Unknown',
        openRouterTone: 'pending',
        geminiBadgeText: 'Unknown',
        geminiTone: 'pending',
        recommendations: ['Waiting for the health endpoint to respond...']
      });
    }

    try {
      const response = await fetch('/api/health/ai-service', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Health endpoint returned ${response.status}`);
      }

      const data = await response.json();
      const overallAvailable = data.status === 'available';
      const openRouterConfigured = Boolean(data.services?.openRouter?.configured);
      const openRouterAvailable = Boolean(data.services?.openRouter?.available);
      const geminiConfigured = Boolean(data.services?.gemini?.configured);

      renderAiStatus({
        statusText: overallAvailable ? 'AI replies should be available' : 'AI replies are currently blocked',
        openRouterText: openRouterAvailable
          ? 'Configured and available'
          : (openRouterConfigured ? 'Configured but unavailable' : 'Not configured'),
        geminiText: geminiConfigured ? 'Configured as fallback' : 'Not configured',
        checkedAtText: formatCheckedAt(data.timestamp),
        summary: overallAvailable
          ? 'The health endpoint reports at least one working AI provider. If the chatbot still falls back, inspect runtime request failures next.'
          : 'The server says no AI provider is currently available. Configure an API key on Render to enable full chatbot replies.',
        diagnosticsPath: '/api/health/ai-service',
        statusBadgeText: overallAvailable ? 'Available' : 'Unavailable',
        statusTone: overallAvailable ? 'ok' : 'error',
        openRouterBadgeText: openRouterAvailable ? 'Live' : (openRouterConfigured ? 'Issue' : 'Missing'),
        openRouterTone: openRouterAvailable ? 'ok' : (openRouterConfigured ? 'error' : 'pending'),
        geminiBadgeText: geminiConfigured ? 'Ready' : 'Missing',
        geminiTone: geminiConfigured ? 'neutral' : 'pending',
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : []
      });
    } catch (error) {
      console.error('Error loading AI service status:', error);
      renderAiStatus({
        statusText: 'AI diagnostics request failed',
        openRouterText: 'Unknown',
        geminiText: 'Unknown',
        checkedAtText: 'Check failed',
        summary: 'The dashboard could not fetch `/api/health/ai-service`. Verify the backend is running and reachable.',
        diagnosticsPath: '/api/health/ai-service',
        statusBadgeText: 'Error',
        statusTone: 'error',
        openRouterBadgeText: 'Unknown',
        openRouterTone: 'pending',
        geminiBadgeText: 'Unknown',
        geminiTone: 'pending',
        recommendations: [
          `Request failed: ${error.message}`,
          'Open /api/health/ai-service directly to inspect the backend response.',
          'If this is Render, check service logs for startup or environment variable issues.'
        ]
      });
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh';
      }
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getAdminStats(){
    // Check cache first
    const cached = dataCache.get('stats');
    if (cached) return cached;
    
    try { 
      const r = await APP.API.get('/admin/stats');
      const stats = r.data || {};
      dataCache.set('stats', stats);
      return stats;
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getAdminStats();
        const stats = r.data || {};
        dataCache.set('stats', stats);
        return stats;
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
      const response = await APP.API.get('/admin/approvals');
      var approvals = response.data || [];
    } catch(err) {
      console.error('Error loading approvals:', err);
      if (countBadge) countBadge.textContent = '';
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">
          Error loading approvals
          <button class="btn-small btn-secondary" onclick="loadPendingApprovals()" style="margin-left: 0.75rem;">Retry</button>
        </td></tr>`;
      return;
    }

    if (countBadge) countBadge.textContent = approvals.length;

    if (approvals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">NO PENDING ITEMS</td></tr>';
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
            <td><span class="badge badge-${typeColor}">${escapeHtml(String(a.type || 'file').toUpperCase())}</span></td>
            <td>${escapeHtml(a.uploaded_by_name || a.uploaded_by || 'Unknown')}</td>
            <td><strong>${escapeHtml(a.title || a.file_name || 'Untitled')}</strong></td>
            <td>${escapeHtml(dateStr)}</td>
            <td>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-small btn-success" onclick="approveItem('${escapeHtml(String(a.id))}')" title="Approve">
                  ✓
                </button>
                <button class="btn-small btn-danger" onclick="rejectItem('${escapeHtml(String(a.id))}')" title="Reject">
                  ✕
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
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
  window.approveItem = async function(id) {
    try {
      await APP.API.post(`/files/approve/${encodeURIComponent(id)}`, {});
      if (typeof Toast !== 'undefined') {
        Toast.success('Item approved successfully', 'Success');
      } else {
        showToast('Item approved successfully', 'success');
      }
      setTimeout(loadPendingApprovals, 800);
    } catch (err) {
      console.error('Approve failed:', err);
      showToast(`Approve failed: ${err.message || 'request failed'}`, 'error');
    }
  };

  window.rejectItem = async function(id) {
    try {
      await APP.API.post(`/admin/approvals/${encodeURIComponent(id)}/reject`, {});
      if (typeof Toast !== 'undefined') {
        Toast.warning('Item rejected', 'Rejected');
      } else {
        showToast('Item rejected', 'success');
      }
      setTimeout(loadPendingApprovals, 800);
    } catch (err) {
      console.error('Reject failed:', err);
      showToast(`Reject failed: ${err.message || 'request failed'}`, 'error');
    }
  };

})();
