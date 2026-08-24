// NOTIFICATION CENTER - bell button + dropdown panel backed by /api/notifications.
// Loaded dynamically by universal-sidebar.js.
(function () {
    'use strict';
    let unreadCount = 0;
    let panelOpen = false;
    const el = {};
    const GLYPHS = {
        announcement: '\u2691', attendance: '\u2713', marks: '\u25A4', assignment: '\u270E', event: '\u2605',
        success: '\u2713', warning: '\u26A0', error: '\u2715', info: '\u2139'
    };
    function authed() {
        try { return Boolean((window.APP && APP.Storage.get('accessToken')) || localStorage.getItem('accessToken')); }
        catch (e) { return Boolean(localStorage.getItem('accessToken')); }
    }
    function api() { return (window.APP && window.APP.API) ? window.APP.API : null; }
    function esc(value) { const div = document.createElement('div'); div.textContent = value == null ? '' : String(value); return div.innerHTML; }
    function timeAgo(iso) {
        const secs = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
        if (secs < 60) return 'JUST NOW';
        if (secs < 3600) return Math.floor(secs / 60) + 'M AGO';
        if (secs < 86400) return Math.floor(secs / 3600) + 'H AGO';
        return Math.floor(secs / 86400) + 'D AGO';
    }
    function ensureCss() {
        if (document.querySelector('link[href*="notification-center.css"]')) return;
        const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/css/base/notification-center.css' });
        document.head.appendChild(link);
    }
    function setUnread(count) {
        unreadCount = Math.max(0, Number(count) || 0);
        if (!el.badge) return;
        el.badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount); el.badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    async function refreshCount() {
        if (!authed()) return;
        try {
            const res = await api().get('/notifications/unread-count');
            if (res.success) setUnread(res.count);
        } catch (e) { /* badge poll is best-effort */ }
    }
    function renderItem(notification) {
        const item = document.createElement('div');
        item.className = 'notification-item' + (notification.is_read ? '' : ' unread') + ' notification-type-' + (notification.type || 'info');
        item.innerHTML =
            '<div class="notification-icon">' + (GLYPHS[notification.type] || GLYPHS.info) + '</div>' +
            '<div class="notification-content"><div class="notification-title">' + esc(notification.title) + '</div>' +
            '<div class="notification-message">' + esc(notification.message) + '</div>' +
            '<div class="notification-time">' + timeAgo(notification.created_at) + '</div></div>' +
            (notification.is_read ? '' : '<span class="unread-indicator">\u25CF</span>');
        item.addEventListener('click', () => onItemClick(notification, item));
        return item;
    }
    async function loadNotifications() {
        if (!authed() || !el.list) return;
        el.list.innerHTML = '<div class="notification-loading"><i>\u2139</i><p>LOADING</p></div>';
        try {
            const res = await api().get('/notifications?pageSize=20');
            if (!res.success) throw new Error(res.error || 'Failed to load notifications');
            setUnread(res.unreadCount || 0);
            const items = res.notifications || [];
            if (!items.length) {
                el.list.innerHTML = '<div class="notification-empty"><i>\uD83D\uDD14</i><p>NO NOTIFICATIONS</p></div>';
                return;
            }
            el.list.innerHTML = '';
            items.forEach((notification) => el.list.appendChild(renderItem(notification)));
        } catch (error) {
            console.error('Notification list error:', error);
            el.list.innerHTML = '<div class="notification-empty"><p>FAILED TO LOAD</p></div>';
        }
    }
    async function markAllRead() {
        try { await api().put('/notifications/read-all', {}); } catch (error) { console.error('Mark all read error:', error); }
        setUnread(0);
        el.list.querySelectorAll('.notification-item.unread').forEach((item) => item.classList.remove('unread'));
        el.list.querySelectorAll('.unread-indicator').forEach((dot) => dot.remove());
    }
    async function onItemClick(notification, item) {
        if (!notification.is_read) {
            notification.is_read = true;
            item.classList.remove('unread');
            const dot = item.querySelector('.unread-indicator');
            if (dot) dot.remove();
            setUnread(unreadCount - 1);
            try { await api().put('/notifications/' + encodeURIComponent(notification.id) + '/read', {}); } catch (error) { /* non-fatal */ }
        }
        toggle(false);
        if (!notification.link) return;
        if (window.APP && typeof window.APP.navigateToDashboard === 'function') {
            window.APP.navigateToDashboard(notification.link);
        } else {
            window.location.href = notification.link;
        }
    }
    function toggle(force) {
        panelOpen = force === undefined ? !panelOpen : Boolean(force);
        el.panel.classList.toggle('open', panelOpen);
        if (panelOpen) loadNotifications();
    }
    function buildUi() {
        if (document.getElementById('notificationBell') || !document.body) return;
        // Inject the bell into the sidebar header, next to the collapse toggle.
        const header = document.querySelector('.sidebar-header');
        const sidebarToggle = document.getElementById('sidebarToggle');
        el.bell = document.createElement('button');
        el.bell.id = 'notificationBell'; el.bell.type = 'button'; el.bell.className = 'notification-bell';
        el.bell.setAttribute('aria-label', 'Notifications'); el.bell.title = 'Notifications';
        el.bell.innerHTML = '<i>\uD83D\uDD14</i><span class="notification-badge" id="notificationBadge"></span>';
        if (header && sidebarToggle && sidebarToggle.parentElement === header) header.insertBefore(el.bell, sidebarToggle);
        else if (header) header.appendChild(el.bell);
        else document.body.appendChild(el.bell);
        el.badge = el.bell.querySelector('.notification-badge');
        el.panel = document.createElement('div');
        el.panel.className = 'notification-panel';
        el.panel.style.maxHeight = '400px';
        el.panel.innerHTML =
            '<div class="notification-header"><h3>Notifications</h3>' +
            '<div class="notification-actions"><button type="button" class="btn-small" id="markAllReadBtn">MARK ALL READ</button></div></div>' +
            '<div class="notification-list"></div>';
        el.list = el.panel.querySelector('.notification-list');
        document.body.appendChild(el.panel);
        el.bell.addEventListener('click', (event) => { event.stopPropagation(); toggle(); });
        el.panel.addEventListener('click', (event) => event.stopPropagation());
        el.panel.querySelector('#markAllReadBtn').addEventListener('click', markAllRead);
        document.addEventListener('click', () => { if (panelOpen) toggle(false); });
    }
    function init() {
        ensureCss();
        buildUi();
        refreshCount();
        setInterval(refreshCount, 60000);
        try {
            if (window.APP && window.APP.Socket && typeof window.APP.Socket.on === 'function') {
                window.APP.Socket.on('notification:new', (payload) => {
                    if (payload && payload.is_read) return;
                    setUnread(unreadCount + 1);
                    if (panelOpen) loadNotifications();
                });
            }
        } catch (error) { /* realtime is optional */ }
        window.addEventListener('notifications:refresh', loadNotifications);
    }
    if (!authed()) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    // Hook consumed by main.js ('announcement:new' handler).
    window.notificationCenter = { refresh: loadNotifications, loadNotifications };
})();
