(function(){
  'use strict';
  const bodyEl = document.getElementById('deptTableBody');
  const searchEl = document.getElementById('deptSearch');

  function row(d){
    return `<tr>
      <td>${escapeHtml(d.code)}</td>
      <td>${escapeHtml(d.name)}</td>
      <td>${escapeHtml(d.hod||'-')}</td>
      <td>${Number(d.total_students||0)}</td>
      <td>${Number(d.total_teachers||0)}</td>
      <td>${Number(d.active_courses||0)}</td>
    </tr>`;
  }
  function render(items){
    if(!bodyEl) return;
    bodyEl.innerHTML = items && items.length ? items.map(row).join('') : '<tr><td colspan="6">No departments</td></tr>';
    
    // Update summary stats
    updateStats(items);
  }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  function updateStats(items) {
    // Calculate totals from departments data
    const totalDepts = items.length;
    const totalStudents = items.reduce((sum, d) => sum + Number(d.total_students || 0), 0);
    const totalTeachers = items.reduce((sum, d) => sum + Number(d.total_teachers || 0), 0);
    const totalCourses = items.reduce((sum, d) => sum + Number(d.active_courses || 0), 0);
    
    // Update stat boxes
    const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setEl('totalDepartments', totalDepts);
    setEl('totalStudents', totalStudents);
    setEl('totalTeachers', totalTeachers);
    setEl('totalCourses', totalCourses);
  }

  async function load(){
    try{
      let res;
      try{
        res = await fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${APP.Storage.get('accessToken')||''}` }}).then(r=>r.ok?r.json():null);
      }catch(_){ res = null; }
      if(!res || !res.success){ res = window.DummyData?.getDepartments?.(); }
      const items = res?.data || [];
      const q = searchEl?.value?.trim()?.toLowerCase();
      const filtered = q? items.filter(d=>`${d.code} ${d.name} ${d.hod}`.toLowerCase().includes(q)) : items;
      render(filtered);
    }catch(err){ console.error('Departments load failed', err); render([]); }
  }

  searchEl?.addEventListener('input', debounce(load, 250));
  function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); }; }

  const modalEl = document.getElementById('departmentModal');
  let warnedNoEndpoint = false;

  function openDepartmentModal(){
    if (!modalEl) { console.warn('Department modal not found'); return; }
    document.getElementById('modalTitleText').textContent = 'Add New Department';
    modalEl.style.display = 'flex';
  }

  window.closeDepartmentModal = function(){
    if (modalEl) modalEl.style.display = 'none';
  };

  window.exportDepartments = function(){
    fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${APP.Storage.get('accessToken')||''}` } })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        const items = res?.data || [];
        if (!items.length) { console.warn('No departments to export'); return; }
        const rows = [['Code','Name','HOD','Students','Faculty','Courses']].concat(
          items.map(d => [d.code, d.name, d.hod || '', d.total_students || 0, d.total_teachers || 0, d.active_courses || 0])
        );
        const csv = rows.map(row => row.map(cell => {
          const val = String(cell ?? '');
          return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
        }).join(',')).join('\n');
        const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `departments-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      })
      .catch(err => console.error('Export departments failed', err));
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addDeptBtn')?.addEventListener('click', openDepartmentModal);
    const form = document.getElementById('departmentForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!warnedNoEndpoint) {
        warnedNoEndpoint = true;
        console.warn('Department creation is not available: the server has no POST /api/admin/departments endpoint yet.');
      }
    });
  });

  document.addEventListener('DOMContentLoaded', load);
})();
