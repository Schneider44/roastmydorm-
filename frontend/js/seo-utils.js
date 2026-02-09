/**
 * Frontend SEO Utilities for RoastMyDorm
 * Client-side helpers for SEO optimization
 */

// Configuration
const SEO_CONFIG = {
  siteName: 'RoastMyDorm',
  siteUrl: 'https://www.roastmydorm.com',
  defaultImage: '/images/og-default.jpg',
  twitterHandle: '@roastmydorm',
  locale: 'en_US'
};

/**
 * Update page meta tags dynamically
 */
function updateMetaTags(options) {
  const {
    title,
    description,
    canonicalUrl,
    ogImage,
    ogType = 'website',
    keywords,
    noindex = false
  } = options;

  // Update title
  document.title = title ? `${title} | ${SEO_CONFIG.siteName}` : SEO_CONFIG.siteName;

  // Update or create meta tags
  updateOrCreateMeta('description', description);
  updateOrCreateMeta('keywords', keywords);
  
  // Open Graph tags
  updateOrCreateMeta('og:title', title, 'property');
  updateOrCreateMeta('og:description', description, 'property');
  updateOrCreateMeta('og:url', canonicalUrl || window.location.href, 'property');
  updateOrCreateMeta('og:image', ogImage || SEO_CONFIG.defaultImage, 'property');
  updateOrCreateMeta('og:type', ogType, 'property');
  updateOrCreateMeta('og:site_name', SEO_CONFIG.siteName, 'property');
  updateOrCreateMeta('og:locale', SEO_CONFIG.locale, 'property');

  // Twitter Card tags
  updateOrCreateMeta('twitter:card', 'summary_large_image', 'name');
  updateOrCreateMeta('twitter:title', title, 'name');
  updateOrCreateMeta('twitter:description', description, 'name');
  updateOrCreateMeta('twitter:image', ogImage || SEO_CONFIG.defaultImage, 'name');
  updateOrCreateMeta('twitter:site', SEO_CONFIG.twitterHandle, 'name');

  // Canonical URL
  updateOrCreateLink('canonical', canonicalUrl || window.location.href);

  // Robots meta
  if (noindex) {
    updateOrCreateMeta('robots', 'noindex, nofollow');
  } else {
    updateOrCreateMeta('robots', 'index, follow');
  }
}

/**
 * Update or create a meta tag
 */
function updateOrCreateMeta(name, content, attribute = 'name') {
  if (!content) return;

  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

/**
 * Update or create a link tag
 */
function updateOrCreateLink(rel, href) {
  if (!href) return;

  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Add JSON-LD structured data to the page
 */
function addStructuredData(data) {
  // Remove existing structured data with same type
  const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
  existingScripts.forEach(script => {
    try {
      const existingData = JSON.parse(script.textContent);
      if (existingData['@type'] === data['@type']) {
        script.remove();
      }
    } catch (e) {}
  });

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Generate breadcrumb structured data
 */
function generateBreadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SEO_CONFIG.siteUrl}${item.url}`
    }))
  };
}

/**
 * Generate organization structured data
 */
function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RoastMyDorm',
    url: SEO_CONFIG.siteUrl,
    logo: `${SEO_CONFIG.siteUrl}/images/logo.png`,
    sameAs: [
      'https://twitter.com/roastmydorm',
      'https://facebook.com/roastmydorm',
      'https://instagram.com/roastmydorm'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@roastmydorm.com',
      contactType: 'customer service'
    }
  };
}

/**
 * Initialize lazy loading for images
 */
function initLazyLoading() {
  const lazyImages = document.querySelectorAll('img.lazyload');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
          }
          img.classList.remove('lazyload');
          img.classList.add('lazyloaded');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    lazyImages.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
      img.classList.remove('lazyload');
      img.classList.add('lazyloaded');
    });
  }
}

/**
 * Track page view for analytics
 */
function trackPageView(pagePath, pageTitle) {
  if (window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: pagePath || window.location.pathname,
      page_title: pageTitle || document.title
    });
  }
}

/**
 * Generate slug from text
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

/**
 * Format price for display
 */
function formatPrice(amount, currency = 'MAD') {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Calculate time ago
 */
function timeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Render star rating HTML
 */
function renderStarRating(rating, maxRating = 5) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);
  
  let html = '';
  for (let i = 0; i < fullStars; i++) {
    html += '<i class="fas fa-star text-yellow-400"></i>';
  }
  if (hasHalfStar) {
    html += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
  }
  for (let i = 0; i < emptyStars; i++) {
    html += '<i class="far fa-star text-gray-300"></i>';
  }
  return html;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initLazyLoading();
  addStructuredData(generateOrganizationSchema());
});

// Export functions for use in other scripts
window.SEO = {
  updateMetaTags,
  addStructuredData,
  generateBreadcrumbs,
  initLazyLoading,
  trackPageView,
  generateSlug,
  formatPrice,
  formatDate,
  timeAgo,
  renderStarRating
};
