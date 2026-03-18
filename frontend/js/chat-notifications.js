/**
 * chat-notifications.js
 * Include this script on any page to show unread message badges + browser notifications.
 * Polls GET /api/roommate/messages/unread-count every 30 seconds.
 *
 * Usage: <script src="js/chat-notifications.js" defer></script>
 * Add <a href="find-roommate-chat.html" id="msgNavLink"> ... <span id="msgBadge"></span></a>
 * anywhere in the page to show the badge.
 */
(function () {
    const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
        ? 'http://localhost:5000/api'
        : 'https://roastmydorm-backend-zy4p.vercel.app/api';

    let token = localStorage.getItem('rmd_token');
    if (!token) return; // not logged in, nothing to do

    let lastCount = parseInt(localStorage.getItem('rmd_unread_count') || '0', 10);

    // Ask for browser notification permission once
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    async function refreshToken() {
        const refresh = localStorage.getItem('rmd_refresh');
        if (!refresh) return false;
        try {
            const r = await fetch(API + '/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refresh })
            });
            const d = await r.json();
            if (r.ok && d.success && d.data.accessToken) {
                token = d.data.accessToken;
                localStorage.setItem('rmd_token', token);
                if (d.data.refreshToken) localStorage.setItem('rmd_refresh', d.data.refreshToken);
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    async function checkUnread() {
        let res = await fetch(API + '/roommate/messages/unread-count', {
            headers: { Authorization: 'Bearer ' + token }
        });

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) return;
            res = await fetch(API + '/roommate/messages/unread-count', {
                headers: { Authorization: 'Bearer ' + token }
            });
        }

        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        const count = data.data.count || 0;
        localStorage.setItem('rmd_unread_count', String(count));

        // Update badge element (if present on this page)
        updateBadge(count);

        // Show browser notification for new messages
        if (count > lastCount) {
            const newCount = count - lastCount;
            showBrowserNotification(newCount);
        }

        lastCount = count;
    }

    function updateBadge(count) {
        const badge = document.getElementById('msgBadge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function showBrowserNotification(newCount) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const n = new Notification('RoastMyDorm — New message' + (newCount > 1 ? 's' : ''), {
            body: 'You have ' + newCount + ' new message' + (newCount > 1 ? 's' : '') + '. Tap to reply.',
            icon: '/roastmydorm_logo-removebg-preview.png',
            tag: 'rmd-chat'
        });
        n.onclick = function () {
            window.focus();
            window.location.href = 'find-roommate-chat.html';
        };
    }

    // Run immediately + every 30 seconds
    checkUnread();
    setInterval(checkUnread, 30000);
})();
