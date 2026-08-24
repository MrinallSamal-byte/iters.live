(function () {
    'use strict';

    const RUBRIC_ARCHIVE_KEY = 'rubricArchive';

    let criteria = [];
    let rubrics = [];
    let rubricFilter = 'all';

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

    function cacheEls() {
        els.form = document.getElementById('createRubricForm');
        els.title = document.getElementById('rubricTitle');
        els.assessmentType = document.getElementById('assessmentType');
        els.totalPoints = document.getElementById('totalPoints');
        els.description = document.getElementById('description');
        els.criteriaContainer = document.getElementById('criteriaContainer');
        els.rubricsList = document.getElementById('rubricsList');
        els.rubricSearch = document.getElementById('rubricSearch');
        els.typeFilter = document.getElementById('typeFilter');
        els.modal = document.getElementById('rubricModal');
        els.modalBody = document.getElementById('rubricModalBody');
    }

    function bindEvents() {
        els.rubricSearch?.addEventListener('input', () => renderRubricsList());
        els.typeFilter?.addEventListener('change', () => renderRubricsList());

        document.querySelectorAll('.filter-tabs .tab-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                rubricFilter = btn.dataset.filter || 'all';
                renderRubricsList();
            });
        });

        els.modal?.addEventListener('click', (e) => {
            if (e.target === els.modal) closeRubricModal();
        });
    }

    window.loadTemplate = function (kind) {
        const templates = {
            basic: {
                type: 'assignment', points: 100,
                levels: [['Excellent', 100], ['Good', 75], ['Satisfactory', 50], ['Needs Improvement', 25]],
                criteria: [
                    ['Content Accuracy', 'Correctness and depth of content', 40],
                    ['Organization', 'Logical structure and flow', 30],
                    ['Clarity', 'Clear expression of ideas', 30]
                ]
            },
            detailed: {
                type: 'project', points: 150,
                levels: [['Outstanding', 100], ['Proficient', 80], ['Developing', 60], ['Beginning', 40], ['Incomplete', 20]],
                criteria: [
                    ['Research', 'Quality of sources and investigation', 30],
                    ['Analysis', 'Depth of critical analysis', 35],
                    ['Execution', 'Implementation quality', 35],
                    ['Documentation', 'Report and citations', 25],
                    ['Presentation', 'Delivery and visuals', 25]
                ]
            },
            presentation: {
                type: 'presentation', points: 50,
                levels: [['Excellent', 100], ['Good', 75], ['Fair', 50], ['Poor', 25]],
                criteria: [
                    ['Content', 'Relevant and well-prepared material', 15],
                    ['Delivery', 'Speaking skills and engagement', 20],
                    ['Visual Aids', 'Slide quality and support', 15]
                ]
            },
            project: {
                type: 'project', points: 200,
                levels: [['Exceptional', 100], ['Strong', 80], ['Adequate', 60], ['Weak', 40], ['Unacceptable', 0]],
                criteria: [
                    ['Requirements Coverage', 'All specified requirements met', 60],
                    ['Code Quality', 'Structure, readability, tests', 50],
                    ['Functionality', 'Features work as intended', 50],
                    ['Demo & Defense', 'Live demonstration answers', 40]
                ]
            }
        };
        const tpl = templates[kind];
        if (!tpl) return;

        if (els.title && !els.title.value) els.title.value = `${kind.charAt(0).toUpperCase() + kind.slice(1)} Rubric`;
        if (els.assessmentType) els.assessmentType.value = tpl.type;
        if (els.totalPoints) els.totalPoints.value = tpl.points;

        const levelGroups = document.querySelectorAll('.level-input-group');
        tpl.levels.forEach(([name, weight], i) => {
            if (i < levelGroups.length) {
                levelGroups[i].querySelector('.level-name-input').value = name;
                levelGroups[i].querySelector('.level-weight-input').value = weight;
            } else {
                addLevelRow(name, weight);
            }
        });

        criteria = tpl.criteria.map(([name, desc, pts]) => ({ name, description: desc, max_points: pts }));
        renderCriteria();
        notify(`Loaded "${kind}" template`, 'success');
    };

    window.addCriterion = function () {
        criteria.push({ name: '', description: '', max_points: 10 });
        renderCriteria();
    };

    window.removeCriterion = function (idx) {
        criteria.splice(Number(idx), 1);
        renderCriteria();
    };

    function renderCriteria() {
        if (!els.criteriaContainer) return;

        if (!criteria.length) {
            els.criteriaContainer.innerHTML = '<div class="loading-text">Click "Add Criterion" to start building your rubric</div>';
            return;
        }

        els.criteriaContainer.innerHTML = criteria.map((c, i) => `
            <div class="card" data-idx="${i}" style="margin-bottom:0.75rem;">
                <div style="display:flex; gap:0.75rem; align-items:center;">
                    <input type="text" class="form-input criterion-name" data-idx="${i}" placeholder="Criterion name (e.g., Content Quality)" value="${esc(c.name)}" style="flex:2;">
                    <input type="number" class="form-input criterion-points" data-idx="${i}" min="1" value="${Number(c.max_points)}" title="Max points" style="flex:0 0 110px;">
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeCriterion(${i})">Remove</button>
                </div>
                <input type="text" class="form-input criterion-desc" data-idx="${i}" placeholder="Description / expectations" value="${esc(c.description)}" style="margin-top:0.5rem;">
            </div>
        `).join('');

        els.criteriaContainer.querySelectorAll('.criterion-name').forEach(input =>
            input.addEventListener('input', () => { criteria[Number(input.dataset.idx)].name = input.value; }));
        els.criteriaContainer.querySelectorAll('.criterion-desc').forEach(input =>
            input.addEventListener('input', () => { criteria[Number(input.dataset.idx)].description = input.value; }));
        els.criteriaContainer.querySelectorAll('.criterion-points').forEach(input =>
            input.addEventListener('input', () => {
                criteria[Number(input.dataset.idx)].max_points = Number(input.value || 0);
                syncTotalPoints();
            }));
    }

    function addLevelRow(name = '', weight = '') {
        const container = document.querySelector('.levels-row');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'level-input-group';
        div.innerHTML = `
            <input type="text" class="level-name-input" placeholder="Level name" value="${esc(name)}">
            <input type="number" class="level-weight-input" placeholder="%" value="${esc(weight)}">
        `;
        container.appendChild(div);
    }

    window.addLevel = function () {
        addLevelRow();
    };

    function collectLevels() {
        const levels = [];
        document.querySelectorAll('.level-input-group').forEach(group => {
            const name = group.querySelector('.level-name-input')?.value?.trim();
            const weight = Number(group.querySelector('.level-weight-input')?.value || 0);
            if (name) levels.push({ name, weight_percent: weight });
        });
        return levels;
    }

    function syncTotalPoints() {
        if (!els.totalPoints) return;
        const sum = criteria.reduce((acc, c) => acc + Number(c.max_points || 0), 0);
        if (sum > 0) els.totalPoints.value = sum;
    }

    window.resetRubric = function () {
        criteria = [];
        renderCriteria();
        els.form?.reset();
        notify('Rubric builder reset', 'info');
    };

    async function loadRubrics() {
        try {
            const resp = await fetch('/api/teacher/rubrics', { headers: authHeaders() });
            if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
            const payload = await resp.json();
            rubrics = payload?.rubrics || [];
            renderRubricsList();
        } catch (err) {
            console.error('Failed to load rubrics:', err);
            if (els.rubricsList) els.rubricsList.innerHTML = '<div class="loading-text">Failed to load saved rubrics</div>';
        }
    }

    function getArchiveSet() {
        try { return new Set(JSON.parse(localStorage.getItem(RUBRIC_ARCHIVE_KEY) || '[]')); }
        catch (_) { return new Set(); }
    }

    function setArchived(id, archived) {
        const set = getArchiveSet();
        if (archived) set.add(String(id)); else set.delete(String(id));
        try { localStorage.setItem(RUBRIC_ARCHIVE_KEY, JSON.stringify([...set])); } catch (_) { }
        renderRubricsList();
    }

    window.previewSavedRubric = function (id) {
        const r = rubrics.find(item => String(item.id) === String(id));
        if (!r) return;
        showPreview({
            name: r.name,
            assessmentType: '',
            totalPoints: r.total_points,
            description: r.description,
            criteria: (r.criteria || []).map(c => ({
                name: c.name,
                description: c.description,
                max_points: Array.isArray(c.levels) && c.levels.length
                    ? Math.max(...c.levels.map(l => Number(l.points || 0)))
                    : Number(c.max_points || 0)
            }))
        }, true);
    };

    window.toggleArchiveRubric = function (id, archived) {
        setArchived(id, archived);
    };

    function renderRubricsList() {
        if (!els.rubricsList) return;

        const search = (els.rubricSearch?.value || '').toLowerCase();
        const type = els.typeFilter?.value || '';
        const archiveSet = getArchiveSet();

        let items = rubrics.filter(r => {
            if (type && r.name && !String(r.description || '').toLowerCase().includes(type)) {
                if (type !== 'all' && !(r.description || '').toLowerCase().includes(type)) { /* keep going - type filter is advisory */ }
            }
            if (search && !`${r.name} ${r.description}`.toLowerCase().includes(search)) return false;
            return true;
        });

        if (rubricFilter === 'active') items = items.filter(r => !archiveSet.has(String(r.id)));
        else if (rubricFilter === 'archived') items = items.filter(r => archiveSet.has(String(r.id)));

        if (!items.length) {
            els.rubricsList.innerHTML = '<div class="loading-text">No rubrics found. Build one above and click Save Rubric.</div>';
            return;
        }

        els.rubricsList.innerHTML = items.map(r => {
            const archived = archiveSet.has(String(r.id));
            const count = Array.isArray(r.criteria) ? r.criteria.length : 0;
            return `
                <div class="card hover-lift" style="margin-bottom:0.75rem;">
                    <div class="card-header"><strong>${esc(r.name)}</strong> ${archived ? '<span class="badge">Archived</span>' : ''}</div>
                    <div class="card-body">${count} criteria • ${Number(r.total_points || 0)} points${r.description ? ` — ${esc(truncate(r.description, 90))}` : ''}</div>
                    <div class="card-footer">
                        <button class="btn btn-sm" onclick="previewSavedRubric('${jsId(r.id)}')">Preview</button>
                        <button class="btn btn-sm" onclick="toggleArchiveRubric('${jsId(r.id)}', ${archived ? 'false' : 'true'})">${archived ? 'Restore' : 'Archive'}</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function truncate(text, max) {
        const t = String(text || '');
        return t.length > max ? `${t.slice(0, max)}…` : t;
    }

    window.saveRubric = async function () {
        const name = els.title?.value?.trim();
        const description = els.description?.value?.trim() || '';
        const levels = collectLevels();

        if (!name) { notify('Rubric title is required', 'error'); els.title?.focus(); return; }
        if (!criteria.length) { notify('Add at least one criterion before saving', 'error'); return; }
        if (criteria.some(c => !c.name?.trim())) { notify('Every criterion needs a name', 'error'); return; }

        const payload = {
            name,
            description: [description, els.assessmentType?.value ? `Assessment type: ${els.assessmentType.value}` : '']
                .filter(Boolean).join(' • '),
            criteria: criteria.map(c => ({
                name: c.name.trim(),
                description: c.description || '',
                max_points: Number(c.max_points || 0),
                levels: levels.map(l => ({ points: Math.round((l.weight_percent / 100) * Number(c.max_points || 0)), description: l.name }))
            }))
        };

        try {
            const resp = await fetch('/api/teacher/rubrics', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error(data?.error || data?.message || `Request failed (${resp.status})`);
            notify('Rubric saved successfully!', 'success');
            resetRubric();
            await loadRubrics();
        } catch (err) {
            console.error('Save rubric failed:', err);
            notify(err.message || 'Failed to save rubric', 'error');
        }
    };

    window.previewRubric = function () {
        const levels = collectLevels();
        showPreview({
            name: els.title?.value?.trim() || 'Untitled Rubric',
            assessmentType: els.assessmentType?.value || '',
            totalPoints: criteria.reduce((sum, c) => sum + Number(c.max_points || 0), 0),
            description: els.description?.value?.trim(),
            criteria,
            levels
        });
    };

    function showPreview(draft, hideLevels) {
        if (!els.modalBody) return;
        const levels = draft.levels && draft.levels.length
            ? `<p><strong>Levels:</strong> ${draft.levels.map(l => esc(`${l.name} (${l.weight_percent}%)`)).join(' • ')}</p>`
            : '';

        els.modalBody.innerHTML = `
            <h3>${esc(draft.name)}</h3>
            ${draft.assessmentType ? `<p><strong>Type:</strong> ${esc(draft.assessmentType)}</p>` : ''}
            ${draft.description ? `<p>${esc(draft.description)}</p>` : ''}
            <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:0.5rem; border-bottom:1px dotted var(--r-line-strong);">Criterion</th>
                        <th style="text-align:left; padding:0.5rem; border-bottom:1px dotted var(--r-line-strong);">Description</th>
                        <th style="text-align:right; padding:0.5rem; border-bottom:1px dotted var(--r-line-strong);">Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${(draft.criteria || []).length ? (draft.criteria || []).map(c => `
                        <tr>
                            <td style="padding:0.5rem; border-bottom:1px solid var(--glass-border);"><strong>${esc(c.name || '-')}</strong></td>
                            <td style="padding:0.5rem; border-bottom:1px solid var(--glass-border);">${esc(c.description || '-')}</td>
                            <td style="padding:0.5rem; border-bottom:1px solid var(--glass-border); text-align:right;">${Number(c.max_points || 0)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="3" style="padding:1rem; text-align:center;">No criteria added yet</td></tr>'}
                </tbody>
            </table>
            <p style="margin-top:0.75rem;"><strong>Total Points:</strong> ${Number(draft.totalPoints || 0)}</p>
            ${hideLevels ? '' : levels}
        `;
        if (els.modal) els.modal.style.display = 'flex';
    }

    window.closeRubricModal = function () {
        if (els.modal) els.modal.style.display = 'none';
    };

    window.exportRubric = function () {
        const data = {
            name: els.title?.value?.trim() || 'Rubric',
            assessmentType: els.assessmentType?.value || '',
            totalPoints: criteria.reduce((sum, c) => sum + Number(c.max_points || 0), 0),
            description: els.description?.value?.trim() || '',
            levels: collectLevels(),
            criteria
        };
        if (!data.criteria.length) { notify('Nothing to export yet — build the rubric first', 'warning'); return; }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${(data.name || 'rubric').replace(/[^\w-]+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        notify('Rubric exported as JSON', 'success');
    };

    document.addEventListener('DOMContentLoaded', () => {
        cacheEls();
        bindEvents();
        renderCriteria();
        loadRubrics();
    });
})();
