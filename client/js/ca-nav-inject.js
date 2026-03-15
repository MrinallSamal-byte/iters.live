/* ============================================================
   CampusArena Nav Injector — ITER EduHub
   Replaces old glass-morphism navbar with Nothing OS header
   Runs on ALL pages (landing, auth, dashboard)
   ============================================================ */
(function () {
  'use strict';

  var THEME_KEY = 'campusarena-theme';

  /* ── Helpers ────────────────────────────────────────────── */
  function getUser() {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) { return {}; }
  }
  function isAuthed() {
    return !!(localStorage.getItem('accessToken') && localStorage.getItem('user'));
  }
  function isDashboard() {
    return window.location.pathname.indexOf('/dashboard/') !== -1;
  }
  function currentPath() {
    return window.location.pathname;
  }
  function navigate(url) {
    if (window.LinkEncoding && typeof window.LinkEncoding.navigateTo === 'function') {
      window.LinkEncoding.navigateTo(url);
    } else {
      window.location.href = url;
    }
  }

  /* ── Build nav links ────────────────────────────────────── */
  function navLinks() {
    var path = currentPath();
    var auth = isAuthed();
    var user = getUser();
    var role = user.role || '';

    if (isDashboard()) {
      // Dashboard pages: role-specific nav
      if (role === 'student') {
        return [
          { href: '/dashboard/student.html',            icon: 'layout-dashboard', label: 'Dashboard' },
          { href: '/dashboard/student-attendance.html', icon: 'bar-chart-2',      label: 'Attendance' },
          { href: '/dashboard/student-marks.html',      icon: 'trending-up',      label: 'Marks' },
          { href: '/dashboard/student-timetable.html',  icon: 'calendar',         label: 'Timetable' },
          { href: '/dashboard/student-events.html',     icon: 'star',             label: 'Events' },
        ];
      } else if (role === 'teacher') {
        return [
          { href: '/dashboard/teacher.html',            icon: 'layout-dashboard', label: 'Dashboard' },
          { href: '/dashboard/teacher-attendance.html', icon: 'check-square',     label: 'Attendance' },
          { href: '/dashboard/teacher-marks.html',      icon: 'trending-up',      label: 'Marks' },
          { href: '/dashboard/teacher-assignments.html',icon: 'clipboard',        label: 'Assignments' },
          { href: '/dashboard/teacher-students.html',   icon: 'users',            label: 'Students' },
        ];
      } else if (role === 'admin') {
        return [
          { href: '/dashboard/admin.html',              icon: 'layout-dashboard', label: 'Dashboard' },
          { href: '/dashboard/admin-users.html',        icon: 'users',            label: 'Users' },
          { href: '/dashboard/admin-analytics.html',    icon: 'bar-chart-2',      label: 'Analytics' },
          { href: '/dashboard/admin-approvals.html',    icon: 'check-circle',     label: 'Approvals' },
          { href: '/dashboard/admin-announcements.html',icon: 'bell',             label: 'Announcements' },
        ];
      }
    }

    // Public / landing pages
    return [
      { href: '/#about',    icon: 'info',     label: 'About' },
      { href: '/#academics',icon: 'book-open',label: 'Academics' },
      { href: '/creator.html', icon: 'code-2', label: 'Creator' },
      { href: '/#contact',  icon: 'mail',     label: 'Contact' },
    ];
  }

  function buildNavLinksHTML() {
    var path = currentPath();
    return navLinks().map(function (link) {
      var active = (path === link.href || path.indexOf(link.href.split('#')[0]) !== -1 && link.href !== '/') ? ' active' : '';
      if (link.href === '/') active = (path === '/' || path === '/index.html') ? ' active' : '';
      return '<a href="' + link.href + '" class="' + active.trim() + '">' +
        '<i data-lucide="' + link.icon + '"></i> ' + link.label + '</a>';
    }).join('');
  }

  function buildMobileNavLinksHTML() {
    var path = currentPath();
    var links = navLinks();
    var html = links.map(function (link) {
      return '<a href="' + link.href + '"><i data-lucide="' + link.icon + '"></i> ' + link.label + '</a>';
    }).join('');
    return html;
  }

  /* ── Auth sections ──────────────────────────────────────── */
  function buildUserMenu(user) {
    var name = user.first_name || user.name || 'Account';
    var initial = name.charAt(0).toUpperCase();
    var role = (user.role || '').charAt(0).toUpperCase() + (user.role || '').slice(1);
    var dashHref = user.role === 'teacher' ? '/dashboard/teacher.html'
                 : user.role === 'admin'   ? '/dashboard/admin.html'
                 : '/dashboard/student.html';

    return '<div class="user-menu">' +
      '<button class="user-menu-toggle" id="ca-user-btn">' +
        '<div class="avatar">' + initial + '</div>' +
        '<span>' + name + '</span>' +
        '<i data-lucide="chevron-down" style="width:14px;height:14px;color:var(--muted)"></i>' +
      '</button>' +
      '<div class="user-dropdown" id="ca-user-dropdown">' +
        '<a href="' + dashHref + '"><i data-lucide="layout-dashboard"></i> Dashboard</a>' +
        '<div class="dropdown-divider"></div>' +
        '<button class="dd-item danger" id="ca-logout-btn" type="button"><i data-lucide="log-out"></i> Sign Out</button>' +
      '</div>' +
    '</div>';
  }

  function buildGuestButtons() {
    return '<a href="/register.html" class="btn-primary btn-small" style="border:1px solid var(--border);background:transparent;color:var(--text)">Register</a>' +
           '<a href="/login.html" class="btn-primary btn-small"><i data-lucide="log-in"></i> Login</a>';
  }

  /* ── Full header HTML ───────────────────────────────────── */
  function buildHeader() {
    var auth = isAuthed();
    var user = getUser();
    var rightSection = auth ? buildUserMenu(user) : buildGuestButtons();
    var mobileAuthLinks = auth
      ? '<button class="mn-item danger" id="ca-mob-logout" type="button"><i data-lucide="log-out"></i> Sign Out</button>'
      : '<a href="/login.html"><i data-lucide="log-in"></i> Login</a><a href="/register.html"><i data-lucide="user-plus"></i> Register</a>';

    return '<a class="skip-link" href="#main-content">Skip to content</a>' +

    '<header class="site-header" id="ca-header">' +
      '<div class="container nav-wrap">' +

        '<a class="brand" href="/index.html">' +
          '<i data-lucide="graduation-cap"></i> ITER EduHub' +
        '</a>' +

        '<nav class="nav-center" id="ca-nav-center">' +
          buildNavLinksHTML() +
        '</nav>' +

        '<div class="nav-right">' +
          '<button id="theme-toggle" class="theme-toggle">' +
            '<span class="theme-toggle-track"><span class="theme-toggle-thumb"></span></span>' +
            '<span id="theme-label">Light</span>' +
          '</button>' +
          rightSection +
          '<button id="mobile-toggle" class="mobile-toggle" aria-label="Open menu">' +
            '<i data-lucide="menu"></i>' +
          '</button>' +
        '</div>' +

      '</div>' +
    '</header>' +

    '<div id="ca-nav-overlay" class="nav-overlay"></div>' +

    '<nav id="ca-mobile-nav" class="mobile-nav">' +
      '<div class="mobile-nav-header">' +
        '<span class="brand">ITER EduHub</span>' +
        '<button class="mobile-nav-close" id="ca-mob-close" aria-label="Close menu">✕</button>' +
      '</div>' +
      buildMobileNavLinksHTML() +
      mobileAuthLinks +
    '</nav>';
  }

  /* ── Footer HTML ────────────────────────────────────────── */
  function buildFooter() {
    return '<footer class="site-footer">' +
      '<div class="container">' +
        '<div class="footer-grid">' +
          '<div>' +
            '<div class="footer-brand">ITER EduHub</div>' +
            '<p class="footer-about">Institute of Technical Education &amp; Research, Siksha \'O\' Anusandhan University. NAAC A++ Accredited.</p>' +
          '</div>' +
          '<div class="footer-col"><h4>Portal</h4>' +
            '<a href="/login.html">Student Login</a>' +
            '<a href="/register.html">Register</a>' +
            '<a href="/dashboard/student.html">Dashboard</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Info</h4>' +
            '<a href="/#about">About ITER</a>' +
            '<a href="/#academics">Academics</a>' +
            '<a href="/creator.html">Creator</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Support</h4>' +
            '<a href="/#contact">Contact</a>' +
            '<a href="/login.html">Help Center</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<p>&copy; 2026 ITER EduHub · Siksha \'O\' Anusandhan University. Built for students.</p>' +
        '</div>' +
      '</div>' +
    '</footer>';
  }

  /* ── Interactions ───────────────────────────────────────── */
  function setupMobileNav() {
    var toggle = document.getElementById('mobile-toggle');
    var overlay = document.getElementById('ca-nav-overlay');
    var nav = document.getElementById('ca-mobile-nav');
    var close = document.getElementById('ca-mob-close');

    function openNav() {
      if (nav) nav.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeNav() {
      if (nav) nav.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (toggle) toggle.addEventListener('click', openNav);
    if (close)  close.addEventListener('click', closeNav);
    if (overlay) overlay.addEventListener('click', closeNav);

    // Close on link click
    if (nav) {
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeNav);
      });
    }
  }

  function setupUserDropdown() {
    var btn = document.getElementById('ca-user-btn');
    var dd  = document.getElementById('ca-user-dropdown');
    if (!btn || !dd) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      dd.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target) && e.target !== btn) {
        dd.classList.remove('open');
      }
    });
  }

  function setupLogout() {
    function doLogout() {
      if (typeof APP !== 'undefined' && typeof APP.logout === 'function') {
        APP.logout();
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        try { sessionStorage.setItem('logoutReason', 'user_initiated'); } catch (e) {}
        navigate('/index.html');
      }
    }

    var btn = document.getElementById('ca-logout-btn');
    if (btn) btn.addEventListener('click', function () {
      if (confirm('Sign out of ITER EduHub?')) doLogout();
    });
    var mobBtn = document.getElementById('ca-mob-logout');
    if (mobBtn) mobBtn.addEventListener('click', function () {
      if (confirm('Sign out of ITER EduHub?')) doLogout();
    });
  }

  function setupScrollBehavior() {
    var header = document.getElementById('ca-header');
    if (!header) return;
    var threshold = 10;
    function onScroll() {
      if (window.scrollY > threshold) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      if (theme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      var label = document.getElementById('theme-label');
      if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme === 'dark' ? '#000000' : '#f5f5f5';
    }

    // Set initial label
    var cur = getTheme();
    var label = document.getElementById('theme-label');
    if (label) label.textContent = cur === 'dark' ? 'Dark' : 'Light';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isDark = getTheme() === 'dark';
      var next = isDark ? 'light' : 'dark';
      var update = function () { applyTheme(next); };

      if (!document.startViewTransition) { update(); return; }

      var x = e.clientX || window.innerWidth / 2;
      var y = e.clientY || 0;
      var endR = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

      document.documentElement.classList.add('vt-active');
      var t = document.startViewTransition(update);
      t.ready.then(function () {
        var anim = document.documentElement.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + endR + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 600, easing: 'cubic-bezier(0.34,1.2,0.64,1)', pseudoElement: '::view-transition-new(root)' }
        );
        anim.onfinish = function () { document.documentElement.classList.remove('vt-active'); };
      }).catch(function () {});
      t.finished.finally(function () { document.documentElement.classList.remove('vt-active'); });
    }, true);
  }

  function initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    } else {
      // lucide not yet loaded — wait for it
      var interval = setInterval(function () {
        if (window.lucide) {
          window.lucide.createIcons();
          clearInterval(interval);
        }
      }, 100);
    }
  }

  /* ── Inject footer on non-dashboard pages ───────────────── */
  function injectFooter() {
    if (isDashboard()) return;
    var existing = document.querySelector('footer.site-footer, footer#ca-footer');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', buildFooter());
  }

  /* ── Main init ──────────────────────────────────────────── */
  function init() {
    // 1. Remove old elements
    var oldNavbars = document.querySelectorAll('nav.navbar, .navbar:not(.ca-injected)');
    oldNavbars.forEach(function (el) { el.remove(); });

    var oldBg = document.querySelectorAll('.bg-animation');
    oldBg.forEach(function (el) { el.remove(); });

    var oldToggle = document.querySelectorAll('button.theme-toggle:not(#theme-toggle)');
    oldToggle.forEach(function (el) { el.remove(); });

    // 2. Inject header at top of body
    document.body.insertAdjacentHTML('afterbegin', buildHeader());

    // 3. Inject footer
    injectFooter();

    // 4. Wrap dashboard content in layout if needed
    // Use setTimeout(0) to let universal-sidebar.js finish injecting the sidebar
    if (isDashboard()) {
      setTimeout(function () {
        var main = document.querySelector('.dashboard-main');
        var sidebar = document.getElementById('universalSidebar');
        if (main && sidebar && !document.querySelector('.dashboard-layout')) {
          var layout = document.createElement('div');
          layout.className = 'dashboard-layout container';
          sidebar.parentNode.insertBefore(layout, sidebar);
          layout.appendChild(sidebar);
          layout.appendChild(main);
        }
      }, 0);
    } else {
      // Ensure main content has container + id for skip-link
      var mainEl = document.querySelector('main') || document.querySelector('.main-content');
      if (mainEl && !mainEl.id) mainEl.id = 'main-content';
    }

    // 5. Wire interactions
    setupMobileNav();
    setupUserDropdown();
    setupLogout();
    setupScrollBehavior();
    setupThemeToggle();
    initIcons();

    // 6. Re-run lucide after any deferred scripts
    window.addEventListener('load', function () { initIcons(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Global stubs for backward compat ─────────────────────
  // student-ai-assistant.html and other legacy pages call this
  window.loadDashboardNav = function (role) {
    // No-op: nav is injected by ca-nav-inject.js automatically
    console.log('[ca-nav-inject] loadDashboardNav(' + role + ') stub called - nav already injected');
  };

  // Also expose APP.showToast bridge early
  if (!window.APP) {
    window.APP = {};
  }
  if (!window.APP.showToast) {
    window.APP.showToast = function (msg, type) {
      if (window.showToast) window.showToast(msg, type);
    };
  }

})();
