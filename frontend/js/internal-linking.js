/**
 * Internal Linking Component for SEO
 * Adds contextual internal links to boost SEO and user navigation
 */

class InternalLinker {
    constructor(options = {}) {
        this.apiBase = options.apiBase || '/api';
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Render related dorms widget
     */
    async renderRelatedDorms(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { city, university, limit = 4, exclude = null } = options;

        try {
            let dorms = await this.fetchRelatedDorms({ city, university, limit, exclude });
            
            container.innerHTML = `
                <div class="internal-links-widget">
                    <h3 class="widget-title">
                        <i class="fas fa-building"></i>
                        ${options.title || 'Similar Housing Options'}
                    </h3>
                    <div class="dorm-links-grid">
                        ${dorms.map(dorm => this.renderDormLink(dorm)).join('')}
                    </div>
                    ${city ? `
                        <a href="/city/${city}-student-housing" class="view-all-link">
                            View all housing in ${this.formatCityName(city)} →
                        </a>
                    ` : ''}
                </div>
            `;
        } catch (error) {
            console.error('Error rendering related dorms:', error);
            container.innerHTML = '';
        }
    }

    renderDormLink(dorm) {
        return `
            <a href="/dorm/${dorm.slug}" class="dorm-link-card">
                <img src="${dorm.images?.[0]?.url || 'images/placeholder-dorm.jpg'}" 
                     alt="${this.escapeHtml(dorm.name)}" 
                     loading="lazy"
                     class="dorm-link-image">
                <div class="dorm-link-info">
                    <div class="dorm-link-name">${this.escapeHtml(dorm.name)}</div>
                    <div class="dorm-link-meta">
                        <span class="dorm-link-price">${this.formatPrice(dorm.price)} MAD/mo</span>
                        <span class="dorm-link-rating">
                            <i class="fas fa-star"></i> ${(dorm.averageRating || 0).toFixed(1)}
                        </span>
                    </div>
                </div>
            </a>
        `;
    }

    async fetchRelatedDorms(params) {
        const cacheKey = JSON.stringify(params);
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheExpiry) {
                return cached.data;
            }
        }

