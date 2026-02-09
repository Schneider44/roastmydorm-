const express = require('express');
const router = express.Router();
const Review = require('../../models/Review');
const Report = require('../../models/Report');
const { logAdminAction } = require('../../middleware/admin');

/**
 * @route   GET /api/admin/reviews
 * @desc    Get all reviews with filtering
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      verified,
      flagged,
      minRating,
      maxRating,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dormId,
      userId
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }

    if (flagged === 'true') {
      query.isFlagged = true;
    }

    if (minRating || maxRating) {
      query.overallRating = {};
      if (minRating) query.overallRating.$gte = parseInt(minRating);
      if (maxRating) query.overallRating.$lte = parseInt(maxRating);
    }

    if (dormId) {
      query.dorm = dormId;
    }

    if (userId) {
      query.user = userId;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('user', 'firstName lastName email profilePicture')
        .populate('dorm', 'name slug location.address.city')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Review.countDocuments(query)
    ]);

    // Get report counts for each review
    const reviewsWithReports = await Promise.all(
      reviews.map(async (review) => {
        const reportCount = await Report.countDocuments({
          targetType: 'review',
          targetId: review._id,
          status: { $in: ['pending', 'under_review'] }
        });
        return {
          ...review.toObject(),
          reportCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        reviews: reviewsWithReports,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

/**
 * @route   GET /api/admin/reviews/stats
 * @desc    Get review statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalReviews,
      verifiedReviews,
      flaggedReviews,
      reviewsThisWeek,
      reviewsThisMonth,
      avgRating,
      ratingDistribution,
      topReviewers
    ] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ isVerified: true }),
      Review.countDocuments({ isFlagged: true }),
      Review.countDocuments({ createdAt: { $gte: thisWeek } }),
      Review.countDocuments({ createdAt: { $gte: thisMonth } }),
      Review.aggregate([
        { $group: { _id: null, avg: { $avg: '$overallRating' } } }
      ]),
      Review.aggregate([
        { $group: { _id: '$overallRating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Review.aggregate([
        { $group: { _id: '$user', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        {
          $project: {
            count: 1,
            name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
            email: '$userInfo.email'
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total: totalReviews,
        verified: verifiedReviews,
        flagged: flaggedReviews,
        thisWeek: reviewsThisWeek,
        thisMonth: reviewsThisMonth,
        averageRating: avgRating[0]?.avg?.toFixed(2) || 0,
        ratingDistribution,
        topReviewers
      }
    });
  } catch (error) {
    console.error('Review stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review statistics'
    });
  }
});

/**
 * @route   GET /api/admin/reviews/flagged
 * @desc    Get flagged/reported reviews
 * @access  Admin
 */
router.get('/flagged', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get reviews with pending reports
    const reportedReviewIds = await Report.distinct('targetId', {
      targetType: 'review',
      status: { $in: ['pending', 'under_review'] }
    });

    const [reviews, total] = await Promise.all([
      Review.find({ 
        $or: [
          { isFlagged: true },
          { _id: { $in: reportedReviewIds } }
        ]
      })
        .populate('user', 'firstName lastName email')
        .populate('dorm', 'name slug')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Review.countDocuments({ 
        $or: [
          { isFlagged: true },
          { _id: { $in: reportedReviewIds } }
        ]
      })
    ]);

    // Get reports for each review
    const reviewsWithReports = await Promise.all(
      reviews.map(async (review) => {
        const reports = await Report.find({
          targetType: 'review',
          targetId: review._id
        })
          .populate('reporter', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        return {
          ...review.toObject(),
          reports
        };
      })
    );

    res.json({
      success: true,
      data: {
        reviews: reviewsWithReports,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get flagged reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged reviews'
    });
  }
});

