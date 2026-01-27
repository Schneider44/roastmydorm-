// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background change on scroll - optimized with throttling
let ticking = false;
function updateNavbar() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.backdropFilter = 'blur(10px)';
    } else {
        navbar.style.background = '#ffffff';
        navbar.style.backdropFilter = 'none';
    }
    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
    }
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and feature items
document.querySelectorAll('.about-card, .feature-item').forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(30px)';
    item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(item);
});

// Button click animations
document.querySelectorAll('.btn-primary, .btn-secondary, .nav-btn').forEach(button => {
    button.addEventListener('click', function(e) {
        // Create ripple effect
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Add ripple effect styles
const style = document.createElement('style');
style.textContent = `
    .btn-primary, .btn-secondary, .nav-btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Stats counter animation
function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/\D/g, ''));
        const increment = target / 100;
        let current = 0;
        
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                stat.textContent = Math.ceil(current) + '+';
                requestAnimationFrame(updateCounter);
            } else {
                stat.textContent = target + '+';
            }
        };
        
        updateCounter();
    });
}

// Trigger stats animation when hero section is visible
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            setTimeout(animateStats, 500);
            heroObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

heroObserver.observe(document.querySelector('.hero'));

// Form validation for future forms
function validateForm(formData) {
    const errors = [];
    
    if (!formData.get('email')) {
        errors.push('Email is required');
    } else if (!isValidEmail(formData.get('email'))) {
        errors.push('Please enter a valid email');
    }
    
    if (!formData.get('name')) {
        errors.push('Name is required');
    }
    
    return errors;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Add loading states to buttons
document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function() {
        if (this.classList.contains('btn-primary') || this.classList.contains('btn-secondary')) {
            const originalText = this.textContent;
            this.textContent = 'Loading...';
            this.disabled = true;
            
            setTimeout(() => {
                this.textContent = originalText;
                this.disabled = false;
            }, 2000);
        }
    });
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    const rate = scrolled * -0.5;
    
    if (hero) {
        hero.style.transform = `translateY(${rate}px)`;
    }
});

// Add some Moroccan cultural elements
document.addEventListener('DOMContentLoaded', () => {
    // Add Moroccan flag colors to some elements
    const moroccanElements = document.querySelectorAll('.highlight, .card-icon, .feature-icon');
    moroccanElements.forEach(element => {
        element.style.background = 'linear-gradient(135deg, #c1272d 0%, #006233 100%)';
    });
    
    // Add Arabic text support (for future localization)
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
});

// Carousel functionality
let carouselPositions = {
    'universities': 0,
    'top-dorms': 0,
    'popular-dorms': 0
};

function slideCarousel(carouselId, direction) {
    const carousel = document.getElementById(carouselId + '-carousel');
    const items = carousel.querySelectorAll('.carousel-item');
    const itemWidth = 320; // 300px + 20px gap
    const maxPosition = items.length - 3; // Show 3 items at once
    
    if (direction === 1) { // Next
        if (carouselPositions[carouselId] < maxPosition) {
            carouselPositions[carouselId]++;
        }
    } else { // Previous
        if (carouselPositions[carouselId] > 0) {
            carouselPositions[carouselId]--;
        }
    }
    
    const translateX = -carouselPositions[carouselId] * itemWidth;
    carousel.style.transform = `translateX(${translateX}px)`;
    
    // Update button states
    updateCarouselButtons(carouselId, maxPosition);
}

function updateCarouselButtons(carouselId, maxPosition) {
    const container = document.querySelector(`#${carouselId}-carousel`).closest('.carousel-container');
    const prevBtn = container.querySelector('.prev-btn');
    const nextBtn = container.querySelector('.next-btn');
    
    // Disable/enable previous button
    if (carouselPositions[carouselId] === 0) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
    }
    
    // Disable/enable next button
    if (carouselPositions[carouselId] >= maxPosition) {
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
    } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }
}

// Initialize carousel button states
document.addEventListener('DOMContentLoaded', () => {
    const carousels = ['universities', 'top-dorms', 'popular-dorms'];
    carousels.forEach(carouselId => {
        const carousel = document.getElementById(carouselId + '-carousel');
        if (carousel) {
            const items = carousel.querySelectorAll('.carousel-item');
            const maxPosition = items.length - 3;
            updateCarouselButtons(carouselId, maxPosition);
        }
    });
});

// Auto-advance carousels - optimized for performance
function autoAdvanceCarousels() {
    const carousels = ['universities', 'top-dorms', 'popular-dorms'];
    carousels.forEach(carouselId => {
        const carousel = document.getElementById(carouselId + '-carousel');
        if (carousel && carouselPositions[carouselId] !== undefined) {
            const items = carousel.querySelectorAll('.carousel-item');
            const maxPosition = Math.max(0, items.length - 3);
            
            if (carouselPositions[carouselId] >= maxPosition) {
                carouselPositions[carouselId] = 0;
            } else {
                carouselPositions[carouselId]++;
            }
            
            const translateX = -carouselPositions[carouselId] * 320; // Fixed itemWidth
            carousel.style.transform = `translateX(${translateX}px)`;
            updateCarouselButtons(carouselId, maxPosition);
        }
    });
}

// Auto-advance every 8 seconds (reduced frequency for better performance)
setInterval(autoAdvanceCarousels, 8000);

// Touch/swipe support for mobile devices
function addTouchSupport() {
    const carousels = ['universities', 'top-dorms', 'popular-dorms'];
    
    carousels.forEach(carouselId => {
        const carousel = document.getElementById(carouselId + '-carousel');
        if (carousel) {
            let startX = 0;
            let endX = 0;
            
            carousel.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });
            
            carousel.addEventListener('touchend', (e) => {
                endX = e.changedTouches[0].clientX;
                const diff = startX - endX;
                
                if (Math.abs(diff) > 50) { // Minimum swipe distance
                    if (diff > 0) {
                        slideCarousel(carouselId, 1); // Swipe left = next
                    } else {
                        slideCarousel(carouselId, -1); // Swipe right = previous
                    }
                }
            });
        }
    });
}

