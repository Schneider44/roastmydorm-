/**
 * Find Roommate Matches - JavaScript
 * RoastMyDorm Platform
 */

// Route configuration
const ROUTES = {
    createProfile: "find-roommate-profile.html",
    browseRoommates: "find-roommate-matches.html",
    chat: "find-roommate-chat.html",
    landing: "find-roommate.html"
};

// GLOBAL function for inline onclick handlers - available immediately
function goToChat(id) {
    console.log('goToChat called with ID:', id);
    localStorage.setItem('chatWithId', String(id));
    localStorage.setItem('selectedRoommateId', String(id));
    window.location.href = 'find-roommate-chat.html';
}


// Fetch and render real roommate profiles
window.addEventListener('DOMContentLoaded', async function() {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) return;
    const res = await fetch('/api/roommate', { headers: { Authorization: 'Bearer ' + jwt } });
    const data = await res.json();
    if (data.success && Array.isArray(data.profiles)) {
        renderProfiles(data.profiles);
    }
});

function renderProfiles(profiles) {
    const container = document.getElementById('matchesContainer') || document.querySelector('.matches-list') || document.querySelector('.main-content');
    if (!container) return;
    container.innerHTML = '';
    profiles.forEach(profile => {
        const card = document.createElement('div');
        card.className = 'roommate-card';
        card.innerHTML = `
            <div class="avatar-section">
                <img src="${profile.avatarUrl || 'default-avatar.png'}" class="profile-avatar" alt="${profile.name || 'User'}">
                ${profile.isVerified ? '<span class="badge badge-verified"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
            </div>
            <div class="profile-info">
                <h3>${profile.name || 'User'}</h3>
                <p>${profile.university || ''}</p>
                <p>${profile.location || ''}</p>
                <button class="btn btn-blue btn-sm" onclick="goToChat('${profile.userId}')">Message</button>
                <button class="btn btn-secondary btn-sm" onclick="openReportModal('${profile.userId}')">Report</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.openReportModal = function(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3><i class="fas fa-flag"></i> Report User</h3>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <p>Why are you reporting this user?</p>
                <div class="report-options">
                    <label class="report-option"><input type="radio" name="reportReason" value="spam"><span>Spam or fake profile</span></label>
                    <label class="report-option"><input type="radio" name="reportReason" value="harassment"><span>Harassment or inappropriate behavior</span></label>
                    <label class="report-option"><input type="radio" name="reportReason" value="scam"><span>Scam or suspicious activity</span></label>
                    <label class="report-option"><input type="radio" name="reportReason" value="other"><span>Other</span></label>
                </div>
                <textarea placeholder="Additional details (optional)" class="report-details" id="reportDetails"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="submitReport('${userId}', this)">Submit Report</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.submitReport = async function(userId, btn) {
    const modal = btn.closest('.modal-overlay');
    const reason = (modal.querySelector('input[name="reportReason"]:checked') || {}).value;
    const details = modal.querySelector('#reportDetails').value;
    if (!reason) return showNotification('Please select a reason.', 'error');
    const jwt = localStorage.getItem('jwt');
    const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
        body: JSON.stringify({ targetType: 'profile', targetId: userId, reason, details })
    });
    if (res.ok) {
        showNotification('Report submitted. We will review it shortly.', 'success');
        modal.remove();
    } else {
        showNotification('Failed to submit report.', 'error');
    }
}

// Wait for page to load
window.onload = function() {
    console.log('Page loaded - initializing...');
    
    // ==================== BUTTON CLICK HANDLERS ====================
    
    // Handle ALL button clicks using event delegation on body
    document.body.addEventListener('click', function(e) {
        var target = e.target;
        
        // Find the actual button element (in case user clicked on icon inside button)
        var button = target.closest('button');
        if (!button) {
            button = target.closest('a');
        }
        if (!button) {
            button = target;
        }
        
        // Check for data-action attribute (View Profile / Message buttons)
        var action = button.getAttribute('data-action');
        var id = button.getAttribute('data-id');
        
        if (action && id) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Action button clicked:', action, 'ID:', id);
            
            if (action === 'view' || action === 'message') {
                // Store the roommate ID
                localStorage.setItem('chatWithId', id);
                localStorage.setItem('selectedRoommateId', id);
                
                // Show notification
                showNotification('Opening chat...', 'success');
                
                // Navigate to chat page
                console.log('Navigating to:', ROUTES.chat);
                window.location.href = ROUTES.chat;
            }
            return;
        }
        
        // Check for data-route attribute (navigation)
        var route = button.getAttribute('data-route');
        if (route) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Route button clicked:', route);
            
            if (route === 'create') {
                window.location.href = ROUTES.createProfile;
            } else if (route === 'browse') {
                window.location.href = ROUTES.browseRoommates;
            }
        }
        // Removed demo profile creation to only show real profiles from backend.
        var buttonId = button.id;
        if (buttonId) {
            console.log('Button ID clicked:', buttonId);
            
            if (buttonId === 'boostBtn' || buttonId === 'boostProfileBtn') {
                showNotification('Boost feature coming soon!', 'info');
            } else if (buttonId === 'searchBtn') {
                showNotification('Filters applied!', 'info');
            } else if (buttonId === 'clearFilters') {
                clearAllFilters();
            } else if (buttonId === 'viewAiMatches') {
                scrollToAiPick();
            } else if (buttonId === 'upgradePremiumBtn' || buttonId === 'popupUpgradeBtn' || buttonId === 'unlockUnlimited' || buttonId === 'unlockPremiumMatch') {
                showNotification('Premium upgrade coming soon!', 'info');
                hidePremiumPopup();
            } else if (buttonId === 'closePopup') {
                hidePremiumPopup();
            }
        }
    }); // End of event delegation handler
    
    // ==================== MOBILE NAV ====================
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');
    
    if (navToggle) {
        navToggle.onclick = function() {
            navLinks.classList.toggle('active');
            var icon = navToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        };
    }
    
    // ==================== ANIMATED COUNTERS ====================
    animateCounters();
    
    // ==================== PARTICLES ====================
    createParticles();
    
    // ==================== NAVBAR SCROLL ====================
    window.addEventListener('scroll', function() {
        var navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(15, 22, 41, 0.98)';
                navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
            } else {
                navbar.style.background = 'rgba(15, 22, 41, 0.9)';
                navbar.style.boxShadow = 'none';
            }
        }
    });
    
    // ==================== COMPATIBILITY BREAKDOWN ====================
    var breakdownHeaders = document.querySelectorAll('.breakdown-header');
    breakdownHeaders.forEach(function(header) {
        header.onclick = function() {
            this.classList.toggle('active');
            var content = this.nextElementSibling;
            if (content) {
                content.classList.toggle('show');
            }
        };
    });
    
    // ==================== AI SUGGESTIONS ====================
    var aiItems = document.querySelectorAll('.ai-suggestion-item');
    aiItems.forEach(function(item) {
        item.onclick = function() {
            var filter = this.getAttribute('data-filter');
            var lifestyleFilter = document.getElementById('lifestyleFilter');
            if (lifestyleFilter && filter) {
                lifestyleFilter.value = filter;
                showNotification('Filter applied!', 'info');
            }
        };
    });
    
    // ==================== PAGINATION ====================
    var pageButtons = document.querySelectorAll('.page-btn:not(#prevPage):not(#nextPage)');
    pageButtons.forEach(function(btn, index) {
        btn.onclick = function() {
            pageButtons.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            showNotification('Page ' + (index + 1), 'info');
        };
    });
    
    console.log('Initialization complete!');
};

// ==================== HELPER FUNCTIONS ====================

function showNotification(message, type) {
    type = type || 'info';
    
    // Remove existing
    var existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    var notification = document.createElement('div');
    notification.className = 'notification';
    
    var bgColor = 'rgba(59, 130, 246, 0.95)';
    var icon = 'fa-info-circle';
    if (type === 'success') {
        bgColor = 'rgba(39, 174, 96, 0.95)';
        icon = 'fa-check-circle';
    } else if (type === 'error') {
        bgColor = 'rgba(229, 57, 53, 0.95)';
        icon = 'fa-exclamation-circle';
    }
    
    notification.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
    notification.style.cssText = 'position:fixed;top:100px;right:20px;background:' + bgColor + ';color:white;padding:16px 24px;border-radius:12px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;';
    
    document.body.appendChild(notification);
    
    setTimeout(function() {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

function clearAllFilters() {
    var cityFilter = document.getElementById('cityFilter');
    var universityFilter = document.getElementById('universityFilter');
    var budgetFilter = document.getElementById('budgetFilter');
    var lifestyleFilter = document.getElementById('lifestyleFilter');
    
    if (cityFilter) cityFilter.value = '';
    if (universityFilter) universityFilter.value = '';
    if (budgetFilter) budgetFilter.value = '';
    if (lifestyleFilter) lifestyleFilter.value = '';
    
    showNotification('Filters cleared', 'info');
}

function scrollToAiPick() {
    var aiCard = document.querySelector('.roommate-card.ai-pick');
    if (aiCard) {
        aiCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        aiCard.style.animation = 'highlight 1s ease';
        setTimeout(function() {
            aiCard.style.animation = '';
        }, 1000);
    }
    showNotification('Showing AI matches!', 'success');
}

function showPremiumPopup() {
    var popup = document.getElementById('premiumPopup');
    if (popup) popup.classList.add('show');
}

function hidePremiumPopup() {
    var popup = document.getElementById('premiumPopup');
    if (popup) popup.classList.remove('show');
}

function animateCounters() {
    var counters = document.querySelectorAll('.counter');
    counters.forEach(function(counter) {
        var target = parseInt(counter.getAttribute('data-target')) || 0;
        var current = 0;
        var increment = target / 100;
        
        var timer = setInterval(function() {
            current += increment;
            if (current >= target) {
                counter.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current).toLocaleString();
            }
        }, 20);
    });
}

function createParticles() {
    var container = document.getElementById('particles');
    if (!container) return;
    
    for (var i = 0; i < 40; i++) {
        var particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = 'position:absolute;background:rgba(255,255,255,0.3);border-radius:50%;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;width:' + (Math.random() * 3 + 1) + 'px;height:' + (Math.random() * 3 + 1) + 'px;animation:float ' + (Math.random() * 4 + 3) + 's ease-in-out infinite;animation-delay:' + (Math.random() * 4) + 's;opacity:' + (Math.random() * 0.5 + 0.2) + ';';
        container.appendChild(particle);
    }
}

// Expose toggleBreakdown globally for onclick in HTML
window.toggleBreakdown = function(header) {
    header.classList.toggle('active');
    var content = header.nextElementSibling;
    if (content) content.classList.toggle('show');
};

console.log('find-roommate-matches.js loaded');
