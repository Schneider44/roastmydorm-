/**
 * Find Roommate Chat - Real chat using backend API + polling
 * RoastMyDorm Platform
 */

const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api'
    : 'https://roastmydorm-backend-zy4p.vercel.app/api';

// ── State ──
let token = localStorage.getItem('rmd_token');
let myUserId = null;
let partner = null; // { userId, name, avatarUrl }
let lastMessageCount = 0;
let pollTimer = null;
let isMobile = window.innerWidth < 768;

// ── DOM refs ──
const chatMessages  = document.getElementById('chatMessages');
const messageInput  = document.getElementById('messageInput');
const sendBtn       = document.getElementById('sendBtn');
const chatAvatar    = document.getElementById('chatAvatar');
const chatUserName  = document.getElementById('chatUserName');
const chatUserStatus = document.getElementById('chatUserStatus');
const typingIndicator = document.getElementById('typingIndicator');
const conversationsList = document.getElementById('conversationsList');

// ── Boot ──
window.addEventListener('DOMContentLoaded', async function () {
    createParticles();
    requestNotificationPermission();

    if (!token) {
        showError('Please sign in to use the chat.');
        return;
    }

    // Decode current user ID from JWT
    try {
        myUserId = JSON.parse(atob(token.split('.')[1])).userId;
    } catch (e) { /* ignore */ }

    const chatWithId = localStorage.getItem('chatWithId');
    if (!chatWithId) {
        showNoConversation();
        return;
    }
    localStorage.removeItem('chatWithId');

    // Load partner profile
    const profileRes = await apiFetch('/roommate/profiles/' + chatWithId);
    if (!profileRes || !profileRes.success) {
        showError('Could not load this user\'s profile.');
        return;
    }

    partner = {
        profileId: profileRes.data._id,
        userId:    String(profileRes.data.userId),
        name:      profileRes.data.name || 'Student',
        avatarUrl: profileRes.data.avatarUrl || null
    };

    updateHeader();
    renderSidebarPartner();
    await loadMessages();

    setupInput();
    setupQuickSuggestions();
    setupMobileNav();
    setupReportModal();
    setupSearch();

    // Poll for new messages every 3 seconds
    pollTimer = setInterval(pollMessages, 3000);
});

// ── API helper (auto-refreshes token on 401) ──
async function apiFetch(path, options) {
    options = options || {};
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = 'Bearer ' + token;
    if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }

    let res = await fetch(API + path, options);

    if (res.status === 401) {
        const refresh = localStorage.getItem('rmd_refresh');
        if (refresh) {
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
                options.headers['Authorization'] = 'Bearer ' + token;
                res = await fetch(API + path, options);
            }
        }
    }

    try { return await res.json(); } catch { return null; }
}

// ── Load messages ──
async function loadMessages() {
    if (!partner) return;
    const data = await apiFetch('/roommate/messages/' + partner.userId);
    if (!data || !data.success) {
        showError('Could not load messages.');
        return;
    }
    renderMessages(data.data || []);
    lastMessageCount = (data.data || []).length;
}

// ── Notification helpers ──
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function playNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || window['webkitAudioContext'];
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* AudioContext not available */ }
}

let titleBlinker = null;
function blinkTitle(name) {
    const original = document.title;
    let on = true;
    clearInterval(titleBlinker);
    titleBlinker = setInterval(function () {
        document.title = on ? '💬 New message from ' + name : original;
        on = !on;
    }, 1000);
    // Stop blinking when tab is focused
    window.addEventListener('focus', function stopBlink() {
        clearInterval(titleBlinker);
        document.title = original;
        window.removeEventListener('focus', stopBlink);
    });
}

function showIncomingNotification(senderName, text) {
    playNotificationSound();
    blinkTitle(senderName);

    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification('💬 ' + senderName + ' sent you a message', {
            body: text.slice(0, 100),
            icon: '/roastmydorm_logo-removebg-preview.png',
            tag: 'rmd-chat-incoming'
        });
        n.onclick = function () { window.focus(); };
    }
}

