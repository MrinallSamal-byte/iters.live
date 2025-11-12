/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices with gesture support
 */

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

    this.createBottomNav();
    this.setupGestures();
    this.setupMenuToggle();
    this.makeElementsTouchFriendly();
    
    console.log('✓ Mobile navigation initialized');
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
    
    const userRole = localStorage.getItem('userRole') || 'student';
    
    const navItems = this.getNavItemsForRole(userRole);
    
    nav.innerHTML = `
      ${navItems.map(item => `
        <a href="${item.href}" 
           class="nav-item ${item.id === this.currentRoute ? 'active' : ''}" 
           data-route="${item.id}">
          <i class="${item.icon}"></i>
          <span>${item.label}</span>
          ${item.badge ? `<span class="badge">${item.badge}</span>` : ''}
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
        this.navigateTo(item.dataset.route);
      });
    });
  }

  /**
   * Get navigation items based on user role
   */
  getNavItemsForRole(role) {
    const commonItems = [
      { id: 'dashboard', label: 'Home', icon: 'fas fa-home', href: '/dashboard/student.html' },
      { id: 'search', label: 'Search', icon: 'fas fa-search', href: '#search' },
      { id: 'notifications', label: 'Alerts', icon: 'fas fa-bell', href: '#notifications', badge: '3' },
      { id: 'profile', label: 'Profile', icon: 'fas fa-user', href: '#profile' }
    ];

    const roleSpecific = {
      student: [
        { id: 'attendance', label: 'Attend', icon: 'fas fa-calendar-check', href: '#attendance' }
      ],
      teacher: [
        { id: 'classes', label: 'Classes', icon: 'fas fa-chalkboard-teacher', href: '#classes' }
      ],
      admin: [
        { id: 'analytics', label: 'Stats', icon: 'fas fa-chart-line', href: '#analytics' }
      ]
    };

    return [
      commonItems[0],
      ...(roleSpecific[role] || []),
      ...commonItems.slice(1)
    ];
  }

  /**
   * Navigate to route
   */
  navigateTo(route) {
    // Remove active class from all items
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to current item
    const activeItem = document.querySelector(`[data-route="${route}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    this.currentRoute = route;

    // Trigger route change event
    window.dispatchEvent(new CustomEvent('mobileNavChange', { detail: { route } }));
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
      menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
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
   * Make all interactive elements touch-friendly (44px minimum)
   */
  makeElementsTouchFriendly() {
    if (!this.isMobileDevice()) return;

    const selectors = [
      'button',
      'a',
      'input[type="checkbox"]',
      'input[type="radio"]',
      '.clickable',
      '.btn',
      '.nav-item'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
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
    this.onRefresh = options.onRefresh || (() => window.location.reload());
    
    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.isRefreshing = false;
    this.lastRefreshAt = 0; // cooldown guard
    this.cooldownMs = options.cooldownMs || 3000; // minimum time between refreshes
    this.touchStartX = 0; // prevent triggering on horizontal swipes
    this.verticalOnlyTolerance = 12; // px
    
    this.init();
  }

  init() {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;

    this.createPullIndicator();
    this.setupListeners();
  }

  createPullIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'pull-to-refresh-indicator';
    indicator.className = 'pull-to-refresh-indicator';
    indicator.innerHTML = `
      <div class="spinner"></div>
      <span class="text">Pull to refresh</span>
    `;
    document.body.insertBefore(indicator, document.body.firstChild);
    this.indicator = indicator;
  }

  setupListeners() {
    // Start gesture only when at the very top and not in cooldown
    document.addEventListener('touchstart', (e) => {
      const atTop = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
      const isScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight;
      const now = Date.now();

      if (atTop && isScrollable && (now - this.lastRefreshAt > this.cooldownMs) && !this.isRefreshing) {
        this.startY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
        this.isDragging = true;
      } else {
        this.isDragging = false;
      }
    }, { passive: true });

    // Track movement and update indicator; ignore mostly horizontal swipes
    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging || this.isRefreshing) return;

      this.currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;

      // If horizontal movement dominates, cancel the gesture
      if (Math.abs(currentX - this.touchStartX) > this.verticalOnlyTolerance && Math.abs(this.currentY - this.startY) < 2 * Math.abs(currentX - this.touchStartX)) {
        this.reset();
        this.isDragging = false;
        return;
      }

      const diff = (this.currentY - this.startY) / this.resistance;

      if (diff > 0) {
        e.preventDefault();
        const translateY = Math.min(diff, this.threshold + 40);
        this.indicator.style.transform = `translateY(${translateY}px)`;

        if (diff >= this.threshold) {
          this.indicator.classList.add('ready');
          this.indicator.querySelector('.text').textContent = 'Release to refresh';
        } else {
          this.indicator.classList.remove('ready');
          this.indicator.querySelector('.text').textContent = 'Pull to refresh';
        }
      }
    }, { passive: false });

    // End gesture: trigger refresh only if threshold clearly exceeded
    document.addEventListener('touchend', () => {
      if (!this.isDragging || this.isRefreshing) return;

      const diff = (this.currentY - this.startY) / this.resistance;

      if (diff >= (this.threshold + 10)) {
        this.refresh();
      } else {
        this.reset();
      }

      this.isDragging = false;
    });
  }

  async refresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.indicator.classList.add('refreshing');
    this.indicator.querySelector('.text').textContent = 'Refreshing...';

    try {
      await this.onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }

    setTimeout(() => {
      this.reset();
      this.isRefreshing = false;
      this.lastRefreshAt = Date.now();
    }, 1000);
  }

  reset() {
    this.indicator.style.transform = 'translateY(-100%)';
    this.indicator.classList.remove('ready', 'refreshing');
    this.indicator.querySelector('.text').textContent = 'Pull to refresh';
  }
}

// Initialize mobile features
const mobileNav = new MobileNavigation();
const pullToRefresh = new PullToRefresh({
  onRefresh: async () => {
    // Optional: refresh logic disabled to prevent accidental reload loops
    // Implement soft refresh here if needed (e.g., re-fetch data without full reload)
    await new Promise(resolve => setTimeout(resolve, 600));
  }
});

// Export for external use
window.mobileNav = mobileNav;
window.pullToRefresh = pullToRefresh;

export { MobileNavigation, PullToRefresh };