// Mouse-triggered automatic sliding
function addMouseTriggeredSliding() {
    const carousels = ['universities', 'top-dorms', 'popular-dorms'];
    
    carousels.forEach(carouselId => {
        const carouselContainer = document.querySelector(`#${carouselId}-carousel`).closest('.carousel-container');
        const carousel = document.getElementById(carouselId + '-carousel');
        
        if (carouselContainer && carousel) {
            let mouseX = 0;
            let isHovering = false;
            let slideInterval = null;
            
            // Mouse enter - start automatic sliding
            carouselContainer.addEventListener('mouseenter', () => {
                isHovering = true;
                startMouseSliding(carouselId);
            });
            
            // Mouse leave - stop automatic sliding
            carouselContainer.addEventListener('mouseleave', () => {
                isHovering = false;
                stopMouseSliding();
            });
            
            // Mouse move - adjust sliding speed based on position
            carouselContainer.addEventListener('mousemove', (e) => {
                if (isHovering) {
                    const rect = carouselContainer.getBoundingClientRect();
                    mouseX = e.clientX - rect.left;
                    
                    // Adjust sliding speed based on mouse position
                    const containerWidth = rect.width;
                    const leftHalf = mouseX < containerWidth / 2;
                    
                    // Stop current interval and restart with new speed
                    stopMouseSliding();
                    startMouseSliding(carouselId, leftHalf ? 'left' : 'right');
                }
            });
        }
    });
}

function startMouseSliding(carouselId, direction = 'right') {
    const carousel = document.getElementById(carouselId + '-carousel');
    const items = carousel.querySelectorAll('.carousel-item');
    const maxPosition = Math.max(0, items.length - 3);
    
    // Different speeds for left/right movement
    const speed = direction === 'left' ? 2000 : 1500; // Left = slower, Right = faster
    
    slideInterval = setInterval(() => {
        if (direction === 'right') {
            // Move forward
            if (carouselPositions[carouselId] >= maxPosition) {
                carouselPositions[carouselId] = 0;
            } else {
                carouselPositions[carouselId]++;
            }
        } else {
            // Move backward
            if (carouselPositions[carouselId] <= 0) {
                carouselPositions[carouselId] = maxPosition;
            } else {
                carouselPositions[carouselId]--;
            }
        }
        
        const translateX = -carouselPositions[carouselId] * 320;
        carousel.style.transform = `translateX(${translateX}px)`;
        updateCarouselButtons(carouselId, maxPosition);
    }, speed);
}

function stopMouseSliding() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

// Initialize touch support when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    addTouchSupport();
    addMouseTriggeredSliding();
});

// Sign In Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('signInModal');
    const signInBtn = document.querySelector('.nav-btn');
    const closeBtn = document.querySelector('.close');
    const uploadBox = document.getElementById('uploadBox');
    const studentIdInput = document.getElementById('studentIdInput');
    const uploadPreview = document.getElementById('uploadPreview');
    const previewImage = document.getElementById('previewImage');
    const retakeBtn = document.getElementById('retakeBtn');
    const verifyIdBtn = document.getElementById('verifyIdBtn');
    const verificationStatus = document.getElementById('verificationStatus');
    const googleSigninBtn = document.querySelector('.google-signin-btn');

    // Open modal when Sign In button is clicked
    signInBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    });

    // Close modal when X is clicked
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        resetModal();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetModal();
        }
    });

    // Handle file upload/scanning
    uploadBox.addEventListener('click', () => {
        studentIdInput.click();
    });

    studentIdInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                uploadBox.style.display = 'none';
                uploadPreview.style.display = 'block';
                verifyIdBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }
    });

    // Retake photo
    retakeBtn.addEventListener('click', () => {
        resetUpload();
    });

    // Verify Student ID
    verifyIdBtn.addEventListener('click', () => {
        // Simulate verification process
        verifyIdBtn.textContent = 'Verifying...';
        verifyIdBtn.disabled = true;
        
        setTimeout(() => {
            showVerificationSuccess();
        }, 2000);
    });

    // Google Sign In
    googleSigninBtn.addEventListener('click', () => {
        // Simulate Google OAuth
        googleSigninBtn.textContent = 'Connecting...';
        googleSigninBtn.disabled = true;
        
        setTimeout(() => {
            showVerificationSuccess();
        }, 1500);
    });

    function resetUpload() {
        uploadBox.style.display = 'block';
        uploadPreview.style.display = 'none';
        verifyIdBtn.disabled = true;
        studentIdInput.value = '';
    }

    function showVerificationSuccess() {
        document.querySelector('.signin-options').style.display = 'none';
        verificationStatus.style.display = 'block';
        
        // Auto-close modal after 3 seconds
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetModal();
        }, 3000);
    }

    function resetModal() {
        document.querySelector('.signin-options').style.display = 'block';
        verificationStatus.style.display = 'none';
        resetUpload();
        verifyIdBtn.textContent = 'Verify Student ID';
        verifyIdBtn.disabled = true;
        googleSigninBtn.textContent = 'Sign in with Google';
        googleSigninBtn.disabled = false;
    }
});

