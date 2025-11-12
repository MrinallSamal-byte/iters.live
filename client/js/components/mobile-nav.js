/**
 * Mobile Navigation Component
 * - Bottom navigation for <768px
 * - Swipe left/right between sections
 * - Pull-to-refresh with indicator
 * - Haptic feedback via Web Vibration API
 */
class MobileNav {
  constructor(options = {}) {
    this.options = Object.assign({
      haptics: true,
      refreshCallback: null
    }, options);

    this.isMobile = window.matchMedia('(max-width: 767px)').matches;
    this.sections = Array.from(document.querySelectorAll('main section[id]'));
    this.currentIndex = 0;

    if (this.isMobile) {
      this.createBottomNav();
      this.setupHamburgerMenu();
      this.setupSwipeGestures();
      this.setupPullToRefresh();
      this.ensureTouchOptimizations();
    }

    window.addEventListener('resize', this.onResize.bind(this));
  }

  setupHamburgerMenu() {
    const nav = document.querySelector('.dashboard-nav');
    const links = document.querySelector('.nav-links');
    if (!nav || !links) return;

    if (!document.querySelector('.hamburger-menu')) {
      const btn = document.createElement('button');
      btn.className = 'hamburger-menu';
      btn.setAttribute('aria-label', 'Toggle Menu');
      btn.innerHTML = '<span class="line"></span><span class="line"></span><span class="line"></span>';
      nav.insertBefore(btn, links);

      const toggle = () => {
        links.classList.toggle('active');
        btn.classList.toggle('active');
        document.body.classList.toggle('nav-open');
        this.haptic(5);
      };
      btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && links.classList.contains('active')) {
          toggle();
        }
      });
      links.querySelectorAll('a').forEach(a => a.addEventListener('click', toggle));
    }
  }

  // Bottom nav with 5 icons: Dashboard, Attendance, Marks, Events, More
  createBottomNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;

  const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.innerHTML = `
  <a href="#" class="nav-item active" data-target="top" aria-label="Dashboard">
        <i class="icon">🏠</i><span>Dashboard</span>
      </a>
      <a href="#attendance" class="nav-item" aria-label="Attendance">
        <i class="icon">📊</i><span>Attendance</span>
      </a>
      <a href="#marks" class="nav-item" aria-label="Marks">
        <i class="icon">📝</i><span>Marks</span>
      </a>
      <a href="#events" class="nav-item" aria-label="Events">
        <i class="icon">📅</i><span>Events</span>
      </a>
      <a href="#more" class="nav-item" aria-label="More">
        <i class="icon">☰</i><span>More</span>
      </a>`;

    document.body.appendChild(nav);

    const items = Array.from(nav.querySelectorAll('.nav-item'));
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const href = item.getAttribute('href') || '';
        // Handle "More" by toggling sidebar on small screens
        if (href === '#more') {
          e.preventDefault();
          const sidebar = document.getElementById('sidebarNav');
          if (sidebar) {
            sidebar.classList.toggle('mobile-open');
          }
          return;
        }

        // If link points to a page (contains .html) allow navigation
        if (href.includes('.html')) {
          // let browser navigate normally
          return;
        }

        // Role-aware: on student dashboard, navigate to dedicated pages if in-page sections not present
        const pageUrl = this.getStudentPageFor(href);
        if (pageUrl) {
          e.preventDefault();
          window.location.href = pageUrl;
          return;
        }

        // Fallback: smooth scroll within page
        e.preventDefault();
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.haptic(8);
        if (href === '#') {
          // Avoid forcing scroll-to-top on abrupt stops; no-op
          return;
        }
        const el = document.querySelector(href);
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset - 70;
          window.scrollTo({ top, behavior: 'smooth' });
          const idx = this.sections.findIndex(s => `#${s.id}` === href);
          if (idx >= 0) this.currentIndex = idx;
        }
      });
    });
  }

  getStudentPageFor(hash) {
    const path = (window.location.pathname || '').toLowerCase();
    const isStudent = path.includes('/dashboard/student');
    if (!isStudent) return '';
    const base = path.substring(0, path.lastIndexOf('/') + 1);
    switch (hash) {
      case '#attendance': return base + 'student-attendance.html';
      case '#marks': return base + 'student-marks.html';
      case '#events': return base + 'student-events.html';
      default: return '';
    }
  }

  setupSwipeGestures() {
    let startX = 0, startY = 0;
    const onStart = (e) => {
      const t = e.changedTouches?.[0];
      startX = t?.screenX ?? 0;
      startY = t?.screenY ?? 0;
    };
    const onEnd = (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.screenX - startX;
      const dy = Math.abs(t.screenY - startY);
      if (Math.abs(dx) > 75 && dy < 75) {
        if (dx < 0) this.navigate(1); else this.navigate(-1);
        this.haptic(5);
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
  }

  navigate(delta) {
    if (this.sections.length === 0) return;
    this.currentIndex = Math.min(Math.max(this.currentIndex + delta, 0), this.sections.length - 1);
    const section = this.sections[this.currentIndex];
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top, behavior: 'smooth' });

    // update active nav item
    const navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
    navItems.forEach(i => {
      const href = i.getAttribute('href');
      i.classList.toggle('active', href === `#${section.id}`);
    });
  }

  setupPullToRefresh() {
    if (document.querySelector('.pull-to-refresh-indicator')) return;
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh-indicator';
    indicator.innerHTML = `<div class="spinner"></div><div class="text">Pull to refresh</div>`;
    document.body.appendChild(indicator);

    let startY = 0;
    let pulling = false;
    let thresholdReached = false;
    const threshold = 80;

    const onTouchStart = (e) => {
      if (window.pageYOffset > 0) return; // only at top
      startY = e.touches[0].clientY;
      pulling = true;
      thresholdReached = false;
    };
    const onTouchMove = (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        indicator.style.transform = `translate(-50%, ${Math.min(dy - 60, threshold)}px)`;
        if (dy > threshold && !thresholdReached) {
          thresholdReached = true;
          indicator.classList.add('ready');
          this.haptic(10);
        }
      }
    };
    const onTouchEnd = async () => {
      if (!pulling) return;
      pulling = false;
      const ready = thresholdReached;
      thresholdReached = false;
      indicator.classList.remove('ready');
      indicator.style.transform = 'translate(-50%, -100%)';
      if (ready) {
        indicator.classList.add('refreshing');
        try {
          this.haptic(15);
          if (typeof this.options.refreshCallback === 'function') {
            await this.options.refreshCallback();
          } else {
            // Default: reload current page data
            window.location.reload();
          }
        } finally {
          indicator.classList.remove('refreshing');
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
  }

  ensureTouchOptimizations() {
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.touchAction = 'pan-y pinch-zoom';
    const main = document.querySelector('.dashboard-main');
    if (main) main.style.paddingBottom = '90px';
  }

  haptic(ms = 8) {
    if (this.options.haptics && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch (_) {}
    }
  }

  onResize() {
    const nowMobile = window.matchMedia('(max-width: 767px)').matches;
    if (nowMobile && !this.isMobile) {
      this.isMobile = true;
      this.createBottomNav();
      this.setupSwipeGestures();
      this.setupPullToRefresh();
      this.ensureTouchOptimizations();
    } else if (!nowMobile && this.isMobile) {
      this.isMobile = false;
      const nav = document.querySelector('.mobile-bottom-nav');
      if (nav) nav.remove();
    }
  }
}

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  try { window.mobileNavComponent = new MobileNav(); } catch (e) { console.error(e); }
});

// Export for tests if needed
if (typeof module !== 'undefined') {
  module.exports = MobileNav;
}
