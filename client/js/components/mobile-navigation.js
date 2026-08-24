/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices with gesture support
 */

const MOBILE_NAV_ICONS = (() => {
  const svg = (paths) => '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  return {
    home: svg('<path d="M4.5 11l7.5-6.5L19.5 11"/><path d="M6.5 9.25V19.5h11V9.25"/>'),
    attendance: svg('<circle cx="12" cy="12" r="8.75"/><path d="M8.25 12.3l2.5 2.5 5-5.2"/>'),
    marks: svg('<path d="M5.5 20v-6"/><path d="M12 20V9.5"/><path d="M18.5 20V4.5"/>'),
    timetable: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>')
  };
})();

class MobileNavigation {
  constructor() {
    this.currentRoute = 'dashboard';
    this.isVisible = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.init();
  }

  /**
   * Initialize mobile navigation
   */
  init() {
    if (!this.isMobileDevice()) return;
    if (document.getElementById('mobile-bottom-nav')) return;

    this.createBottomNav();
    this.setupGestures();
    this.setupMenuToggle();
    this.makeElementsTouchFriendly();
    
    console.log('Mobile navigation initialized');
  }

  /**
   * Check if device is mobile
   */
  isMobileDevice() {
    return window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Create bottom navigation bar
   */
  createBottomNav() {
    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.id = 'mobile-bottom-nav';
    
    const userRole = this.getCurrentUserRole();
    const navItems = this.getNavItemsForRole(userRole);
    const currentPath = window.location.pathname;
    
    nav.innerHTML = `
      ${navItems.map(item => `
        <a href="${item.href}" 
           class="nav-item ${item.href === currentPath ? 'active' : ''}" 
           data-route="${item.id}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    `;

    document.body.appendChild(nav);
    
    // Add padding to main content to account for fixed bottom nav
    const mainContent = document.querySelector('main, .dashboard-content, .main-content');
    if (mainContent) {
      mainContent.style.paddingBottom = '80px';
    }

    // Handle navigation clicks
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.dataset.route;
        if (route === 'more') {
          this.openSidebar();
          return;
        }
        const link = navItems.find(n => n.id === route);
        if (link && link.href) {
          this.navigateTo(link.href);
        }
      });
    });
  }

  getCurrentUserRole() {
    try {
      const user = this.safeParseUser();
      return (user && user.role) ? user.role : 'student';
    } catch (e) { }
    return 'student';
  }

  safeParseUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Get navigation items based on user role
   * Exactly five destinations: Home · Attendance · Marks · Timetable · More
   */
  getNavItemsForRole(role) {
    const roleLinks = {
      student: {
        home: '/dashboard/student.html',
        attendance: '/dashboard/student-attendance.html',
        marks: '/dashboard/student-marks.html',
        timetable: '/dashboard/student-timetable.html'
      },
      teacher: {
        home: '/dashboard/teacher.html',
        attendance: '/dashboard/teacher-attendance.html',
        marks: '/dashboard/teacher-marks.html',
        timetable: null
      },
      admin: {
        home: '/dashboard/admin.html',
        attendance: null,
        marks: null,
        timetable: null
      }
    };

    const links = roleLinks[role] || roleLinks.student;

    return [
      { id: 'home', label: 'Home', icon: MOBILE_NAV_ICONS.home, href: links.home },
      { id: 'attendance', label: 'Attendance', icon: MOBILE_NAV_ICONS.attendance, href: links.attendance || links.home },
      { id: 'marks', label: 'Marks', icon: MOBILE_NAV_ICONS.marks, href: links.marks || links.home },
      { id: 'timetable', label: 'Timetable', icon: MOBILE_NAV_ICONS.timetable, href: links.timetable || links.home },
      { id: 'more', label: 'More', icon: MOBILE_NAV_ICONS.more, href: '#' }
    ];
  }
  
  /**
   * Navigate to route
   */
  navigateTo(href) {
    // Remove active class from all items
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to current item
    const activeItem = Array.from(document.querySelectorAll('.mobile-bottom-nav .nav-item'))
      .find(item => item.getAttribute('href') === href);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Trigger route change event
    window.dispatchEvent(new CustomEvent('mobileNavChange', { detail: { href } }));

    if (typeof UniversalSidebar !== 'undefined' && typeof UniversalSidebar.navigateWithinApp === 'function') {
      UniversalSidebar.navigateWithinApp(href);
    } else {
      window.location.href = href;
    }
  }

  /**
   * Setup swipe gestures
   */
  setupGestures() {
    let startX = 0;
    let startY = 0;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = endX - startX;
      const diffY = endY - startY;

      // Swipe right to open sidebar
      if (diffX > 100 && Math.abs(diffY) < 50) {
        this.openSidebar();
      }
      // Swipe left to close sidebar
      else if (diffX < -100 && Math.abs(diffY) < 50) {
        this.closeSidebar();
      }
    }, { passive: true });
  }

  /**
   * Setup hamburger menu toggle
   */
  setupMenuToggle() {
    // Create hamburger button if doesn't exist
    let menuBtn = document.getElementById('mobile-menu-toggle');
    
    if (!menuBtn) {
      menuBtn = document.createElement('button');
      menuBtn.id = 'mobile-menu-toggle';
      menuBtn.className = 'mobile-menu-toggle';
      menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
      menuBtn.setAttribute('aria-label', 'Toggle menu');
      
      const header = document.querySelector('header, .header, .top-nav');
      if (header) {
        header.insertBefore(menuBtn, header.firstChild);
      }
    }

    menuBtn.addEventListener('click', () => {
      this.toggleSidebar();
    });
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar, .side-nav, aside');
    if (!sidebar) return;

    if (sidebar.classList.contains('mobile-visible')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  /**
   * Open sidebar
   */
  openSidebar() {
    // Prefer the universal sidebar's own toggle so its state stays in sync
    const universalToggle = document.getElementById('mobileSidebarToggle');
    if (universalToggle) {
      universalToggle.click();
      return;
    }

    const sidebar = document.querySelector('.sidebar, .side-nav, aside');
    if (!sidebar) return;

    sidebar.classList.add('mobile-visible');
    
    // Create overlay
    let overlay = document.getElementById('mobile-sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mobile-sidebar-overlay';
      overlay.className = 'mobile-sidebar-overlay';
      document.body.appendChild(overlay);
      
      overlay.addEventListener('click', () => this.closeSidebar());
    }
    overlay.classList.add('active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close sidebar
   */
  closeSidebar() {
    const sidebar = document.querySelector('.sidebar, .side-nav, aside');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    
    if (sidebar) {
      sidebar.classList.remove('mobile-visible');
    }
    
    if (overlay) {
      overlay.classList.remove('active');
    }

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Make nav items touch-friendly (44px minimum)
   */
  makeElementsTouchFriendly() {
    if (!this.isMobileDevice()) return;

    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(element => {
      const rect = element.getBoundingClientRect();
      
      // Ensure minimum 44px touch target
      if (rect.height < 44) {
        element.style.minHeight = '44px';
        element.style.display = 'inline-flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
      }
      
      if (rect.width < 44) {
        element.style.minWidth = '44px';
      }
    });
  }

  /**
   * Update notification badge
   */
  updateBadge(count) {
    const badge = document.querySelector('[data-route="notifications"] .badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  /**
   * Hide bottom navigation
   */
  hide() {
    const nav = document.getElementById('mobile-bottom-nav');
    if (nav) {
      nav.style.transform = 'translateY(100%)';
    }
  }

  /**
   * Show bottom navigation
   */
  show() {
    const nav = document.getElementById('mobile-bottom-nav');
    if (nav) {
      nav.style.transform = 'translateY(0)';
    }
  }
}

// Pull-to-refresh functionality
class PullToRefresh {
  constructor(options = {}) {
    this.threshold = options.threshold || 80;
    this.resistance = options.resistance || 2.5;

    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.hasReloaded = false; // honest guard: one reload per gesture session
    this.touchStartX = 0; // prevent triggering on horizontal swipes
    this.verticalOnlyTolerance = 12; // px

    this.init();
  }

  init() {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;

    this.setupListeners();
  }

  setupListeners() {
    // Start gesture only when at the very top and not already reloading
    document.addEventListener('touchstart', (e) => {
      const atTop = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
      const isScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight;

      if (atTop && isScrollable && !this.hasReloaded) {
        this.startY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
        this.currentY = this.startY;
        this.isDragging = true;
      } else {
        this.isDragging = false;
      }
    }, { passive: true });

    // Track movement; ignore mostly horizontal swipes
    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging || this.hasReloaded) return;

      this.currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;

      // If horizontal movement dominates, cancel the gesture
      if (Math.abs(currentX - this.touchStartX) > this.verticalOnlyTolerance && Math.abs(this.currentY - this.startY) < 2 * Math.abs(currentX - this.touchStartX)) {
        this.isDragging = false;
        return;
      }

      const diff = (this.currentY - this.startY) / this.resistance;

      if (diff > 0) {
        e.preventDefault();
      }

      if (diff >= (this.threshold + 10)) {
        this.refresh();
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  refresh() {
    if (this.hasReloaded) return;
    this.hasReloaded = true;
    window.location.reload();
  }
}

// Initialize mobile features
const mobileNav = new MobileNavigation();
const pullToRefresh = new PullToRefresh();

// Export for external use
window.mobileNav = mobileNav;
window.pullToRefresh = pullToRefresh;