// Sign In Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('signInModal');
    const signInBtn = document.querySelector('.nav-btn');
    const closeBtn = document.querySelector('.close-modal');
    const gmailBtn = document.getElementById('gmailSignIn');
    const idScanBtn = document.getElementById('idScanBtn');
    const gmailEmailInput = document.getElementById('gmailEmail');
    const sendVerificationEmailBtn = document.getElementById('sendVerificationEmail');
    const userEmailDisplay = document.getElementById('userEmail');
    const idFileInput = document.getElementById('idFileInput');
    const scanBox = document.getElementById('scanBox');
    const scanPreview = document.getElementById('scanPreview');
    const previewImage = document.getElementById('previewImage');
    const retakeBtn = document.getElementById('retakePhoto');
    const verifyIdBtn = document.getElementById('verifyId');
    const resendEmailBtn = document.getElementById('resendEmail');
    const checkVerificationBtn = document.getElementById('checkVerification');
    const startRatingBtn = document.getElementById('startRating');
    const browseHousingBtn = document.getElementById('browseHousing');

    // Open modal when Sign In button is clicked
    signInBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        resetModal();
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        closeModal();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Gmail Sign In
    gmailBtn.addEventListener('click', () => {
        showGmailEmailInput();
    });

    // Send Verification Email
    function sendVerificationEmail() {
        const email = gmailEmailInput.value.trim();
        
        if (!email) {
            showNotification('Please enter your Gmail address', 'error');
            return;
        }
        
        if (!isValidGmail(email)) {
            showNotification('Please enter a valid Gmail address', 'error');
            return;
        }
        
        sendVerificationEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        sendVerificationEmailBtn.disabled = true;
        
        // Simulate sending verification email
        setTimeout(() => {
            userEmailDisplay.textContent = email;
            showGmailVerification();
        }, 2000);
    }

    sendVerificationEmailBtn.addEventListener('click', sendVerificationEmail);
    
    // Allow Enter key to send email
    gmailEmailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendVerificationEmail();
        }
    });

    // Student ID Scan
    idScanBtn.addEventListener('click', () => {
        showIdScanStep();
    });

    // File input for ID scanning
    scanBox.addEventListener('click', () => {
        idFileInput.click();
    });

    idFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                scanBox.style.display = 'none';
                scanPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Retake photo
    retakeBtn.addEventListener('click', () => {
        scanBox.style.display = 'block';
        scanPreview.style.display = 'none';
        idFileInput.value = '';
    });

    // Verify ID
    verifyIdBtn.addEventListener('click', () => {
        verifyIdBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        verifyIdBtn.disabled = true;
        
        // Simulate ID verification process
        setTimeout(() => {
            showVerificationSuccess();
        }, 3000);
    });

    // Resend email
    resendEmailBtn.addEventListener('click', () => {
        resendEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        resendEmailBtn.disabled = true;
        
        setTimeout(() => {
            resendEmailBtn.innerHTML = 'Resend Email';
            resendEmailBtn.disabled = false;
            showNotification(`Verification email sent to ${userEmailDisplay.textContent}!`, 'success');
        }, 1500);
    });

    // Check verification
    checkVerificationBtn.addEventListener('click', () => {
        checkVerificationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        checkVerificationBtn.disabled = true;
        
        setTimeout(() => {
            showVerificationSuccess();
        }, 2000);
    });

    // Success actions
    startRatingBtn.addEventListener('click', () => {
        closeModal();
        // Scroll to dorm sections
        document.querySelector('.top-dorms').scrollIntoView({ behavior: 'smooth' });
        showNotification('Welcome! You can now rate dorms and write reviews.', 'success');
    });

    browseHousingBtn.addEventListener('click', () => {
        closeModal();
        // Navigate to dorms listing page
        window.location.href = 'dorms.html';
    });

    function showGmailEmailInput() {
        document.querySelector('.signin-options').style.display = 'none';
        document.getElementById('gmailEmailInput').style.display = 'block';
    }

    function showGmailVerification() {
        document.querySelector('.signin-options').style.display = 'none';
        document.getElementById('gmailEmailInput').style.display = 'none';
        document.getElementById('gmailVerification').style.display = 'block';
    }

    function showIdScanStep() {
        document.querySelector('.signin-options').style.display = 'none';
        document.getElementById('idScanStep').style.display = 'block';
    }

    function showVerificationSuccess() {
        document.querySelector('.signin-options').style.display = 'none';
        document.getElementById('gmailVerification').style.display = 'none';
        document.getElementById('idScanStep').style.display = 'none';
        document.getElementById('verificationSuccess').style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        resetModal();
    }

    function resetModal() {
        // Reset all steps
        document.querySelector('.signin-options').style.display = 'block';
        document.getElementById('gmailEmailInput').style.display = 'none';
        document.getElementById('gmailVerification').style.display = 'none';
        document.getElementById('idScanStep').style.display = 'none';
        document.getElementById('verificationSuccess').style.display = 'none';
        
        // Reset buttons
        gmailBtn.innerHTML = '<i class="fab fa-google"></i> Continue with Gmail';
        gmailBtn.disabled = false;
        
        sendVerificationEmailBtn.innerHTML = 'Send Verification Email';
        sendVerificationEmailBtn.disabled = false;
        
        verifyIdBtn.innerHTML = 'Verify ID';
        verifyIdBtn.disabled = false;
        
        resendEmailBtn.innerHTML = 'Resend Email';
        resendEmailBtn.disabled = false;
        
        checkVerificationBtn.innerHTML = 'I\'ve Verified';
        checkVerificationBtn.disabled = false;
        
        // Reset email input
        gmailEmailInput.value = '';
        
        // Reset scan area
        scanBox.style.display = 'block';
        scanPreview.style.display = 'none';
        idFileInput.value = '';
    }

    function isValidGmail(email) {
        const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
        return gmailRegex.test(email);
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        let icon = 'info-circle';
        let backgroundColor = '#3b82f6';
        
        if (type === 'success') {
            icon = 'check-circle';
            backgroundColor = '#10b981';
        } else if (type === 'error') {
            icon = 'exclamation-circle';
            backgroundColor = '#ef4444';
        }
        
        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Add notification animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});

console.log('RoastMyDorm Morocco - Welcome to the future of student housing reviews! 🏠🇲🇦'); 

// University visibility control
let universitiesVisible = false;

function toggleUniversitySearch() {
    universitiesVisible = !universitiesVisible;
    const searchBtn = document.getElementById('searchUniversitiesBtn');
    const universityTexts = document.querySelectorAll('.university-text');
    const campusTexts = document.querySelectorAll('.campus-text');
    
    if (universitiesVisible) {
        // Show university names
        universityTexts.forEach(text => text.classList.remove('hidden'));
        campusTexts.forEach(text => text.classList.remove('show'));
        searchBtn.classList.add('active');
        searchBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Universities';
        searchBtn.style.background = '#dc2626';
    } else {
        // Hide university names
        universityTexts.forEach(text => text.classList.add('hidden'));
        campusTexts.forEach(text => text.classList.add('show'));
        searchBtn.classList.remove('active');
        searchBtn.innerHTML = '<i class="fas fa-graduation-cap"></i> Search Universities';
        searchBtn.style.background = '#f59e0b';
    }
}

// Initialize university visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    // Hide universities by default
    const universityTexts = document.querySelectorAll('.university-text');
    const campusTexts = document.querySelectorAll('.campus-text');
    
    universityTexts.forEach(text => text.classList.add('hidden'));
    campusTexts.forEach(text => text.classList.add('show'));
});

