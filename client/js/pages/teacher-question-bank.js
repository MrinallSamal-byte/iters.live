class TeacherQuestionBankPage {
  constructor() {
    this.page = 1;
    this.limit = 20;
    this.skeleton = new SkeletonLoader();
    this.state = { editingId: null };
    this.init();
  }

  init() {
    this.cacheEls();
    this.bindEvents();
    this.loadSubjects();
    this.loadQuestions();
  }

  cacheEls() {
    this.els = {
      search: document.getElementById('qbSearch'),
      diff: document.getElementById('qbDifficulty'),
      subj: document.getElementById('qbSubject'),
      grid: document.getElementById('qbGrid'),
      pag: document.getElementById('qbPagination'),
      addBtn: document.getElementById('qbAddBtn'),
      modal: document.getElementById('qbModal'),
      modalTitle: document.getElementById('qbModalTitle'),
      modalClose: document.getElementById('qbModalClose'),
      form: document.getElementById('qbForm'),
      formId: document.getElementById('qbId'),
      formSubj: document.getElementById('qbFormSubject'),
      formDiff: document.getElementById('qbFormDifficulty'),
      formMarks: document.getElementById('qbFormMarks'),
      formText: document.getElementById('qbFormText'),
      formCancel: document.getElementById('qbFormCancel'),
    };
  }

  bindEvents() {
    this.els.search?.addEventListener('input', this.debounce(() => this.loadQuestions(1), 400));
    this.els.diff?.addEventListener('change', () => this.loadQuestions(1));
    this.els.subj?.addEventListener('change', () => this.loadQuestions(1));
    this.els.addBtn?.addEventListener('click', () => this.openAddModal());

    // Modal wiring
    this.els.form?.addEventListener('submit', (e) => this.onSubmit(e));
    this.els.formCancel?.addEventListener('click', () => this.hideModal());
    this.els.modalClose?.addEventListener('click', () => this.hideModal());
    this.els.modal?.addEventListener('click', (e) => { if (e.target === this.els.modal) this.hideModal(); });
  }

  async loadSubjects() {
    try {
      const resp = await fetch('/api/subjects', { headers: this.authHeaders() });
      let items = [];
      if (resp.ok) {
        const data = await resp.json();
        items = data.items || data.data || data || [];
      } else {
        items = [
          { id: 101, name: 'Data Structures' },
          { id: 102, name: 'Algorithms' },
          { id: 103, name: 'Operating Systems' }
        ];
      }
      const filterOpts = ['<option value="">All Subjects</option>'].concat(
        items.map(s => `<option value="${s.id}">${this.escape(s.name || s.title || ('Subject ' + s.id))}</option>`) 
      );
      if (this.els.subj) this.els.subj.innerHTML = filterOpts.join('');
      const formOpts = ['<option value="">Select Subject</option>'].concat(
        items.map(s => `<option value="${s.id}">${this.escape(s.name || s.title || ('Subject ' + s.id))}</option>`) 
      );
      if (this.els.formSubj) this.els.formSubj.innerHTML = formOpts.join('');
    } catch (e) {
      console.warn('Subjects load failed');
    }
  }

  async loadQuestions(page = this.page) {
    this.page = page;
    this.skeleton.show(this.els.grid, 'list');
    try {
      const q = new URLSearchParams();
      const search = this.els.search?.value?.trim();
      const diff = this.els.diff?.value;
      const subj = this.els.subj?.value;
      if (search) q.set('q', search);
      if (diff) q.set('difficulty', diff);
      if (subj) q.set('subject_id', subj);
      q.set('page', String(this.page));
      q.set('limit', String(this.limit));

      const resp = await fetch(`/api/question-bank?${q.toString()}`, { headers: this.authHeaders() });
      if (!resp.ok) throw new Error('Request failed');
      const payload = await resp.json();
      const items = (payload?.data?.items) ?? payload?.items ?? payload?.data ?? [];
      const total = Number(payload?.data?.total ?? payload?.total ?? items.length);
      const pageNum = Number(payload?.data?.page ?? payload?.page ?? this.page);
      const limitNum = Number(payload?.data?.limit ?? payload?.limit ?? this.limit);
      this.renderGrid(items || []);
      this.renderPagination(total || 0, pageNum || 1, limitNum || this.limit);
    } catch (error) {
      console.error('Error context:', error);
      this.renderError('Failed to load questions');
    } finally {
      this.skeleton.hide(this.els.grid);
    }
  }

  renderGrid(items) {
    const grid = this.els.grid;
    if (!grid) return;
    if (!items.length) { grid.innerHTML = '<div class="empty">No questions found</div>'; return; }
    const badge = (d) => `<span class="badge" style="text-transform:capitalize;">${this.escape(d||'unknown')}</span>`;
    const truncate = (s, n=220) => { const t = String(s||''); return t.length>n ? `${this.escape(t.slice(0,n))}…` : this.escape(t); };
    grid.innerHTML = items.map(q => `
      <div class="card hover-lift" data-id="${q.id}">
        <div class="card-header">${this.escape(q.topic || 'General')} • ${badge(q.difficulty)}</div>
        <div class="card-body">${truncate(q.question_text)}</div>
        <div class="card-footer">
          <button class="btn btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete">Delete</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.card [data-action="delete"]').forEach(btn => btn.addEventListener('click', (e) => this.handleDelete(e)));
    grid.querySelectorAll('.card [data-action="edit"]').forEach(btn => btn.addEventListener('click', (e) => this.handleEdit(e)));
  }

  renderPagination(total, page, limit) {
    const el = document.getElementById('qbPagination');
    if (!el) return;
    const pages = Math.max(1, Math.ceil(total / limit));
    let html = '';
    for (let i = 1; i <= pages; i++) {
      html += `<button class="btn btn-sm ${i===page?'btn-primary':''}" data-pg="${i}">${i}</button>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.loadQuestions(Number(b.dataset.pg))));
  }

  async handleDelete(e) {
    const card = e.target.closest('.card');
    const id = card?.dataset.id;
    if (!id) return;
    if (!confirm('Delete this question?')) return;
    try {
      const resp = await fetch(`/api/question-bank/${id}`, { method: 'DELETE', headers: this.authHeaders() });
      if (!resp.ok) throw new Error('Request failed');
      this.loadQuestions();
    } catch (error) {
      console.error('Error context:', error);
      alert('Failed to delete');
    }
  }

  handleEdit(e) {
    const card = e.target.closest('.card');
    const id = card?.dataset.id;
    if (!id) return;
    const current = card.querySelector('.card-body')?.textContent || '';
    this.state.editingId = id;
    if (this.els.modalTitle) this.els.modalTitle.textContent = 'Edit Question';
    if (this.els.formId) this.els.formId.value = id;
    if (this.els.formText) this.els.formText.value = current;
    this.showModal();
  }

  async updateQuestion(id, payload) {
    try {
      const resp = await fetch(`/api/question-bank/${id}`, {
        method: 'PUT',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Request failed');
      // Caller refreshes
    } catch (error) {
      console.error('Error context:', error);
      alert('Update failed');
    }
  }

  openAddModal() {
    this.state.editingId = null;
    if (this.els.modalTitle) this.els.modalTitle.textContent = 'Add Question';
    this.els.form?.reset();
    if (this.els.formDiff) this.els.formDiff.value = 'easy';
    if (this.els.formMarks) this.els.formMarks.value = 1;
    this.showModal();
  }

  showModal() { this.els.modal?.classList.add('show'); }
  hideModal() { this.els.modal?.classList.remove('show'); }

  async onSubmit(e) {
    e.preventDefault();
    const payload = {
      subject_id: Number(this.els.formSubj?.value || 0),
      question_text: this.els.formText?.value?.trim(),
      difficulty: this.els.formDiff?.value || 'easy',
      question_type: 'mcq',
      marks: Number(this.els.formMarks?.value || 1)
    };
    if (!payload.subject_id || !payload.question_text) {
      if (typeof Toast !== 'undefined') Toast.error('Subject and question are required');
      return;
    }
    if (this.state.editingId) {
      await this.updateQuestion(this.state.editingId, payload);
    } else {
      await this.createQuestion(payload);
    }
    this.hideModal();
    this.loadQuestions(this.page);
  }

  async createQuestion(payload) {
    try {
      const resp = await fetch('/api/question-bank', {
        method: 'POST',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Request failed');
      // Caller refreshes
    } catch (error) {
      console.error('Error context:', error);
      alert('Create failed');
    }
  }

  escape(str) { return String(str).replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  authHeaders() { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; }
}

document.addEventListener('DOMContentLoaded', () => new TeacherQuestionBankPage());
