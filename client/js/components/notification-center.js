/**
 * Notification Center Component
 * Handles in-app notifications with real-time updates
 */

class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.isOpen = false;
    this.page = 1;
    this.hasMore = true;
    this.socket = null;

    this.init();
  }

  /**
   * Initialize notification center
   */
  async init() {
    this.createNotificationButton();
    this.createNotificationPanel();
    this.attachEventListeners();
    await this.loadNotifications();
    this.updateUnreadBadge();
    this.initializeSocket();
  }

  /**
   * Create notification bell button
   */
  createNotificationButton() {
    const button = document.createElement('div');
    button.id = 'notification-bell';
    button.className = 'notification-bell';
    button.innerHTML = `
      <i class="fas fa-bell"></i>
      <span class="notification-badge" id="notification-badge">0</span>
    `;

    // Find a suitable place to insert (e.g., header or top-right corner)
    const header = document.querySelector('header') || document.querySelector('.top-right-profile');
    if (header) {
      header.appendChild(button);
    }
  }

  /**
   * Create notification panel
   */
  createNotificationPanel() {
    const panel = document.createElement('div');
    panel.id = 'notification-panel';
    panel.className = 'notification-panel';
    panel.style.display = 'none';

    panel.innerHTML = `
      <div class="notification-header">
        <h3>Notifications</h3>
        <div class="notification-actions">
          <button id="mark-all-read" class="btn-small">
            <i class="fas fa-check-double"></i> Mark all read
          </button>
          <button id="clear-read" class="btn-small">
            <i class="fas fa-trash"></i> Clear read
          </button>
        </div>
      </div>
      
      <div class="notification-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="attendance">Attendance</button>
        <button class="filter-btn" data-filter="marks">Marks</button>
        <button class="filter-btn" data-filter="assignment">Assignments</button>
        <button class="filter-btn" data-filter="event">Events</button>
      </div>
      
      <div class="notification-list" id="notification-list">
        <div class="notification-loading">
          <i class="fas fa-spinner fa-spin"></i> Loading notifications...
        </div>
      </div>
      
      <div class="notification-footer">
        <button id="load-more-notifications" class="btn-primary" style="display: none;">
          Load More
        </button>
      </div>
    `;

    document.body.appendChild(panel);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle panel
    document.getElementById('notification-bell')?.addEventListener('click', () => {
      this.togglePanel();
    });

    // Mark all as read
    document.getElementById('mark-all-read')?.addEventListener('click', () => {
      this.markAllAsRead();
    });

    // Clear read notifications
    document.getElementById('clear-read')?.addEventListener('click', () => {
      this.clearReadNotifications();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filterNotifications(e.target.dataset.filter);
      });
    });

    // Load more
    document.getElementById('load-more-notifications')?.addEventListener('click', () => {
      this.loadMoreNotifications();
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notification-panel');
      const bell = document.getElementById('notification-bell');
      
      if (this.isOpen && panel && bell && 
          !panel.contains(e.target) && 
          !bell.contains(e.target)) {
        this.closePanel();
      }
    });
  }

  /**
   * Initialize Socket.IO for real-time notifications
   */
  initializeSocket() {
    if (typeof io !== 'undefined') {
      this.socket = io();
      
      this.socket.on('notification:new', (notification) => {
        this.handleNewNotification(notification);
      });
    }
  }

  /**
   * Load notifications from server
   */
  async loadNotifications(append = false) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(
        `/api/notifications?page=${this.page}&pageSize=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        if (append) {
          this.notifications = [...this.notifications, ...data.notifications];
        } else {
          this.notifications = data.notifications;
        }

        this.unreadCount = data.unreadCount;
        this.hasMore = data.pagination.page < data.pagination.totalPages;

        this.renderNotifications();
        this.updateUnreadBadge();
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  /**
   * Load more notifications
   */
  async loadMoreNotifications() {
    this.page++;
    await this.loadNotifications(true);
  }

  /**
   * Render notifications in panel
   */
  renderNotifications() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (this.notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this.notifications.map(notif => this.renderNotificationItem(notif)).join('');

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('load-more-notifications');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = this.hasMore ? 'block' : 'none';
    }

    // Attach click handlers to notification items
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        this.handleNotificationClick(id);
      });
    });
  }

  /**
   * Render single notification item
   */
  renderNotificationItem(notif) {
    const typeIcons = {
      attendance: 'fa-calendar-check',
      marks: 'fa-chart-line',
      assignment: 'fa-file-alt',
      event: 'fa-calendar-star',
      announcement: 'fa-bullhorn',
      info: 'fa-info-circle',
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      error: 'fa-times-circle'
    };

    const icon = typeIcons[notif.type] || 'fa-bell';
    const unreadClass = notif.is_read ? '' : 'unread';
    const timeAgo = this.getTimeAgo(new Date(notif.created_at));

    return `
      <div class="notification-item ${unreadClass} notification-type-${notif.type}" 
           data-id="${notif.id}" 
           data-type="${notif.type}">
        <div class="notification-icon">
          <i class="fas ${icon}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${this.escapeHtml(notif.title)}</div>
          <div class="notification-message">${this.escapeHtml(notif.message)}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        <div class="notification-actions">
          ${!notif.is_read ? '<i class="fas fa-circle unread-indicator"></i>' : ''}
          <button class="delete-notification" data-id="${notif.id}" title="Delete">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Handle notification click
   */
  async handleNotificationClick(id) {
    const notification = this.notifications.find(n => n.id === id);
    
    if (notification && !notification.is_read) {
      await this.markAsRead(id);
    }

    // Navigate to link if exists
    if (notification?.link) {
      window.location.href = notification.link;
    }
  }

  /**
   * Handle new real-time notification
   */
  handleNewNotification(notification) {
    // Add to beginning of array
    this.notifications.unshift(notification);
    this.unreadCount++;

    // Show toast
    this.showToast(notification);

    // Update UI
    this.renderNotifications();
    this.updateUnreadBadge();

    // Play notification sound (optional)
    this.playNotificationSound();

    // Show browser notification if permission granted
    this.showBrowserNotification(notification);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
          notification.is_read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.renderNotifications();
          this.updateUnreadBadge();
        }
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
        this.renderNotifications();
        this.updateUnreadBadge();
        showToast('All notifications marked as read', 'success');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      showToast('Failed to mark notifications as read', 'error');
    }
  }

  /**
   * Clear read notifications
   */
  async clearReadNotifications() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications/read/all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        this.notifications = this.notifications.filter(n => !n.is_read);
        this.renderNotifications();
        showToast(`Deleted ${data.count} notifications`, 'success');
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      showToast('Failed to clear notifications', 'error');
    }
  }

  /**
   * Filter notifications by type
   */
  filterNotifications(type) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === type) {
        btn.classList.add('active');
      }
    });

    // Filter and render
    const list = document.getElementById('notification-list');
    if (!list) return;

    const items = list.querySelectorAll('.notification-item');
    items.forEach(item => {
      if (type === 'all' || item.dataset.type === type) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Toggle notification panel
   */
  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Open notification panel
   */
  openPanel() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
      panel.style.display = 'block';
      this.isOpen = true;
      setTimeout(() => panel.classList.add('open'), 10);
    }
  }

  /**
   * Close notification panel
   */
  closePanel() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
      panel.classList.remove('open');
      setTimeout(() => {
        panel.style.display = 'none';
        this.isOpen = false;
      }, 300);
    }
  }

  /**
   * Update unread badge
   */
  updateUnreadBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
    }
  }

  /**
   * Show toast notification
   */
  showToast(notification) {
    if (typeof showToast === 'function') {
      showToast(notification.message, notification.type);
    }
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    try {
      const audio = new Audio('/static/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch (error) {
      // Sound not available
    }
  }

  /**
   * Show browser notification
   */
  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/static/assets/icon.png',
        badge: '/static/assets/badge.png',
        tag: `notification-${notification.id}`
      });
    }
  }

  /**
   * Request browser notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  /**
   * Utility: Get time ago string
   */
  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize notification center when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.notificationCenter = new NotificationCenter();
  });
} else {
  window.notificationCenter = new NotificationCenter();
}
