class RubricCreatorPage {
  constructor() {
    this.criteria = [];
    this.cacheEls();
    this.bind();
    this.render();
  }

  cacheEls() {
    this.els = {
      list: document.getElementById('criteriaList'),
      addBtn: document.getElementById('addCriterion'),
      saveBtn: document.getElementById('saveRubric'),
      importBtn: document.getElementById('importRubric'),
      exportBtn: document.getElementById('exportRubric'),
      assignId: document.getElementById('assignmentId'),
      rubricName: document.getElementById('rubricName'),
      modal: document.getElementById('rcModal'),
      modalTitle: document.getElementById('rcModalTitle'),
      modalClose: document.getElementById('rcModalClose'),
      form: document.getElementById('rcForm'),
      idx: document.getElementById('rcIndex'),
      name: document.getElementById('rcName'),
      desc: document.getElementById('rcDesc'),
      points: document.getElementById('rcPoints'),
      cancel: document.getElementById('rcCancel'),
    };
  }

  bind() {
    this.els.addBtn?.addEventListener('click', () => this.addCriterion());
    this.els.saveBtn?.addEventListener('click', () => this.save());
    this.els.importBtn?.addEventListener('click', () => this.import());
    this.els.exportBtn?.addEventListener('click', () => this.export());

    // Modal wiring
    this.els.form?.addEventListener('submit', (e) => this.onSubmit(e));
    this.els.cancel?.addEventListener('click', () => this.hideModal());
    this.els.modalClose?.addEventListener('click', () => this.hideModal());
    this.els.modal?.addEventListener('click', (e) => { if (e.target === this.els.modal) this.hideModal(); });
  }

  addCriterion() {
    this.els.modalTitle.textContent = 'Add Criterion';
    this.els.idx.value = '';
    this.els.name.value = '';
    this.els.desc.value = '';
    this.els.points.value = 10;
    this.showModal();
  }

  render() {
    const el = this.els.list;
    if (!el) return;
    if (this.criteria.length === 0) { el.innerHTML = '<div class="empty">No criteria yet</div>'; return; }
    el.innerHTML = this.criteria.map((c, i) => `
      <div class="card" draggable="true" data-idx="${i}">
        <div class="card-header">${this.escape(c.name)} <span class="badge">${c.max_points} pts</span></div>
        <div class="card-body">${this.escape(c.description)}</div>
        <div class="card-footer">
          <button class="btn btn-sm" data-action="edit" data-idx="${i}">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="remove" data-idx="${i}">Remove</button>
        </div>
      </div>
    `).join('');

    // DnD reorder
    el.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.idx);
      });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/plain'));
        const to = Number(card.dataset.idx);
        if (isNaN(from) || isNaN(to) || from === to) return;
        const [moved] = this.criteria.splice(from, 1);
        this.criteria.splice(to, 0, moved);
        this.render();
      });
    });

    el.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => this.edit(btn.dataset.idx)));
    el.querySelectorAll('[data-action="remove"]').forEach(btn => btn.addEventListener('click', () => this.remove(btn.dataset.idx)));
  }

  edit(index) {
    index = Number(index);
    const c = this.criteria[index];
    if (!c) return;
    this.els.modalTitle.textContent = 'Edit Criterion';
    this.els.idx.value = String(index);
    this.els.name.value = c.name;
    this.els.desc.value = c.description;
    this.els.points.value = c.max_points;
    this.showModal();
  }

  remove(index) { index = Number(index); this.criteria.splice(index, 1); this.render(); }

  async save() {
    const assignment_id = Number(this.els.assignId?.value || 0);
    const name = this.els.rubricName?.value || 'Rubric';
    if (!assignment_id || this.criteria.length === 0) { alert('Assignment ID and at least one criterion are required'); return; }
    try {
      const resp = await fetch('/api/rubrics', {
        method: 'POST',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id, name, criteria: this.criteria })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Request failed');
      alert('Rubric saved');
    } catch (error) {
      console.error('Error context:', error);
      alert('Failed to save rubric');
    }
  }

  onSubmit(e) {
    e.preventDefault();
    const idx = this.els.idx.value === '' ? null : Number(this.els.idx.value);
    const payload = {
      name: this.els.name.value?.trim(),
      description: this.els.desc.value?.trim() || '',
      max_points: Number(this.els.points.value || 1)
    };
    if (!payload.name) { if (typeof Toast !== 'undefined') Toast.error('Name is required'); return; }
    if (idx === null) this.criteria.push(payload); else this.criteria[idx] = payload;
    this.hideModal();
    this.render();
  }

  export() {
    const data = { name: this.els.rubricName?.value || 'Rubric', criteria: this.criteria };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rubric.json'; a.click(); URL.revokeObjectURL(a.href);
  }

  import() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (Array.isArray(json.criteria)) this.criteria = json.criteria; else if (Array.isArray(json)) this.criteria = json; else throw new Error('Invalid format');
        if (json.name && this.els.rubricName) this.els.rubricName.value = json.name;
        this.render();
      } catch (err) {
        console.error('Import failed:', err);
        if (typeof Toast !== 'undefined') Toast.error('Import failed');
      }
    };
    input.click();
  }

  showModal() { this.els.modal?.classList.add('show'); }
  hideModal() { this.els.modal?.classList.remove('show'); }

  escape(str) { return String(str).replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
  authHeaders() { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; }
}

document.addEventListener('DOMContentLoaded', () => new RubricCreatorPage());