// Universities and Schools Database
const universitiesAndSchools = {
    casablanca: [
        { name: "Hassan II University", type: "University", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "Mohammed VI University of Health Sciences", type: "University", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "International University of Casablanca", type: "University", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "École Nationale Supérieure d'Informatique et d'Analyse des Systèmes", type: "Engineering School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "École Supérieure de Commerce de Casablanca", type: "Business School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "Institut Supérieur de Commerce et d'Administration des Entreprises", type: "Business School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "École Supérieure de Technologie de Casablanca", type: "Technology School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "Faculté de Médecine et de Pharmacie de Casablanca", type: "Medical School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "École Nationale Supérieure des Arts et Métiers", type: "Arts School", city: "Casablanca", page: "casablanca-dorms.html" },
        { name: "Institut Supérieur de Journalisme et de Communication", type: "Communication School", city: "Casablanca", page: "casablanca-dorms.html" }
    ],
    rabat: [
        { name: "Mohammed V University", type: "University", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Université Mohammed V", type: "University", city: "Rabat", page: "rabat-dorms.html" },
        { name: "International University of Rabat", type: "University", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Mohammadia d'Ingénieurs", type: "Engineering School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut National des Postes et Télécommunications", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure d'Informatique et d'Analyse des Systèmes", type: "Engineering School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté des Sciences de Rabat", type: "Science Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté de Droit de Rabat", type: "Law Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Technologie de Salé", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de l'Information et de la Communication", type: "Communication School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure des Arts et Métiers de Rabat", type: "Arts School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté des Lettres et des Sciences Humaines de Rabat", type: "Humanities Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Commerce de Rabat", type: "Business School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de Commerce et d'Administration des Entreprises", type: "Business School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté de Médecine et de Pharmacie de Rabat", type: "Medical School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure de l'Administration", type: "Administration School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de Journalisme et de Communication", type: "Communication School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Université Mohammed V de Rabat", type: "University", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure d'Architecture", type: "Architecture School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de Gestion et d'Informatique", type: "Business School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Technologie de Rabat", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté des Sciences Juridiques, Économiques et Sociales", type: "Law Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure de l'Électricité et Mécanique", type: "Engineering School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de Traduction et d'Interprétation", type: "Language School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Technologie de Kénitra", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté de Médecine Dentaire de Rabat", type: "Dental School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure de Chimie et Physique", type: "Science School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur des Sciences de l'Information et de la Communication", type: "Communication School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Technologie de Mohammedia", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté des Sciences de l'Éducation", type: "Education Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure de Statistique et d'Économie Appliquée", type: "Economics School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Institut Supérieur de l'Art Dramatique et d'Animation Culturelle", type: "Arts School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Supérieure de Technologie de Casablanca - Rabat Campus", type: "Technology School", city: "Rabat", page: "rabat-dorms.html" },
        { name: "Faculté de Théologie", type: "Theology Faculty", city: "Rabat", page: "rabat-dorms.html" },
        { name: "École Nationale Supérieure de l'Informatique et d'Analyse des Systèmes - Rabat", type: "Engineering School", city: "Rabat", page: "rabat-dorms.html" }
    ],
    marrakech: [
        { name: "Cadi Ayyad University", type: "University", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Université Cadi Ayyad", type: "University", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Nationale Supérieure d'Informatique et d'Analyse des Systèmes", type: "Engineering School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Supérieure de Technologie de Marrakech", type: "Technology School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Faculté des Sciences et Techniques de Marrakech", type: "Science Faculty", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Faculté de Médecine et de Pharmacie de Marrakech", type: "Medical School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Supérieure de Commerce de Marrakech", type: "Business School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Institut Supérieur de Tourisme et d'Hôtellerie", type: "Tourism School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Nationale Supérieure des Arts et Métiers de Marrakech", type: "Arts School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Faculté des Lettres et des Sciences Humaines", type: "Humanities Faculty", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Supérieure de Technologie de Safi", type: "Technology School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Institut Supérieur de Commerce et d'Administration des Entreprises", type: "Business School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Nationale d'Agriculture de Meknès", type: "Agriculture School", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "Faculté de Droit de Marrakech", type: "Law Faculty", city: "Marrakech", page: "marrakech-dorms.html" },
        { name: "École Supérieure de Technologie d'Essaouira", type: "Technology School", city: "Marrakech", page: "marrakech-dorms.html" }
    ],
    fes: [
        { name: "Sidi Mohamed Ben Abdellah University", type: "University", city: "Fes", page: "fes-dorms.html" },
        { name: "Université Sidi Mohamed Ben Abdellah", type: "University", city: "Fes", page: "fes-dorms.html" },
        { name: "École Nationale Supérieure d'Informatique et d'Analyse des Systèmes", type: "Engineering School", city: "Fes", page: "fes-dorms.html" },
        { name: "Faculté des Sciences et Techniques de Fes", type: "Science Faculty", city: "Fes", page: "fes-dorms.html" },
        { name: "Faculté de Médecine et de Pharmacie de Fes", type: "Medical School", city: "Fes", page: "fes-dorms.html" },
        { name: "École Supérieure de Technologie de Fes", type: "Technology School", city: "Fes", page: "fes-dorms.html" },
        { name: "Faculté des Lettres et des Sciences Humaines de Fes", type: "Humanities Faculty", city: "Fes", page: "fes-dorms.html" },
        { name: "Faculté de Droit de Fes", type: "Law Faculty", city: "Fes", page: "fes-dorms.html" },
        { name: "École Supérieure de Commerce de Fes", type: "Business School", city: "Fes", page: "fes-dorms.html" }
    ],
    agadir: [
        { name: "Ibn Zohr University", type: "University", city: "Agadir", page: "agadir-dorms.html" },
        { name: "Université Ibn Zohr", type: "University", city: "Agadir", page: "agadir-dorms.html" },
        { name: "École Nationale Supérieure d'Informatique et d'Analyse des Systèmes", type: "Engineering School", city: "Agadir", page: "agadir-dorms.html" },
        { name: "Faculté des Sciences d'Agadir", type: "Science Faculty", city: "Agadir", page: "agadir-dorms.html" },
        { name: "École Supérieure de Technologie d'Agadir", type: "Technology School", city: "Agadir", page: "agadir-dorms.html" },
        { name: "Faculté des Lettres et des Sciences Humaines d'Agadir", type: "Humanities Faculty", city: "Agadir", page: "agadir-dorms.html" },
        { name: "Institut Supérieur de Tourisme et d'Hôtellerie d'Agadir", type: "Tourism School", city: "Agadir", page: "agadir-dorms.html" },
        { name: "École Supérieure de Commerce d'Agadir", type: "Business School", city: "Agadir", page: "agadir-dorms.html" }
    ]
};

// Search functionality for Universities/Schools
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('schoolSearchInput');
    const dropdown = document.getElementById('schoolSearchDropdown');
    
    if (!input || !dropdown) {
        console.error('Search elements not found!');
        return;
    }

    // Flatten all universities and schools into one array
    const allInstitutions = [];
    Object.values(universitiesAndSchools).forEach(cityInstitutions => {
        allInstitutions.push(...cityInstitutions);
    });

    function renderList(list) {
        if (!list.length) {
            dropdown.innerHTML = '<div class="search-item">No results found</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = list.map(institution => (
            `<div class="search-item" data-name="${institution.name.replace(/"/g, '&quot;')}" data-page="${institution.page}">`+
                `<div class="institution-info">`+
                    `<span class="institution-name">${institution.name}</span>`+
                    `<span class="institution-type">${institution.type}</span>`+
                `</div>`+
                `<span class="institution-city">${institution.city}</span>`+
            `</div>`
        )).join('');
        dropdown.style.display = 'block';
    }

    function filter(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            renderList(allInstitutions.slice(0, 10)); // Show first 10 by default
            return;
        }
        const filtered = allInstitutions.filter(institution =>
            institution.name.toLowerCase().includes(q) || 
            institution.type.toLowerCase().includes(q) ||
            institution.city.toLowerCase().includes(q)
        );
        renderList(filtered.slice(0, 15)); // Limit to 15 results
    }

    // Show initial suggestions
    renderList(allInstitutions.slice(0, 10));

    input.addEventListener('focus', () => {
        dropdown.style.display = 'block';
    });

    input.addEventListener('input', (e) => {
        filter(e.target.value);
    });

    dropdown.addEventListener('click', (e) => {
        const itemEl = e.target.closest('.search-item');
        if (!itemEl) return;
        
        const institutionName = itemEl.getAttribute('data-name');
        const page = itemEl.getAttribute('data-page');
        
        // Update input with selected institution
        input.value = institutionName;
        
        // Special handling for specific dorms
        if (institutionName.includes('Hassan II University')) {
            // Show a modal with dorm options or redirect to a specific dorm
            showDormOptionsModal(institutionName);
        } else if (page) {
            // Redirect to the appropriate city dorms page
            window.location.href = page;
        }
        
        dropdown.style.display = 'none';
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.style.display = 'none';
        }
    });
});

