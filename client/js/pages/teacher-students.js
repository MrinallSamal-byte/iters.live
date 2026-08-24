class TeacherStudentsPage {
  constructor() {
    this.students = [];
    this.filtered = [];
    this.page = 1;
    this.pageSize = 20;
    this.currentView = 'table';
    this.init();
  }

  init() {
    this.bind();
    this.load();
  }

  bind() {
    const search = document.getElementById('searchInput');
    search?.addEventListener('input', this.debounce(() => this.applyLocalFilters(), 350));
    ['deptFilter', 'yearFilter', 'sectionFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.applyLocalFilters());
    });
  }

  authHeaders() {
    const t = window.APP?.Storage?.get?.('accessToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  escape(str) { return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  jsId(id) { return String(id ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  async load() {
    try {
      const resp = await fetch('/api/mobile/teacher/students', { headers: this.authHeaders() });
      const payload = resp.ok ? await resp.json() : null;
      if (!resp.ok || !payload) throw new Error(payload?.message || 'Request failed');
      this.students = payload.data || [];
      this.applyLocalFilters();
      window.TeacherStudentsPageInstance.renderAttention();
    } catch (err) {
      console.error('Load students failed:', err);
      if (typeof DummyData !== 'undefined' && DummyData.getTeacherStudents) {
        const result = DummyData.getTeacherStudents({ limit: 50 });
        this.students = result?.data || [];
        this.applyLocalFilters();
        console.log('Loaded dummy student data');
      } else {
        const body = document.getElementById('studentsTableBody');
        if (body) body.innerHTML = '<tr><td colspan="10" class="loading-text">Failed to load students</td></tr>';
      }
    }
  }

  applyLocalFilters() {
    const dept = document.getElementById('deptFilter')?.value || '';
    const year = document.getElementById('yearFilter')?.value || '';
    const section = document.getElementById('sectionFilter')?.value || '';
    const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

    this.filtered = this.students.filter(s => {
      if (dept && String(s.department || '') !== dept) return false;
      if (year && String(s.year ?? '') !== year) return false;
      if (section && String(s.section || '') !== section) return false;
      if (q && !`${s.name || ''} ${s.registration_number || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    this.page = 1;
    this.updateStats();
    this.renderCurrentView();
    this.renderPagination();
  }

  updateStats() {
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const count = document.getElementById('studentCount');
    if (count) count.textContent = `(${this.filtered.length})`;
    setEl('totalStudents', this.filtered.length);
    if (!this.filtered.length) { setEl('avgPerformance', '--%'); setEl('lowPerformers', 0); setEl('topPerformers', 0); return; }
    const avgMarks = Math.round(this.filtered.reduce((sum, s) => sum + Number(s.avg_marks || 0), 0) / this.filtered.length);
    setEl('avgPerformance', `${avgMarks}%`);
    setEl('lowPerformers', this.filtered.filter(s => Number(s.avg_marks || 0) < 50).length);
    setEl('topPerformers', this.filtered.filter(s => Number(s.avg_marks || 0) >= 85).length);
  }

  renderCurrentView() {
    if (this.currentView === 'table') this.renderTable();
    else this.renderCards();
  }

  renderTable() {
    const body = document.getElementById('studentsTableBody');
    if (!body) return;

    if (!this.filtered.length) {
      body.innerHTML = '<tr><td colspan="10" class="loading-text">No students found</td></tr>';
      return;
    }

    const pageItems = this.filtered.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
    body.innerHTML = pageItems.map(s => this.rowHtml(s)).join('');
  }

  rowHtml(s) {
    const att = Number(s.attendance_percent || 0);
    const marks = Number(s.avg_marks || 0);
    let badgeClass = 'performance-average';
    let badgeText = 'Average';
    if (marks >= 85) { badgeClass = 'performance-excellent'; badgeText = 'Excellent'; }
    else if (marks >= 70) { badgeClass = 'performance-good'; badgeText = 'Good'; }
    else if (marks < 50) { badgeClass = 'performance-poor'; badgeText = 'Poor'; }
    const attColor = att >= 75 ? 'var(--success)' : (att >= 60 ? 'var(--warning)' : 'var(--danger)');

    return `
      <tr>
        <td>
          <img src="../assets/default-avatar.png"
               alt="${this.escape(s.name)}"
               class="student-photo">
        </td>
        <td>${this.escape(String(s.id ?? '-'))}</td>
        <td>${this.escape(s.registration_number || '-')}</td>
        <td>
          <div style="font-weight: 500;">${this.escape(s.name || '-')}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${this.escape(s.email || '-')}</div>
        </td>
        <td>${this.escape(s.department || '-')}</td>
        <td>${this.escape(s.year ?? '-')}</td>
        <td>${this.escape(s.section || '-')}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="flex: 1; height: 6px; background: var(--bg-tertiary); border-radius: 0; width: 60px;">
              <div style="width: ${att}%; height: 100%; background: ${attColor}; border-radius: 0;"></div>
            </div>
            <span style="font-size: 0.85rem; font-weight: 600;">${att}%</span>
          </div>
        </td>
        <td><span class="performance-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn-icon" title="View Details" onclick="viewStudent('${this.jsId(s.id)}')">👁️</button>
        </td>
      </tr>
    `;
  }

  renderCards() {
    const grid = document.getElementById('cardView');
    if (!grid) return;

    if (!this.filtered.length) {
      grid.innerHTML = '<div class="loading-text">No students found</div>';
      return;
    }

    const pageItems = this.filtered.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
    grid.innerHTML = pageItems.map(s => `
      <div class="student-card" onclick="viewStudent('${this.jsId(s.id)}')" style="cursor:pointer;">
        <img src="../assets/default-avatar.png" alt="${this.escape(s.name)}" class="student-card-photo">
        <div class="student-card-name">${this.escape(s.name || '-')}</div>
        <small style="color: var(--text-secondary);">${this.escape(s.registration_number || '-')}</small>
        <div class="student-card-info">
          <div class="info-row"><span class="info-label">Dept</span><span class="info-value">${this.escape(s.department || '-')}</span></div>
          <div class="info-row"><span class="info-label">Year</span><span class="info-value">${this.escape(s.year ?? '-')}</span></div>
          <div class="info-row"><span class="info-label">Section</span><span class="info-value">${this.escape(s.section || '-')}</span></div>
          <div class="info-row"><span class="info-label">Attendance</span><span class="info-value">${Number(s.attendance_percent || 0)}%</span></div>
          <div class="info-row"><span class="info-label">Avg Marks</span><span class="info-value">${Number(s.avg_marks || 0)}%</span></div>
        </div>
      </div>
    `).join('');
  }

  renderPagination() {
    const totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    this.page = Math.min(Math.max(1, this.page), totalPages);

    const section = document.querySelector('#tableView');
    let pager = document.getElementById('stuPager');
    if (!pager && section) {
      pager = document.createElement('div');
      pager.id = 'stuPager';
      pager.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:1rem;';
      section.appendChild(pager);
    }
    if (!pager) return;
    if (totalPages <= 1) { pager.innerHTML = ''; return; }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="view-btn ${i === this.page ? 'active' : ''}" data-pg="${i}">${i}</button>`;
    }
    pager.innerHTML = html;
    pager.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      this.page = Number(b.dataset.pg);
      this.renderCurrentView();
      this.renderPagination();
    }));
  }

  renderAttention() {
    const list = document.getElementById('attentionList');
    if (!list) return;

    const needy = this.students.filter(s => Number(s.attendance_percent || 0) < 75 || Number(s.avg_marks || 0) < 50);
    if (!needy.length) {
      list.innerHTML = '<div class="loading-text">All students are on track 🎉</div>';
      return;
    }

    list.innerHTML = needy.slice(0, 8).map(s => {
      const reasons = [];
      if (Number(s.attendance_percent || 0) < 75) reasons.push(`Attendance ${Number(s.attendance_percent)}%`);
      if (Number(s.avg_marks || 0) < 50) reasons.push(`Avg marks ${Number(s.avg_marks)}%`);
      return `
        <div class="attention-item">
          <div class="attention-info">
            <div class="attention-name">${this.escape(s.name || '-')}</div>
            <div class="attention-reason">${reasons.join(' • ')}</div>
          </div>
          <div class="attention-stats">
            <button class="view-btn" onclick="viewStudent('${this.jsId(s.id)}')">View</button>
          </div>
        </div>
      `;
    }).join('');

    this.renderPerformanceChart();
  }

  renderPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const buckets = { 'Excellent (85+)': 0, 'Good (70-84)': 0, 'Average (50-69)': 0, 'Poor (<50)': 0 };
    this.students.forEach(s => {
      const marks = Number(s.avg_marks || 0);
      if (marks >= 85) buckets['Excellent (85+)']++;
      else if (marks >= 70) buckets['Good (70-84)']++;
      else if (marks >= 50) buckets['Average (50-69)']++;
      else buckets['Poor (<50)']++;
    });

    if (window.__perfChart instanceof Chart) window.__perfChart.destroy();
    window.__perfChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{ label: 'Students', data: Object.values(buckets), backgroundColor: ['#f4f4f4', '#8a8a8a', '#4a4a4a', '#d71921'] }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
}

