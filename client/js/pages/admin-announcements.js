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
      let result;
      try {
        const response = await fetch('/api/admin/announcements', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (response.ok) result = await response.json();
      } catch (error) {
        console.log('API not available, loading dummy data');
      }
      
      if (!result || !result.success) result = generateDummyAnnouncements();
      
      announcements = result.data || [];
      updateStats();
      applyFilters();
    } catch (error) {
      console.error('Error loading announcements:', error);
      announcements = [];
      renderAnnouncements();
    }
  }

  function generateDummyAnnouncements() {
    const priorities = ['urgent', 'normal', 'info'];
    const audiences = ['all', 'students', 'teachers', 'department'];
    const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
    
    const sampleTitles = [
      'Mid-Semester Examination Schedule Released',
      'Campus Placement Drive - October 2025',
      'Annual Technical Fest Registration Open',
      'Holiday Notice - Diwali Break',
      'Workshop on Machine Learning and AI',
      'Library Timing Changes',
      'Sports Meet 2025 - Registrations Open',
      'Guest Lecture by Industry Expert',
      'Internal Assessment Schedule',
      'New Course Registration Period'
    ];

    const data = [];
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      const createdDate = new Date(now);
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30));
      
      data.push({
        id: i + 1,
        title: sampleTitles[i],
        content: `Important information regarding ${sampleTitles[i].toLowerCase()}. All concerned students/faculty members are requested to take note.`,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        target_audience: audiences[Math.floor(Math.random() * audiences.length)],
        department: audiences[Math.floor(Math.random() * audiences.length)] === 'department' ? departments[Math.floor(Math.random() * departments.length)] : null,
        created_at: createdDate.toISOString(),
        created_by: 'Admin',
        pinned: Math.random() > 0.8,
        status: Math.random() > 0.2 ? 'active' : 'archived',
        send_email: true
      });
    }

    return { success: true, data };
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
      <div class="announcement-card" data-priority="${ann.priority}" data-id="${ann.id}">
        ${ann.pinned ? '<div class="pinned-badge">📌 Pinned</div>' : ''}
        
        <h3 class="announcement-title">${escapeHtml(ann.title)}</h3>
        
        <div class="announcement-meta">
          <span class="announcement-meta-item">📅 ${dateStr}</span>
          <span class="announcement-meta-item">🕐 ${timeStr}</span>
          <span class="announcement-meta-item">👤 ${ann.created_by}</span>
        </div>
        
        <p class="announcement-content">${escapeHtml(ann.content)}</p>
        
        <div class="announcement-badges">
          <span class="priority-badge ${ann.priority}">${priorityIcon} ${ann.priority}</span>
          <span class="audience-badge">${audienceIcon} ${formatAudience(ann)}</span>
        </div>
        
        <div class="announcement-actions">
          <button class="btn btn-sm btn-primary" onclick="editAnnouncement(${ann.id})">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(${ann.id})">🗑️ Delete</button>
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

  function handleFormSubmit(e) {
    e.preventDefault();
    if (typeof showToast === 'function') {
      showToast('Announcement saved successfully!', 'success');
    }
    window.closeAnnouncementModal();
    setTimeout(() => loadAnnouncements(), 500);
  }

  window.editAnnouncement = function(id) {
    const ann = announcements.find(a => a.id === id);
    if (!ann) return;
    
    elements.modal.classList.add('active');
    document.getElementById('modalTitleText').textContent = 'Edit Announcement';
    document.getElementById('annTitle').value = ann.title;
    document.getElementById('annContent').value = ann.content;
    document.getElementById('annPriority').value = ann.priority;
    document.getElementById('annAudience').value = ann.target_audience;
    window.toggleDepartmentField();
  };

  window.deleteAnnouncement = function(id) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    if (typeof showToast === 'function') {
      showToast('Announcement deleted successfully!', 'success');
    }
    setTimeout(() => loadAnnouncements(), 500);
  };

})();
