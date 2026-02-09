/**
 * SEO Utilities for RoastMyDorm
 * Handles slug generation, metadata, structured data, and sitemap generation
 */

/**
 * Generate SEO-friendly slug from text
 */
const generateSlug = (text) => {
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
};

/**
 * Generate dorm page slug
 */
const generateDormSlug = (dormName, city) => {
  const baseSlug = generateSlug(dormName);
  const citySlug = generateSlug(city);
  return `${baseSlug}-${citySlug}`;
};

/**
 * Generate city page slug
 */
const generateCitySlug = (cityName) => {
  return `${generateSlug(cityName)}-student-housing`;
};

/**
 * Generate university page slug
 */
const generateUniversitySlug = (universityName) => {
  return `${generateSlug(universityName)}-dorms`;
};

/**
 * Generate meta title for dorm page
 */
const generateDormMetaTitle = (dormName, city) => {
  return `${dormName} | Student Dorm in ${city} - RoastMyDorm`;
};

/**
 * Generate meta description for dorm page
 */
const generateDormMetaDescription = (dormName, city, rating, reviewCount) => {
  const ratingText = rating ? `Rated ${rating}/5` : '';
  const reviewText = reviewCount ? `with ${reviewCount} reviews` : '';
  return `${ratingText} ${reviewText}. Reviews, pricing, photos, and amenities of ${dormName} student housing in ${city}. Find your perfect student accommodation.`.trim();
};

/**
 * Generate meta title for city page
 */
const generateCityMetaTitle = (cityName) => {
  return `Student Housing in ${cityName} | Best Dorms , Studio & Apartments - RoastMyDorm`;
};

/**
 * Generate meta description for city page
 */
const generateCityMetaDescription = (cityName, dormCount) => {
  return `Discover ${dormCount || 'the best'} student dorms , studio and apartments in ${cityName}. Compare prices, read reviews, and find your perfect student accommodation near universities.`;
};

/**
 * Generate meta title for university page
 */
const generateUniversityMetaTitle = (universityName) => {
  return `Dorms Near ${universityName} | Student Housing & Reviews - RoastMyDorm`;
};

/**
 * Generate meta description for university page
 */
const generateUniversityMetaDescription = (universityName, dormCount) => {
  return `Find ${dormCount || 'the best'} student dorms near ${universityName}. Compare housing options, read honest reviews, and book your accommodation.`;
};

/**
 * Generate Open Graph metadata
 */
const generateOpenGraphMeta = (options) => {
  const {
    title,
    description,
    url,
    image,
    type = 'website',
    siteName = 'RoastMyDorm'
  } = options;

  return {
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'og:image': image || 'https://www.roastmydorm.com/images/og-default.jpg',
    'og:type': type,
    'og:site_name': siteName,
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image || 'https://www.roastmydorm.com/images/og-default.jpg'
  };
};

/**
 * Generate JSON-LD structured data for a dorm
 */
const generateDormSchema = (dorm) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: dorm.name,
    description: dorm.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: dorm.location?.address?.street,
      addressLocality: dorm.location?.address?.city,
      postalCode: dorm.location?.address?.postalCode,
      addressCountry: dorm.location?.address?.country || 'Morocco'
    },
    geo: dorm.location?.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: dorm.location.coordinates.latitude,
      longitude: dorm.location.coordinates.longitude
    } : undefined,
    image: dorm.images?.map(img => img.url) || [],
    priceRange: dorm.pricing ? `${dorm.pricing.baseRent} ${dorm.pricing.currency}/month` : undefined,
    amenityFeature: [
      ...(dorm.amenities?.basic || []).map(a => ({ '@type': 'LocationFeatureSpecification', name: a })),
      ...(dorm.amenities?.common || []).map(a => ({ '@type': 'LocationFeatureSpecification', name: a }))
    ]
  };

  // Add aggregate rating if available
  if (dorm.averageRating && dorm.totalReviews) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: dorm.averageRating,
      reviewCount: dorm.totalReviews,
      bestRating: 5,
      worstRating: 1
    };
  }

  return schema;
};

/**
 * Generate JSON-LD structured data for a review
 */
const generateReviewSchema = (review, dorm) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'ApartmentComplex',
      name: dorm.name
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.overallRating,
      bestRating: 5,
      worstRating: 1
    },
    author: {
      '@type': 'Person',
      name: review.user?.fullName || 'Anonymous'
    },
    datePublished: review.createdAt,
    reviewBody: review.content
  };
};

