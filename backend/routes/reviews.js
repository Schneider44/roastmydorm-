const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const ReviewVote = require('../models/ReviewVote');
const Dorm = require('../models/Dorm');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const gamification = require('../utils/gamification');
const seo = require('../utils/seo');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * GET /api/reviews/dorm/:dormId
 * Get all reviews for a specific dorm
 */
router.get('/dorm/:dormId', async (req, res) => {
  try {
    const { dormId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      rating,
      verified
    } = req.query;

    const filter = { dorm: dormId, status: 'approved' };

    if (rating) {
      filter.overallRating = parseInt(rating);
    }

    if (verified === 'true') {
      filter.isVerified = true;
    }

    const sort = {};
    if (sortBy === 'helpful') {
      sort.helpfulCount = -1;
    } else if (sortBy === 'rating') {
      sort.overallRating = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(filter)
      .populate('user', 'firstName lastName profilePicture isVerified university')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Review.countDocuments(filter);

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { dorm: require('mongoose').Types.ObjectId(dormId), status: 'approved' } },
      { $group: { _id: '$overallRating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      success: true,
      data: reviews,
      ratingDistribution,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

/**
 * GET /api/reviews/:reviewId
 * Get a single review
 */
router.get('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { views: 1 } },
      { new: true }
    )
    .populate('user', 'firstName lastName profilePicture isVerified university')
    .populate('dorm', 'name slug location.address.city images')
    .lean();

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ success: false, message: 'Error fetching review' });
  }
});

/**
 * POST /api/reviews
 * Create a new review
 */
router.post('/',
  auth,
  upload.array('images', 5),
  [
    body('dormId').notEmpty().withMessage('Dorm ID is required'),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }),
    body('overallRating').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
    body('ratings.cleanliness').isInt({ min: 1, max: 5 }),
    body('ratings.safety').isInt({ min: 1, max: 5 }),
    body('ratings.location').isInt({ min: 1, max: 5 }),
    body('ratings.landlord').isInt({ min: 1, max: 5 }),
    body('ratings.value').isInt({ min: 1, max: 5 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        dormId,
        title,
        content,
        overallRating,
        ratings,
        pros,
        cons,
        livingPeriod
      } = req.body;

      // Check if user already reviewed this dorm
      const existingReview = await Review.findOne({ dorm: dormId, user: req.user._id });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this dorm'
        });
      }

      // Verify dorm exists
      const dorm = await Dorm.findById(dormId);
      if (!dorm) {
        return res.status(404).json({ success: false, message: 'Dorm not found' });
      }

      // Upload images if provided
      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: 'reviews', transformation: { width: 1200, quality: 'auto' } },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(file.buffer);
          });
          imageUrls.push({ url: result.secure_url });
        }
      }

      // Parse pros and cons if they're strings
      const parsedPros = typeof pros === 'string' ? JSON.parse(pros) : pros;
      const parsedCons = typeof cons === 'string' ? JSON.parse(cons) : cons;

      const review = new Review({
        dorm: dormId,
        user: req.user._id,
        title,
        content,
        overallRating: parseInt(overallRating),
        ratings: {
          cleanliness: parseInt(ratings.cleanliness),
          safety: parseInt(ratings.safety),
          location: parseInt(ratings.location),
          landlord: parseInt(ratings.landlord),
          value: parseInt(ratings.value)
        },
        pros: parsedPros,
        cons: parsedCons,
        livingPeriod,
        images: imageUrls,
        isVerified: req.user.isVerified,
        status: 'approved' // Auto-approve for now, could be 'pending' for moderation
      });

      await review.save();

      // Update dorm rating
      await updateDormRating(dormId);

      // Check for badges
      const newBadges = await gamification.checkAndAwardBadges(req.user._id);

      await review.populate('user', 'firstName lastName profilePicture');

      res.status(201).json({
        success: true,
        data: review,
        newBadges: newBadges.map(b => ({
          name: b.badge.name,
          icon: b.badge.icon
        })),
        message: 'Review submitted successfully'
      });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ success: false, message: 'Error creating review' });
    }
  }
);

/**
 * POST /api/reviews/:reviewId/vote
 * Vote on a review (upvote/downvote)
 */
