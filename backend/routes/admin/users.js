const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Review = require('../../models/Review');
const AdminAction = require('../../models/AdminAction');
const { logAdminAction, capturePreviousState } = require('../../middleware/admin');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering and pagination
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      university,
      status,
      userType,
      verified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = req.query;

    // Build query
    const query = { userType: { $ne: 'admin' } };

    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by university
    if (university) {
      query['university.name'] = { $regex: university, $options: 'i' };
    }

    // Filter by user type
    if (userType && userType !== 'all') {
      query.userType = userType;
    }

    // Filter by status
    if (status) {
      switch (status) {
        case 'active':
          query.isActive = true;
          query.isBanned = { $ne: true };
          break;
        case 'suspended':
          query.isSuspended = true;
          break;
        case 'banned':
          query.isBanned = true;
          break;
        case 'inactive':
          query.isActive = false;
          break;
      }
    }

    // Filter by verification status
    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -verificationToken')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Get review counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const reviewCount = await Review.countDocuments({ user: user._id });
        return {
          ...user.toObject(),
          reviewCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

/**
 * @route   GET /api/admin/users/stats
 * @desc    Get user statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      verifiedUsers,
      students,
      landlords,
      bannedUsers,
      newThisMonth,
      newLastMonth,
      byUniversity
    ] = await Promise.all([
      User.countDocuments({ userType: { $ne: 'admin' } }),
      User.countDocuments({ isVerified: true, userType: { $ne: 'admin' } }),
      User.countDocuments({ userType: 'student' }),
      User.countDocuments({ userType: 'landlord' }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ createdAt: { $gte: thisMonth }, userType: { $ne: 'admin' } }),
      User.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth }, userType: { $ne: 'admin' } }),
      User.aggregate([
        { $match: { 'university.name': { $exists: true, $ne: null } } },
        { $group: { _id: '$university.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total: totalUsers,
        verified: verifiedUsers,
        verificationRate: ((verifiedUsers / totalUsers) * 100).toFixed(1),
        byType: {
          students,
          landlords
        },
        banned: bannedUsers,
        growth: {
          thisMonth: newThisMonth,
          lastMonth: newLastMonth,
          rate: lastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth * 100).toFixed(1) : 100
        },
        topUniversities: byUniversity
      }
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user with full details
 * @access  Admin
 */
router.get('/:id', logAdminAction('user_view', 'user'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -verificationToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's reviews
    const reviews = await Review.find({ user: user._id })
      .populate('dorm', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get admin actions on this user
    const adminActions = await AdminAction.getByTarget('user', user._id);

    res.json({
      success: true,
      data: {
        user,
        reviews,
        adminHistory: adminActions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details
 * @access  Admin
 */
router.put('/:id', 
  capturePreviousState(User),
  logAdminAction('user_edit', 'user'),
  async (req, res) => {
    try {
      const { firstName, lastName, email, university, isVerified, isActive } = req.body;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            firstName,
            lastName,
            email,
            university,
            isVerified,
            isActive
          }
        },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }
);

/**
 * @route   POST /api/admin/users/:id/verify
 * @desc    Verify user account
 * @access  Admin
 */
router.post('/:id/verify', logAdminAction('user_verify', 'user'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: req.user._id
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User verified successfully',
      data: user
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify user'
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/ban
 * @desc    Ban user
 * @access  Admin
 */
router.post('/:id/ban', logAdminAction('user_ban', 'user'), async (req, res) => {
  try {
    const { reason, notes } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isBanned: true,
          isActive: false,
          banReason: reason,
          bannedAt: new Date(),
          bannedBy: req.user._id
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User banned successfully',
      data: user
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban user'
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/suspend
 * @desc    Suspend user temporarily
 * @access  Admin
 */
router.post('/:id/suspend', logAdminAction('user_suspend', 'user'), async (req, res) => {
  try {
    const { reason, duration, notes } = req.body; // duration in days

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + (duration || 7));

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isSuspended: true,
          suspendedUntil,
          suspendReason: reason,
          suspendedAt: new Date(),
          suspendedBy: req.user._id
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User suspended until ${suspendedUntil.toLocaleDateString()}`,
      data: user
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend user'
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/unban
 * @desc    Unban/unsuspend user
 * @access  Admin
 */
router.post('/:id/unban', logAdminAction('user_unban', 'user'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isBanned: false,
          isSuspended: false,
          isActive: true
        },
        $unset: {
          banReason: 1,
          suspendReason: 1,
          suspendedUntil: 1
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User unbanned successfully',
      data: user
    });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban user'
    });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user account
 * @access  Admin
 */
router.delete('/:id', logAdminAction('user_delete', 'user'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete - mark as deleted instead of removing
    await User.findByIdAndUpdate(req.params.id, {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
        email: `deleted_${Date.now()}_${user.email}`, // Prevent email reuse
        isActive: false
      }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

/**
 * @route   GET /api/admin/users/:id/activity
 * @desc    Get user activity history
 * @access  Admin
 */
router.get('/:id/activity', async (req, res) => {
  try {
    const AnalyticsEvent = require('../../models/AnalyticsEvent');
    const { limit = 50, page = 1 } = req.query;

    const [events, total] = await Promise.all([
      AnalyticsEvent.find({ userId: req.params.id })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      AnalyticsEvent.countDocuments({ userId: req.params.id })
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity'
    });
  }
});

module.exports = router;
