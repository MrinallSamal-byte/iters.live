/**
 * LIVE UPDATES - socket listeners for cross-page realtime feedback.
 *
 * Waits for the shared APP.Socket (created in main.js) and registers
 * listeners for events the server already broadcasts. Shows a toast via the
 * global Toast API and bumps the sidebar notification unread badge.
 * No new UI framework; all dynamic strings are escaped before insertion.
 */
(function () {
    'use strict';

    var UNREAD_KEY = 'iterUnreadNotifications';
    var unread = 0;

    function esc(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    // ---------- Unread badge (memory + sessionStorage) ----------
    function loadUnread() {
        try { unread = parseInt(sessionStorage.getItem(UNREAD_KEY), 10) || 0; } catch (e) { unread = 0; }
    }

    function saveUnread() {
        try { sessionStorage.setItem(UNREAD_KEY, String(unread)); } catch (e) { /* private mode */ }
    }

    function renderBadge() {
        var bell = document.getElementById('notificationBell');
        if (!bell) return;
        var badge = bell.querySelector('.notification-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            bell.appendChild(badge);
        }
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = unread > 0 ? 'flex' : 'none';
        bell.classList.toggle('has-unread', unread > 0);
    }

    function incrementUnread() {
        unread += 1;
        saveUnread();
        renderBadge();
    }

    function clearUnread() {
        if (!unread) return;
        unread = 0;
        saveUnread();
        renderBadge();
    }

    loadUnread();
    // Badge element is injected by notification-center.js - retry briefly.
    (function waitForBell(attempts) {
        renderBadge();
        if (document.getElementById('notificationBell') || attempts <= 0) return;
        setTimeout(function () { waitForBell(attempts - 1); }, 500);
    })(20);

    // Clear when the notification center opens: listen on the bell itself,
    // plus a custom event other code can dispatch.
    document.addEventListener('click', function (event) {
        if (event.target && event.target.closest && event.target.closest('#notificationBell')) clearUnread();
    }, true);
    window.addEventListener('notification-center:opened', clearUnread);

    // ---------- Toasts ----------
    function toast(type, title, message) {
        if (window.Toast && typeof window.Toast.show === 'function') {
            window.Toast.show({ type: type, title: esc(title), message: esc(message) });
        }
    }

    function notifyCenterRefresh() {
        if (window.notificationCenter && typeof window.notificationCenter.loadNotifications === 'function') {
            window.notificationCenter.loadNotifications();
        } else {
            window.dispatchEvent(new CustomEvent('notifications:refresh'));
        }
    }

    // ---------- Socket listeners ----------
    function register(socket) {
        if (!socket || typeof socket.on !== 'function') return;

        // Events create / register / cancel broadcasts (server/routes/event.routes.js).
        socket.on('events:update', function (payload) {
            var data = payload || {};
            var title = data.title ? String(data.title) : null;
            toast('info', data.count != null ? 'EVENT UPDATED' : 'EVENTS UPDATE',
                title ? ('Event updated: ' + title + (data.count != null ? ' (' + data.count + ' registered)' : '')) : 'Event details have changed.');
            notifyCenterRefresh();
        });

        // Targeted notifications (emitToUser / emitToRole / emitToDept in server/socket/socket.js).
        ['notifyUser', 'notifyRole', 'notifyDept'].forEach(function (eventName) {
            socket.on(eventName, function (payload) {
                var data = payload || {};
                incrementUnread();
                toast(data.type === 'error' ? 'error' : (data.type === 'success' ? 'success' : 'info'),
                    data.title || 'NOTIFICATION',
                    data.message || data.body || '');
                notifyCenterRefresh();
            });
        });

        // Chat events (server/services/chat.service.js). Only surface new messages.
        socket.on('new_message', function (payload) {
            var data = payload || {};
            var senderName = data.user_name || data.sender_name || data.userName || '';
            incrementUnread();
            toast('info', senderName ? 'MESSAGE FROM ' + String(senderName).toUpperCase() : 'NEW MESSAGE',
                data.message || data.text || '');
        });
        socket.on('user_typing', function () { /* presence signal only - no toast */ });
        socket.on('message_history', function () { /* bulk replay - no toast, no badge */ });
    }

    // Wait/poll for APP.socket availability (~10s), skip silently if absent.
    var waited = 0;
    (function connect() {
        var socketApi = window.APP && window.APP.Socket;
        if (socketApi && typeof socketApi.on === 'function') {
            // APP.Socket.on queues listeners until the underlying io socket connects.
            register(socketApi);
            return;
        }
        if (waited >= 10000) return; // silent skip
        waited += 250;
        setTimeout(connect, 250);
    })();
})();
