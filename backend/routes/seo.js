const express = require('express');
const router = express.Router();
const Dorm = require('../models/Dorm');
const BlogPost = require('../models/BlogPost');
const seo = require('../utils/seo');

/**
 * GET /api/seo/sitemap.xml
 * Generate dynamic sitemap
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';
    
    // Fetch all active dorms
    const dorms = await Dorm.find({ status: 'active' })
      .select('name location.address.city slug updatedAt')
      .lean();

    // Fetch published blog posts
    const blogPosts = await BlogPost.find({ status: 'published' })
      .select('slug updatedAt')
      .lean();

    // Get unique cities
    const cities = [...new Set(dorms.map(d => d.location?.address?.city).filter(Boolean))];

    // Get unique universities
    const universities = [...new Set(
      dorms.flatMap(d => d.location?.nearbyUniversities?.map(u => u.name) || [])
    )];

    // Generate sitemap
    const sitemap = await seo.generateSitemap(baseUrl, {
      dorms,
      cities,
      universities,
      blogPosts
    });

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ success: false, message: 'Error generating sitemap' });
  }
});

/**
 * GET /api/seo/robots.txt
 * Generate robots.txt
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';
  const robotsTxt = seo.generateRobotsTxt(baseUrl);
  
  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.send(robotsTxt);
});

/**
 * GET /api/seo/dorm/:slug/metadata
 * Get SEO metadata for a dorm page
 */
router.get('/dorm/:slug/metadata', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const dorm = await Dorm.findOne({ slug }).lean();
    if (!dorm) {
      return res.status(404).json({ success: false, message: 'Dorm not found' });
    }

    const city = dorm.location?.address?.city || 'Morocco';
    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';

    const metadata = {
      title: seo.generateDormMetaTitle(dorm.name, city),
      description: seo.generateDormMetaDescription(
        dorm.name,
        city,
        dorm.averageRating,
        dorm.totalReviews
      ),
      canonicalUrl: `${baseUrl}/dorm/${slug}`,
      openGraph: seo.generateOpenGraphMeta({
        title: seo.generateDormMetaTitle(dorm.name, city),
        description: seo.generateDormMetaDescription(dorm.name, city, dorm.averageRating, dorm.totalReviews),
        url: `${baseUrl}/dorm/${slug}`,
        image: dorm.images?.[0]?.url,
        type: 'place'
      }),
      structuredData: seo.generateDormSchema(dorm),
      breadcrumbs: seo.generateBreadcrumbSchema([
        { name: 'Home', url: baseUrl },
        { name: city, url: `${baseUrl}/city/${seo.generateCitySlug(city)}` },
        { name: dorm.name, url: `${baseUrl}/dorm/${slug}` }
      ])
    };

    res.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Error getting dorm metadata:', error);
    res.status(500).json({ success: false, message: 'Error getting metadata' });
  }
});

/**
 * GET /api/seo/city/:slug/metadata
 * Get SEO metadata for a city page
 */
router.get('/city/:slug/metadata', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Extract city name from slug (e.g., "casablanca-student-housing" -> "Casablanca")
    const cityName = slug
      .replace('-student-housing', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const dormCount = await Dorm.countDocuments({
      'location.address.city': new RegExp(cityName, 'i'),
      status: 'active'
    });

    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';

    const metadata = {
      title: seo.generateCityMetaTitle(cityName),
      description: seo.generateCityMetaDescription(cityName, dormCount),
      canonicalUrl: `${baseUrl}/city/${slug}`,
      openGraph: seo.generateOpenGraphMeta({
        title: seo.generateCityMetaTitle(cityName),
        description: seo.generateCityMetaDescription(cityName, dormCount),
        url: `${baseUrl}/city/${slug}`,
        type: 'website'
      }),
      breadcrumbs: seo.generateBreadcrumbSchema([
        { name: 'Home', url: baseUrl },
        { name: 'Cities', url: `${baseUrl}/cities` },
        { name: cityName, url: `${baseUrl}/city/${slug}` }
      ])
    };

    res.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Error getting city metadata:', error);
    res.status(500).json({ success: false, message: 'Error getting metadata' });
  }
});