// ── Poll for new messages ──
async function pollMessages() {
    if (!partner) return;
    const data = await apiFetch('/roommate/messages/' + partner.userId);
    if (!data || !data.success) return;
    const msgs = data.data || [];

    if (msgs.length > lastMessageCount) {
        // Check if the newest message is from the partner (not us)
        const newest = msgs[msgs.length - 1];
        const isIncoming = newest && String(newest.senderId) !== String(myUserId);
        if (isIncoming) {
            showIncomingNotification(partner.name, newest.text);
        }
        lastMessageCount = msgs.length;
        renderMessages(msgs);
        // Clear unread badge since user is actively in chat
        localStorage.setItem('rmd_unread_count', '0');
    }
}

// ── Render message list ──
function renderMessages(messages) {
    // Remove all existing messages and date separators (keep typing indicator)
    chatMessages.querySelectorAll('.message:not(#typingIndicator), .date-separator').forEach(function (el) {
        el.remove();
    });

    if (messages.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:60px 20px;color:#9ca3af;font-size:0.9rem;';
        empty.textContent = 'No messages yet. Say hi! 👋';
        chatMessages.insertBefore(empty, typingIndicator);
        return;
    }

    let lastDate = null;

    messages.forEach(function (msg) {
        const dateLabel = formatDate(msg.createdAt);
        if (dateLabel !== lastDate) {
            lastDate = dateLabel;
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = '<span>' + dateLabel + '</span>';
            chatMessages.insertBefore(sep, typingIndicator);
        }

        const isSent = String(msg.senderId) === String(myUserId);
        const el = document.createElement('div');
        el.className = 'message ' + (isSent ? 'sent' : 'received');

        const time = new Date(msg.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        if (isSent) {
            el.innerHTML =
                '<div class="message-content">' +
                    '<div class="message-bubble"><p>' + escapeHtml(msg.text) + '</p></div>' +
                    '<div class="message-meta">' +
                        '<span class="message-time">' + time + '</span>' +
                        '<span class="message-status ' + (msg.read ? 'seen' : '') + '">' +
                            '<i class="fas ' + (msg.read ? 'fa-check-double' : 'fa-check') + '"></i>' +
                        '</span>' +
                    '</div>' +
                '</div>';
        } else {
            const avatarHtml = partner && partner.avatarUrl
                ? '<img src="' + partner.avatarUrl + '" alt="' + partner.name + '" class="message-avatar">'
                : '<div class="message-avatar" style="background:#10b981;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;font-size:1rem;">' +
                    (partner ? partner.name.charAt(0).toUpperCase() : '?') + '</div>';
            el.innerHTML =
                avatarHtml +
                '<div class="message-content">' +
                    '<div class="message-bubble"><p>' + escapeHtml(msg.text) + '</p></div>' +
                    '<span class="message-time">' + time + '</span>' +
                '</div>';
        }

        chatMessages.insertBefore(el, typingIndicator);
    });

    scrollToBottom();
}

// ── Send a message ──
async function sendMessage() {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text || !partner) return;

    // Optimistic UI — add the bubble immediately
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const el = document.createElement('div');
    el.className = 'message sent';
    el.innerHTML =
        '<div class="message-content">' +
            '<div class="message-bubble"><p>' + escapeHtml(text) + '</p></div>' +
            '<div class="message-meta">' +
                '<span class="message-time">' + time + '</span>' +
                '<span class="message-status"><i class="fas fa-check"></i></span>' +
            '</div>' +
        '</div>';
    chatMessages.insertBefore(el, typingIndicator);

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    scrollToBottom();

    // POST to API
    const result = await apiFetch('/roommate/messages', {
        method: 'POST',
        body: JSON.stringify({ receiverId: partner.userId, text: text })
    });

    if (!result || !result.success) {
        showNotification('Message failed to send. Please try again.', 'error');
        el.remove();
        return;
    }

    lastMessageCount++;
    updateSidebarPreview('You: ' + text);
}

