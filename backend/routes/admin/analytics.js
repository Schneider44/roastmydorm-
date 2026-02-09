const express = require('express');
const router = express.Router();
const AnalyticsEvent = require('../../models/AnalyticsEvent');
const User = require('../../models/User');
const Dorm = require('../../models/Dorm');
const Review = require('../../models/Review');

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Get analytics overview
 * @access  Admin
 */
router.get('/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      totalPageViews,
      uniqueVisitors,
      newUsers,
      newReviews,
      dormViews,
      searchEvents,
      conversionEvents
    ] = await Promise.all([
      AnalyticsEvent.countDocuments({ 
        eventType: 'page_view',
        timestamp: { $gte: startDate }
      }),
      AnalyticsEvent.distinct('sessionId', {
        timestamp: { $gte: startDate }
      }).then(arr => arr.length),
      User.countDocuments({
        createdAt: { $gte: startDate },
        userType: { $ne: 'admin' }
      }),
      Review.countDocuments({
        createdAt: { $gte: startDate }
      }),
      AnalyticsEvent.countDocuments({
        eventType: 'dorm_view',
        timestamp: { $gte: startDate }
      }),
      AnalyticsEvent.countDocuments({
        eventType: 'search',
        timestamp: { $gte: startDate }
      }),
      AnalyticsEvent.countDocuments({
        category: 'conversion',
        timestamp: { $gte: startDate }
      })
    ]);

    // Get previous period for comparison
    const prevStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const [
      prevPageViews,
      prevNewUsers,
      prevNewReviews
    ] = await Promise.all([
      AnalyticsEvent.countDocuments({
        eventType: 'page_view',
        timestamp: { $gte: prevStartDate, $lt: startDate }
      }),
      User.countDocuments({
        createdAt: { $gte: prevStartDate, $lt: startDate },
        userType: { $ne: 'admin' }
      }),
      Review.countDocuments({
        createdAt: { $gte: prevStartDate, $lt: startDate }
      })
    ]);

    res.json({
      success: true,
      data: {
        period,
        metrics: {
          pageViews: {
            value: totalPageViews,
            change: calculateChange(totalPageViews, prevPageViews)
          },
          uniqueVisitors: {
            value: uniqueVisitors,
            change: null // Would need session tracking in prev period
          },
          newUsers: {
            value: newUsers,
            change: calculateChange(newUsers, prevNewUsers)
          },
          newReviews: {
            value: newReviews,
            change: calculateChange(newReviews, prevNewReviews)
          },
          dormViews: {
            value: dormViews
          },
          searches: {
            value: searchEvents
          },
          conversions: {
            value: conversionEvents
          }
        }
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics overview'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/growth
 * @desc    Get growth metrics over time
 * @access  Admin
 */
router.get('/growth', async (req, res) => {
  try {
    const { period = '30d', metric = 'users' } = req.query;
    
    const now = new Date();
    const days = parseInt(period) || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let data;
    
    switch (metric) {
      case 'users':
        data = await User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              userType: { $ne: 'admin' }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;
        
      case 'reviews':
        data = await Review.aggregate([
          {
            $match: { createdAt: { $gte: startDate } }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;
        
      case 'dorms':
        data = await Dorm.aggregate([
          {
            $match: { createdAt: { $gte: startDate } }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;
        
      case 'pageViews':
        data = await AnalyticsEvent.aggregate([
          {
            $match: {
              eventType: 'page_view',
              timestamp: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;
        
      default:
        data = [];
    }

    // Fill in missing dates with 0
    const filledData = fillMissingDates(startDate, now, data);

    res.json({
      success: true,
      data: {
        metric,
        period,
        values: filledData
      }
    });
  } catch (error) {
    console.error('Growth analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch growth analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/engagement
 * @desc    Get engagement metrics
 * @access  Admin
 */
router.get('/engagement', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    const days = parseInt(period) || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      reviewsPerDay,
      avgRatingTrend,
      photoUploads,
      qaActivity,
      roommateActivity
    ] = await Promise.all([
      // Reviews per day
      Review.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            avgRating: { $avg: '$overallRating' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Average rating trend
      Review.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            avgRating: { $avg: '$overallRating' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Photo uploads in reviews
      Review.countDocuments({
        createdAt: { $gte: startDate },
        'images.0': { $exists: true }
      }),
      
      // Q&A activity
      AnalyticsEvent.countDocuments({
        eventType: { $in: ['question_create', 'answer_create'] },
        timestamp: { $gte: startDate }
      }),
      
      // Roommate activity
      AnalyticsEvent.countDocuments({
        category: 'roommate',
        timestamp: { $gte: startDate }
      })
    ]);

    res.json({
      success: true,
      data: {
        reviewsPerDay,
        avgRatingTrend,
        photoUploads,
        qaActivity,
        roommateActivity
      }
    });
  } catch (error) {
    console.error('Engagement analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch engagement analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/traffic
 * @desc    Get traffic analytics
 * @access  Admin
 */
router.get('/traffic', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    const days = parseInt(period) || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      pageViewsByDay,
      topPages,
      topDorms,
      topCities,
      deviceBreakdown,
      trafficSources
    ] = await Promise.all([
      // Page views by day
      AnalyticsEvent.aggregate([
        {
          $match: {
            eventType: 'page_view',
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        {
          $project: {
            _id: 1,
            views: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Top pages
      AnalyticsEvent.aggregate([
        {
          $match: {
            eventType: 'page_view',
            timestamp: { $gte: startDate },
            'metadata.page': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$metadata.page',
            views: { $sum: 1 }
          }
        },
        { $sort: { views: -1 } },
        { $limit: 10 }
      ]),
      
      // Top viewed dorms
      AnalyticsEvent.getTopDorms(startDate, now, 10),
      
      // Top searched cities
      AnalyticsEvent.getCityAnalytics(startDate, now),
      
      // Device breakdown
      AnalyticsEvent.getDeviceBreakdown(startDate, now),
      
      // Traffic sources (UTM)
      AnalyticsEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            'utm.source': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: {
              source: '$utm.source',
              medium: '$utm.medium'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        pageViewsByDay,
        topPages,
        topDorms,
        topCities,
        deviceBreakdown,
        trafficSources
      }
    });
  } catch (error) {
    console.error('Traffic analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traffic analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/market
 * @desc    Get market insights
 * @access  Admin
 */
router.get('/market', async (req, res) => {
  try {
    const [
      pricesByCity,
      topUniversities,
      topRatedDorms,
      demandByCity,
      priceHistory
    ] = await Promise.all([
      // Average rent by city
      Dorm.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$location.address.city',
            avgRent: { $avg: '$pricing.baseRent' },
            minRent: { $min: '$pricing.baseRent' },
            maxRent: { $max: '$pricing.baseRent' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Most popular universities (by user count)
      User.aggregate([
        {
          $match: {
            'university.name': { $exists: true, $ne: null },
            userType: 'student'
          }
        },
        {
          $group: {
            _id: '$university.name',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Highest rated dorms
      Dorm.find({ status: 'active', reviewCount: { $gte: 5 } })
        .select('name slug averageRating reviewCount location.address.city pricing.baseRent')
        .sort({ averageRating: -1 })
        .limit(10),
      
      // Demand by city (based on search/views)
      AnalyticsEvent.aggregate([
        {
          $match: {
            eventType: { $in: ['dorm_view', 'search'] },
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$metadata.dormCity',
            views: { $sum: 1 }
          }
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { views: -1 } },
        { $limit: 10 }
      ]),
      
      // Price history (mock - would need historical data)
      []
    ]);

    res.json({
      success: true,
      data: {
        pricesByCity,
        topUniversities,
        topRatedDorms,
        demandByCity,
        priceHistory
      }
    });
  } catch (error) {
    console.error('Market analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/retention
 * @desc    Get user retention data
 * @access  Admin
 */
router.get('/retention', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Users who signed up 30+ days ago and logged in recently
    const retainedUsers = await User.countDocuments({
      createdAt: { $lt: thirtyDaysAgo },
      lastLogin: { $gte: sevenDaysAgo },
      userType: { $ne: 'admin' }
    });

    const totalOldUsers = await User.countDocuments({
      createdAt: { $lt: thirtyDaysAgo },
      userType: { $ne: 'admin' }
    });

    // Cohort analysis
    const cohorts = await User.aggregate([
      {
        $match: {
          userType: { $ne: 'admin' }
        }
      },
      {
        $project: {
          signupMonth: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          hasReturned: { $cond: [{ $gte: ['$lastLogin', sevenDaysAgo] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: '$signupMonth',
          total: { $sum: 1 },
          returned: { $sum: '$hasReturned' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 6 }
    ]);

    res.json({
      success: true,
      data: {
        retentionRate: totalOldUsers > 0 ? ((retainedUsers / totalOldUsers) * 100).toFixed(1) : 0,
        retainedUsers,
        totalOldUsers,
        cohorts
      }
    });
  } catch (error) {
    console.error('Retention analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch retention analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/search
 * @desc    Get search analytics
 * @access  Admin
 */
router.get('/search', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    const days = parseInt(period) || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const searchAnalytics = await AnalyticsEvent.getSearchAnalytics(startDate, now);

    res.json({
      success: true,
      data: {
        topSearches: searchAnalytics
      }
    });
  } catch (error) {
    console.error('Search analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search analytics'
    });
  }
});

/**
 * @route   GET /api/admin/analytics/funnel
 * @desc    Get conversion funnel data
 * @access  Admin
 */
router.get('/funnel', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    const days = parseInt(period) || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const funnelData = await AnalyticsEvent.getFunnelData(startDate, now);

    res.json({
      success: true,
      data: {
        funnel: funnelData
      }
    });
  } catch (error) {
    console.error('Funnel analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch funnel data'
    });
  }
});

// Helper functions
function calculateChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous * 100).toFixed(1);
}

function fillMissingDates(startDate, endDate, data) {
  const result = [];
  const dataMap = new Map(data.map(d => [d._id, d.count]));
  
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: dataMap.get(dateStr) || 0
    });
    current.setDate(current.getDate() + 1);
  }
  
  return result;
}

module.exports = router;
