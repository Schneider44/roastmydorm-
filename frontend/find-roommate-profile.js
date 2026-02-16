/**
 * Find Roommate Profile - JavaScript
 * RoastMyDorm Platform
 */

// ============================================
// ROUTE CONFIGURATION
// ============================================
const ROUTES = {
    createProfile: "find-roommate-profile.html",
    browseRoommates: "find-roommate-matches.html",
    chat: "find-roommate-chat.html",
    landing: "find-roommate.html"
};

// ============================================
// DOM ELEMENTS
// ============================================
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const navbar = document.getElementById('navbar');
const particlesContainer = document.getElementById('particles');
const profileForm = document.getElementById('profileForm');
const budgetSlider = document.getElementById('budgetSlider');
const sliderValue = document.getElementById('sliderValue');
const minBudgetInput = document.getElementById('minBudget');
const maxBudgetInput = document.getElementById('maxBudget');

// ============================================
// MOBILE NAVIGATION TOGGLE
// ============================================
if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        });
    });
}

// ============================================
// ROUTE NAVIGATION
// ============================================
function navigateToRoute(routeKey) {
    const route = ROUTES[routeKey];
    if (route) {
        window.location.href = route;
    } else {
        console.warn(`Route "${routeKey}" not found.`);
    }
}

// Attach click handlers to all elements with data-route attribute
document.querySelectorAll('[data-route]').forEach(element => {
    element.addEventListener('click', (e) => {
        e.preventDefault();
        const routeKey = element.getAttribute('data-route');
        
        switch (routeKey) {
            case 'create':
                navigateToRoute('createProfile');
                break;
            case 'browse':
                // Check if profile exists before allowing browse
                const savedProfile = localStorage.getItem('roommateProfile');
                if (!savedProfile) {
                    alert('Please complete and submit your profile first to browse roommates.');
                    // Stay on the profile page - user is already here
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    navigateToRoute('browseRoommates');
                }
                break;
            case 'chat':
                navigateToRoute('chat');
                break;
            case 'landing':
                navigateToRoute('landing');
                break;
            default:
                console.warn(`Unknown route key: "${routeKey}"`);
        }
    });
});

// ============================================
// BUDGET SLIDER
// ============================================
if (budgetSlider && sliderValue) {
    budgetSlider.addEventListener('input', function() {
        const value = this.value;
        sliderValue.textContent = value + ' MAD';
        
        // Update max budget input
        if (maxBudgetInput) {
            maxBudgetInput.value = value;
        }
    });

    // Sync min budget with slider
    if (minBudgetInput) {
        minBudgetInput.addEventListener('input', function() {
            const minVal = parseInt(this.value) || 1000;
            if (minVal <= parseInt(budgetSlider.value)) {
                // Value is valid
            }
        });
    }

    // Sync max budget with slider
    if (maxBudgetInput) {
        maxBudgetInput.addEventListener('input', function() {
            const maxVal = parseInt(this.value) || 5000;
            if (maxVal >= 1000 && maxVal <= 5000) {
                budgetSlider.value = maxVal;
                sliderValue.textContent = maxVal + ' MAD';
            }
        });
    }
}

// ============================================
// FORM SUBMISSION
// ============================================
if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Collect form data
        const formData = new FormData(this);
        const profileData = {};
        
        formData.forEach((value, key) => {
            profileData[key] = value;
        });

        // Get contact preference (outside main form)
        const contactPref = document.querySelector('input[name="contactPreference"]:checked');
        if (contactPref) {
            profileData.contactPreference = contactPref.value;
        }

        // Validate required fields
        const requiredFields = ['fullName', 'city', 'university', 'minBudget', 'moveInDate'];
        const missingFields = requiredFields.filter(field => !profileData[field]);

        if (missingFields.length > 0) {
            showNotification('Please fill in all required fields: ' + missingFields.join(', '), 'error');
            return;
        }

        // Log data (in production, this would be an API call)
        console.log('Profile Data:', profileData);

        // Show success notification
        showNotification('Profile created successfully! Redirecting to matches...', 'success');

        // Store in localStorage for demo purposes
        localStorage.setItem('roommateProfile', JSON.stringify(profileData));

        // Redirect to matches page after delay
        setTimeout(() => {
            window.location.href = ROUTES.browseRoommates;
        }, 2000);
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(39, 174, 96, 0.95)' : type === 'error' ? 'rgba(229, 57, 53, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Close button handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (navbar) {
        if (currentScrollY > 50) {
            navbar.style.background = 'rgba(15, 22, 41, 0.98)';
            navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(15, 22, 41, 0.9)';
            navbar.style.boxShadow = 'none';
        }
    }
});

// ============================================
// PARTICLE/STAR BACKGROUND EFFECT
// ============================================
function createParticles() {
    if (!particlesContainer) return;

    const particleCount = 60;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        
        // Random size (1-3px)
        const size = Math.random() * 2 + 1;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // Random animation delay and duration
        particle.style.animationDelay = Math.random() * 3 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
        
        // Random opacity
        particle.style.opacity = Math.random() * 0.5 + 0.2;
        
        particlesContainer.appendChild(particle);
    }
}

// Initialize particles
createParticles();

// ============================================
// FORM FIELD VALIDATION FEEDBACK
// ============================================
const requiredInputs = document.querySelectorAll('input[required], select[required]');

requiredInputs.forEach(input => {
    input.addEventListener('blur', function() {
        if (this.value.trim() === '') {
            this.style.borderColor = 'rgba(229, 57, 53, 0.5)';
        } else {
            this.style.borderColor = 'rgba(39, 174, 96, 0.5)';
        }
    });

    input.addEventListener('focus', function() {
        this.style.borderColor = '';
    });
});

// ============================================
// RADIO BUTTON ENHANCEMENTS
// ============================================
document.querySelectorAll('.radio-option').forEach(option => {
    option.addEventListener('click', function() {
        const radio = this.querySelector('input[type="radio"]');
        const name = radio.name;
        
        // Remove active state from siblings
        document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
            r.closest('.radio-option').classList.remove('active');
        });
        
        // Add active state
        this.classList.add('active');
    });
});

// ============================================
// SET MINIMUM DATE TO TODAY
// ============================================
const moveInDateInput = document.getElementById('moveInDate');
if (moveInDateInput) {
    const today = new Date().toISOString().split('T')[0];
    moveInDateInput.setAttribute('min', today);
}

// ============================================
// LOAD SAVED PROFILE DATA
// ============================================
function loadSavedProfile() {
    const savedProfile = localStorage.getItem('roommateProfile');
    if (savedProfile) {
        try {
            const data = JSON.parse(savedProfile);
            
            // Populate form fields
            Object.keys(data).forEach(key => {
                const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (element) {
                    if (element.type === 'radio') {
                        const radio = document.querySelector(`input[name="${key}"][value="${data[key]}"]`);
                        if (radio) {
                            radio.checked = true;
                            radio.closest('.radio-option')?.classList.add('active');
                        }
                    } else {
                        element.value = data[key];
                    }
                }
            });

            // Update slider if budget exists
            if (data.maxBudget && budgetSlider && sliderValue) {
                budgetSlider.value = data.maxBudget;
                sliderValue.textContent = data.maxBudget + ' MAD';
            }
        } catch (e) {
            console.error('Error loading saved profile:', e);
        }
    }
}

// Load saved profile on page load
loadSavedProfile();

// ============================================
// CONSOLE LOG FOR DEBUGGING
// ============================================
console.log('Profile page initialized');
console.log('Available routes:', ROUTES);