/**
 * GET /api/seo/university/:slug/metadata
 * Get SEO metadata for a university page
 */
router.get('/university/:slug/metadata', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Extract university name from slug
    const universityName = slug
      .replace('-dorms', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const dormCount = await Dorm.countDocuments({
      'location.nearbyUniversities.name': new RegExp(universityName, 'i'),
      status: 'active'
    });

    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';

    const metadata = {
      title: seo.generateUniversityMetaTitle(universityName),
      description: seo.generateUniversityMetaDescription(universityName, dormCount),
      canonicalUrl: `${baseUrl}/university/${slug}`,
      openGraph: seo.generateOpenGraphMeta({
        title: seo.generateUniversityMetaTitle(universityName),
        description: seo.generateUniversityMetaDescription(universityName, dormCount),
        url: `${baseUrl}/university/${slug}`,
        type: 'website'
      }),
      breadcrumbs: seo.generateBreadcrumbSchema([
        { name: 'Home', url: baseUrl },
        { name: 'Universities', url: `${baseUrl}/universities` },
        { name: universityName, url: `${baseUrl}/university/${slug}` }
      ])
    };

    res.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Error getting university metadata:', error);
    res.status(500).json({ success: false, message: 'Error getting metadata' });
  }
});

/**
 * POST /api/seo/generate-slug
 * Generate SEO-friendly slug from text
 */
router.post('/generate-slug', (req, res) => {
  const { text, type, city } = req.body;

  if (!text) {
    return res.status(400).json({ success: false, message: 'Text is required' });
  }

  let slug;
  switch (type) {
    case 'dorm':
      slug = seo.generateDormSlug(text, city || '');
      break;
    case 'city':
      slug = seo.generateCitySlug(text);
      break;
    case 'university':
      slug = seo.generateUniversitySlug(text);
      break;
    default:
      slug = seo.generateSlug(text);
  }

  res.json({ success: true, data: { slug } });
});

/**
 * GET /api/seo/internal-links/:dormId
 * Get internal linking suggestions for a dorm
 */
router.get('/internal-links/:dormId', async (req, res) => {
  try {
    const { dormId } = req.params;
    
    const dorm = await Dorm.findById(dormId).lean();
    if (!dorm) {
      return res.status(404).json({ success: false, message: 'Dorm not found' });
    }

    const city = dorm.location?.address?.city;
    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';

    // Get related dorms in the same city
    const relatedDorms = await Dorm.find({
      _id: { $ne: dormId },
      'location.address.city': city,
      status: 'active'
    })
    .select('name slug averageRating pricing.baseRent images')
    .limit(6)
    .lean();

    // Get related blog posts
    const relatedPosts = await BlogPost.find({
      status: 'published',
      $or: [
        { relatedCities: new RegExp(city, 'i') },
        { tags: { $in: dorm.tags || [] } }
      ]
    })
    .select('title slug category featuredImage')
    .limit(4)
    .lean();

    // Get nearby universities
    const nearbyUniversities = dorm.location?.nearbyUniversities?.map(u => ({
      name: u.name,
      url: `${baseUrl}/university/${seo.generateUniversitySlug(u.name)}`,
      distance: u.distance
    })) || [];

    res.json({
      success: true,
      data: {
        cityPage: {
          name: city,
          url: `${baseUrl}/city/${seo.generateCitySlug(city)}`
        },
        relatedDorms: relatedDorms.map(d => ({
          name: d.name,
          url: `${baseUrl}/dorm/${d.slug}`,
          rating: d.averageRating,
          price: d.pricing?.baseRent,
          image: d.images?.[0]?.url
        })),
        relatedPosts: relatedPosts.map(p => ({
          title: p.title,
          url: `${baseUrl}/blog/${p.slug}`,
          category: p.category,
          image: p.featuredImage?.url
        })),
        nearbyUniversities
      }
    });
  } catch (error) {
    console.error('Error getting internal links:', error);
    res.status(500).json({ success: false, message: 'Error getting internal links' });
  }
});

module.exports = router;