// ── Header ──
function updateHeader() {
    if (chatAvatar) {
        if (partner.avatarUrl) {
            chatAvatar.src = partner.avatarUrl;
        } else {
            chatAvatar.style.cssText = 'background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;';
            chatAvatar.alt = partner.name.charAt(0).toUpperCase();
        }
    }
    if (chatUserName) chatUserName.textContent = partner.name;
    if (chatUserStatus) {
        chatUserStatus.innerHTML = '<span class="status-dot"></span> Active';
        chatUserStatus.className = 'chat-user-status online';
    }
    document.title = 'Chat with ' + partner.name + ' | RoastMyDorm';

    // Mobile header
    const mobileAvatar = document.querySelector('.mobile-avatar');
    const mobileName   = document.querySelector('.mobile-user-name');
    const mobileStatus = document.querySelector('.mobile-user-status');
    if (mobileAvatar && partner.avatarUrl) mobileAvatar.src = partner.avatarUrl;
    if (mobileName) mobileName.textContent = partner.name;
    if (mobileStatus) { mobileStatus.textContent = 'Active'; mobileStatus.className = 'mobile-user-status online'; }
}

// ── Sidebar ──
function renderSidebarPartner() {
    if (!conversationsList) return;
    conversationsList.innerHTML = '';

    const initial = partner.name.charAt(0).toUpperCase();
    const avatarHtml = partner.avatarUrl
        ? '<img src="' + partner.avatarUrl + '" alt="' + partner.name + '">'
        : '<div style="width:100%;height:100%;background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;">' + initial + '</div>';

    const item = document.createElement('div');
    item.className = 'conversation-item active';
    item.dataset.id = partner.userId;
    item.innerHTML =
        '<div class="conversation-avatar">' + avatarHtml + '<span class="online-indicator"></span></div>' +
        '<div class="conversation-info">' +
            '<div class="conversation-header">' +
                '<span class="conversation-name">' + partner.name + '</span>' +
                '<span class="conversation-time" id="sidebarTime">now</span>' +
            '</div>' +
            '<div class="conversation-preview">' +
                '<span class="preview-text" id="sidebarPreview">Tap to chat</span>' +
            '</div>' +
        '</div>';
    conversationsList.appendChild(item);
}

function updateSidebarPreview(text) {
    const el = document.getElementById('sidebarPreview');
    if (el) el.textContent = text.slice(0, 35) + (text.length > 35 ? '…' : '');
    const timeEl = document.getElementById('sidebarTime');
    if (timeEl) timeEl.textContent = 'now';
}

// ── Input setup ──
function setupInput() {
    if (!messageInput || !sendBtn) return;

    messageInput.addEventListener('input', function () {
        sendBtn.disabled = !this.value.trim();
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
}

// ── Quick suggestions ──
function setupQuickSuggestions() {
    document.querySelectorAll('.suggestion-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            const text = this.getAttribute('data-text');
            if (messageInput && text) {
                messageInput.value = text;
                messageInput.dispatchEvent(new Event('input'));
                messageInput.focus();
            }
        });
    });
}

// ── Search ──
function setupSearch() {
    const searchInput = document.getElementById('searchConversations');
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
        const q = this.value.toLowerCase();
        document.querySelectorAll('.conversation-item').forEach(function (item) {
            const name = (item.querySelector('.conversation-name') || {}).textContent || '';
            item.style.display = name.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    });
}

