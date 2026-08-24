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
    setText('totalUsers', stats.totalUsers != null ? stats.totalUsers : '--');
    setText('totalStudents', stats.totalStudents ?? '--');
    setText('totalTeachers', stats.totalTeachers ?? '--');
    setText('pendingApprovals', stats.pendingApprovals ?? '--');
    setText('totalFiles', stats.totalFiles ?? '--');
    setText('totalAssignments', stats.totalAssignments ?? '--');
    setText('totalEvents', stats.totalEvents ?? '--');
    setText('avgAttendance', stats.avgAttendance != null ? stats.avgAttendance + '%' : '--');

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
      const token = APP.Storage.get('accessToken');
      const response = await fetch('/api/health/ai-service', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
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
    } catch(err) {
      console.error('Error loading admin stats:', err);
      return {};
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

    const departments = stats.departments || [];

    try {
      new Chart(el, {
        type: 'bar',
        data: {
          labels: departments.map(d => d.name),
          datasets: [{
            label: 'Students',
            data: departments.map(d => d.count),
            backgroundColor: '#6366f1',
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
        <tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger, #d71921);">
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
          note: 'primary',
          notes: 'primary',
          assignment: 'warning',
          assignments: 'warning',
          pyq: 'success',
          event: 'info',
          events: 'info',
          announcement: 'info',
          announcements: 'info'
        };
        const itemType = a.category || a.type || 'file';
        const typeColor = typeColors[itemType] || 'primary';

        return `
          <tr>
            <td><span class="badge badge-${typeColor}">${escapeHtml(itemType.toUpperCase())}</span></td>
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

  async function loadRecentActivity(){
    const container = document.getElementById('recentActivity');
    if (!container) return;

    container.innerHTML = '<div class="activity-item"><div class="activity-description" style="font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">LOADING ACTIVITY…</div></div>';

    let logs;
    try {
      const response = await APP.API.get('/admin/activity-log?limit=7');
      logs = response.data || [];
    } catch (err) {
      console.error('Error loading activity log:', err);
      container.innerHTML = '<div class="activity-item"><div class="activity-description" style="font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">ACTIVITY UNAVAILABLE — COULD NOT REACH THE SERVER</div></div>';
      return;
    }

    if (!logs.length) {
      container.innerHTML = '<div class="activity-item"><div class="activity-description" style="font-family: \'IBM Plex Mono\', ui-monospace, monospace; letter-spacing: 0.08em; color: var(--text-secondary);">NO RECENT ACTIVITY</div></div>';
      return;
    }

    container.innerHTML = logs.map(a => {
      const who = a.user_name || a.user_id || 'System';
      const what = a.action || a.details || 'activity';
      const when = a.created_at || a.timestamp;
      const timeStr = when ? new Date(when).toLocaleString() : '';
      return `
      <div class="activity-item">
        <div class="activity-header">
          <span class="activity-user">${escapeHtml(String(who))}</span>
          <span class="activity-time">${escapeHtml(timeStr)}</span>
        </div>
        <div class="activity-description">${escapeHtml(String(what))}</div>
      </div>
    `;}).join('');
  }

  // Make functions global for onclick handlers
  window.loadPendingApprovals = loadPendingApprovals;
  window.approveItem = async function(id) {
    try {
      await APP.API.post(`/files/approve/${encodeURIComponent(id)}`, {});
      Toast.success('Item approved successfully', 'Success');
      setTimeout(loadPendingApprovals, 800);
    } catch (err) {
      console.error('Approve failed:', err);
      Toast.error(`Approve failed: ${err.message || 'request failed'}`);
    }
  };

  window.rejectItem = async function(id) {
    try {
      await APP.API.post(`/admin/approvals/${encodeURIComponent(id)}/reject`, {});
      Toast.warning('Item rejected', 'Rejected');
      setTimeout(loadPendingApprovals, 800);
    } catch (err) {
      console.error('Reject failed:', err);
      Toast.error(`Reject failed: ${err.message || 'request failed'}`);
    }
  };

})();
