/* ===================================================================
   CampusArena Components JS — "Nothing OS" Interactions
   Theme toggle, scroll reveal, tabs, countdown, toasts, FAQ accordion
   =================================================================== */

(function() {
  'use strict';

  /* ── 1. THEME MANAGEMENT ───────────────────────────────────────── */
  const THEME_KEY = 'campusarena-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Also set legacy class for backwards compat
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem(THEME_KEY, theme);

    // Update theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f5');
    }

    // Update label
    const label = document.getElementById('theme-label');
    if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }

  function toggleTheme(event) {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';

    // Try circular reveal via View Transitions API
    if (document.startViewTransition && event) {
      const x = event.clientX || window.innerWidth / 2;
      const y = event.clientY || 0;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(() => applyTheme(next));
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 600, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function() {});
    } else {
      applyTheme(next);
    }
  }

  // Apply theme immediately on load
  applyTheme(getTheme());

  /* ── 2. SCROLL REVEAL (IntersectionObserver) ───────────────────── */
  function initScrollReveal() {
    var elements = document.querySelectorAll('.n-reveal, .scroll-reveal');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('n-vis', 'visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -32px 0px' });

    elements.forEach(function(el) { observer.observe(el); });

    // Also handle stagger children
    document.querySelectorAll('.stagger-animation').forEach(function(container) {
      var children = container.children;
      var staggerObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            for (var i = 0; i < children.length; i++) {
              children[i].classList.add('n-vis', 'visible');
            }
            staggerObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });
      staggerObs.observe(container);
    });
  }

  /* ── 3. TAB SYSTEM ─────────────────────────────────────────────── */
  function initTabs() {
    document.querySelectorAll('.n-tab-bar, .tab-bar, .tabs').forEach(function(bar) {
      bar.querySelectorAll('.n-tab, .tab-btn, .tab-link').forEach(function(btn) {
        btn.addEventListener('click', function() {
          // Remove active from siblings
          bar.querySelectorAll('.n-tab, .tab-btn, .tab-link').forEach(function(b) {
            b.classList.remove('on', 'active');
          });
          // Hide all panels
          var panelId = btn.dataset.p || btn.dataset.panel || btn.dataset.target;
          if (panelId) {
            var parent = bar.parentElement;
            parent.querySelectorAll('.n-panel, .tab-panel').forEach(function(p) {
              p.classList.remove('on', 'active');
            });
            btn.classList.add('on', 'active');
            var panel = document.getElementById(panelId);
            if (panel) panel.classList.add('on', 'active');
          }
        });
      });
    });
  }

  /* ── 4. COUNTDOWN TIMER ────────────────────────────────────────── */
  function initCountdowns() {
    document.querySelectorAll('[data-deadline]').forEach(function(el) {
      function update() {
        var diff = Math.max(0, new Date(el.dataset.deadline).getTime() - Date.now());
        var fmt = function(n) { return String(Math.floor(n)).padStart(2, '0'); };
        var days = el.querySelector('[data-days]');
        var hours = el.querySelector('[data-hours]');
        var mins = el.querySelector('[data-mins]');
        var secs = el.querySelector('[data-secs]');
        if (days) days.textContent = fmt(diff / 864e5);
        if (hours) hours.textContent = fmt((diff % 864e5) / 36e5);
        if (mins) mins.textContent = fmt((diff % 36e5) / 6e4);
        if (secs) secs.textContent = fmt((diff % 6e4) / 1e3);
      }
      update();
      setInterval(update, 1000);
    });
  }

  /* ── 5. FAQ ACCORDION ──────────────────────────────────────────── */
  function initFAQ() {
    document.querySelectorAll('.faq-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var item = btn.closest('.faq-item');
        if (item) item.classList.toggle('open');
      });
    });
  }

  /* ── 6. TOAST SYSTEM ───────────────────────────────────────────── */
  window.showToast = function(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;

    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + message + '</span>';
    container.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(12px)';
      toast.style.transition = 'opacity .3s, transform .3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  };

  /* ── 7. SKILL CHIP TOGGLES ─────────────────────────────────────── */
  function initSkillChips() {
    document.querySelectorAll('.n-sk').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.classList.toggle('on');
        var hidden = document.getElementById('sk-hidden');
        if (hidden) {
          hidden.value = Array.from(document.querySelectorAll('.n-sk.on'))
            .map(function(x) { return x.dataset.s; }).join(',');
        }
      });
    });
  }

  /* ── 8. LUCIDE ICONS INIT ──────────────────────────────────────── */
  function initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /* ── 9. THEME TOGGLE BUTTON BINDING ────────────────────────────── */
  function initThemeToggle() {
    var toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function(e) { toggleTheme(e); });
    }

    // Also bind any other theme toggle buttons
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(function(btn) {
      btn.addEventListener('click', function(e) { toggleTheme(e); });
    });
  }

  /* ── INIT ALL ──────────────────────────────────────────────────── */
  function init() {
    initThemeToggle();
    initScrollReveal();
    initTabs();
    initCountdowns();
    initFAQ();
    initSkillChips();
    initIcons();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init icons after dynamic content changes
  var origFetch = window.fetch;
  if (origFetch) {
    // Provide utility to re-init icons after AJAX
    window.campusArenaRefresh = function() {
      initIcons();
      initScrollReveal();
    };
  }
})();
