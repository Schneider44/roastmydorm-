/**
 * Find Roommate Chat - JavaScript
 * RoastMyDorm Platform
 * Handles chat functionality, conversation switching, and message sending
 */

// ==================== ROUTE CONFIGURATION ====================
const ROUTES = {
    profile: 'find-roommate-profile.html',
    browse: 'find-roommate-matches.html',
    chat: 'find-roommate-chat.html',
    landing: 'find-roommate.html'
};

// ==================== DOM ELEMENTS ====================
let sidebar, chatPanel, conversationsList, chatMessages, messageInput, sendBtn;
let chatAvatar, chatUserName, chatUserStatus;
let searchInput, quickSuggestions;
let reportModal, typingIndicator;
let mobileChatHeader, backToListBtn;

// ==================== STATE ====================
let currentConversationId = null;
let isMobile = window.innerWidth < 768;


// ==================== REAL DATA STATE ====================
let conversationsData = {};
let usersData = {};
const jwt = localStorage.getItem('jwt');

// Fetch conversations and users on load
window.addEventListener('DOMContentLoaded', async function() {
    if (!jwt) return;
    // Fetch conversations
    const convRes = await fetch('/api/messages/conversations', { headers: { Authorization: 'Bearer ' + jwt } });
    const convData = await convRes.json();
    if (convData.success && Array.isArray(convData.conversations)) {
        conversationsData = {};
        for (const thread of convData.conversations) {
            // Fetch messages for each thread
            const msgRes = await fetch(`/api/messages?threadId=${thread._id}`, { headers: { Authorization: 'Bearer ' + jwt } });
            const msgData = await msgRes.json();
            conversationsData[thread._id] = {
                threadId: thread._id,
                participants: thread.participants,
                messages: msgData.messages || [],
                otherUserId: thread.participants.find(id => id !== getUserId()),
            };
        }
        // Fetch user data for all participants
        const userIds = Object.values(conversationsData).map(c => c.otherUserId);
        for (const userId of userIds) {
            if (!usersData[userId]) {
                const userRes = await fetch(`/api/users/profile/${userId}`, { headers: { Authorization: 'Bearer ' + jwt } });
                const userData = await userRes.json();
                if (userData.data) usersData[userId] = userData.data.user;
            }
        }
        // Render conversations list
        renderConversationsList();
    }
});

function getUserId() {
    try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        return payload.userId;
    } catch {
        return null;
    }
}

