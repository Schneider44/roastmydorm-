const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const seo = require('../utils/seo');

/**
 * GET /api/blog
 * Get all published blog posts with pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      search,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { status: 'published' };

    if (category) {
      filter.category = category;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await BlogPost.find(filter)
      .populate('author', 'firstName lastName profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await BlogPost.countDocuments(filter);

    res.json({
      success: true,
      data: posts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ success: false, message: 'Error fetching blog posts' });
  }
});

/**
 * GET /api/blog/categories
 * Get all blog categories with post counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

/**
 * GET /api/blog/popular
 * Get popular blog posts
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const posts = await BlogPost.find({ status: 'published' })
      .populate('author', 'firstName lastName profilePicture')
      .sort({ views: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Error fetching popular posts:', error);
    res.status(500).json({ success: false, message: 'Error fetching popular posts' });
  }
});

/**
 * GET /api/blog/recent
 * Get recent blog posts
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const posts = await BlogPost.find({ status: 'published' })
      .populate('author', 'firstName lastName profilePicture')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    res.status(500).json({ success: false, message: 'Error fetching recent posts' });
  }
});

/**
 * GET /api/blog/:slug
 * Get a single blog post by slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await BlogPost.findOneAndUpdate(
      { slug, status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    )
    .populate('author', 'firstName lastName profilePicture bio')
    .populate('relatedDorms', 'name slug averageRating images location.address.city')
    .populate('relatedPosts', 'title slug featuredImage category')
    .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Generate SEO metadata
    const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';
    post.seoMetadata = {
      title: post.seo?.metaTitle || post.title,
      description: post.seo?.metaDescription || post.excerpt,
      canonicalUrl: `${baseUrl}/blog/${slug}`,
      structuredData: seo.generateBlogPostSchema(post, post.author)
    };

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ success: false, message: 'Error fetching blog post' });
  }
});

/**
 * POST /api/blog
 * Create a new blog post (admin only)
 */
router.post('/',
  auth,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('excerpt').trim().notEmpty().withMessage('Excerpt is required'),
    body('category').isIn([
      'housing-guides', 'cost-of-living', 'dorm-comparisons',
      'university-advice', 'city-guides', 'student-life',
      'roommate-tips', 'moving-tips', 'reviews'
    ]).withMessage('Invalid category')
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        title,
        content,
        excerpt,
        category,
        tags,
        featuredImage,
        seo: seoData,
        relatedDorms,
        relatedCities,
        relatedUniversities,
        status = 'draft'
      } = req.body;

      // Generate slug
      let slug = BlogPost.generateSlug(title);
      
      // Check for duplicate slug
      const existingPost = await BlogPost.findOne({ slug });
      if (existingPost) {
        slug = `${slug}-${Date.now()}`;
      }

      const post = new BlogPost({
        title,
        slug,
        content,
        excerpt,
        author: req.user._id,
        category,
        tags,
        featuredImage,
        seo: seoData,
        relatedDorms,
        relatedCities,
        relatedUniversities,
        status,
        publishedAt: status === 'published' ? new Date() : null
      });

      await post.save();

      res.status(201).json({
        success: true,
        data: post,
        message: 'Blog post created successfully'
      });
    } catch (error) {
      console.error('Error creating blog post:', error);
      res.status(500).json({ success: false, message: 'Error creating blog post' });
    }
  }
);

/**
 * PUT /api/blog/:slug
 * Update a blog post (admin only)
 */
router.put('/:slug', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { slug } = req.params;
    const updates = req.body;

    // If status changing to published, set publishedAt
    if (updates.status === 'published') {
      const existingPost = await BlogPost.findOne({ slug });
      if (existingPost && !existingPost.publishedAt) {
        updates.publishedAt = new Date();
      }
    }

    const post = await BlogPost.findOneAndUpdate(
      { slug },
      updates,
      { new: true, runValidators: true }
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({
      success: true,
      data: post,
      message: 'Blog post updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ success: false, message: 'Error updating blog post' });
  }
});

/**
 * DELETE /api/blog/:slug
 * Delete a blog post (admin only)
 */
router.delete('/:slug', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { slug } = req.params;

    const post = await BlogPost.findOneAndDelete({ slug });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ success: false, message: 'Error deleting blog post' });
  }
});

/**
 * POST /api/blog/:slug/like
 * Like a blog post
 */
router.post('/:slug/like', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user._id;

    const post = await BlogPost.findOne({ slug });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(userId);
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      post.likesCount = post.likes.length;
    } else {
      // Like
      post.likes.push(userId);
      post.likesCount = post.likes.length;
    }

    await post.save();

    res.json({
      success: true,
      data: {
        liked: likeIndex === -1,
        likesCount: post.likesCount
      }
    });
  } catch (error) {
    console.error('Error liking blog post:', error);
    res.status(500).json({ success: false, message: 'Error liking blog post' });
  }
});

module.exports = router;
