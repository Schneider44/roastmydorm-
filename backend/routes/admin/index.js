const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const { isAdmin, adminSecurityHeaders, adminRateLimit } = require('../../middleware/admin');

// Import admin sub-routes
const usersRouter = require('./users');
const dormsRouter = require('./dorms');
const reviewsRouter = require('./reviews');
const roommatesRouter = require('./roommates');
const analyticsRouter = require('./analytics');
const reportsRouter = require('./reports');
const settingsRouter = require('./settings');

// Apply security headers and rate limiting to all admin routes
router.use(adminSecurityHeaders);
router.use(adminRateLimit);

// All admin routes require authentication and admin role
router.use(auth);
router.use(isAdmin);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get dashboard overview data
 * @access  Admin
 */
router.get('/dashboard', async (req, res) => {
  try {
    const User = require('../../models/User');
    const Dorm = require('../../models/Dorm');
    const Review = require('../../models/Review');
    const Report = require('../../models/Report');
    const AnalyticsEvent = require('../../models/AnalyticsEvent');
    const RoommateProfile = require('../../models/RoommateProfile');

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel fetch all stats
    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsers,
      totalDorms,
      pendingDorms,
      totalReviews,
      reviewsThisWeek,
      pendingReports,
      totalRoommateProfiles,
      recentSignups,
      recentReviews,
      topDorms
    ] = await Promise.all([
      User.countDocuments({ userType: { $ne: 'admin' } }),
      User.countDocuments({ createdAt: { $gte: today }, userType: { $ne: 'admin' } }),
      User.countDocuments({ createdAt: { $gte: thisWeek }, userType: { $ne: 'admin' } }),
      User.countDocuments({ createdAt: { $gte: thisMonth }, userType: { $ne: 'admin' } }),
      User.countDocuments({ lastLogin: { $gte: thisWeek }, userType: { $ne: 'admin' } }),
      Dorm.countDocuments(),
      Dorm.countDocuments({ status: 'pending' }),
      Review.countDocuments(),
      Review.countDocuments({ createdAt: { $gte: thisWeek } }),
      Report.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      RoommateProfile.countDocuments({ isActive: true }),
      User.find({ userType: { $ne: 'admin' } })
        .select('firstName lastName email profilePicture createdAt university.name isVerified')
        .sort({ createdAt: -1 })
        .limit(5),
      Review.find()
        .populate('user', 'firstName lastName profilePicture')
        .populate('dorm', 'name slug')
        .select('title overallRating createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Dorm.find()
        .select('name slug averageRating reviewCount location.address.city')
        .sort({ reviewCount: -1 })
        .limit(5)
    ]);

    // Calculate growth rates
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: lastMonth, $lt: thisMonth },
      userType: { $ne: 'admin' }
    });
    const userGrowthRate = lastMonthUsers > 0 
      ? ((newUsersThisMonth - lastMonthUsers) / lastMonthUsers * 100).toFixed(1)
      : 100;

    // Get platform health indicators
    const avgReviewRating = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: '$overallRating' } } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          userGrowthRate: parseFloat(userGrowthRate),
          activeUsers,
          totalDorms,
          pendingDorms,
          totalReviews,
          reviewsThisWeek,
          pendingReports,
          totalRoommateProfiles
        },
        platformHealth: {
          avgRating: avgReviewRating[0]?.avg?.toFixed(2) || 0,
          pendingActions: pendingDorms + pendingReports,
          systemStatus: 'healthy'
        },
        recentActivity: {
          signups: recentSignups,
          reviews: recentReviews
        },
        topDorms,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data'
    });
  }
});

/**
 * @route   GET /api/admin/activity
 * @desc    Get recent admin activity log
 * @access  Admin
 */
router.get('/activity', async (req, res) => {
  try {
    const AdminAction = require('../../models/AdminAction');
    const { limit = 50, page = 1 } = req.query;

    const actions = await AdminAction.find()
      .populate('admin', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AdminAction.countDocuments();

    res.json({
      success: true,
      data: {
        actions,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load activity log'
    });
  }
});

// Mount sub-routers
router.use('/users', usersRouter);
router.use('/dorms', dormsRouter);
router.use('/reviews', reviewsRouter);
router.use('/roommates', roommatesRouter);
router.use('/analytics', analyticsRouter);
router.use('/reports', reportsRouter);
router.use('/settings', settingsRouter);

module.exports = router;

module.exports = router;