const teacherStudentsPage = new TeacherStudentsPage();
window.TeacherStudentsPageInstance = teacherStudentsPage;

function applyFilters() { teacherStudentsPage.applyLocalFilters(); }

function resetFilters() {
  ['deptFilter', 'yearFilter', 'sectionFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const search = document.getElementById('searchInput');
  if (search) search.value = '';
  teacherStudentsPage.applyLocalFilters();
}

function switchView(view) {
  const tableView = document.getElementById('tableView');
  const cardView = document.getElementById('cardView');
  if (!tableView || !cardView) return;
  teacherStudentsPage.currentView = view === 'cards' ? 'cards' : 'table';
  tableView.style.display = view === 'cards' ? 'none' : '';
  cardView.style.display = view === 'cards' ? '' : 'none';
  document.querySelectorAll('.view-toggle .view-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  teacherStudentsPage.renderCurrentView();
}

function closeStudentModal() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'none';
}

function viewStudent(studentId) {
  const s = teacherStudentsPage.students.find(st => String(st.id) === String(studentId));
  const modal = document.getElementById('studentModal');
  const body = document.getElementById('studentModalBody');
  if (!s || !modal || !body) return;

  body.innerHTML = `
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Name</strong><span>${teacherStudentsPage.escape(s.name || '-')}</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Registration No</strong><span>${teacherStudentsPage.escape(s.registration_number || '-')}</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Email</strong><span>${teacherStudentsPage.escape(s.email || '-')}</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Department</strong><span>${teacherStudentsPage.escape(s.department || '-')}</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Year / Section</strong><span>${teacherStudentsPage.escape(s.year ?? '-')} / ${teacherStudentsPage.escape(s.section || '-')}</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Attendance</strong><span>${Number(s.attendance_percent || 0)}%</span></div>
    <div class="info-row" style="display:flex; justify-content:space-between; padding:0.5rem 0;"><strong>Average Marks</strong><span>${Number(s.avg_marks || 0)}%</span></div>
  `;
  modal.style.display = 'flex';
}

function exportToExcel() {
  if (!teacherStudentsPage.filtered.length) return;
  const rows = [['ID', 'Registration No', 'Name', 'Email', 'Department', 'Year', 'Section', 'Attendance %', 'Avg Marks %']].concat(
    teacherStudentsPage.filtered.map(s => [
      s.id, s.registration_number || '', s.name || '', s.email || '',
      s.department || '', s.year ?? '', s.section || '',
      Number(s.attendance_percent || 0), Number(s.avg_marks || 0)
    ])
  );
  const csv = rows.map(row => row.map(cell => {
    const val = String(cell ?? '');
    return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
  }).join(',')).join('\n');
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `my-students-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
