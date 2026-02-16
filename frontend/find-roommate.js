/**
 * Find Roommate - JavaScript
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
                    alert('Please create your profile first to browse roommates.');
                    navigateToRoute('createProfile');
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
// NAVBAR SCROLL EFFECT
// ============================================
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (navbar) {
        if (currentScrollY > 50) {
            navbar.style.background = 'rgba(15, 22, 41, 0.95)';
            navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(15, 22, 41, 0.85)';
            navbar.style.boxShadow = 'none';
        }
    }

    lastScrollY = currentScrollY;
});

// ============================================
// PARTICLE/STAR BACKGROUND EFFECT
// ============================================
function createParticles() {
    if (!particlesContainer) return;

    const particleCount = 80;
    
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
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Skip if it's just "#" or has a data-route
        if (href === '#' || this.hasAttribute('data-route')) return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const navHeight = navbar ? navbar.offsetHeight : 0;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ============================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe feature cards and step items
document.querySelectorAll('.feature-card, .step-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Add animation class styles
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

// ============================================
// HOVER EFFECTS FOR CARDS
// ============================================
document.querySelectorAll('.feature-card').forEach((card, index) => {
    card.addEventListener('mouseenter', () => {
        card.style.transitionDelay = '0s';
    });

    card.addEventListener('mouseleave', () => {
        card.style.transitionDelay = '0s';
    });
});

// ============================================
// BUTTON RIPPLE EFFECT
// ============================================
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            width: 100px;
            height: 100px;
            left: ${x - 50}px;
            top: ${y - 50}px;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// ============================================
// CONSOLE LOG FOR DEBUGGING
// ============================================
console.log('Find Roommate page initialized');
console.log('Available routes:', ROUTES);
