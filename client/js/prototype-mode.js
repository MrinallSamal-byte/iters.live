// Prototype Mode Bootstrap
// Ensures dashboards work without real auth/API by seeding a demo user and tokens.
(function() {
  try {
    // Toggle via localStorage.setItem('prototypeMode', 'true') to force enable
    const forced = (localStorage.getItem('prototypeMode') || '').toString() === 'true';

    // Enable automatically on dashboard/student pages if no token present
  const onStudentPage = /\/dashboard\/student(\.|$)/i.test(window.location.pathname);
  const onAnyStudentPage = /\/dashboard\/(student|student-)/i.test(window.location.pathname);
  const onTeacherPage = /\/dashboard\/(teacher|teacher-)/i.test(window.location.pathname);
  const onAdminPage = /\/dashboard\/(admin|admin-)/i.test(window.location.pathname);
    const hasAnyToken = !!(localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('accessToken'));

    if (!forced && !(onAnyStudentPage || onTeacherPage || onAdminPage)) return;

    if (forced || !hasAnyToken) {
      // Demo user profile
      // Determine demo role
      const demoRole = (localStorage.getItem('demoRole') || '').toLowerCase() || (onAdminPage ? 'admin' : onTeacherPage ? 'teacher' : 'student');

      // Prefer centralized demo accounts if available
      let demoUser;
      try {
        demoUser = (window.DummyData?.getDemoUser?.(demoRole)) || null;
      } catch {}
      if (!demoUser) {
        demoUser = demoRole === 'admin' ? {
          id: 30001,
          registration_number: 'ADM2025001',
          name: 'Demo Admin',
          email: 'demo.admin@iter.edu',
          role: 'admin'
        } : demoRole === 'teacher' ? {
          id: 20001,
          registration_number: 'TCH2025001',
          name: 'Demo Teacher',
          email: 'demo.teacher@iter.edu',
          role: 'teacher',
          department: 'CSE'
        } : {
          id: 10001,
          registration_number: 'STU20250001',
          name: 'Shreya Mishra',
          email: 'student1@iter.edu',
          role: 'student',
          department: 'CIVIL',
          year: 1,
          section: 'A',
          semester: '1',
          blood_group: 'O+',
          profile_pic: '/uploads/avatars/default-avatar.svg'
        };
      }

      const demoToken = 'demo-token';

      // Seed storage for various code paths
      try { localStorage.setItem('token', demoToken); } catch(e) {}
      try { sessionStorage.setItem('token', demoToken); } catch(e) {}
      try { localStorage.setItem('accessToken', JSON.stringify(demoToken)); } catch(e) {}
      try { localStorage.setItem('user', JSON.stringify(demoUser)); } catch(e) {}
      try { sessionStorage.setItem('user', JSON.stringify(demoUser)); } catch(e) {}

      // Mark as prototype mode
      window.PROTOTYPE_MODE = true;
      if (!forced) {
        // Persist prototype mode so subsequent pages keep working
        try { localStorage.setItem('prototypeMode', 'true'); } catch(e) {}
      }

      // Gentle console hint
      if (!window.__prototypeBannerShown) {
        window.__prototypeBannerShown = true;
        console.log('%cPrototype Mode Enabled (demo role: ' + demoUser.role + ')', 'padding:2px 6px;border-radius:4px;background:#6366f1;color:#fff');
      }
    }
  } catch (err) {
    console.warn('Prototype mode bootstrap failed:', err);
  }
})();

// Optional: simple demo role switcher for quick testing
window.__enableDemoRoleSwitcher = function() {
  try {
    let c = document.getElementById('demoRoleSwitcher');
    if (c) return;
    c = document.createElement('div');
    c.id = 'demoRoleSwitcher';
    c.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9999;background:var(--glass-bg,#111);color:#fff;border:1px solid var(--glass-border,#333);border-radius:8px;padding:6px 8px;display:flex;gap:6px;align-items:center;font:12px system-ui;backdrop-filter:blur(8px)';
    c.innerHTML = '<span style="opacity:.8">Demo role</span>'+
      ['student','teacher','admin'].map(r=>`<button data-r="${r}" style="cursor:pointer;border:1px solid #555;background:transparent;color:#fff;border-radius:6px;padding:4px 8px">${r}</button>`).join('');
    c.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ localStorage.setItem('demoRole', b.dataset.r); localStorage.removeItem('accessToken'); location.reload(); }));
    document.body.appendChild(c);
  } catch {}
}
document.addEventListener('DOMContentLoaded', ()=>{ if ((localStorage.getItem('prototypeMode')||'')==='true') { window.__enableDemoRoleSwitcher?.(); } });