router.post('/:reviewId/vote', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { voteType } = req.body;

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ success: false, message: 'Invalid vote type' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Prevent self-voting
    if (review.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot vote on your own review' });
    }

    const result = await ReviewVote.vote(reviewId, req.user._id, voteType);

    // Check for badges for the review author
    await gamification.checkAndAwardBadges(review.user);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error voting on review:', error);
    res.status(500).json({ success: false, message: 'Error voting' });
  }
});

/**
 * POST /api/reviews/:reviewId/report
 * Report a review
 */
router.post('/:reviewId/report', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason, description } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Check if already reported by this user
    const alreadyReported = review.reports.some(
      r => r.reportedBy.toString() === req.user._id.toString()
    );

    if (alreadyReported) {
      return res.status(400).json({ success: false, message: 'You have already reported this review' });
    }

    review.reports.push({
      reportedBy: req.user._id,
      reason,
      description
    });

    // Auto-flag if reported multiple times
    if (review.reports.length >= 3) {
      review.status = 'flagged';
    }

    await review.save();

    res.json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ success: false, message: 'Error reporting review' });
  }
});

/**
 * PUT /api/reviews/:reviewId
 * Update a review (only by author)
 */
router.put('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allowedUpdates = ['title', 'content', 'overallRating', 'ratings', 'pros', 'cons'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    Object.assign(review, updates);
    await review.save();

    // Update dorm rating
    await updateDormRating(review.dorm);

    res.json({
      success: true,
      data: review,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ success: false, message: 'Error updating review' });
  }
});

/**
 * DELETE /api/reviews/:reviewId
 * Delete a review (only by author or admin)
 */
router.delete('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const isAuthor = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.userType === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const dormId = review.dorm;
    await review.deleteOne();

    // Update dorm rating
    await updateDormRating(dormId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Error deleting review' });
  }
});

/**
 * GET /api/reviews/dorm/:dormId/schema
 * Get review schema for SEO
 */
router.get('/dorm/:dormId/schema', async (req, res) => {
  try {
    const { dormId } = req.params;

    const dorm = await Dorm.findById(dormId).lean();
    if (!dorm) {
      return res.status(404).json({ success: false, message: 'Dorm not found' });
    }

    const reviews = await Review.find({ dorm: dormId, status: 'approved' })
      .populate('user', 'firstName lastName')
      .limit(10)
      .lean();

    const reviewSchemas = reviews.map(r => seo.generateReviewSchema(r, dorm));

    res.json({
      success: true,
      data: {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: dorm.averageRating,
          reviewCount: dorm.totalReviews,
          bestRating: 5,
          worstRating: 1
        },
        reviews: reviewSchemas
      }
    });
  } catch (error) {
    console.error('Error generating review schema:', error);
    res.status(500).json({ success: false, message: 'Error generating schema' });
  }
});

/**
 * Helper function to update dorm's aggregate rating
 */
async function updateDormRating(dormId) {
  const reviews = await Review.find({ dorm: dormId, status: 'approved' });
  
  if (reviews.length === 0) {
    await Dorm.findByIdAndUpdate(dormId, {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: {
        cleanliness: 0,
        safety: 0,
        location: 0,
        landlord: 0,
        value: 0
      }
    });
    return;
  }

  const totalReviews = reviews.length;
  const avgOverall = reviews.reduce((sum, r) => sum + r.overallRating, 0) / totalReviews;
  
  const ratingBreakdown = {
    cleanliness: reviews.reduce((sum, r) => sum + r.ratings.cleanliness, 0) / totalReviews,
    safety: reviews.reduce((sum, r) => sum + r.ratings.safety, 0) / totalReviews,
    location: reviews.reduce((sum, r) => sum + r.ratings.location, 0) / totalReviews,
    landlord: reviews.reduce((sum, r) => sum + r.ratings.landlord, 0) / totalReviews,
    value: reviews.reduce((sum, r) => sum + r.ratings.value, 0) / totalReviews
  };

  await Dorm.findByIdAndUpdate(dormId, {
    averageRating: Math.round(avgOverall * 10) / 10,
    totalReviews,
    ratingBreakdown
  });
}

module.exports = router;