// ── Report modal ──
function setupReportModal() {
    const reportModal = document.getElementById('reportModal');
    const reportBtn   = document.getElementById('reportBtn');
    const closeBtn    = document.getElementById('closeReportModal');
    const cancelBtn   = document.getElementById('cancelReport');
    const submitBtn   = document.getElementById('submitReport');

    if (reportBtn)  reportBtn.addEventListener('click',  function () { if (reportModal) reportModal.classList.add('show'); });
    if (closeBtn)   closeBtn.addEventListener('click',   closeReportModal);
    if (cancelBtn)  cancelBtn.addEventListener('click',  closeReportModal);
    if (reportModal) reportModal.addEventListener('click', function (e) { if (e.target === this) closeReportModal(); });
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            showNotification('Report submitted. We will review it shortly.', 'success');
            closeReportModal();
        });
    }
}

function closeReportModal() {
    const m = document.getElementById('reportModal');
    if (!m) return;
    m.classList.remove('show');
    m.querySelectorAll('input[type="radio"]').forEach(function (r) { r.checked = false; });
    const d = document.getElementById('reportDetails');
    if (d) d.value = '';
}

// ── Mobile nav ──
function setupMobileNav() {
    const sidebar   = document.getElementById('sidebar');
    const chatPanel = document.getElementById('chatPanel');
    const backBtn   = document.getElementById('backToList');

    if (backBtn) {
        backBtn.addEventListener('click', function () {
            if (sidebar)   sidebar.classList.remove('hidden');
            if (chatPanel) chatPanel.classList.remove('active');
        });
    }

    window.addEventListener('resize', function () {
        isMobile = window.innerWidth < 768;
        if (!isMobile) {
            if (sidebar)   sidebar.classList.remove('hidden');
            if (chatPanel) chatPanel.classList.remove('active');
        }
    });

    if (isMobile) {
        if (sidebar)   sidebar.classList.add('hidden');
        if (chatPanel) chatPanel.classList.add('active');
    }
}

// ── Misc UI actions ──
document.addEventListener('click', function (e) {
    if (e.target.closest('#viewProfileBtn') && partner) {
        window.location.href = 'find-roommate-matches.html';
    }
    if (e.target.closest('#moreOptionsBtn')) {
        showNotification('More options coming soon!', 'info');
    }
    if (e.target.closest('#attachmentBtn')) {
        showNotification('File attachments coming soon!', 'info');
    }
    if (e.target.closest('#blockBtn')) {
        showNotification('Block feature coming soon!', 'info');
    }
});

// ── Helpers ──
function formatDate(isoString) {
    const d   = new Date(isoString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())       return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scrollToBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(msg) {
    if (chatMessages) chatMessages.innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:#9ca3af;font-size:0.95rem;">' + msg + '</div>';
}

function showNoConversation() {
    const emptyState = document.getElementById('emptyState');
    const chatPanel  = document.getElementById('chatPanel');
    if (emptyState) emptyState.style.display = 'flex';
    if (chatPanel)  chatPanel.style.display  = 'none';
}

function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const n = document.createElement('div');
    n.className = 'notification';
    const bg   = type === 'success' ? 'rgba(39,174,96,0.95)' : type === 'error' ? 'rgba(229,57,53,0.95)' : 'rgba(59,130,246,0.95)';
    const icon = type === 'success' ? 'fa-check-circle'      : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    n.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
    n.style.cssText = 'position:fixed;top:20px;right:20px;background:' + bg + ';color:white;padding:14px 20px;border-radius:12px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;';
    document.body.appendChild(n);
    setTimeout(function () {
        n.style.opacity = '0';
        n.style.transition = 'opacity 0.3s';
        setTimeout(function () { n.remove(); }, 300);
    }, 3000);
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText =
            'left:'               + (Math.random() * 100)    + '%;' +
            'top:'                + (Math.random() * 100)    + '%;' +
            'width:'              + (Math.random() * 3 + 1)  + 'px;' +
            'height:'             + (Math.random() * 3 + 1)  + 'px;' +
            'animation-duration:' + (Math.random() * 4 + 4)  + 's;' +
            'animation-delay:'    + (Math.random() * 4)      + 's;' +
            'opacity:'            + (Math.random() * 0.3 + 0.1) + ';';
        container.appendChild(p);
    }
}