/**
 * @route   GET /api/admin/reviews/:id
 * @desc    Get single review with details
 * @access  Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'firstName lastName email profilePicture university')
      .populate('dorm', 'name slug location images');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Get reports for this review
    const reports = await Report.find({
      targetType: 'review',
      targetId: review._id
    })
      .populate('reporter', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Get admin action history
    const AdminAction = require('../../models/AdminAction');
    const adminHistory = await AdminAction.getByTarget('review', review._id);

    res.json({
      success: true,
      data: {
        review,
        reports,
        adminHistory
      }
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/approve
 * @desc    Approve review
 * @access  Admin
 */
router.post('/:id/approve', logAdminAction('review_approve', 'review'), async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'approved',
          isFlagged: false,
          approvedAt: new Date(),
          approvedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Dismiss related reports
    await Report.updateMany(
      { targetType: 'review', targetId: review._id, status: 'pending' },
      { 
        $set: { 
          status: 'dismissed',
          resolution: {
            action: 'no_action',
            notes: 'Review approved by admin',
            resolvedBy: req.user._id,
            resolvedAt: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'Review approved',
      data: review
    });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve review'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/verify
 * @desc    Mark review as verified
 * @access  Admin
 */
router.post('/:id/verify', logAdminAction('review_verify', 'review'), async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isVerified: true,
          verificationMethod: 'manual',
          verifiedAt: new Date(),
          verifiedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review verified',
      data: review
    });
  } catch (error) {
    console.error('Verify review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify review'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/flag
 * @desc    Flag review for investigation
 * @access  Admin
 */
router.post('/:id/flag', logAdminAction('review_flag', 'review'), async (req, res) => {
  try {
    const { reason } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isFlagged: true,
          flagReason: reason,
          flaggedAt: new Date(),
          flaggedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review flagged',
      data: review
    });
  } catch (error) {
    console.error('Flag review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag review'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/unflag
 * @desc    Remove flag from review
 * @access  Admin
 */
router.post('/:id/unflag', logAdminAction('review_unflag', 'review'), async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: { isFlagged: false },
        $unset: { flagReason: 1, flaggedAt: 1, flaggedBy: 1 }
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review unflagged',
      data: review
    });
  } catch (error) {
    console.error('Unflag review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unflag review'
    });
  }
});

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Delete review
 * @access  Admin
 */
router.delete('/:id', logAdminAction('review_delete', 'review'), async (req, res) => {
  try {
    const { reason } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update dorm review count and rating
    const Dorm = require('../../models/Dorm');
    await Dorm.findByIdAndUpdate(review.dorm, {
      $inc: { reviewCount: -1 }
    });

    // Soft delete
    await Review.findByIdAndUpdate(req.params.id, {
      $set: {
        status: 'deleted',
        deletedAt: new Date(),
        deletedBy: req.user._id,
        deleteReason: reason
      }
    });

    // Resolve related reports
    await Report.updateMany(
      { targetType: 'review', targetId: review._id },
      {
        $set: {
          status: 'resolved',
          resolution: {
            action: 'content_removed',
            notes: reason || 'Review deleted by admin',
            resolvedBy: req.user._id,
            resolvedAt: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'Review deleted'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/bulk
 * @desc    Perform bulk actions on reviews
 * @access  Admin
 */
router.post('/bulk', logAdminAction('bulk_action', 'review'), async (req, res) => {
  try {
    const { action, reviewIds, reason } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No reviews selected'
      });
    }

    let updateData = {};
    
    switch (action) {
      case 'approve':
        updateData = { 
          status: 'approved', 
          isFlagged: false,
          approvedAt: new Date(),
          approvedBy: req.user._id
        };
        break;
      case 'flag':
        updateData = { 
          isFlagged: true,
          flaggedAt: new Date(),
          flaggedBy: req.user._id
        };
        break;
      case 'delete':
        updateData = { 
          status: 'deleted',
          deletedAt: new Date(),
          deletedBy: req.user._id,
          deleteReason: reason
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    const result = await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} reviews updated`,
      data: { modified: result.modifiedCount }
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action'
    });
  }
});

module.exports = router;
