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
        this.els.body.innerHTML = '<tr><td colspan="6">Failed to load</td></tr>';
      }
    }
  }

  render(items) {
    if (!items.length) { this.els.body.innerHTML = '<tr><td colspan="6">No students found</td></tr>'; return; }
    this.els.body.innerHTML = items.map(s => `
      <tr>
        <td>${this.escape(s.reg_no || s.registration_no || s.id || '-')}</td>
        <td>${this.escape(s.name || s.full_name || s.fullName || '-')}</td>
        <td>${this.escape(s.department || s.branch || '-')}</td>
        <td>${this.escape(s.year || '-')}</td>
        <td>${this.escape(s.section || '-')}</td>
        <td>${this.escape(s.email || s.contact_email || '-')}</td>
      </tr>
    `).join('');
  }

  renderPagination(total, page, limit) {
    const pages = Math.max(1, Math.ceil(total / limit));
    let html = '';
    for (let i = 1; i <= pages; i++) {
      html += `<button class="btn btn-sm ${i===page?'btn-primary':''}" data-pg="${i}">${i}</button>`;
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

  escape(str) { return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }
  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  authHeaders() { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; }
}

document.addEventListener('DOMContentLoaded', () => new TeacherStudentsPage());
