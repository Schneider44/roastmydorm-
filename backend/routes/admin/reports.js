const express = require('express');
const router = express.Router();
const Report = require('../../models/Report');
const Review = require('../../models/Review');
const Dorm = require('../../models/Dorm');
const User = require('../../models/User');
const { logAdminAction, capturePreviousState } = require('../../middleware/admin');

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports with filters
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      targetType,
      reason,
      priority,
      assignedTo,
      search,
      startDate,
      endDate,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Target type filter
    if (targetType) {
      query.targetType = targetType;
    }

    // Reason filter
    if (reason) {
      query.reason = reason;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Assigned filter
    if (assignedTo === 'me') {
      query.assignedTo = req.user._id;
    } else if (assignedTo === 'unassigned') {
      query.assignedTo = null;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Text search
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { 'resolution.notes': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reporter', 'name email')
        .populate('assignedTo', 'name email')
        .populate('resolution.resolvedBy', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(query)
    ]);

    // Populate target details for each report
    const reportsWithTargets = await Promise.all(
      reports.map(async (report) => {
        const reportObj = report.toObject();
        
        try {
          switch (report.targetType) {
            case 'review':
              reportObj.target = await Review.findById(report.targetId)
                .select('overallRating pros cons createdAt')
                .populate('user', 'name');
              break;
            case 'dorm':
              reportObj.target = await Dorm.findById(report.targetId)
                .select('name slug status location.address.city');
              break;
            case 'user':
              reportObj.target = await User.findById(report.targetId)
                .select('name email userType isActive');
              break;
          }
        } catch (e) {
          reportObj.target = null;
        }
        
        return reportObj;
      })
    );

    res.json({
      success: true,
      data: {
        reports: reportsWithTargets,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports'
    });
  }
});

/**
 * @route   GET /api/admin/reports/stats
 * @desc    Get report statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Report.getStats();

    // Get reports by day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const reportsByDay = await Report.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Average resolution time
    const resolutionStats = await Report.aggregate([
      {
        $match: {
          status: 'resolved',
          'resolution.resolvedAt': { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $subtract: ['$resolution.resolvedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' },
          minTime: { $min: '$resolutionTime' },
          maxTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    const avgResolutionTime = resolutionStats.length > 0 
      ? Math.round(resolutionStats[0].avgTime / (1000 * 60 * 60)) // Convert to hours
      : null;

    res.json({
      success: true,
      data: {
        ...stats,
        reportsByDay,
        avgResolutionTimeHours: avgResolutionTime
      }
    });
  } catch (error) {
    console.error('Report stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report statistics'
    });
  }
});

/**
 * @route   GET /api/admin/reports/pending
 * @desc    Get pending reports queue
 * @access  Admin
 */
router.get('/pending', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const pendingReports = await Report.find({
      status: { $in: ['pending', 'under_review'] }
    })
      .populate('reporter', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ priority: -1, createdAt: 1 }) // High priority first, then oldest
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        reports: pendingReports,
        count: pendingReports.length
      }
    });
  } catch (error) {
    console.error('Get pending reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reports'
    });
  }
});

/**
 * @route   GET /api/admin/reports/:id
 * @desc    Get single report details
 * @access  Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'name email userType createdAt')
      .populate('assignedTo', 'name email')
      .populate('resolution.resolvedBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const reportObj = report.toObject();

    // Get target details
    switch (report.targetType) {
      case 'review':
        reportObj.target = await Review.findById(report.targetId)
          .populate('user', 'name email')
          .populate('dorm', 'name slug');
        break;
      case 'dorm':
        reportObj.target = await Dorm.findById(report.targetId)
          .select('name slug status pricing location images owner')
          .populate('owner', 'name email');
        break;
      case 'user':
        reportObj.target = await User.findById(report.targetId)
          .select('name email userType isActive isVerified createdAt');
        break;
    }

    // Get related reports (same target)
    reportObj.relatedReports = await Report.find({
      targetType: report.targetType,
      targetId: report.targetId,
      _id: { $ne: report._id }
    })
      .select('reason status createdAt')
      .sort('-createdAt')
      .limit(5);

    // Get reporter's other reports
    reportObj.reporterHistory = await Report.find({
      reporter: report.reporter._id,
      _id: { $ne: report._id }
    })
      .select('targetType reason status createdAt')
      .sort('-createdAt')
      .limit(10);

    res.json({
      success: true,
      data: reportObj
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report'
    });
  }
});

/**
 * @route   POST /api/admin/reports/:id/assign
 * @desc    Assign report to admin
 * @access  Admin
 */
router.post('/:id/assign', 
  capturePreviousState(Report),
  logAdminAction('report_assign', 'report'),
  async (req, res) => {
    try {
      const { adminId } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Verify admin exists
      if (adminId) {
        const admin = await User.findOne({ _id: adminId, userType: 'admin' });
        if (!admin) {
          return res.status(400).json({
            success: false,
            message: 'Invalid admin ID'
          });
        }
        report.assignedTo = adminId;
      } else {
        // Assign to self
        report.assignedTo = req.user._id;
      }

      report.status = 'under_review';
      await report.save();

      res.json({
        success: true,
        message: 'Report assigned successfully',
        data: report
      });
    } catch (error) {
      console.error('Assign report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign report'
      });
    }
  }
);

