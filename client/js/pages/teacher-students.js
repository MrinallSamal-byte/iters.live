class TeacherStudentsPage {
  constructor() {
    this.page = 1;
    this.limit = 20;
    this.bind();
    this.load();
  }

  bind() {
    this.els = {
      search: document.getElementById('stuSearch'),
      dept: document.getElementById('stuDept'),
      year: document.getElementById('stuYear'),
      section: document.getElementById('stuSection'),
      reset: document.getElementById('stuReset'),
      body: document.getElementById('studentsTableBody'),
      pag: document.getElementById('stuPagination')
    };

    this.els.search?.addEventListener('input', this.debounce(() => this.load(1), 350));
    this.els.dept?.addEventListener('change', () => this.load(1));
    this.els.year?.addEventListener('change', () => this.load(1));
    this.els.section?.addEventListener('change', () => this.load(1));
    this.els.reset?.addEventListener('click', () => this.reset());
  }

  async load(page = this.page) {
    this.page = page;
    const q = new URLSearchParams();
    const search = this.els.search?.value?.trim();
    const dept = this.els.dept?.value;
    const year = this.els.year?.value;
    const section = this.els.section?.value;
    if (search) q.set('q', search);
    if (dept) q.set('department', dept);
    if (year) q.set('year', year);
    if (section) q.set('section', section);
    q.set('page', String(this.page));
    q.set('limit', String(this.limit));

    try {
      const resp = await fetch(`/api/teacher/students?${q.toString()}`, { headers: this.authHeaders() });
      const payload = resp.ok ? await resp.json() : null;
      const items = (payload?.data?.items) ?? payload?.items ?? payload?.data ?? [];
      const total = Number(payload?.data?.total ?? payload?.total ?? items.length);
      this.render(items || []);
      this.renderPagination(total || 0, this.page, this.limit);
    } catch (err) {
      console.error('Load students failed:', err);
      // Fallback to dummy data
      if (typeof DummyData !== 'undefined') {
        console.log('📦 Loading dummy student data...');
        const filters = {};
        if (dept) filters.department = dept;
        if (year) filters.year = parseInt(year);
        if (section) filters.section = section;
        filters.limit = 50;

        const result = DummyData.getTeacherStudents(filters);
        if (result.success) {
          let students = result.data;

          // Apply search filter
          if (search) {
            students = students.filter(s =>
              s.name.toLowerCase().includes(search.toLowerCase()) ||
              s.registration_number.toLowerCase().includes(search.toLowerCase())
            );
          }

          this.render(students);
          this.renderPagination(students.length, 1, this.limit);
          console.log('✅ Loaded', students.length, 'dummy students');
        }
      } else {
        this.els.body.innerHTML = '<tr><td colspan="10">Failed to load</td></tr>';
      }
    }
  }

  render(items) {
    if (!items.length) { this.els.body.innerHTML = '<tr><td colspan="10" class="loading-text">No students found</td></tr>'; return; }

    this.els.body.innerHTML = items.map(s => {
      // Calculate performance badge
      let badgeClass = 'performance-average';
      let badgeText = 'Average';
      const marks = s.avg_marks || 0;

      if (marks >= 85) { badgeClass = 'performance-excellent'; badgeText = 'Excellent'; }
      else if (marks >= 70) { badgeClass = 'performance-good'; badgeText = 'Good'; }
      else if (marks < 50) { badgeClass = 'performance-poor'; badgeText = 'Poor'; }

      // Attendance color
      const att = s.attendance_percent || 0;
      const attColor = att >= 75 ? 'var(--success)' : (att >= 60 ? 'var(--warning)' : 'var(--danger)');

      return `
      <tr>
        <td>
          <img src="${s.profile_picture || '/assets/soa-logo.png'}" 
               alt="${this.escape(s.name)}" 
               class="student-photo"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=6B0000&color=fff&bold=true'">
        </td>
        <td>${this.escape(s.roll_no || s.id || '-')}</td>
        <td>${this.escape(s.reg_no || s.registration_number || s.registration_no || '-')}</td>
        <td>
          <div style="font-weight: 500;">${this.escape(s.name || '-')}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${this.escape(s.email || '-')}</div>
        </td>
        <td>${this.escape(s.department || '-')}</td>
        <td>${this.escape(s.year || '-')}</td>
        <td>${this.escape(s.section || '-')}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="flex: 1; height: 6px; background: var(--bg-tertiary); border-radius: 3px; width: 60px;">
              <div style="width: ${att}%; height: 100%; background: ${attColor}; border-radius: 3px;"></div>
            </div>
            <span style="font-size: 0.85rem; font-weight: 600;">${att}%</span>
          </div>
        </td>
        <td><span class="performance-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn-icon" title="View Details" onclick="viewStudent(${s.id})">👁️</button>
          <button class="btn-icon" title="Edit" onclick="editStudent(${s.id})">✏️</button>
        </td>
      </tr>
    `}).join('');
  }

  renderPagination(total, page, limit) {
    const pages = Math.max(1, Math.ceil(total / limit));
    let html = '';
    for (let i = 1; i <= pages; i++) {
      html += `<button class="btn btn-sm ${i === page ? 'btn-primary' : ''}" data-pg="${i}">${i}</button>`;
    }
    this.els.pag.innerHTML = html;
    this.els.pag.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.load(Number(b.dataset.pg))));
  }

  reset() {
    if (this.els.search) this.els.search.value = '';
    if (this.els.dept) this.els.dept.value = '';
    if (this.els.year) this.els.year.value = '';
    if (this.els.section) this.els.section.value = '';
    this.load(1);
  }

  escape(str) { return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[s])); }
  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  authHeaders() { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; }
}

document.addEventListener('DOMContentLoaded', () => new TeacherStudentsPage());
