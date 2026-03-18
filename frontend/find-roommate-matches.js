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


// ── API base URL (works for local and production) ──
const ROOMMATE_API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api'
    : 'https://roastmydorm-backend-zy4p.vercel.app/api';

// ── Token refresh helper ──
async function refreshRmdToken() {
    const refreshToken = localStorage.getItem('rmd_refresh');
    if (!refreshToken) return null;
    try {
        const res = await fetch(`${ROOMMATE_API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const data = await res.json();
        if (res.ok && data.success && data.data.accessToken) {
            localStorage.setItem('rmd_token', data.data.accessToken);
            if (data.data.refreshToken) localStorage.setItem('rmd_refresh', data.data.refreshToken);
            return data.data.accessToken;
        }
        return null;
    } catch { return null; }
}

// ── Load real profiles on page load ──
window.addEventListener('DOMContentLoaded', async function() {
    let token = localStorage.getItem('rmd_token');
    const grid = document.getElementById('roommatesGrid');
    const loadingState = document.getElementById('loadingState');
    const notLoggedIn = document.getElementById('notLoggedInState');
    const noProfile = document.getElementById('noProfileState');
    const emptyState = document.getElementById('emptyState');

    function hideAll() {
        [loadingState, notLoggedIn, noProfile, emptyState].forEach(el => { if (el) el.style.display = 'none'; });
    }

    if (!token) {
        hideAll();
        if (notLoggedIn) notLoggedIn.style.display = 'block';
        return;
    }

    try {
        // Check current user's own profile
        let profileRes = await fetch(`${ROOMMATE_API}/roommate/profiles/me`, {
            headers: { Authorization: 'Bearer ' + token }
        });

        // Silently refresh token if expired
        if (profileRes.status === 401) {
            token = await refreshRmdToken();
            if (!token) {
                hideAll();
                if (notLoggedIn) notLoggedIn.style.display = 'block';
                return;
            }
            profileRes = await fetch(`${ROOMMATE_API}/roommate/profiles/me`, {
                headers: { Authorization: 'Bearer ' + token }
            });
        }

        if (profileRes.status === 404) {
            hideAll();
            if (noProfile) noProfile.style.display = 'block';
            return;
        }

        const myProfileData = await profileRes.json();
        const myProfile = myProfileData.success ? myProfileData.data : null;

        // Get all other profiles
        const res = await fetch(`${ROOMMATE_API}/roommate/profiles`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();

        hideAll();

        const others = (data.success && Array.isArray(data.data)) ? data.data : [];

        // Render own profile card first, then others
        if (myProfile) renderMyProfile(myProfile);
        if (others.length > 0) renderProfiles(others);
        if (!myProfile && others.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
        }

    } catch (err) {
        hideAll();
        if (grid) grid.insertAdjacentHTML('beforeend',
            '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444;">Could not connect to server. Please try again.</div>'
        );
    }
});

// Generate a gradient for a card cover based on a seed string
function cardCoverGradient(seed, isOwn) {
    if (isOwn) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    const palettes = [
        'linear-gradient(135deg,#667eea,#764ba2)',
        'linear-gradient(135deg,#f093fb,#f5576c)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#fa709a,#fee140)',
        'linear-gradient(135deg,#a18cd1,#fbc2eb)',
        'linear-gradient(135deg,#fccb90,#d57eeb)',
        'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
    ];
    let h = 0;
    for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xff;
    return palettes[h % palettes.length];
}

// Get initials from a name
function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function buildCardHtml({ profile, id, isOwn, score }) {
    const initials = getInitials(profile.name);
    const avatarGrad = isOwn
        ? 'linear-gradient(135deg,#10b981,#059669)'
        : cardCoverGradient(String(id));

    const avatarHtml = profile.avatarUrl
        ? `<img src="${profile.avatarUrl}" alt="${profile.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : initials;

    const verifiedBadge = profile.isVerified
        ? `<span class="badge-verified"><i class="fas fa-check-circle"></i> Verified</span>`
        : '';

    const ownBadge = isOwn
        ? `<span style="background:#DCFCE7;color:#16a34a;border:1px solid #BBF7D0;font-size:0.62rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.4px;">YOUR PROFILE</span>`
        : '';

    const scoreBadge = !isOwn && score !== null
        ? `<span class="match-badge ${matchBadgeClass(score)}"><i class="fas fa-bolt" style="font-size:0.5rem;"></i> ${score}% match</span>`
        : '';

    const hasBadges = verifiedBadge || ownBadge || scoreBadge;

    // Inline stats row: "Budget: X MAD · Active · Clean: Y/5"
    const budgetText = (profile.budgetMin || profile.budgetMax)
        ? `<span class="stat-inline-text">Budget: ${profile.budgetMax || profile.budgetMin} MAD</span>` : '';
    const cleanText = profile.cleanlinessLevel
        ? `<span class="stat-inline-text">Clean: ${profile.cleanlinessLevel}/5</span>` : '';
    const activeBadge = `<span class="stat-inline-badge"><i class="fas fa-circle" style="font-size:0.4rem;"></i> Active</span>`;
    const hasStats = budgetText || cleanText;

    // Interest tags (max 4)
    const interestTags = (profile.interests || []).slice(0, 4)
        .map(i => `<span class="tag">${i}</span>`).join('');

    const bioSnippet = profile.bio ? profile.bio.slice(0, 88) + (profile.bio.length > 88 ? '…' : '') : '';

    const actionsHtml = isOwn
        ? `<a href="find-roommate-profile.html" class="btn btn-msg" style="text-decoration:none;"><i class="fas fa-pen"></i> Edit Profile</a>`
        : `<button class="btn btn-msg" onclick="goToChat('${id}')"><i class="fas fa-paper-plane"></i> Message</button>
           <button class="btn btn-outline-ghost" onclick="goToChat('${id}')"><i class="fas fa-user"></i> Profile</button>`;

    return `
        <!-- Header: avatar + identity + menu -->
        <div class="card-header">
            <div class="card-avatar-wrap">
                <div class="avatar-placeholder${profile.gender === 'female' ? ' female' : ''}" style="background:${avatarGrad};position:relative;">
                    ${avatarHtml}
                    <span class="online-dot"></span>
                </div>
            </div>
            <div class="card-identity">
                <h3>${profile.name || (isOwn ? 'You' : 'Student')}</h3>
                <div class="card-role">${profile.university ? 'Student' : 'Looking for a roommate'}</div>
            </div>
            <button class="card-menu-btn"><i class="fas fa-ellipsis-h"></i></button>
        </div>

        ${hasBadges ? `<div class="card-badges-float">${ownBadge}${verifiedBadge}${scoreBadge}</div>` : ''}

        <div class="card-divider" style="margin:10px 14px 0;"></div>

        <!-- Info section -->
        <div class="card-body">
            <div class="card-info-list">
                ${profile.university ? `<div class="info-row"><div class="info-icon"><i class="fas fa-graduation-cap"></i></div><span>${profile.university}</span></div>` : ''}
                ${profile.location ? `<div class="info-row"><div class="info-icon"><i class="fas fa-map-marker-alt"></i></div><span>${profile.location}</span></div>` : ''}
            </div>

            ${hasStats ? `
            <div class="card-divider" style="margin:8px -14px;"></div>
            <div class="card-stats-inline">
                ${budgetText}
                ${activeBadge}
                ${cleanText}
            </div>` : ''}

            ${interestTags ? `
            <div class="card-divider" style="margin:8px -14px;"></div>
            <p class="card-interests-label">Interests:</p>
            <div class="card-tags">${interestTags}</div>` : ''}

            ${bioSnippet ? `<p class="card-bio" style="margin-top:6px;">${bioSnippet}</p>` : ''}
        </div>

        <div class="card-divider" style="margin:0 14px;"></div>
        <div class="card-actions">${actionsHtml}</div>
    `;
}

function renderMyProfile(profile) {
    const grid = document.getElementById('roommatesGrid');
    if (!grid) return;
    const card = document.createElement('div');
    card.className = 'roommate-card';
    card.style.cssText = 'border: 1.5px solid rgba(16,185,129,0.25);';
    card.innerHTML = buildCardHtml({ profile, id: 'me', isOwn: true, score: null });
    grid.insertBefore(card, grid.firstChild);
}

function matchBadgeClass(score) {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
}

function renderProfiles(profiles) {
    const grid = document.getElementById('roommatesGrid');
    if (!grid) return;
    grid.querySelectorAll('[id$="State"]').forEach(el => el.remove());

    profiles.forEach(profile => {
        const id = profile._id || profile.userId;
        const score = profile.matchScore !== undefined ? profile.matchScore : null;
        const card = document.createElement('div');
        card.className = 'roommate-card';
        card.dataset.id = id;
        card.innerHTML = buildCardHtml({ profile, id, isOwn: false, score });
        grid.appendChild(card);
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