/**
 * @route   POST /api/admin/reports/:id/resolve
 * @desc    Resolve a report
 * @access  Admin
 */
router.post('/:id/resolve',
  capturePreviousState(Report),
  logAdminAction('report_resolve', 'report'),
  async (req, res) => {
    try {
      const { action, notes, takeAction } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Resolution action is required'
        });
      }

      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Update report resolution
      report.status = 'resolved';
      report.resolution = {
        action,
        notes,
        resolvedBy: req.user._id,
        resolvedAt: new Date()
      };

      await report.save();

      // Take action on target if requested
      if (takeAction) {
        await takeActionOnTarget(report, action, notes, req.user._id);
      }

      res.json({
        success: true,
        message: 'Report resolved successfully',
        data: report
      });
    } catch (error) {
      console.error('Resolve report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve report'
      });
    }
  }
);

/**
 * @route   POST /api/admin/reports/:id/dismiss
 * @desc    Dismiss a report
 * @access  Admin
 */
router.post('/:id/dismiss',
  capturePreviousState(Report),
  logAdminAction('report_dismiss', 'report'),
  async (req, res) => {
    try {
      const { reason } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      report.status = 'dismissed';
      report.resolution = {
        action: 'dismissed',
        notes: reason || 'Report dismissed - no action needed',
        resolvedBy: req.user._id,
        resolvedAt: new Date()
      };

      await report.save();

      res.json({
        success: true,
        message: 'Report dismissed successfully',
        data: report
      });
    } catch (error) {
      console.error('Dismiss report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to dismiss report'
      });
    }
  }
);

/**
 * @route   POST /api/admin/reports/:id/escalate
 * @desc    Escalate a report
 * @access  Admin
 */
router.post('/:id/escalate',
  capturePreviousState(Report),
  logAdminAction('report_escalate', 'report'),
  async (req, res) => {
    try {
      const { reason, assignTo } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      report.status = 'escalated';
      report.priority = 'critical';
      
      if (assignTo) {
        report.assignedTo = assignTo;
      }

      // Add escalation note to description
      report.description = `${report.description}\n\n[ESCALATED by ${req.user.name}]: ${reason || 'Requires higher review'}`;

      await report.save();

      res.json({
        success: true,
        message: 'Report escalated successfully',
        data: report
      });
    } catch (error) {
      console.error('Escalate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to escalate report'
      });
    }
  }
);

/**
 * @route   POST /api/admin/reports/bulk
 * @desc    Bulk update reports
 * @access  Admin
 */
router.post('/bulk',
  logAdminAction('report_bulk_action', 'report'),
  async (req, res) => {
    try {
      const { reportIds, action, notes } = req.body;

      if (!reportIds || !reportIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Report IDs are required'
        });
      }

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Action is required'
        });
      }

      let updateData = {};
      
      switch (action) {
        case 'assign':
          updateData = {
            assignedTo: req.user._id,
            status: 'under_review'
          };
          break;
        case 'dismiss':
          updateData = {
            status: 'dismissed',
            resolution: {
              action: 'dismissed',
              notes: notes || 'Bulk dismissed',
              resolvedBy: req.user._id,
              resolvedAt: new Date()
            }
          };
          break;
        case 'escalate':
          updateData = {
            status: 'escalated',
            priority: 'critical'
          };
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action'
          });
      }

      const result = await Report.updateMany(
        { _id: { $in: reportIds } },
        { $set: updateData }
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} reports updated`,
        data: { modified: result.modifiedCount }
      });
    } catch (error) {
      console.error('Bulk report action error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk action'
      });
    }
  }
);

// Helper function to take action on reported content
async function takeActionOnTarget(report, action, notes, adminId) {
  switch (report.targetType) {
    case 'review':
      if (action === 'content_removed') {
        await Review.findByIdAndUpdate(report.targetId, {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: adminId,
          deletionReason: notes
        });
      } else if (action === 'warning_issued') {
        const review = await Review.findById(report.targetId);
        if (review && review.user) {
          await User.findByIdAndUpdate(review.user, {
            $inc: { warningCount: 1 },
            $push: {
              warnings: {
                reason: notes,
                issuedBy: adminId,
                issuedAt: new Date()
              }
            }
          });
        }
      }
      break;
      
    case 'dorm':
      if (action === 'content_removed') {
        await Dorm.findByIdAndUpdate(report.targetId, {
          status: 'removed',
          removedAt: new Date(),
          removedBy: adminId,
          removalReason: notes
        });
      }
      break;
      
    case 'user':
      if (action === 'user_banned') {
        await User.findByIdAndUpdate(report.targetId, {
          isActive: false,
          isBanned: true,
          bannedAt: new Date(),
          bannedBy: adminId,
          banReason: notes
        });
      } else if (action === 'warning_issued') {
        await User.findByIdAndUpdate(report.targetId, {
          $inc: { warningCount: 1 },
          $push: {
            warnings: {
              reason: notes,
              issuedBy: adminId,
              issuedAt: new Date()
            }
          }
        });
      }
      break;
  }
}

module.exports = router;