// Function to show dorm options modal
function showDormOptionsModal(universityName) {
    const modalHTML = `
        <div id="dormOptionsModal" class="dorm-options-modal">
            <div class="dorm-options-content">
                <div class="dorm-options-header">
                    <h2>Available Dorms near ${universityName}</h2>
                    <button class="close-options-modal">&times;</button>
                </div>
                <div class="dorm-options-grid">
                    <div class="dorm-option-card" onclick="window.location.href='modern-studio-hassan-ii.html'">
                        <div class="dorm-option-image">
                            <img src="dormart.png" alt="Modern Studio">
                        </div>
                        <div class="dorm-option-info">
                            <h3>Modern Studio</h3>
                            <p class="dorm-option-location">5 min walk to ${universityName}</p>
                            <div class="dorm-option-rating">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <span>4.8/5 (127 reviews)</span>
                            </div>
                            <div class="dorm-option-price">2,200 MAD/month</div>
                        </div>
                    </div>
                    <div class="dorm-option-card" onclick="window.location.href='casablanca-dorms.html'">
                        <div class="dorm-option-image">
                            <img src="cover.png" alt="Student Residence">
                        </div>
                        <div class="dorm-option-info">
                            <h3>Student Residence</h3>
                            <p class="dorm-option-location">10 min walk to ${universityName}</p>
                            <div class="dorm-option-rating">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="far fa-star"></i>
                                <span>4.2/5 (89 reviews)</span>
                            </div>
                            <div class="dorm-option-price">1,800 MAD/month</div>
                        </div>
                    </div>
                    <div class="dorm-option-card" onclick="window.location.href='casablanca-dorms.html'">
                        <div class="dorm-option-image">
                            <img src="cover 2.png" alt="Shared Apartment">
                        </div>
                        <div class="dorm-option-info">
                            <h3>Shared Apartment</h3>
                            <p class="dorm-option-location">7 min walk to ${universityName}</p>
                            <div class="dorm-option-rating">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <span>4.6/5 (156 reviews)</span>
                            </div>
                            <div class="dorm-option-price">1,500 MAD/month</div>
                        </div>
                    </div>
                </div>
                <div class="dorm-options-footer">
                    <button class="btn-secondary" onclick="window.location.href='casablanca-dorms.html'">
                        View All Dorms in Casablanca
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .dorm-options-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .dorm-options-content {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .dorm-options-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }
        
        .dorm-options-header h2 {
            margin: 0;
            color: #1f2937;
        }
        
        .close-options-modal {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
        }
        
        .dorm-options-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .dorm-option-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .dorm-option-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .dorm-option-image {
            height: 150px;
            overflow: hidden;
        }
        
        .dorm-option-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .dorm-option-info {
            padding: 1rem;
        }
        
        .dorm-option-info h3 {
            margin: 0 0 0.5rem 0;
            color: #1f2937;
        }
        
        .dorm-option-location {
            color: #6b7280;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        .dorm-option-rating {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        
        .dorm-option-rating i {
            color: #fbbf24;
        }
        
        .dorm-option-price {
            font-size: 1.1rem;
            font-weight: 600;
            color: #10b981;
        }
        
        .dorm-options-footer {
            text-align: center;
        }
    `;
    document.head.appendChild(style);
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add close functionality
    const modal = document.getElementById('dormOptionsModal');
    const closeBtn = modal.querySelector('.close-options-modal');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Contact dorm function
function contactDorm() {
    alert('Contacting Modern Studio landlord...\n\nPhone: +212 6 12 34 56 78\nEmail: mohamed.alami@email.com\n\nOr click "View Details" to see the full contact information!');
}

// Dorms page: city filter logic
document.addEventListener('DOMContentLoaded', () => {
    // Only run on dorms page
    const cards = Array.from(document.querySelectorAll('.dorm-card[data-city]'));
    if (!cards.length) return;

    const chips = Array.from(document.querySelectorAll('#cityChips .chip'));
    const searchInput = document.getElementById('dormSearchInput');
    const sortSelect = document.getElementById('sortSelect');
    const resultsCount = document.getElementById('resultsCount');

    let activeCity = 'all';
    let query = '';

    function applyFilters() {
        let visible = 0;
        cards.forEach(card => {
            const city = card.getAttribute('data-city');
            const name = card.querySelector('h3').textContent.toLowerCase();
            const matchesCity = activeCity === 'all' || city === activeCity;
            const matchesQuery = !query || name.includes(query);
            const show = matchesCity && matchesQuery;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        resultsCount.textContent = visible === cards.length ? 'Showing all dorms' : `Showing ${visible} dorm${visible===1?'':'s'}`;
        applySort();
    }

    function applySort() {
        const grid = document.querySelector('.dorms-grid');
        if (!grid) return;
        const visibleCards = cards.filter(c => c.style.display !== 'none');
        const getPrice = c => parseFloat(c.getAttribute('data-price') || '0');
        const getRating = c => parseFloat(c.getAttribute('data-rating') || '0');

        let sorted = [...visibleCards];
        switch (sortSelect?.value) {
            case 'rating_desc':
                sorted.sort((a,b) => getRating(b) - getRating(a));
                break;
            case 'price_asc':
                sorted.sort((a,b) => getPrice(a) - getPrice(b));
                break;
            case 'price_desc':
                sorted.sort((a,b) => getPrice(b) - getPrice(a));
                break;
            default:
                // recommended: rating desc then price asc
                sorted.sort((a,b) => (getRating(b) - getRating(a)) || (getPrice(a) - getPrice(b)));
        }

        // Re-append in sorted order
        sorted.forEach(c => grid.appendChild(c));
    }

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCity = chip.getAttribute('data-city');
            applyFilters();
        });
    });

    searchInput?.addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        applyFilters();
    });

    sortSelect?.addEventListener('change', applySort);

    // initial
    applyFilters();

    // Add click functionality to dorm cards
    cards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const dormName = card.querySelector('h3').textContent;
            const city = card.getAttribute('data-city');
            const price = card.querySelector('.price').textContent;
            const reviews = card.querySelector('.reviews').textContent;
            const rating = card.getAttribute('data-rating');
            const image = card.querySelector('img').src;
            const features = Array.from(card.querySelectorAll('.dorm-features span')).map(span => span.textContent);
            
            showDormDetailModal({
                name: dormName,
                location: `Near University in ${city}`,
                price: price,
                reviews: reviews,
                imageSrc: image,
                rating: `${rating}/5`,
                description: `Experience excellent student living at ${dormName} in ${city}. Modern facilities and great community atmosphere.`,
                features: features,
                amenities: ['Kitchen', 'Laundry', '24/7 Support', 'Cleaning Service'],
                rules: ['No Smoking', 'Quiet Hours 11 PM - 7 AM', 'No Pets', 'Guest Policy'],
                nearby: ['University Campus', 'Public Transport', 'Shopping Center', 'Restaurants']
            });
        });
    });
});

