// Admin Announcements Page - Enhanced
(function() {
  'use strict';

  let announcements = [];
  let filteredAnnouncements = [];
  let currentView = 'grid';

  const elements = {
    list: document.getElementById('annList'),
    empty: document.getElementById('annEmpty'),
    search: document.getElementById('annSearch'),
    filterPriority: document.getElementById('filterPriority'),
    filterAudience: document.getElementById('filterAudience'),
    filterStatus: document.getElementById('filterStatus'),
    resetFilters: document.getElementById('resetFilters'),
    newBtn: document.getElementById('newAnnBtn'),
    modal: document.getElementById('announcementModal'),
    form: document.getElementById('announcementForm'),
    totalAnnouncements: document.getElementById('totalAnnouncements'),
    activeAnnouncements: document.getElementById('activeAnnouncements'),
    urgentAnnouncements: document.getElementById('urgentAnnouncements'),
    thisMonthAnnouncements: document.getElementById('thisMonthAnnouncements'),
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();
    bindEvents();
    initializeViewToggle();
  });

  async function loadAnnouncements() {
    try {
      const result = await APP.API.get('/admin/announcements');
      announcements = result.data || [];
      updateStats();
      applyFilters();
    } catch (error) {
      console.error('Error loading announcements:', error);
      announcements = [];
      updateStats();
      renderLoadError(error);
    }
  }

  function renderLoadError(error) {
    if (!elements.list) return;
    elements.list.style.display = 'block';
    if (elements.empty) elements.empty.style.display = 'none';
    elements.list.innerHTML = `
      <div class="announcement-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
        <p style="color: var(--error, #ff6b6b); margin-bottom: 1rem;">Failed to load announcements${error && error.message ? `: ${escapeHtml(error.message)}` : ''}</p>
        <button class="btn btn-primary" id="annRetryBtn">Retry</button>
      </div>
    `;
    document.getElementById('annRetryBtn')?.addEventListener('click', () => {
      elements.list.innerHTML = '<div class="announcement-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Loading...</div>';
      loadAnnouncements();
    });
  }

  function updateStats() {
    elements.totalAnnouncements.textContent = announcements.length;
    elements.activeAnnouncements.textContent = announcements.filter(a => a.status === 'active').length;
    elements.urgentAnnouncements.textContent = announcements.filter(a => a.priority === 'urgent').length;

    const thisMonth = announcements.filter(a => {
      const date = new Date(a.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    elements.thisMonthAnnouncements.textContent = thisMonth;
  }

  function applyFilters() {
    const searchQuery = (elements.search?.value || '').toLowerCase();
    const priority = elements.filterPriority?.value || '';
    const audience = elements.filterAudience?.value || '';
    const status = elements.filterStatus?.value || '';

    filteredAnnouncements = announcements.filter(ann => {
      const matchesSearch = !searchQuery ||
        ann.title.toLowerCase().includes(searchQuery) ||
        ann.content.toLowerCase().includes(searchQuery);

      return matchesSearch &&
        (!priority || ann.priority === priority) &&
        (!audience || ann.target_audience === audience) &&
        (!status || ann.status === status);
    });

    renderAnnouncements();
  }

  function renderAnnouncements() {
    if (!elements.list) return;

    if (filteredAnnouncements.length === 0) {
      elements.list.style.display = 'none';
      elements.empty.style.display = 'flex';
      return;
    }

    elements.list.style.display = currentView === 'grid' ? 'grid' : 'flex';
    elements.empty.style.display = 'none';

    const sorted = [...filteredAnnouncements].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    elements.list.innerHTML = sorted.map(ann => createAnnouncementCard(ann)).join('');
  }

  function createAnnouncementCard(ann) {
    const date = new Date(ann.created_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const priorityIcon = {urgent: '🔴', normal: '🟢', info: '🔵'}[ann.priority] || '🟢';
    const audienceIcon = {all: '👥', students: '👨‍🎓', teachers: '👨‍🏫', department: '🎓'}[ann.target_audience] || '👥';

    return `
      <div class="announcement-card" data-priority="${escapeHtml(String(ann.priority || ''))}" data-id="${escapeHtml(String(ann.id))}">
        ${ann.pinned ? '<div class="pinned-badge">📌 Pinned</div>' : ''}

        <h3 class="announcement-title">${escapeHtml(ann.title)}</h3>

        <div class="announcement-meta">
          <span class="announcement-meta-item">📅 ${dateStr}</span>
          <span class="announcement-meta-item">🕐 ${timeStr}</span>
          <span class="announcement-meta-item">👤 ${escapeHtml(ann.created_by || 'Admin')}</span>
        </div>

        <p class="announcement-content">${escapeHtml(ann.content)}</p>

        <div class="announcement-badges">
          <span class="priority-badge ${escapeHtml(String(ann.priority || ''))}">${priorityIcon} ${escapeHtml(String(ann.priority || ''))}</span>
          <span class="audience-badge">${audienceIcon} ${escapeHtml(formatAudience(ann))}</span>
        </div>

        <div class="announcement-actions">
          <button class="btn btn-sm btn-primary" onclick="editAnnouncement('${escapeHtml(String(ann.id))}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${escapeHtml(String(ann.id))}', this)">🗑️ Delete</button>
        </div>
      </div>
    `;
  }

  function formatAudience(ann) {
    if (ann.target_audience === 'department' && ann.department) {
      return `${ann.department} Dept`;
    }
    return ann.target_audience.charAt(0).toUpperCase() + ann.target_audience.slice(1);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function notify(message, type) {
    if (typeof showToast === 'function') showToast(message, type);
    else if (window.Toast?.show) window.Toast.show({ type, message });
  }

  function bindEvents() {
    elements.search?.addEventListener('input', debounce(applyFilters, 300));
    elements.filterPriority?.addEventListener('change', applyFilters);
    elements.filterAudience?.addEventListener('change', applyFilters);
    elements.filterStatus?.addEventListener('change', applyFilters);
    elements.resetFilters?.addEventListener('click', resetFilters);
    elements.newBtn?.addEventListener('click', openNewAnnouncementModal);
    elements.form?.addEventListener('submit', handleFormSubmit);
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function resetFilters() {
    if (elements.search) elements.search.value = '';
    if (elements.filterPriority) elements.filterPriority.value = '';
    if (elements.filterAudience) elements.filterAudience.value = '';
    if (elements.filterStatus) elements.filterStatus.value = '';
    applyFilters();
  }

  function initializeViewToggle() {
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderAnnouncements();
      });
    });
  }

  function openNewAnnouncementModal() {
    elements.modal.classList.add('active');
    document.getElementById('modalTitleText').textContent = 'Create New Announcement';
    elements.form.reset();
  }

  window.closeAnnouncementModal = function() {
    elements.modal.classList.remove('active');
  };

  window.toggleDepartmentField = function() {
    const audience = document.getElementById('annAudience').value;
    const deptRow = document.getElementById('departmentRow');
    const deptSelect = document.getElementById('annDepartment');

    if (audience === 'department') {
      deptRow.style.display = 'flex';
      deptSelect.required = true;
    } else {
      deptRow.style.display = 'none';
      deptSelect.required = false;
    }
  };

  async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = elements.form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      title: document.getElementById('annTitle').value.trim(),
      content: document.getElementById('annContent').value.trim(),
      priority: document.getElementById('annPriority').value,
      target_audience: document.getElementById('annAudience').value,
      department: document.getElementById('annDepartment').value || null,
      pinned: document.getElementById('annPinned')?.checked || false,
      status: 'active'
    };

    try {
      await APP.API.post('/admin/announcements', payload);
      notify('Announcement published successfully!', 'success');
      window.closeAnnouncementModal();
      await loadAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      notify(`Failed to publish announcement: ${error.message || 'request failed'}`, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  window.editAnnouncement = function(id) {
    const ann = announcements.find(a => String(a.id) === String(id));
    if (!ann) return;

    elements.modal.classList.add('active');
    document.getElementById('modalTitleText').textContent = 'Edit Announcement';
    document.getElementById('annTitle').value = ann.title;
    document.getElementById('annContent').value = ann.content;
    document.getElementById('annPriority').value = ann.priority;
    document.getElementById('annAudience').value = ann.target_audience;
    window.toggleDepartmentField();
  };

  window.deleteAnnouncement = function(id, btn) {
    if (!btn.dataset.confirming) {
      btn.dataset.confirming = 'true';
      btn.textContent = 'Click again to confirm';
      setTimeout(() => {
        if (btn.isConnected) {
          delete btn.dataset.confirming;
          btn.textContent = '🗑️ Delete';
        }
      }, 4000);
      return;
    }

    const card = btn.closest('.announcement-card');
    if (card) card.remove();
    announcements = announcements.filter(a => String(a.id) !== String(id));
    updateStats();

    APP.API.delete(`/admin/announcements/${encodeURIComponent(id)}`)
      .then(() => {
        notify('Announcement deleted successfully!', 'success');
      })
      .catch((error) => {
        console.error('Error deleting announcement:', error);
        notify(`Failed to delete announcement: ${error.message || 'request failed'}`, 'error');
        loadAnnouncements();
      });
  };

  window.exportAnnouncements = function() {
    if (!announcements.length) {
      notify('No announcements to export', 'warning');
      return;
    }
    const rows = [['ID', 'Title', 'Content', 'Priority', 'Audience', 'Department', 'Status', 'Pinned', 'Created By', 'Created At']]
      .concat(announcements.map(a => [
        a.id, a.title, a.content, a.priority, a.target_audience,
        a.department || '', a.status || '', a.pinned ? 'yes' : 'no',
        a.created_by || '', a.created_at || ''
      ]));
    const csv = rows.map(row => row.map(cell => {
      const val = String(cell ?? '');
      return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
    }).join(',')).join('\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `announcements-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    notify('Announcements exported to CSV', 'success');
  };

})();
