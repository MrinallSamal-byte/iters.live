(function () {
    'use strict';

    let materials = [];
    let statusFilter = 'all';
    let currentDetail = null;

    const els = {};

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function jsId(id) { return String(id ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

    function authHeaders() {
        const t = window.APP?.Storage?.get?.('accessToken');
        return t ? { Authorization: `Bearer ${t}` } : {};
    }

    function notify(message, type) {
        if (window.Toast?.show) window.Toast.show({ type, message });
        else console.log(`[${type}] ${message}`);
    }

    function currentUser() {
        return window.APP?.Storage?.get?.('user') || {};
    }

    function cacheEls() {
        els.form = document.getElementById('uploadNotesForm');
        els.file = document.getElementById('file');
        els.filePreview = document.getElementById('filePreview');
        els.search = document.getElementById('searchInput');
        els.categoryFilter = document.getElementById('categoryFilter');
        els.departmentFilter = document.getElementById('departmentFilter');
        els.tableBody = document.getElementById('notesTableBody');
        els.popular = document.getElementById('popularMaterials');
        els.modal = document.getElementById('detailsModal');
        els.modalTitle = document.getElementById('modalTitle');
        els.modalBody = document.getElementById('modalBody');
    }

    function bindEvents() {
        els.file?.addEventListener('change', () => {
            const file = els.file.files?.[0];
            if (!els.filePreview) return;
            els.filePreview.innerHTML = file
                ? `<div style="padding:0.75rem;">📎 <strong>${esc(file.name)}</strong> (${(file.size / 1024 / 1024).toFixed(2)} MB)</div>`
                : '';
        });

        els.form?.addEventListener('submit', handleUpload);

        els.search?.addEventListener('input', debounce(renderTable, 300));
        els.categoryFilter?.addEventListener('change', renderTable);
        els.departmentFilter?.addEventListener('change', renderTable);

        document.querySelectorAll('.filter-tabs .tab-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                statusFilter = btn.dataset.filter || 'all';
                renderTable();
            });
        });

        els.modal?.addEventListener('click', (e) => {
            if (e.target === els.modal) closeDetailsModal();
        });
    }

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; }

    async function loadMaterials() {
        try {
            const resp = await fetch('/api/files?limit=50', { headers: authHeaders() });
            if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
            const payload = await resp.json();
            const me = String(currentUser().id ?? '');
            materials = (payload?.data?.files || []).filter(f => String(f.uploaded_by ?? '') === me);
        } catch (err) {
            console.error('Failed to load study materials:', err);
            materials = [];
        }
        updateStats();
        renderTable();
        renderPopular();
    }

    function updateStats() {
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('totalNotes', materials.length);
        setEl('approvedNotes', materials.filter(m => m.approved).length);
        setEl('pendingNotes', materials.filter(m => !m.approved).length);
        setEl('totalDownloads', materials.reduce((sum, m) => sum + Number(m.download_count || 0), 0));
    }

    async function handleUpload(e) {
        e.preventDefault();

        const file = els.file?.files?.[0];
        const title = document.getElementById('noteTitle')?.value?.trim();
        const subject = document.getElementById('subject')?.value?.trim();
        const description = document.getElementById('description')?.value?.trim();
        const category = document.getElementById('category')?.value;
        const unit = document.getElementById('unit')?.value?.trim();
        const department = document.getElementById('department')?.value;
        const year = document.getElementById('year')?.value;
        const semester = document.getElementById('semester')?.value;
        const tags = document.getElementById('tags')?.value?.trim();

        if (!title || !subject || !description || !category || !file) {
            notify('Please fill in all required fields and choose a file', 'error');
            return;
        }

        const composedDescription = [
            `${title} — ${description}`,
            [unit && `Unit: ${unit}`, department && `Dept: ${department}`, year && `Year ${year}`, semester && `Semester ${semester}`, tags && `Tags: ${tags}`]
                .filter(Boolean).join(' | ')
        ].join(' (');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('subject', subject);
        formData.append('description', composedDescription + ')');

        const submitBtn = els.form.querySelector('[type="submit"]');
        submitBtn && (submitBtn.disabled = true);

        try {
            const resp = await fetch('/api/files/upload', {
                method: 'POST',
                headers: authHeaders(),
                body: formData
            });
            const payload = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(payload?.message || `Upload failed (${resp.status})`);
            notify(payload?.message || 'Material uploaded — pending admin approval', 'success');
            resetForm();
            await loadMaterials();
        } catch (err) {
            console.error('Upload failed:', err);
            notify(err.message || 'Failed to upload material', 'error');
        } finally {
            submitBtn && (submitBtn.disabled = false);
        }
    }

    window.resetForm = function () {
        els.form?.reset();
        if (els.filePreview) els.filePreview.innerHTML = '';
    };

    function visibleMaterials() {
        const search = (els.search?.value || '').toLowerCase();
        const category = els.categoryFilter?.value || '';
        const department = els.departmentFilter?.value || '';

        return materials.filter(m => {
            if (category && m.category !== category) return false;
            if (search && !`${m.original_name} ${m.subject} ${m.description}`.toLowerCase().includes(search)) return false;
            return true;
        }).filter(m => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'approved') return Boolean(m.approved);
            if (statusFilter === 'pending') return !m.approved;
            return false;
        });
    }

    function renderTable() {
        if (!els.tableBody) return;
        const items = visibleMaterials();

        if (!items.length) {
            els.tableBody.innerHTML = '<tr><td colspan="9" class="loading-text">No study materials uploaded yet</td></tr>';
            return;
        }

        els.tableBody.innerHTML = items.map(m => `
            <tr>
                <td><strong>${esc(prettyName(m))}</strong></td>
                <td>${esc(m.subject || '-')}</td>
                <td>${esc(m.category || '-')}</td>
                <td>${esc(deptFromDescription(m.description))}</td>
                <td>${esc(yearFromDescription(m.description))}</td>
                <td><span class="badge ${m.approved ? 'success' : 'warning'}">${m.approved ? 'Approved' : 'Pending'}</span></td>
                <td>${Number(m.download_count || 0)}</td>
                <td>${m.created_at ? esc(new Date(m.created_at).toLocaleDateString()) : '-'}</td>
                <td>
                    <button class="btn-icon" title="Details" onclick="showMaterialDetails('${jsId(m.id)}')">👁️</button>
                    <a class="btn-icon" title="Download" href="/api/files/download/${encodeURIComponent(String(m.id))}">📥</a>
                    <button class="btn-icon" title="Delete" onclick="deleteMaterial('${jsId(m.id)}', this)">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function prettyName(m) {
        return String(m.description || '').split('(')[0].split('—')[0].trim() || m.original_name || '-';
    }

    function deptFromDescription(desc) {
        const match = String(desc || '').match(/Dept:\s*(\w+)/);
        return match ? match[1] : '--';
    }

    function yearFromDescription(desc) {
        const match = String(desc || '').match(/Year\s+(\d+)/i);
        return match ? match[1] : '--';
    }

    function renderPopular() {
        if (!els.popular) return;
        const top = [...materials].sort((a, b) => Number(b.download_count || 0) - Number(a.download_count || 0)).slice(0, 5);
        if (!top.length) {
            els.popular.innerHTML = '<div class="loading-text">No download data yet</div>';
            return;
        }
        els.popular.innerHTML = top.map(m => `
            <div class="card" style="margin-bottom:0.5rem;">
                <div class="card-header"><strong>${esc(prettyName(m))}</strong></div>
                <div class="card-body">📥 ${Number(m.download_count || 0)} downloads • ${esc(m.subject || '-')}</div>
            </div>
        `).join('');
    }

    window.showMaterialDetails = function (id) {
        const m = materials.find(item => String(item.id) === String(id));
        if (!m || !els.modalBody) return;
        currentDetail = m;

        if (els.modalTitle) els.modalTitle.textContent = prettyName(m);
        els.modalBody.innerHTML = `
            <p><strong>File:</strong> ${esc(m.original_name || '-')}</p>
            <p><strong>Subject:</strong> ${esc(m.subject || '-')}</p>
            <p><strong>Category:</strong> ${esc(m.category || '-')}</p>
            <p><strong>Status:</strong> ${m.approved ? 'Approved' : 'Pending approval'}</p>
            <p><strong>Downloads:</strong> ${Number(m.download_count || 0)}</p>
            <p><strong>Description:</strong></p>
            <p style="white-space:pre-wrap;">${esc(m.description || '-')}</p>
        `;
        if (els.modal) els.modal.style.display = 'flex';
    };

    window.closeDetailsModal = function () {
        if (els.modal) els.modal.style.display = 'none';
        currentDetail = null;
    };

    window.deleteMaterial = function (id, btn) {
        if (!btn.dataset.confirming) {
            btn.dataset.confirming = 'true';
            btn.textContent = 'Confirm?';
            setTimeout(() => {
                if (btn.isConnected) {
                    delete btn.dataset.confirming;
                    btn.textContent = '🗑️';
                }
            }, 4000);
            return;
        }
        fetch(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() })
            .then(async resp => {
                if (!resp.ok) {
                    const payload = await resp.json().catch(() => null);
                    throw new Error(payload?.message || `Delete failed (${resp.status})`);
                }
                notify('Material deleted', 'success');
                await loadMaterials();
            })
            .catch(err => {
                console.error('Delete failed:', err);
                notify(err.message || 'Failed to delete material', 'error');
            });
    };

    document.addEventListener('DOMContentLoaded', () => {
        cacheEls();
        bindEvents();
        loadMaterials();
    });
})();
