// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('teacher')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires teacher role');
  }
})();

(function () {
    'use strict';

    const QB_SUBJECTS_KEY = 'qbSubjects';
    const TYPE_LABELS = { mcq: 'MCQ', short_answer: 'Short Answer', essay: 'Essay' };
    let questions = [];
    let page = 1;
    const limit = 20;
    let total = 0;
    let editingId = null;
    let typeFilter = 'all';
    let warnedSubjectRegistry = false;

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

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; }

    function loadSubjectRegistry() {
        try {
            const raw = localStorage.getItem(QB_SUBJECTS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) { }
        return {
            'Data Structures': 101,
            'Operating Systems': 102,
            'Database Management Systems': 103
        };
    }

    function saveSubjectRegistry(registry) {
        try { localStorage.setItem(QB_SUBJECTS_KEY, JSON.stringify(registry)); } catch (_) { }
    }

    function resolveSubjectId(name) {
        const registry = loadSubjectRegistry();
        const key = String(name || '').trim();
        if (!key) return 0;
        if (registry[key]) return Number(registry[key]);
        // No server-side subjects table exists to mint real IDs, so derive a
        // deterministic ID from the subject name (same name -> same ID on every
        // device) instead of inventing per-browser sequence numbers.
        let hash = 2166136261;
        for (let i = 0; i < key.length; i++) {
            hash ^= key.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        const id = Math.abs(hash % 1000000000) + 1;
        registry[key] = id;
        saveSubjectRegistry(registry);
        if (!warnedSubjectRegistry) {
            warnedSubjectRegistry = true;
            console.warn('No /api/subjects endpoint exists server-side; subject IDs are derived deterministically from subject names.');
        }
        return id;
    }

    function teacherProfileSubjects() {
        const user = window.APP?.Storage?.get?.('user') || {};
        if (Array.isArray(user.subjects)) return user.subjects.filter(Boolean);
        if (typeof user.subjects_taught === 'string' && user.subjects_taught.trim()) {
            return user.subjects_taught.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return [];
    }

    function refreshSubjectOptions() {
        const registry = loadSubjectRegistry();
        const names = [...new Set(teacherProfileSubjects().concat(Object.keys(registry)))].sort();
        const options = ['<option value="">All Subjects</option>']
            .concat(names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`));
        if (els.subjectFilter) els.subjectFilter.innerHTML = options.join('');
    }

    function cacheEls() {
        els.search = document.getElementById('questionSearch');
        els.subjectFilter = document.getElementById('subjectFilter');
        els.difficultyFilter = document.getElementById('difficultyFilter');
        els.list = document.getElementById('questionsList');
        els.addForm = document.getElementById('addQuestionForm');
        els.paperForm = document.getElementById('generatePaperForm');
        els.modal = document.getElementById('questionModal');
        els.modalBody = document.getElementById('questionModalBody');
        els.mcqOptions = document.getElementById('mcqOptions');
    }

    function bindEvents() {
        els.search?.addEventListener('input', debounce(() => loadQuestions(1), 400));
        els.subjectFilter?.addEventListener('change', () => loadQuestions(1));
        els.difficultyFilter?.addEventListener('change', () => loadQuestions(1));

        document.querySelectorAll('.filter-tabs .tab-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                typeFilter = btn.dataset.filter || 'all';
                loadQuestions(1);
            });
        });

        els.addForm?.addEventListener('submit', onSubmitQuestion);
        els.paperForm?.addEventListener('submit', (e) => { e.preventDefault(); buildPaper(); });
    }

    async function loadQuestions(targetPage = 1) {
        page = targetPage;
        if (!els.list) return;
        els.list.innerHTML = '<div class="loading-text">Loading questions...</div>';
        try {
            const q = new URLSearchParams();
            const search = els.search?.value?.trim();
            const diff = els.difficultyFilter?.value;
            const subjectName = els.subjectFilter?.value;
            if (search) q.set('q', search);
            if (diff) q.set('difficulty', diff);
            if (subjectName) q.set('subject_id', String(resolveSubjectId(subjectName)));
            if (typeFilter !== 'all') q.set('question_type', typeFilter);
            q.set('page', String(page));
            q.set('limit', String(limit));

            const resp = await fetch(`/api/question-bank?${q.toString()}`, { headers: authHeaders() });
            if (!resp.ok) throw new Error('Request failed');
            const payload = await resp.json();
            questions = payload?.data?.items ?? [];
            total = Number(payload?.data?.total ?? questions.length);
            renderGrid(questions);
            renderPagination();
            updateStats();
        } catch (err) {
            console.error('Failed to load questions:', err);
            questions = [];
            els.list.innerHTML = '<div class="loading-text">Failed to load questions. Is the API server running?</div>';
        }
    }

    function filterQuestionsByType() {
        // Type filtering happens server-side (question_type query param), so the
        // loaded page already matches the active tab and pager counts stay in sync.
        return questions;
    }

    function updateStats() {
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('totalQuestions', total);
        setEl('subjectCovered', new Set(questions.map(q => q.subject_id)).size);
        const counts = {};
        questions.forEach(q => { if (q.difficulty) counts[q.difficulty] = (counts[q.difficulty] || 0) + 1; });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setEl('avgDifficulty', top ? top[0].charAt(0).toUpperCase() + top[0].slice(1) : '--');
        setEl('questionPapers', localStorage.getItem('qbPaperCount') || 0);
    }

    function renderGrid(items) {
        if (!els.list) return;
        if (!items.length) {
            els.list.innerHTML = '<div class="loading-text">No questions found</div>';
            return;
        }
        els.list.innerHTML = items.map(q => `
            <div class="card hover-lift" data-id="${esc(q.id)}">
                <div class="card-header">
                    <strong>${esc(q.topic || 'General')}</strong>
                    <span>${TYPE_LABELS[q.question_type] || esc(q.question_type)} • <span class="badge">${esc(q.difficulty || 'unknown')}</span> • ${Number(q.marks || 0)} marks</span>
                </div>
                <div class="card-body">${esc(truncate(q.question_text, 220))}</div>
                <div class="card-footer">
                    <button class="btn btn-sm" onclick="editQuestion('${jsId(q.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${jsId(q.id)}', this)">Delete</button>
                    <button class="btn btn-sm" onclick="showQuestionDetail('${jsId(q.id)}')">Details</button>
                </div>
            </div>
        `).join('');
    }

    function truncate(text, max) {
        const t = String(text || '');
        return t.length > max ? `${t.slice(0, max)}…` : t;
    }

    function renderPagination() {
        const totalPages = Math.max(1, Math.ceil(total / limit));
        let pager = document.getElementById('qbPager');
        if (!pager && els.list?.parentElement) {
            pager = document.createElement('div');
            pager.id = 'qbPager';
            pager.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:1rem;';
            els.list.parentElement.appendChild(pager);
        }
        if (!pager) return;
        if (totalPages <= 1) { pager.innerHTML = ''; return; }
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="view-btn ${i === page ? 'active' : ''}" data-pg="${i}">${i}</button>`;
        }
        pager.innerHTML = html;
        pager.querySelectorAll('button').forEach(b => b.addEventListener('click', () => loadQuestions(Number(b.dataset.pg))));
    }

    window.toggleMCQOptions = window.toggleMCQOptions || function () {
        const type = document.getElementById('questionType')?.value;
        const box = document.getElementById('mcqOptions');
        if (box) box.style.display = type === 'mcq' ? 'block' : 'none';
    };

    function collectFormPayload() {
        const subject = document.getElementById('subject')?.value?.trim();
        const unit = document.getElementById('unit')?.value?.trim();
        const topic = document.getElementById('topic')?.value?.trim();
        const questionType = document.getElementById('questionType')?.value;
        const difficulty = document.getElementById('difficulty')?.value;
        const marks = document.getElementById('marks')?.value;
        const bloom = document.getElementById('bloomLevel')?.value;
        const questionText = document.getElementById('question')?.value?.trim();
        const answer = document.getElementById('answer')?.value?.trim();

        const payload = {
            subject_id: resolveSubjectId(subject),
            question_text: questionText,
            question_type: questionType,
            difficulty,
            topic: [unit, topic].filter(Boolean).join(' • ').slice(0, 100) || undefined,
            blooms_taxonomy: bloom || undefined,
            marks: Number(marks || 1)
        };

        if (questionType === 'mcq') {
            const letters = ['A', 'B', 'C', 'D'];
            const correctLetter = (document.querySelector('input[name="correctOption"]:checked') || {}).value;
            payload.options = letters.map(l => ({
                letter: l,
                text: document.getElementById(`option${l}`)?.value?.trim() || ''
            }));
            if (correctLetter) payload.correct_answer = correctLetter;
        } else if (answer) {
            payload.correct_answer = answer;
        }
        return payload;
    }

    async function onSubmitQuestion(e) {
        e.preventDefault();
        const payload = collectFormPayload();

        if (!payload.subject_id || !payload.question_text || !payload.question_type || !payload.difficulty) {
            notify('Subject, type, difficulty, and question text are required', 'error');
            return;
        }
        if (payload.question_type === 'mcq' && !(payload.options || []).every(o => o.text)) {
            notify('Please fill in all four MCQ options', 'error');
            return;
        }

        try {
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId ? `/api/question-bank/${encodeURIComponent(editingId)}` : '/api/question-bank';
            const resp = await fetch(url, {
                method,
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const errPayload = await resp.json().catch(() => null);
                throw new Error(errPayload?.message || `Request failed (${resp.status})`);
            }
            notify(editingId ? 'Question updated successfully!' : 'Question added successfully!', 'success');
            resetQuestionForm();
            loadQuestions(editingId ? page : 1);
        } catch (err) {
            console.error('Save question failed:', err);
            notify(err.message || 'Failed to save question', 'error');
        }
    }

    window.resetQuestionForm = function () {
        els.addForm?.reset();
        if (els.mcqOptions) els.mcqOptions.style.display = 'none';
        editingId = null;
        document.querySelectorAll('#addQuestionForm button[type="submit"]').forEach(btn => {
            const span = btn.querySelector('span');
            if (span) span.textContent = '✓';
            btn.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = ' Add Question ';
            });
        });
    };

    window.editQuestion = function (id) {
        const q = questions.find(item => String(item.id) === String(id));
        if (!q) return;
        editingId = id;

        const topicParts = String(q.topic || '').split('•').map(p => p.trim());
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('unit', topicParts.length > 1 ? topicParts[0] : '');
        setVal('topic', topicParts.length > 1 ? topicParts.slice(1).join(' • ') : (q.topic || ''));
        setVal('questionType', q.question_type);
        setVal('difficulty', q.difficulty);
        setVal('marks', q.marks);
        setVal('bloomLevel', q.blooms_taxonomy || '');
        setVal('question', q.question_text || '');
        setVal('answer', typeof q.correct_answer === 'string' && !['A', 'B', 'C', 'D'].includes(q.correct_answer) ? q.correct_answer : '');

        toggleMCQOptions();
        (q.options || []).forEach(opt => {
            const input = document.getElementById(`option${opt.letter}`);
            if (input) input.value = opt.text || '';
        });
        if (['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
            const radio = document.querySelector(`input[name="correctOption"][value="${q.correct_answer}"]`);
            if (radio) radio.checked = true;
        }

        els.addForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        notify('Editing existing question — submit to save changes', 'info');
    };

    window.deleteQuestion = function (id, btn) {
        if (!btn.dataset.confirming) {
            btn.dataset.confirming = 'true';
            btn.textContent = 'Confirm?';
            setTimeout(() => {
                if (btn.isConnected) {
                    delete btn.dataset.confirming;
                    btn.textContent = 'Delete';
                }
            }, 4000);
            return;
        }
        fetch(`/api/question-bank/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() })
            .then(resp => {
                if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
                notify('Question deleted', 'success');
                loadQuestions(page);
            })
            .catch(err => {
                console.error('Delete question failed:', err);
                notify(err.message || 'Failed to delete question', 'error');
            });
    };

    window.showQuestionDetail = function (id) {
        const q = questions.find(item => String(item.id) === String(id));
        if (!q || !els.modalBody) return;
        const optionRows = (q.options || []).map(o => `
            <div style="padding:0.35rem 0;">
                ${o.letter === q.correct_answer ? '✅' : '▫️'} <strong>${esc(o.letter)})</strong> ${esc(o.text)}
            </div>
        `).join('');
        els.modalBody.innerHTML = `
            <p><strong>Type:</strong> ${TYPE_LABELS[q.question_type] || esc(q.question_type)} &nbsp; <strong>Difficulty:</strong> ${esc(q.difficulty)} &nbsp; <strong>Marks:</strong> ${Number(q.marks || 0)}</p>
            <p><strong>Topic:</strong> ${esc(q.topic || '-')}</p>
            <p style="line-height:1.6;">${esc(q.question_text)}</p>
            ${optionRows ? `<div style="margin-top:0.75rem;">${optionRows}</div>` : ''}
            ${q.correct_answer && !optionRows ? `<p style="margin-top:0.75rem;"><strong>Answer:</strong> ${esc(q.correct_answer)}</p>` : ''}
        `;
        if (els.modal) els.modal.style.display = 'flex';
    };

    window.closeQuestionModal = function () {
        if (els.modal) els.modal.style.display = 'none';
    };

    window.importQuestions = function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const resp = await fetch('/api/question-bank/import', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: formData
                });
                const payload = await resp.json().catch(() => null);
                if (!resp.ok) throw new Error(payload?.message || `Import failed (${resp.status})`);
                notify(`Imported ${(payload?.inserted || payload?.data?.inserted || []).length || 'some'} questions`, 'success');
                loadQuestions(1);
            } catch (err) {
                console.error('Import failed:', err);
                notify(err.message || 'Import failed', 'error');
            }
        };
        input.click();
    };

    window.exportQuestions = function () {
        if (!questions.length) {
            notify('No questions loaded to export', 'warning');
            return;
        }
        const rows = [['ID', 'Type', 'Difficulty', 'Marks', 'Topic', 'Question', 'Correct Answer']].concat(
            questions.map(q => [
                q.id, q.question_type, q.difficulty, q.marks, q.topic, q.question_text, q.correct_answer
            ])
        );
        const csv = rows.map(row => row.map(cell => {
            const val = String(cell ?? '');
            return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
        }).join(',')).join('\n');
        const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `question-bank-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        notify('Questions exported to CSV', 'success');
    };

    window.previewPaper = buildPaper;

    function buildPaper() {
        if (!els.paperForm) return;
        if (!els.paperForm.reportValidity()) return;

        const subject = document.getElementById('paperSubject')?.value?.trim();
        const examType = document.getElementById('examType')?.value;
        const totalMarks = Number(document.getElementById('totalMarks')?.value || 0);
        const duration = Number(document.getElementById('duration')?.value || 0);
        const wanted = {
            easy: Number(document.getElementById('easyCount')?.value || 0),
            medium: Number(document.getElementById('mediumCount')?.value || 0),
            hard: Number(document.getElementById('hardCount')?.value || 0)
        };
        const wantedTotal = wanted.easy + wanted.medium + wanted.hard;
        if (!wantedTotal) {
            notify('Set how many easy/medium/hard questions you need', 'warning');
            return;
        }

        const pool = questions.filter(q => !subject || String(q.topic || '').toLowerCase().includes(subject.toLowerCase()));
        const picked = [];
        Object.keys(wanted).forEach(diff => {
            picked.push(...pool.filter(q => q.difficulty === diff).slice(0, wanted[diff]));
        });

        if (!picked.length) {
            notify('No matching questions in your bank yet — add questions first or widen the subject match', 'warning');
            return;
        }

        const paperMarks = picked.reduce((sum, q) => sum + Number(q.marks || 0), 0);
        const sectionsHtml = picked.map((q, idx) => `
            <div style="margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:1px dotted var(--r-line-strong);">
                <strong>Q${idx + 1}.</strong> ${esc(q.question_text)}
                <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:0.25rem;">
                    [${TYPE_LABELS[q.question_type] || esc(q.question_type)} • ${esc(q.difficulty)} • ${Number(q.marks || 0)} marks]
                </div>
            </div>
        `).join('');

        if (els.modalBody) {
            els.modalBody.innerHTML = `
                <div style="text-align:center; margin-bottom:1rem;">
                    <h4>${esc(subject || 'Question Paper')}</h4>
                    <p>${esc(examType || '')} • Total Marks: ${paperMarks}${totalMarks ? ` / ${totalMarks}` : ''} • Duration: ${duration} mins</p>
                </div>
                ${sectionsHtml}
                ${paperMarks !== totalMarks ? `<p style="color:var(--warning,#d71921);">⚠️ Paper totals ${paperMarks} marks vs a target of ${totalMarks}. Adjust counts or question marks.</p>` : ''}
            `;
        }
        if (els.modal) els.modal.style.display = 'flex';

        try {
            localStorage.setItem('qbPaperCount', String(Number(localStorage.getItem('qbPaperCount') || 0) + 1));
        } catch (_) { }
        updateStats();
    }

    document.addEventListener('DOMContentLoaded', () => {
        cacheEls();
        bindEvents();
        refreshSubjectOptions();
        loadQuestions(1);
    });
})();