/**
 * Generate JSON-LD breadcrumb schema
 */
const generateBreadcrumbSchema = (items) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
};

/**
 * Generate JSON-LD blog post schema
 */
const generateBlogPostSchema = (post, author) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.featuredImage?.url,
    author: {
      '@type': 'Person',
      name: author?.fullName || 'RoastMyDorm Team'
    },
    publisher: {
      '@type': 'Organization',
      name: 'RoastMyDorm',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.roastmydorm.com/images/logo.png'
      }
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.roastmydorm.com/blog/${post.slug}`
    }
  };
};

/**
 * Generate JSON-LD FAQ schema for Q&A
 */
const generateFAQSchema = (questions) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.title,
      acceptedAnswer: q.answers && q.answers.length > 0 ? {
        '@type': 'Answer',
        text: q.answers[0].content
      } : undefined
    })).filter(q => q.acceptedAnswer)
  };
};

/**
 * Generate sitemap XML entries
 */
const generateSitemapEntry = (url, options = {}) => {
  const {
    lastmod = new Date().toISOString(),
    changefreq = 'weekly',
    priority = 0.5
  } = options;

  return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

/**
 * Generate full sitemap XML
 */
const generateSitemap = async (baseUrl, data) => {
  const { dorms = [], cities = [], universities = [], blogPosts = [] } = data;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static pages
  const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/how-it-works', priority: 0.8, changefreq: 'monthly' },
    { url: '/for-students', priority: 0.8, changefreq: 'monthly' },
    { url: '/find-roommate', priority: 0.8, changefreq: 'weekly' },
    { url: '/blog', priority: 0.8, changefreq: 'daily' }
  ];

  for (const page of staticPages) {
    xml += generateSitemapEntry(`${baseUrl}${page.url}`, page);
  }

  // Dorm pages
  for (const dorm of dorms) {
    const slug = dorm.slug || generateDormSlug(dorm.name, dorm.location?.address?.city);
    xml += generateSitemapEntry(`${baseUrl}/dorm/${slug}`, {
      lastmod: dorm.updatedAt,
      priority: 0.9,
      changefreq: 'weekly'
    });
  }

  // City pages
  for (const city of cities) {
    const slug = generateCitySlug(city);
    xml += generateSitemapEntry(`${baseUrl}/city/${slug}`, {
      priority: 0.8,
      changefreq: 'weekly'
    });
  }

  // University pages
  for (const university of universities) {
    const slug = generateUniversitySlug(university);
    xml += generateSitemapEntry(`${baseUrl}/university/${slug}`, {
      priority: 0.8,
      changefreq: 'weekly'
    });
  }

  // Blog posts
  for (const post of blogPosts) {
    xml += generateSitemapEntry(`${baseUrl}/blog/${post.slug}`, {
      lastmod: post.updatedAt,
      priority: 0.7,
      changefreq: 'monthly'
    });
  }

  xml += '\n</urlset>';
  return xml;
};

/**
 * Generate robots.txt content
 */
const generateRobotsTxt = (baseUrl) => {
  return `# Robots.txt for RoastMyDorm
User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for respectful crawling
Crawl-delay: 1
`;
};

/**
 * Calculate keyword density
 */
const calculateKeywordDensity = (content, keyword) => {
  const words = content.toLowerCase().split(/\s+/);
  const keywordLower = keyword.toLowerCase();
  const count = words.filter(word => word.includes(keywordLower)).length;
  return ((count / words.length) * 100).toFixed(2);
};

/**
 * Extract keywords from content
 */
const extractKeywords = (content, maxKeywords = 10) => {
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its'];
  
  const words = content.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const wordCount = {};
  
  words.forEach(word => {
    if (word.length > 3 && !stopWords.includes(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
};

module.exports = {
  generateSlug,
  generateDormSlug,
  generateCitySlug,
  generateUniversitySlug,
  generateDormMetaTitle,
  generateDormMetaDescription,
  generateCityMetaTitle,
  generateCityMetaDescription,
  generateUniversityMetaTitle,
  generateUniversityMetaDescription,
  generateOpenGraphMeta,
  generateDormSchema,
  generateReviewSchema,
  generateBreadcrumbSchema,
  generateBlogPostSchema,
  generateFAQSchema,
  generateSitemapEntry,
  generateSitemap,
  generateRobotsTxt,
  calculateKeywordDensity,
  extractKeywords
};
