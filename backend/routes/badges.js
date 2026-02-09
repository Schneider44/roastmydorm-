const express = require('express');
const router = express.Router();
const Badge = require('../models/Badge');
const { UserBadge } = require('../models/Badge');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const gamification = require('../utils/gamification');

/**
 * GET /api/badges
 * Get all available badges
 */
router.get('/', async (req, res) => {
  try {
    const { category, rarity } = req.query;
    
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (rarity) filter.rarity = rarity;

    const badges = await Badge.find(filter)
      .sort({ category: 1, 'requirement.value': 1 })
      .lean();

    res.json({ success: true, data: badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ success: false, message: 'Error fetching badges' });
  }
});

/**
 * GET /api/badges/leaderboard
 * Get the badge leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await gamification.getLeaderboard(parseInt(limit));
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
  }
});

/**
 * GET /api/badges/user/:userId
 * Get badges for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userBadges = await gamification.getUserBadges(userId);
    const stats = await gamification.getUserBadgeStats(userId);

    res.json({
      success: true,
      data: {
        badges: userBadges,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ success: false, message: 'Error fetching user badges' });
  }
});

/**
 * GET /api/badges/my-badges
 * Get current user's badges
 */
router.get('/my-badges', auth, async (req, res) => {
  try {
    const userBadges = await gamification.getUserBadges(req.user._id);
    const stats = await gamification.getUserBadgeStats(req.user._id);

    res.json({
      success: true,
      data: {
        badges: userBadges,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ success: false, message: 'Error fetching badges' });
  }
});

/**
 * POST /api/badges/check
 * Check and award any earned badges for current user
 */
router.post('/check', auth, async (req, res) => {
  try {
    const newBadges = await gamification.checkAndAwardBadges(req.user._id);

    res.json({
      success: true,
      data: {
        newBadges: newBadges.map(b => ({
          name: b.badge.name,
          icon: b.badge.icon,
          description: b.badge.description,
          points: b.badge.points
        })),
        count: newBadges.length
      }
    });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({ success: false, message: 'Error checking badges' });
  }
});

/**
 * POST /api/badges/seed
 * Seed badges (admin only)
 */
router.post('/seed', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    await gamification.seedBadges();

    res.json({
      success: true,
      message: 'Badges seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding badges:', error);
    res.status(500).json({ success: false, message: 'Error seeding badges' });
  }
});

/**
 * POST /api/badges/award
 * Manually award a badge to a user (admin only)
 */
router.post('/award', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { userId, badgeSlug, reason } = req.body;

    if (!userId || !badgeSlug) {
      return res.status(400).json({ success: false, message: 'userId and badgeSlug are required' });
    }

    const userBadge = await gamification.awardSpecialBadge(userId, badgeSlug, reason);

    res.json({
      success: true,
      data: userBadge,
      message: 'Badge awarded successfully'
    });
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ success: false, message: error.message || 'Error awarding badge' });
  }
});

/**
 * PUT /api/badges/display
 * Toggle badge display on profile
 */
router.put('/display', auth, async (req, res) => {
  try {
    const { badgeId, isDisplayed } = req.body;

    const userBadge = await UserBadge.findOneAndUpdate(
      { user: req.user._id, badge: badgeId },
      { isDisplayed },
      { new: true }
    ).populate('badge');

    if (!userBadge) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }

    res.json({
      success: true,
      data: userBadge
    });
  } catch (error) {
    console.error('Error updating badge display:', error);
    res.status(500).json({ success: false, message: 'Error updating badge display' });
  }
});

/**
 * GET /api/badges/:badgeSlug
 * Get a specific badge by slug
 */
router.get('/:badgeSlug', async (req, res) => {
  try {
    const { badgeSlug } = req.params;

    const badge = await Badge.findOne({ slug: badgeSlug }).lean();
    if (!badge) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }

    // Get users who have this badge
    const recentHolders = await UserBadge.find({ badge: badge._id })
      .populate('user', 'firstName lastName profilePicture')
      .sort({ awardedAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        badge,
        recentHolders
      }
    });
  } catch (error) {
    console.error('Error fetching badge:', error);
    res.status(500).json({ success: false, message: 'Error fetching badge' });
  }
});

module.exports = router;