        const queryParams = new URLSearchParams();
        if (params.city) queryParams.append('city', params.city);
        if (params.university) queryParams.append('university', params.university);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.exclude) queryParams.append('exclude', params.exclude);

        try {
            const response = await fetch(`${this.apiBase}/dorms?${queryParams}`);
            const data = await response.json();
            
            if (data.success) {
                this.cache.set(cacheKey, { data: data.data.dorms, time: Date.now() });
                return data.data.dorms;
            }
        } catch (error) {
            console.error('Error fetching related dorms:', error);
        }
        
        return [];
    }

    /**
     * Render city links widget
     */
    renderCityLinks(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const cities = options.cities || [
            { name: 'Casablanca', slug: 'casablanca', count: 156 },
            { name: 'Rabat', slug: 'rabat', count: 89 },
            { name: 'Marrakech', slug: 'marrakech', count: 67 },
            { name: 'Fes', slug: 'fes', count: 45 },
            { name: 'Tangier', slug: 'tangier', count: 38 },
            { name: 'Agadir', slug: 'agadir', count: 29 }
        ];

        const excludeCurrent = options.excludeCurrent || null;
        const filteredCities = excludeCurrent 
            ? cities.filter(c => c.slug !== excludeCurrent)
            : cities;

        container.innerHTML = `
            <div class="city-links-widget">
                <h3 class="widget-title">
                    <i class="fas fa-city"></i>
                    ${options.title || 'Explore Other Cities'}
                </h3>
                <div class="city-links-grid">
                    ${filteredCities.map(city => `
                        <a href="/city/${city.slug}-student-housing" class="city-link-item">
                            <span class="city-link-name">${city.name}</span>
                            <span class="city-link-count">${city.count} listings</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render university links widget
     */
    async renderUniversityLinks(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const universities = options.universities || await this.fetchUniversities(options.city);

        container.innerHTML = `
            <div class="university-links-widget">
                <h3 class="widget-title">
                    <i class="fas fa-graduation-cap"></i>
                    ${options.title || 'Housing by University'}
                </h3>
                <div class="university-links-list">
                    ${universities.map(uni => `
                        <a href="/university/${uni.slug}-dorms" class="university-link-item">
                            <div class="university-link-icon">
                                <i class="fas fa-university"></i>
                            </div>
                            <div class="university-link-info">
                                <span class="university-link-name">${this.escapeHtml(uni.name)}</span>
                                <span class="university-link-count">${uni.dormCount || 0} housing options</span>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async fetchUniversities(city) {
        try {
            const url = city 
                ? `${this.apiBase}/universities?city=${city}` 
                : `${this.apiBase}/universities`;
            const response = await fetch(url);
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error fetching universities:', error);
            return [];
        }
    }

    /**
     * Render breadcrumb navigation
     */
    renderBreadcrumb(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const breadcrumbItems = items.map((item, index) => {
            const isLast = index === items.length - 1;
            if (isLast) {
                return `<span class="breadcrumb-current">${this.escapeHtml(item.label)}</span>`;
            }
            return `<a href="${item.url}" class="breadcrumb-link">${this.escapeHtml(item.label)}</a>`;
        });

        container.innerHTML = `
            <nav class="breadcrumb-nav" aria-label="Breadcrumb">
                <ol class="breadcrumb-list" itemscope itemtype="https://schema.org/BreadcrumbList">
                    ${items.map((item, index) => `
                        <li class="breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            ${index === items.length - 1 
                                ? `<span itemprop="name">${this.escapeHtml(item.label)}</span>`
                                : `<a href="${item.url}" itemprop="item"><span itemprop="name">${this.escapeHtml(item.label)}</span></a>`
                            }
                            <meta itemprop="position" content="${index + 1}">
                        </li>
                    `).join('<li class="breadcrumb-separator">/</li>')}
                </ol>
            </nav>
        `;
    }

    /**
     * Render blog related articles
     */
    async renderRelatedArticles(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { category, tags, limit = 3, exclude = null } = options;

        try {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            if (tags) params.append('tags', tags.join(','));
            params.append('limit', limit);
            if (exclude) params.append('exclude', exclude);

            const response = await fetch(`${this.apiBase}/blog?${params}`);
            const data = await response.json();

            if (data.success && data.data.posts.length > 0) {
                container.innerHTML = `
                    <div class="related-articles-widget">
                        <h3 class="widget-title">
                            <i class="fas fa-newspaper"></i>
                            ${options.title || 'Related Articles'}
                        </h3>
                        <div class="related-articles-list">
                            ${data.data.posts.map(post => `
                                <a href="/blog/${post.slug}" class="related-article-item">
                                    <img src="${post.featuredImage || 'images/blog-placeholder.jpg'}" 
                                         alt="${this.escapeHtml(post.title)}"
                                         class="related-article-image"
                                         loading="lazy">
                                    <div class="related-article-info">
                                        <span class="related-article-category">${post.category}</span>
                                        <span class="related-article-title">${this.escapeHtml(post.title)}</span>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                        <a href="/blog" class="view-all-link">View all articles →</a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching related articles:', error);
        }
    }

    /**
     * Auto-link keywords in text content
     */
    autoLinkContent(containerId, linkMap) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = container.innerHTML;
        
        // Sort by length to replace longer phrases first
        const sortedLinks = Object.entries(linkMap).sort((a, b) => b[0].length - a[0].length);
        
        for (const [keyword, url] of sortedLinks) {
            // Only replace first occurrence and not in links
            const regex = new RegExp(`(?<!<[^>]*)\\b(${this.escapeRegex(keyword)})\\b(?![^<]*>)`, 'i');
            html = html.replace(regex, `<a href="${url}" class="auto-link">$1</a>`);
        }

        container.innerHTML = html;
    }

    /**
     * Render footer navigation links
     */
    renderFooterLinks(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const sections = options.sections || [
            {
                title: 'Popular Cities',
                links: [
                    { label: 'Casablanca Housing', url: '/city/casablanca-dorms.html' },
                    { label: 'Rabat Housing', url: '/city/rabat-dorms.html' },
                    { label: 'Marrakech Housing', url: '/city/marrakech-dorms.html' }
                ]
            },
            {
                title: 'Top Universities',
                links: [
                    { label: 'Mohammed V University', url: '/university/mohammed-v-dorms.html' },
                    { label: 'Hassan II University', url: '/university/maarouf.html.html' },
                    { label: 'Cadi Ayyad University', url: '/university/Fadl.html' },
                    { label: 'UIR', url: '/Rabat ocean.html' }
                ]
            },
            {
                title: 'Resources',
                links: [
                    { label: 'Student Housing Guide', url: '/blog/student-housing-guide' },
                    { label: 'Find a Roommate', url: '/find-roommate-profile.html' },
                    { label: 'How to Review', url: '/blog/how-to-write-review' },
                    { label: 'Safety Tips', url: '/blog/student-safety-tips' }
                ]
            },
            {
                title: 'Company',
                links: [
                    { label: 'About Us', url: '/about.html' },
                    { label: 'Contact', url: '/contact.html' },
                    { label: 'Privacy Policy', url: '/privacy.html' },
                    { label: 'Terms of Service', url: '/terms.html' }
                ]
            }
        ];

        container.innerHTML = `
            <div class="footer-links-grid">
                ${sections.map(section => `
                    <div class="footer-links-section">
                        <h4>${section.title}</h4>
                        <ul>
                            ${section.links.map(link => `
                                <li><a href="${link.url}">${link.label}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Utility methods
    formatPrice(price) {
        return new Intl.NumberFormat('fr-MA').format(price || 0);
    }

    formatCityName(slug) {
        return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// CSS Styles for internal linking widgets
const internalLinkStyles = `
<style>
    /* Widget Base Styles */
    .internal-links-widget,
    .city-links-widget,
    .university-links-widget,
    .related-articles-widget {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        margin-bottom: 24px;
    }

    .widget-title {
        font-size: 1.125rem;
        color: #1f2937;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .widget-title i {
        color: #667eea;
    }

    /* Dorm Links Grid */
    .dorm-links-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 16px;
    }

    .dorm-link-card {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.2s;
    }

    .dorm-link-card:hover {
        background: #f3f4f6;
        transform: translateY(-2px);
    }

    .dorm-link-image {
        width: 60px;
        height: 60px;
        border-radius: 6px;
        object-fit: cover;
    }

    .dorm-link-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .dorm-link-name {
        font-weight: 600;
        font-size: 0.875rem;
        color: #374151;
        margin-bottom: 4px;
    }

    .dorm-link-meta {
        display: flex;
        gap: 12px;
        font-size: 0.75rem;
        color: #6b7280;
    }

    .dorm-link-rating i {
        color: #f59e0b;
    }

    /* City Links Grid */
    .city-links-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .city-link-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.2s;
    }

    .city-link-item:hover {
        background: #667eea;
        color: white;
    }

    .city-link-name {
        font-weight: 500;
        color: inherit;
    }

    .city-link-count {
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .city-link-item:hover .city-link-count {
        color: rgba(255,255,255,0.8);
    }

    /* University Links */
    .university-links-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .university-link-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.2s;
    }

    .university-link-item:hover {
        background: #f3f4f6;
    }

    .university-link-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .university-link-info {
        flex: 1;
    }

    .university-link-name {
        display: block;
        font-weight: 600;
        color: #374151;
        font-size: 0.875rem;
    }

    .university-link-count {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .university-link-item .fa-chevron-right {
        color: #9ca3af;
    }

    /* Related Articles */
    .related-articles-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
    }

    .related-article-item {
        display: flex;
        gap: 12px;
        text-decoration: none;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s;
    }

    .related-article-item:hover {
        background: #f9fafb;
    }

    .related-article-image {
        width: 80px;
        height: 60px;
        border-radius: 6px;
        object-fit: cover;
    }

    .related-article-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .related-article-category {
        font-size: 0.7rem;
        color: #667eea;
        text-transform: uppercase;
        font-weight: 600;
        margin-bottom: 4px;
    }

    .related-article-title {
        font-size: 0.875rem;
        color: #374151;
        line-height: 1.4;
    }

    /* View All Link */
    .view-all-link {
        display: inline-block;
        color: #667eea;
        font-weight: 500;
        text-decoration: none;
        font-size: 0.875rem;
    }

    .view-all-link:hover {
        text-decoration: underline;
    }

    /* Breadcrumb */
    .breadcrumb-nav {
        margin-bottom: 24px;
    }

    .breadcrumb-list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .breadcrumb-item a {
        color: #6b7280;
        text-decoration: none;
        font-size: 0.875rem;
    }

    .breadcrumb-item a:hover {
        color: #667eea;
    }

    .breadcrumb-item span {
        color: #374151;
        font-size: 0.875rem;
    }

    .breadcrumb-separator {
        color: #d1d5db;
        font-size: 0.75rem;
    }

    /* Auto Links */
    .auto-link {
        color: #667eea;
        text-decoration: none;
        border-bottom: 1px dashed #667eea;
    }

    .auto-link:hover {
        border-bottom-style: solid;
    }

    /* Footer Links */
    .footer-links-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 32px;
    }

    .footer-links-section h4 {
        color: #374151;
        font-size: 1rem;
        margin-bottom: 16px;
    }

    .footer-links-section ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .footer-links-section li {
        margin-bottom: 8px;
    }

    .footer-links-section a {
        color: #6b7280;
        text-decoration: none;
        font-size: 0.875rem;
        transition: color 0.2s;
    }

    .footer-links-section a:hover {
        color: #667eea;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .dorm-links-grid,
        .city-links-grid {
            grid-template-columns: 1fr;
        }

        .footer-links-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 480px) {
        .footer-links-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
`;

// Inject styles
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', internalLinkStyles);
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.InternalLinker = InternalLinker;
    window.internalLinker = new InternalLinker();
}
