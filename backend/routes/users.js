const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const Favorite = require('../models/Favorite');
const { UserBadge } = require('../models/Badge');
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const gamification = require('../utils/gamification');
const seo = require('../utils/seo');

/**
 * GET /api/users/profile/:username
 * Get public user profile
 */
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username (derived from email or custom username)
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: new RegExp(`^${username}@`, 'i') }
      ]
    })
    .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken')
    .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's reviews
    const reviews = await Review.find({ user: user._id, status: 'approved' })
      .populate('dorm', 'name slug location.address.city images')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get user's badges
    const badges = await UserBadge.find({ user: user._id, isDisplayed: true })
      .populate('badge')
      .sort({ awardedAt: -1 })
      .lean();

    // Get badge stats
    const badgeStats = await gamification.getUserBadgeStats(user._id);

    // Get user's question activity
    const questionsAsked = await Question.countDocuments({ author: user._id });
    const answersGiven = await Question.aggregate([
      { $unwind: '$answers' },
      { $match: { 'answers.author': user._id } },
      { $count: 'total' }
    ]);

    // Increment profile views
    await User.findByIdAndUpdate(user._id, { $inc: { profileViews: 1 } });

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          university: user.university,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          profileViews: user.profileViews
        },
        reviews,
        badges,
        badgeStats,
        stats: {
          totalReviews: reviews.length,
          questionsAsked,
          answersGiven: answersGiven[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

/**
 * GET /api/users/me
 * Get current user's profile
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get favorites count
    const favoritesCount = await Favorite.countDocuments({ user: user._id });

    // Get reviews count
    const reviewsCount = await Review.countDocuments({ user: user._id, status: 'approved' });

    // Get badges
    const badges = await UserBadge.find({ user: user._id })
      .populate('badge')
      .lean();

    res.json({
      success: true,
      data: {
        ...user,
        favoritesCount,
        reviewsCount,
        badges
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

/**
 * PUT /api/users/me
 * Update current user's profile
 */
router.put('/me',
  auth,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('phone').optional().trim(),
    body('university.name').optional().trim(),
    body('university.major').optional().trim(),
    body('university.graduationYear').optional().isInt({ min: 2000, max: 2040 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const allowedUpdates = [
        'firstName', 'lastName', 'bio', 'phone', 'dateOfBirth',
        'gender', 'profilePicture', 'university', 'preferences'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -resetPasswordToken -resetPasswordExpires -verificationToken');

      // Check for profile completion badge
      await gamification.checkAndAwardBadges(req.user._id);

      res.json({
        success: true,
        data: user,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ success: false, message: 'Error updating profile' });
    }
  }
);

/**
 * GET /api/users/me/favorites
 * Get current user's favorites
 */
router.get('/me/favorites', auth, async (req, res) => {
  try {
    const { page = 1, limit = 12, folder } = req.query;

    const filter = { user: req.user._id };
    if (folder) filter.folder = folder;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const favorites = await Favorite.find(filter)
      .populate({
        path: 'dorm',
        select: 'name slug location images pricing averageRating totalReviews',
        populate: {
          path: 'landlord',
          select: 'firstName lastName'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Favorite.countDocuments(filter);

    // Get all folders
    const folders = await Favorite.distinct('folder', { user: req.user._id });

    res.json({
      success: true,
      data: {
        favorites,
        folders
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: 'Error fetching favorites' });
  }
});

/**
 * POST /api/users/me/favorites
 * Add a dorm to favorites
 */
router.post('/me/favorites', auth, async (req, res) => {
  try {
    const { dormId, notes, folder = 'default' } = req.body;

    if (!dormId) {
      return res.status(400).json({ success: false, message: 'Dorm ID is required' });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ user: req.user._id, dorm: dormId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Dorm already in favorites' });
    }

    const favorite = new Favorite({
      user: req.user._id,
      dorm: dormId,
      notes,
      folder
    });

    await favorite.save();
    await favorite.populate('dorm', 'name slug images');

    res.status(201).json({
      success: true,
      data: favorite,
      message: 'Added to favorites'
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ success: false, message: 'Error adding favorite' });
  }
});

/**
 * DELETE /api/users/me/favorites/:dormId
 * Remove a dorm from favorites
 */
router.delete('/me/favorites/:dormId', auth, async (req, res) => {
  try {
    const { dormId } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      user: req.user._id,
      dorm: dormId
    });

    if (!favorite) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ success: false, message: 'Error removing favorite' });
  }
});

/**
 * GET /api/users/me/reviews
 * Get current user's reviews
 */
router.get('/me/reviews', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(filter)
      .populate('dorm', 'name slug location.address.city images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: reviews,
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
 * GET /api/users/me/activity
 * Get user's activity feed
 */
router.get('/me/activity', auth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get recent reviews
    const reviews = await Review.find({ user: req.user._id })
      .populate('dorm', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get recent questions
    const questions = await Question.find({ author: req.user._id })
      .populate('dorm', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get recent answers
    const answers = await Question.aggregate([
      { $unwind: '$answers' },
      { $match: { 'answers.author': req.user._id } },
      { $sort: { 'answers.createdAt': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'dorms',
          localField: 'dorm',
          foreignField: '_id',
          as: 'dormInfo'
        }
      },
      { $unwind: '$dormInfo' },
      {
        $project: {
          _id: '$answers._id',
          content: '$answers.content',
          createdAt: '$answers.createdAt',
          questionTitle: '$title',
          questionId: '$_id',
          dorm: {
            name: '$dormInfo.name',
            slug: '$dormInfo.slug'
          }
        }
      }
    ]);

    // Get recent badges
    const badges = await UserBadge.find({ user: req.user._id })
      .populate('badge')
      .sort({ awardedAt: -1 })
      .limit(5)
      .lean();

    // Combine and sort all activities
    const activities = [
      ...reviews.map(r => ({ type: 'review', data: r, date: r.createdAt })),
      ...questions.map(q => ({ type: 'question', data: q, date: q.createdAt })),
      ...answers.map(a => ({ type: 'answer', data: a, date: a.createdAt })),
      ...badges.map(b => ({ type: 'badge', data: b, date: b.awardedAt }))
    ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ success: false, message: 'Error fetching activity' });
  }
});

/**
 * POST /api/users/me/roommate-preferences
 * Update roommate preferences
 */
router.post('/me/roommate-preferences', auth, async (req, res) => {
  try {
    const RoommateProfile = require('../models/RoommateProfile');
    const {
      budget,
      lifestyle,
      sleepSchedule,
      smoking,
      pets,
      preferredCity,
      preferredUniversity,
      moveInDate,
      bio
    } = req.body;

    const profile = await RoommateProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        user: req.user._id,
        budget,
        lifestyle,
        sleepSchedule,
        smoking,
        pets,
        preferredCity,
        preferredUniversity,
        moveInDate,
        bio,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: profile,
      message: 'Roommate preferences updated'
    });
  } catch (error) {
    console.error('Error updating roommate preferences:', error);
    res.status(500).json({ success: false, message: 'Error updating preferences' });
  }
});

module.exports = router;
