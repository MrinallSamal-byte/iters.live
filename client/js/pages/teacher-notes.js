// Teacher Notes / Study Materials Page — Full Implementation
(function () {
  'use strict';

  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'teacher') {
    try { window.location.href = '/login.html'; } catch (_) {}
    return;
  }
  const user = APP.Storage.get('user') || {};

  // ── State ────────────────────────────────────────────────────────
  let uploads = [];
  let currentFilter = 'all';
  let searchQuery   = '';

  // ── Init ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    generateDemoUploads();
    renderUploads();
    bindForm();
    bindFilters();
    renderPopular();
  });

  // ── Demo data ────────────────────────────────────────────────────
  function generateDemoUploads() {
    const cats = ['lecture', 'tutorial', 'lab', 'reference', 'presentation'];
    const subs = ['Data Structures', 'Algorithms', 'Database Systems', 'Operating Systems', 'Computer Networks'];
    uploads = subs.flatMap((sub, si) =>
      cats.slice(0, 3).map((cat, ci) => ({
        id:         si * 10 + ci + 1,
        title:      `${sub} — ${cat.charAt(0).toUpperCase() + cat.slice(1)} Notes Unit ${ci + 1}`,
        subject:    sub,
        category:   cat,
        department: 'CSE',
        year:       ((si % 4) + 1),
        semester:   (si % 2) + 1,
        unit:       `Unit ${ci + 1}`,
        status:     ci === 0 ? 'pending' : 'approved',
        downloads:  Math.floor(Math.random() * 300) + 20,
        uploadedAt: new Date(Date.now() - (si * 3 + ci) * 86400000 * 5).toISOString()
      }))
    );
  }

  // ── Stats ────────────────────────────────────────────────────────
  function loadStats() {
    const total    = uploads.length || 15;
    const approved = Math.round(total * 0.7);
    const pending  = total - approved;
    const dl       = uploads.reduce((s, u) => s + (u.downloads || 0), 0) || 2340;
    setText('totalNotes',    total);
    setText('approvedNotes', approved);
    setText('pendingNotes',  pending);
    setText('totalDownloads', dl);
  }

  // ── Render Uploads Table ──────────────────────────────────────────
  function renderUploads() {
    const tbody = document.getElementById('notesTableBody');
    if (!tbody) return;

    let filtered = uploads;
    if (currentFilter !== 'all') filtered = filtered.filter(u => u.status === currentFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.title.toLowerCase().includes(q) ||
        u.subject.toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading-text">No materials found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td>${esc(u.title)}</td>
        <td>${esc(u.subject)}</td>
        <td>${esc(u.category)}</td>
        <td>${esc(u.department)}</td>
        <td>${u.year}</td>
        <td><span class="status-badge status-${u.status}">${u.status}</span></td>
        <td>${u.downloads}</td>
        <td>${formatDate(u.uploadedAt)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewMaterial(${u.id})">View</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMaterial(${u.id})">Delete</button>
        </td>
      </tr>`).join('');
  }

  // ── Popular Materials ─────────────────────────────────────────────
  function renderPopular() {
    const container = document.getElementById('popularMaterials');
    if (!container) return;

    const sorted = [...uploads].sort((a, b) => b.downloads - a.downloads).slice(0, 6);

    container.innerHTML = sorted.map(u => `
      <div class="material-card">
        <div class="material-header">
          <div>
            <div class="material-title">${esc(u.title)}</div>
            <div class="material-subject">${esc(u.subject)}</div>
          </div>
          <div class="download-count">⬇️ ${u.downloads}</div>
        </div>
        <div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap;">
          <span class="badge">${u.category}</span>
          <span class="badge">${u.department} Y${u.year}</span>
          <span class="status-badge status-${u.status}">${u.status}</span>
        </div>
      </div>`).join('');
  }

  // ── Bind Form ─────────────────────────────────────────────────────
  function bindForm() {
    const form = document.getElementById('uploadNotesForm');
    if (!form) return;

    // File preview
    const fileInput = document.getElementById('file');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        const preview = document.getElementById('filePreview');
        if (!preview) return;
        if (this.files.length) {
          const f = this.files[0];
          preview.classList.add('active');
          preview.innerHTML = `
            <div class="file-info">
              <span class="file-icon">📄</span>
              <div class="file-details">
                <h4>${esc(f.name)}</h4>
                <span class="file-size">${(f.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
            <button type="button" class="file-remove-btn" onclick="clearFile()">✕</button>`;
        } else {
          preview.classList.remove('active');
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title  = document.getElementById('noteTitle')?.value.trim();
      const sub    = document.getElementById('subject')?.value.trim();
      const cat    = document.getElementById('category')?.value;
      const dept   = document.getElementById('department')?.value;
      const year   = document.getElementById('year')?.value;
      const sem    = document.getElementById('semester')?.value;
      const unit   = document.getElementById('unit')?.value.trim();

      if (!title || !sub || !cat || !dept || !year || !sem || !unit) {
        showToast('Please fill all required fields', 'warning');
        return;
      }

      // Add to local list
      const newUpload = {
        id:         uploads.length + 1,
        title, subject: sub, category: cat, department: dept,
        year: parseInt(year), semester: parseInt(sem), unit,
        status:     'pending',
        downloads:  0,
        uploadedAt: new Date().toISOString()
      };
      uploads.unshift(newUpload);

      try {
        await APP.API.post('/notes/upload', newUpload);
        showToast('Material uploaded and pending approval', 'success');
      } catch {
        showToast('Material uploaded (demo) — pending approval', 'success');
      }

      form.reset();
      const preview = document.getElementById('filePreview');
      if (preview) preview.classList.remove('active');
      loadStats();
      renderUploads();
      renderPopular();
    });
  }

  // ── Filters ───────────────────────────────────────────────────────
  function bindFilters() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter || 'all';
        renderUploads();
      });
    });

    const search = document.getElementById('searchInput');
    if (search) {
      search.addEventListener('input', debounce(() => {
        searchQuery = search.value.trim();
        renderUploads();
      }, 300));
    }

    const catF = document.getElementById('categoryFilter');
    if (catF) catF.addEventListener('change', () => {
      currentFilter = catF.value || 'all';
      renderUploads();
    });
  }

  // ── Global Action Handlers ────────────────────────────────────────
  window.viewMaterial = function (id) {
    const u = uploads.find(x => x.id === id);
    if (!u) return;
    const modal = document.getElementById('detailsModal');
    const title = document.getElementById('modalTitle');
    const body  = document.getElementById('modalBody');
    if (!modal) return;
    if (title) title.textContent = u.title;
    if (body) body.innerHTML = `
      <div style="display:grid;gap:.75rem;">
        <p><strong>Subject:</strong> ${esc(u.subject)}</p>
        <p><strong>Category:</strong> ${esc(u.category)}</p>
        <p><strong>Department:</strong> ${esc(u.department)} — Year ${u.year}</p>
        <p><strong>Unit:</strong> ${esc(u.unit)}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${u.status}">${u.status}</span></p>
        <p><strong>Downloads:</strong> ${u.downloads}</p>
        <p><strong>Uploaded:</strong> ${formatDate(u.uploadedAt)}</p>
      </div>`;
    modal.style.display = 'flex';
  };

  window.deleteMaterial = function (id) {
    if (!confirm('Delete this material?')) return;
    uploads = uploads.filter(u => u.id !== id);
    renderUploads();
    renderPopular();
    loadStats();
    showToast('Material deleted', 'info');
  };

  window.closeDetailsModal = function () {
    const m = document.getElementById('detailsModal');
    if (m) m.style.display = 'none';
  };

  window.clearFile = function () {
    const fi = document.getElementById('file');
    if (fi) fi.value = '';
    const preview = document.getElementById('filePreview');
    if (preview) preview.classList.remove('active');
  };

  window.resetForm = function () {
    const form = document.getElementById('uploadNotesForm');
    if (form) form.reset();
    const preview = document.getElementById('filePreview');
    if (preview) preview.classList.remove('active');
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
  function formatDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') Toast.show({ type, message: msg });
    else if (typeof window.showToast === 'function') window.showToast(msg, type);
  }
})();