// Dorm Detail Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Add click event listeners to all dorm images
    const dormImages = document.querySelectorAll('.dorm-card .dorm-image img');
    dormImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', (e) => {
            e.preventDefault();
            const dormCard = img.closest('.dorm-card');
            const dormName = dormCard.querySelector('h3').textContent;
            const dormLocation = dormCard.querySelector('.location').textContent;
            const dormRating = dormCard.querySelector('.rating-badge span')?.textContent || '4.5/5';
            const dormPrice = dormCard.querySelector('.price')?.textContent || '2,500 MAD/month';
            const dormReviews = dormCard.querySelector('.reviews')?.textContent || '100+ reviews';
            const dormFeatures = Array.from(dormCard.querySelectorAll('.dorm-features span')).map(span => span.textContent);
            
            showDormDetailModal({
                name: dormName,
                location: dormLocation,
                rating: dormRating,
                price: dormPrice,
                reviews: dormReviews,
                features: dormFeatures,
                imageSrc: img.src
            });
        });
    });
});

function showDormDetailModal(dormData) {
    // Create modal HTML
    const modalHTML = `
        <div id="dormDetailModal" class="dorm-detail-modal">
            <div class="dorm-detail-content">
                <div class="dorm-detail-header">
                    <div class="dorm-hero-image">
                        <img src="${dormData.imageSrc}" alt="${dormData.name}">
                        <div class="dorm-hero-overlay">
                            <h1>${dormData.name}</h1>
                            <p>${dormData.location}</p>
                            <div class="dorm-rating">
                                ${generateStars(dormData.rating)}
                                <span class="rating-text">${dormData.rating}</span>
                            </div>
                        </div>
                    </div>
                    <button class="close-dorm-modal">&times;</button>
                </div>
                
                <div class="dorm-detail-body">
                    <div class="dorm-detail-grid">
                        <div class="dorm-reviews-section">
                            <h2>Browse ${dormData.reviews}</h2>
                            <p class="review-info">Reviews with a Verified Student badge were written with a school email.</p>
                            
                            <div class="dorm-review">
                                <div class="review-header">
                                    ${generateStars(dormData.rating)}
                                    <span class="review-date">2 years ago</span>
                                </div>
                                <div class="review-content">
                                    <div class="review-pros">
                                        <h4>Pros:</h4>
                                        <p>big shower, 2 toilets, spacious kitchen, lots of kitchen storage, big common area</p>
                                    </div>
                                    <div class="review-cons">
                                        <h4>Cons:</h4>
                                        <p>Very prisonsque aesthetic</p>
                                    </div>
                                    <div class="review-footer">
                                        <span class="lived-in">Lived in a double</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="dorm-actions-section">
                            <div class="action-buttons">
                                <button class="action-btn primary">
                                    <i class="fas fa-pen"></i>
                                    Write a Review
                                </button>
                                <button class="action-btn">
                                    <i class="fas fa-camera"></i>
                                    Add Photo
                                </button>
                                <button class="action-btn">
                                    <i class="fas fa-comment"></i>
                                    Answer Question
                                </button>
                            </div>
                            
                            <div class="dorm-stats-card">
                                <h3>When students lived here</h3>
                                <div class="year-stats">
                                    <div class="year-stat">
                                        <span class="year-label">Sophomore Year</span>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: 80%"></div>
                                        </div>
                                        <span class="year-count">4</span>
                                    </div>
                                    <div class="year-stat">
                                        <span class="year-label">Junior Year</span>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: 20%"></div>
                                        </div>
                                        <span class="year-count">1</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="dorm-rating-breakdown">
                                <h3>Overall rating breakdown</h3>
                                <div class="rating-categories">
                                    <div class="rating-category">
                                        <span class="category-icon"><i class="fas fa-bed"></i></span>
                                        <span class="category-name">Room</span>
                                        <div class="category-stars">${generateStars('5/5')}</span>
                                    </div>
                                    <div class="rating-category">
                                        <span class="category-icon"><i class="fas fa-building"></i></span>
                                        <span class="category-name">Building</span>
                                        <div class="category-stars">${generateStars('5/5')}</span>
                                    </div>
                                    <div class="rating-category">
                                        <span class="category-icon"><i class="fas fa-map-marker-alt"></i></span>
                                        <span class="category-name">Location</span>
                                        <div class="category-stars">${generateStars('5/5')}</span>
                                    </div>
                                    <div class="rating-category">
                                        <span class="category-icon"><i class="fas fa-bath"></i></span>
                                        <span class="category-name">Bathroom</span>
                                        <div class="category-stars">${generateStars('5/5')}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="dorm-forum">
                                <h3>Housing Forum</h3>
                                <p>Ask questions and get answers from students who lived here.</p>
                                <button class="forum-btn">
                                    <i class="fas fa-plus"></i>
                                    Ask a Question
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = document.getElementById('dormDetailModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close-dorm-modal');
    closeBtn.addEventListener('click', () => {
        closeDormDetailModal();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDormDetailModal();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDormDetailModal();
        }
    });
}

function closeDormDetailModal() {
    const modal = document.getElementById('dormDetailModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

function showCityDormsModal(cityData) {
    // Sample dorm data for each city
    const cityDorms = {
        0: [ // Casablanca
            { name: "Bayt Al Maârifa Casablanca", price: "2,200 MAD/month", rating: "4.8", reviews: "156", features: ["WiFi", "Security", "Study Room"], image: "BAYT CASA .PNG" },
            { name: "Student Residence Casa", price: "1,800 MAD/month", rating: "4.6", reviews: "89", features: ["WiFi", "Kitchen", "Laundry"], image: "dormart.png" },
            { name: "Casa University Dorms", price: "2,500 MAD/month", rating: "4.9", reviews: "203", features: ["WiFi", "Gym", "Pool"], image: "cover.png" }
        ],
        1: [ // Rabat
            { name: "Bayt Al Maârifa Rabat", price: "2,000 MAD/month", rating: "4.7", reviews: "134", features: ["WiFi", "Security", "Library"], image: "bayt al maârifa rabat.PNG" },
            { name: "Rabat Student Center", price: "1,900 MAD/month", rating: "4.5", reviews: "98", features: ["WiFi", "Kitchen", "Common Area"], image: "dormart.png" },
            { name: "Capital City Dorms", price: "2,300 MAD/month", rating: "4.8", reviews: "167", features: ["WiFi", "Gym", "Study Rooms"], image: "cover 2.png" }
        ],
        2: [ // Marrakech
            { name: "Daoudiate Residence", price: "1,700 MAD/month", rating: "4.6", reviews: "112", features: ["WiFi", "Garden", "Kitchen"], image: "daoudiate.png" },
            { name: "Red City Dorms", price: "2,100 MAD/month", rating: "4.7", reviews: "145", features: ["WiFi", "Pool", "Security"], image: "cover 3.png" },
            { name: "Marrakech Student Hub", price: "1,950 MAD/month", rating: "4.5", reviews: "87", features: ["WiFi", "Laundry", "Study Room"], image: "dormart.png" }
        ],
        3: [ // Fes
            { name: "Fes University Dorms", price: "1,600 MAD/month", rating: "4.4", reviews: "76", features: ["WiFi", "Library", "Kitchen"], image: "Universite fes.png" },
            { name: "Medina Student House", price: "1,800 MAD/month", rating: "4.6", reviews: "103", features: ["WiFi", "Garden", "Common Area"], image: "dormart.png" },
            { name: "Fes Student Residence", price: "2,000 MAD/month", rating: "4.7", reviews: "128", features: ["WiFi", "Gym", "Study Rooms"], image: "cover.png" }
        ]
    };

    const dorms = cityDorms[cityData.cityIndex] || cityDorms[0];
    
    // Create modal HTML
    const modalHTML = `
        <div id="cityDormsModal" class="city-dorms-modal">
            <div class="city-dorms-content">
                <div class="city-dorms-header">
                    <div class="city-hero">
                        <img src="${cityData.cityImage}" alt="${cityData.cityName}">
                        <div class="city-hero-overlay">
                            <h1>Popular Dorms in ${cityData.cityName}</h1>
                            <p>Discover the best student housing options</p>
                        </div>
                    </div>
                    <button class="close-city-modal">&times;</button>
                </div>
                
                <div class="city-dorms-body">
                    <div class="dorms-grid">
                        ${dorms.map(dorm => `
                            <div class="city-dorm-card" onclick="showDormDetailModal({
                                name: '${dorm.name}',
                                location: 'Near University in ${cityData.cityName}',
                                price: '${dorm.price}',
                                reviews: '${dorm.reviews} reviews',
                                image: '${dorm.image}',
                                rating: '${dorm.rating}/5',
                                description: 'Experience excellent student living at ${dorm.name} in ${cityData.cityName}. Modern facilities and great community atmosphere.',
                                features: ${JSON.stringify(dorm.features)},
                                amenities: ['Kitchen', 'Laundry', '24/7 Support', 'Cleaning Service'],
                                rules: ['No Smoking', 'Quiet Hours 11 PM - 7 AM', 'No Pets', 'Guest Policy'],
                                nearby: ['University Campus', 'Public Transport', 'Shopping Center', 'Restaurants']
                            })">
                                <div class="city-dorm-image">
                                    <img src="${dorm.image}" alt="${dorm.name}">
                                    <div class="city-dorm-rating">
                                        <i class="fas fa-star"></i>
                                        ${dorm.rating}
                                    </div>
                                </div>
                                <div class="city-dorm-info">
                                    <h3>${dorm.name}</h3>
                                    <div class="city-dorm-location">
                                        <i class="fas fa-map-marker-alt"></i>
                                        Near University in ${cityData.cityName}
                                    </div>
                                    <div class="city-dorm-features">
                                        ${dorm.features.map(feature => `<span>${feature}</span>`).join('')}
                                    </div>
                                    <div class="city-dorm-price">
                                        <span class="price">${dorm.price}</span>
                                        <span class="reviews">${dorm.reviews} reviews</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = document.getElementById('cityDormsModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close-city-modal');
    closeBtn.addEventListener('click', () => {
        closeCityDormsModal();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCityDormsModal();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCityDormsModal();
        }
    });
}

function closeCityDormsModal() {
    const modal = document.getElementById('cityDormsModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

function generateStars(rating) {
    const ratingValue = parseFloat(rating.split('/')[0]);
    const maxRating = 5;
    let starsHTML = '';
    
    for (let i = 1; i <= maxRating; i++) {
        if (i <= ratingValue) {
            starsHTML += '<i class="fas fa-star star-filled"></i>';
        } else if (i - ratingValue < 1) {
            starsHTML += '<i class="fas fa-star-half-alt star-half"></i>';
        } else {
            starsHTML += '<i class="far fa-star star-empty"></i>';
        }
    }
    
    return starsHTML;
}

// Carousel functionality for Highest Rated Dorms
document.addEventListener('DOMContentLoaded', () => {
    const carouselTrack = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (carouselTrack && prevBtn && nextBtn) {
        let currentIndex = 0;
        const items = carouselTrack.querySelectorAll('.carousel-item');
        const totalItems = items.length;
        const itemsToShow = 3; // Show 3 items at once
        const maxIndex = Math.max(0, totalItems - itemsToShow);
        
        function updateCarousel() {
            const translateX = -currentIndex * (320 + 25); // 320px width + 25px gap
            carouselTrack.style.transform = `translateX(${translateX}px)`;
            
            // Update button states
            prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
            prevBtn.style.cursor = currentIndex === 0 ? 'not-allowed' : 'pointer';
            
            nextBtn.style.opacity = currentIndex >= maxIndex ? '0.5' : '1';
            nextBtn.style.cursor = currentIndex >= maxIndex ? 'not-allowed' : 'pointer';
        }
        
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                updateCarousel();
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (currentIndex < maxIndex) {
                currentIndex++;
                updateCarousel();
            }
        });
        
        // Auto-advance carousel
        setInterval(() => {
            if (currentIndex >= maxIndex) {
                currentIndex = 0;
            } else {
                currentIndex++;
            }
            updateCarousel();
        }, 5000);
        
        // Initialize carousel
        updateCarousel();
        
        // Touch/swipe support
        let startX = 0;
        let endX = 0;
        
        carouselTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        carouselTrack.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) { // Minimum swipe distance
                if (diff > 0 && currentIndex < maxIndex) {
                    currentIndex++;
                } else if (diff < 0 && currentIndex > 0) {
                    currentIndex--;
                }
                updateCarousel();
            }
        });
    }
});

// Add click event listeners for Popular Dorms section (city cards)
document.addEventListener('DOMContentLoaded', () => {
    // Popular Dorms section (city cards)
    const popularDormCards = document.querySelectorAll('.top-cities .city-card');
    popularDormCards.forEach((card, index) => {
        // Add cursor pointer style
        card.style.cursor = 'pointer';
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.transition = 'transform 0.3s ease';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
        
        card.addEventListener('click', () => {
            const cityName = card.querySelector('h3').textContent;
            const cityImage = card.querySelector('img').src;
            
            // Special handling for Casablanca, Marrakech, and Rabat - redirect to dedicated pages
            if (cityName === 'Casablanca') {
                window.location.href = 'Casablanca Dorms.html';
                return;
            }
            
            if (cityName === 'Marrakech') {
                window.location.href = 'Marrakech Dorms.html';
                return;
            }
            
            if (cityName === 'Rabat') {
                window.location.href = 'Rabat Dorms.html';
                return;
            }
            
            showCityDormsModal({
                cityName: cityName,
                cityImage: cityImage,
                cityIndex: index
            });
        });
    });

    // Highest Rated Dorms section
    const topRatedDormImages = document.querySelectorAll('.top-dorms .dorm-image img');
    topRatedDormImages.forEach((img, index) => {
        img.addEventListener('click', () => {
            const dormCard = img.closest('.dorm-card');
            const dormName = dormCard.querySelector('h3').textContent;
            const location = dormCard.querySelector('.location').textContent.replace(/^\s*📍\s*/, '');
            const price = dormCard.querySelector('.price').textContent;
            const reviews = dormCard.querySelector('.reviews').textContent;
            const ratingBadge = dormCard.querySelector('.rating-badge span');
            const rating = ratingBadge ? ratingBadge.textContent : '4.5/5';
            
            showDormDetailModal({
                name: dormName,
                location: location,
                price: price,
                reviews: reviews,
                image: img.src,
                rating: rating,
                description: `Discover excellence at ${dormName}, one of our highest-rated student accommodations. Premium facilities and exceptional service await you.`,
                features: ['WiFi', 'Meals', 'Security', 'Premium Amenities', 'Study Spaces'],
                amenities: ['Kitchen', 'Laundry', '24/7 Support', 'Cleaning Service', 'Maintenance'],
                rules: ['No Smoking', 'Quiet Hours 11 PM - 7 AM', 'No Pets', 'Guest Policy', 'Cleanliness Standards'],
                nearby: ['University Campus', 'Public Transport', 'Shopping Center', 'Restaurants', 'Parks']
            });
        });
    });
});

// For Students Section Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to city preview cards (now links)
    const cityPreviewCards = document.querySelectorAll('.city-preview-card');
    
    cityPreviewCards.forEach(card => {
        // Add click animation
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.style.cursor = 'pointer';
        });
    });
    
    // Add smooth scroll animation for For Students section
    const forStudentsSection = document.querySelector('.for-students-section');
    if (forStudentsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1
        });
        
        // Set initial state
        forStudentsSection.style.opacity = '0';
        forStudentsSection.style.transform = 'translateY(30px)';
        forStudentsSection.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        observer.observe(forStudentsSection);
    }
    
    // Animate feature items on scroll
    const featureItems = document.querySelectorAll('.feature-item');
    if (featureItems.length > 0) {
        const featureObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * 100);
                }
            });
        }, {
            threshold: 0.1
        });
        
        featureItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            featureObserver.observe(item);
        });
    }
});