function renderConversationsList() {
    const list = document.getElementById('conversationsList');
    if (!list) return;
    list.innerHTML = '';
    Object.values(conversationsData).forEach(conv => {
        const user = usersData[conv.otherUserId] || {};
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.setAttribute('data-id', conv.threadId);
        item.setAttribute('data-name', user.firstName || 'User');
        item.innerHTML = `
            <div class="conversation-avatar">
                <img src="${user.avatarUrl || 'default-avatar.png'}" alt="${user.firstName || 'User'}">
                <span class="online-indicator"></span>
            </div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <span class="conversation-name">${user.firstName || 'User'}</span>
                    <span class="conversation-time">now</span>
                </div>
                <div class="conversation-preview">
                    <span class="preview-text"></span>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

// ==================== INITIALIZATION ====================
window.onload = function() {
    console.log('Chat page loaded - initializing...');
    
    // Get DOM elements
    sidebar = document.getElementById('sidebar');
    chatPanel = document.getElementById('chatPanel');
    conversationsList = document.getElementById('conversationsList');
    chatMessages = document.getElementById('chatMessages');
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    chatAvatar = document.getElementById('chatAvatar');
    chatUserName = document.getElementById('chatUserName');
    chatUserStatus = document.getElementById('chatUserStatus');
    searchInput = document.getElementById('searchConversations');
    quickSuggestions = document.getElementById('quickSuggestions');
    reportModal = document.getElementById('reportModal');
    typingIndicator = document.getElementById('typingIndicator');
    mobileChatHeader = document.getElementById('mobileChatHeader');
    backToListBtn = document.getElementById('backToList');
    
    // Check if coming from matches page with a specific user
    checkIncomingNavigation();
    
    // Setup event listeners
    setupConversationListeners();
    setupMessageInput();
    setupQuickSuggestions();
    setupReportModal();
    setupMobileNav();
    setupSearch();
    setupResponsive();
    
    // Create particles
    createParticles();
    
    console.log('Chat initialization complete!');
};

// ==================== INCOMING NAVIGATION ====================
function checkIncomingNavigation() {
    const chatWithId = localStorage.getItem('chatWithId');
    if (chatWithId) {
        // Find the corresponding conversation or use first available
        const conversationItem = document.querySelector(`.conversation-item[data-id="${chatWithId}"]`);
        if (conversationItem) {
            selectConversation(chatWithId);
            conversationItem.classList.add('active');
        }
        // Clear the stored ID
        localStorage.removeItem('chatWithId');
    } else {
        // Select first conversation by default
        const firstConversation = document.querySelector('.conversation-item');
        if (firstConversation) {
            const id = firstConversation.getAttribute('data-id');
            selectConversation(id);
        }
    }
}

// ==================== CONVERSATION SELECTION ====================
function setupConversationListeners() {
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(function(item) {
        item.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            
            // Remove active from all
            items.forEach(function(i) { i.classList.remove('active'); });
            
            // Add active to clicked
            this.classList.add('active');
            
            // Remove unread badge
            const badge = this.querySelector('.unread-badge');
            if (badge) badge.remove();
            
            // Select conversation
            selectConversation(id);
            
            // On mobile, show chat panel
            if (isMobile) {
                showChatPanel();
            }
        });
    });
}


function selectConversation(id) {
    currentConversationId = id;
    const conversation = conversationsData[id];
    if (!conversation) return;
    const user = usersData[conversation.otherUserId] || {};
    // Update header avatar and name
    chatAvatar.src = user.avatarUrl || 'default-avatar.png';
    chatUserName.innerHTML = `${user.firstName || 'User'} <span id="verifiedBadge" style="${user.isVerified ? '' : 'display:none;'}" title="Verified" class="verified-badge"><i class="fas fa-shield-alt" style="color:#2ecc71;"></i> Verified</span>`;
    // Status
    chatUserStatus.innerHTML = user.status === 'online' ? '<span class="status-dot"></span> Online' : (user.lastSeen ? 'Last seen ' + user.lastSeen : '');
    chatUserStatus.className = user.status === 'online' ? 'chat-user-status online' : 'chat-user-status';
    // Mobile header
    if (mobileChatHeader) {
        const mobileAvatar = mobileChatHeader.querySelector('.mobile-avatar');
        const mobileName = mobileChatHeader.querySelector('.mobile-user-name');
        const mobileStatus = mobileChatHeader.querySelector('.mobile-user-status');
        if (mobileAvatar) mobileAvatar.src = user.avatarUrl || 'default-avatar.png';
        if (mobileName) mobileName.textContent = user.firstName || 'User';
        if (mobileStatus) {
            mobileStatus.textContent = user.status === 'online' ? 'Online' : (user.lastSeen ? 'Last seen ' + user.lastSeen : '');
            mobileStatus.className = 'mobile-user-status' + (user.status === 'online' ? ' online' : '');
        }
    }
    // Render messages and safety banner
    renderMessages(conversation.messages, user.avatarUrl || 'default-avatar.png');
    // Safety banner
    const hasFlags = (conversation.messages || []).some(m => Array.isArray(m.flags) && m.flags.length > 0);
    const safetyBanner = document.getElementById('safetyBanner');
    if (safetyBanner) safetyBanner.style.display = hasFlags ? '' : 'none';
    // Focus input
    if (messageInput) setTimeout(function() { messageInput.focus(); }, 100);
}

function renderMessages(messages, avatarSrc) {
    // Clear existing messages (keep typing indicator)
    const existingMessages = chatMessages.querySelectorAll('.message:not(.typing-indicator), .date-separator');
    existingMessages.forEach(function(m) { m.remove(); });
    
    let currentDate = null;
    
    messages.forEach(function(msg) {
        // Add date separator if new date
        if (msg.date !== currentDate) {
            currentDate = msg.date;
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            separator.innerHTML = '<span>' + msg.date + '</span>';
            chatMessages.insertBefore(separator, typingIndicator);
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'message ' + (msg.type === 'sent' ? 'sent' : 'received');
        
        if (msg.type === 'received') {
            messageEl.innerHTML = 
                '<img src="' + avatarSrc + '" alt="User" class="message-avatar">' +
                '<div class="message-content">' +
                    '<div class="message-bubble"><p>' + msg.text + '</p></div>' +
                    '<span class="message-time">' + msg.time + '</span>' +
                '</div>';
        } else {
            messageEl.innerHTML = 
                '<div class="message-content">' +
                    '<div class="message-bubble"><p>' + msg.text + '</p></div>' +
                    '<div class="message-meta">' +
                        '<span class="message-time">' + msg.time + '</span>' +
                        (msg.seen ? '<span class="message-status seen"><i class="fas fa-check-double"></i></span>' : '<span class="message-status"><i class="fas fa-check"></i></span>') +
                    '</div>' +
                '</div>';
        }
        
        chatMessages.insertBefore(messageEl, typingIndicator);
    });
    
    // Scroll to bottom
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==================== MESSAGE INPUT ====================

function setupReportModal() {
    const reportBtn = document.getElementById('reportBtn');
    const blockBtn = document.getElementById('blockBtn');
    const closeBtn = document.getElementById('closeReportModal');
    const cancelBtn = document.getElementById('cancelReport');
    const submitBtn = document.getElementById('submitReport');
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            if (reportModal) reportModal.classList.add('show');
        });
    }
    if (blockBtn) {
        blockBtn.addEventListener('click', async function() {
            if (!currentConversationId) return;
            const conversation = conversationsData[currentConversationId];
            if (!conversation) return;
            if (!confirm('Are you sure you want to block this user? You won’t be able to message each other.')) return;
            const res = await fetch('/api/block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
                body: JSON.stringify({ blockedUserId: conversation.otherUserId })
            });
            if (res.ok) {
                showNotification('User blocked.', 'success');
                window.location.reload();
            } else {
                showNotification('Failed to block user.', 'error');
            }
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeReportModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeReportModal);
    if (submitBtn) {
        submitBtn.addEventListener('click', async function() {
            if (!currentConversationId) return;
            const conversation = conversationsData[currentConversationId];
            if (!conversation) return;
            const reason = (reportModal.querySelector('input[name="reportReason"]:checked') || {}).value;
            const details = document.getElementById('reportDetails').value;
            if (!reason) return showNotification('Please select a reason.', 'error');
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
                body: JSON.stringify({
                    targetType: 'profile',
                    targetId: conversation.otherUserId,
                    reason,
                    details
                })
            });
            if (res.ok) {
                showNotification('Report submitted. We will review it shortly.', 'success');
                closeReportModal();
            } else {
                showNotification('Failed to submit report.', 'error');
            }
        });
    }
    if (reportModal) {
        reportModal.addEventListener('click', function(e) {
            if (e.target === this) closeReportModal();
        });
    }
}
    if (!text || !currentConversationId) return;
    
    // Get current time
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    // Add to data
    const newMessage = {
        type: 'sent',
        text: text,
        time: time,
        date: 'Today',
        seen: false
    };
    
    conversationsData[currentConversationId].messages.push(newMessage);
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'message sent';
    messageEl.innerHTML = 
        '<div class="message-content">' +
            '<div class="message-bubble"><p>' + escapeHtml(text) + '</p></div>' +
            '<div class="message-meta">' +
                '<span class="message-time">' + time + '</span>' +
                '<span class="message-status"><i class="fas fa-check"></i></span>' +
            '</div>' +
        '</div>';
    
    chatMessages.insertBefore(messageEl, typingIndicator);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    
    // Scroll to bottom
    scrollToBottom();
    
    // Update conversation preview
    updateConversationPreview(currentConversationId, text);
    
    // Simulate response
    simulateResponse();
}

function updateConversationPreview(id, text) {
    const item = document.querySelector('.conversation-item[data-id="' + id + '"]');
    if (item) {
        const preview = item.querySelector('.preview-text');
        const time = item.querySelector('.conversation-time');
        if (preview) preview.textContent = 'You: ' + text.substring(0, 30) + (text.length > 30 ? '...' : '');
        if (time) time.textContent = 'now';
    }
}

function simulateResponse() {
    // Show typing indicator
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
        scrollToBottom();
    }
    
    // Simulate delay
    setTimeout(function() {
        // Hide typing
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
        
        // Random responses
        const responses = [
            "That sounds interesting! Let's discuss more.",
            "Great question! I was thinking the same thing.",
            "Perfect! When would you like to meet?",
            "I agree! This could work well for both of us.",
            "👍 Let me check my schedule and get back to you."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        const conversation = conversationsData[currentConversationId];
        if (!conversation) return;
        
        // Add response
        const responseMsg = {
            type: 'received',
            text: randomResponse,
            time: time,
            date: 'Today'
        };
        
        conversation.messages.push(responseMsg);
        
        // Create element
        const messageEl = document.createElement('div');
        messageEl.className = 'message received';
        messageEl.innerHTML = 
            '<img src="' + conversation.img + '" alt="User" class="message-avatar">' +
            '<div class="message-content">' +
                '<div class="message-bubble"><p>' + randomResponse + '</p></div>' +
                '<span class="message-time">' + time + '</span>' +
            '</div>';
        
        chatMessages.insertBefore(messageEl, typingIndicator);
        scrollToBottom();
        
        // Mark our message as seen
        const ourMessages = chatMessages.querySelectorAll('.message.sent');
        if (ourMessages.length > 0) {
            const lastMsg = ourMessages[ourMessages.length - 1];
            const status = lastMsg.querySelector('.message-status');
            if (status) {
                status.innerHTML = '<i class="fas fa-check-double"></i>';
                status.classList.add('seen');
            }
        }
        
        // Update preview
        updateConversationPreview(currentConversationId, randomResponse);
        
    }, 1500 + Math.random() * 1500);
}

// ==================== QUICK SUGGESTIONS ====================
function setupQuickSuggestions() {
    const chips = document.querySelectorAll('.suggestion-chip');
    chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            const text = this.getAttribute('data-text');
            if (messageInput && text) {
                messageInput.value = text;
                messageInput.dispatchEvent(new Event('input'));
                messageInput.focus();
            }
        });
    });
}

// ==================== REPORT MODAL ====================
function setupReportModal() {
    const reportBtn = document.getElementById('reportBtn');
    const closeBtn = document.getElementById('closeReportModal');
    const cancelBtn = document.getElementById('cancelReport');
    const submitBtn = document.getElementById('submitReport');
    
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            if (reportModal) reportModal.classList.add('show');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReportModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeReportModal);
    }
    
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            showNotification('Report submitted. We will review it shortly.', 'success');
            closeReportModal();
        });
    }
    
    // Close on overlay click
    if (reportModal) {
        reportModal.addEventListener('click', function(e) {
            if (e.target === this) closeReportModal();
        });
    }
}

function closeReportModal() {
    if (reportModal) {
        reportModal.classList.remove('show');
        // Reset form
        const radios = reportModal.querySelectorAll('input[type="radio"]');
        radios.forEach(function(r) { r.checked = false; });
        const details = document.getElementById('reportDetails');
        if (details) details.value = '';
    }
}

// ==================== MOBILE NAVIGATION ====================
function setupMobileNav() {
    if (backToListBtn) {
        backToListBtn.addEventListener('click', function() {
            hideChatPanel();
        });
    }
}

function showChatPanel() {
    if (sidebar) sidebar.classList.add('hidden');
    if (chatPanel) chatPanel.classList.add('active');
}

function hideChatPanel() {
    if (sidebar) sidebar.classList.remove('hidden');
    if (chatPanel) chatPanel.classList.remove('active');
}

// ==================== SEARCH ====================
function setupSearch() {
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const items = document.querySelectorAll('.conversation-item');
        
        items.forEach(function(item) {
            const name = item.getAttribute('data-name').toLowerCase();
            if (name.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// ==================== RESPONSIVE HANDLING ====================
function setupResponsive() {
    function checkMobile() {
        isMobile = window.innerWidth < 768;
        
        if (!isMobile) {
            // Reset mobile-specific states
            if (sidebar) sidebar.classList.remove('hidden');
            if (chatPanel) chatPanel.classList.remove('active');
        }
    }
    
    window.addEventListener('resize', checkMobile);
    checkMobile();
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type) {
    type = type || 'info';
    
    // Remove existing
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let bgColor = 'rgba(59, 130, 246, 0.95)';
    let icon = 'fa-info-circle';
    
    if (type === 'success') {
        bgColor = 'rgba(39, 174, 96, 0.95)';
        icon = 'fa-check-circle';
    } else if (type === 'error') {
        bgColor = 'rgba(229, 57, 53, 0.95)';
        icon = 'fa-exclamation-circle';
    }
    
    notification.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
    notification.style.cssText = 'position:fixed;top:20px;right:20px;background:' + bgColor + ';color:white;padding:14px 20px;border-radius:12px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;animation:slideInRight 0.3s ease;';
    
    document.body.appendChild(notification);
    
    setTimeout(function() {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(function() { notification.remove(); }, 300);
        }
    }, 3000);
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = 
            'left:' + (Math.random() * 100) + '%;' +
            'top:' + (Math.random() * 100) + '%;' +
            'width:' + (Math.random() * 3 + 1) + 'px;' +
            'height:' + (Math.random() * 3 + 1) + 'px;' +
            'animation-duration:' + (Math.random() * 4 + 4) + 's;' +
            'animation-delay:' + (Math.random() * 4) + 's;' +
            'opacity:' + (Math.random() * 0.3 + 0.1) + ';';
        container.appendChild(particle);
    }
}

// ==================== VIEW PROFILE BUTTON ====================
document.addEventListener('click', function(e) {
    const viewProfileBtn = e.target.closest('#viewProfileBtn');
    if (viewProfileBtn && currentConversationId) {
        showNotification('Opening profile...', 'info');
        // Navigate to profile page or show profile modal
        window.location.href = ROUTES.browse + '?view=' + currentConversationId;
    }
    
    const moreOptionsBtn = e.target.closest('#moreOptionsBtn');
    if (moreOptionsBtn) {
        showNotification('More options coming soon!', 'info');
    }
    
    const attachmentBtn = e.target.closest('#attachmentBtn');
    if (attachmentBtn) {
        showNotification('File attachments coming soon!', 'info');
    }
});
