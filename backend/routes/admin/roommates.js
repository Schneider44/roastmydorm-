const express = require('express');
const router = express.Router();
const RoommateProfile = require('../../models/RoommateProfile');
const RoommateMatch = require('../../models/RoommateMatch');
const Report = require('../../models/Report');
const { logAdminAction } = require('../../middleware/admin');

/**
 * @route   GET /api/admin/roommates
 * @desc    Get all roommate profiles
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      city,
      university,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    if (city) {
      query['location.preferredCity'] = { $regex: city, $options: 'i' };
    }

    if (university) {
      query['university'] = { $regex: university, $options: 'i' };
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'flagged') {
      query.isFlagged = true;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [profiles, total] = await Promise.all([
      RoommateProfile.find(query)
        .populate('user', 'firstName lastName email profilePicture')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      RoommateProfile.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        profiles,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get roommate profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roommate profiles'
    });
  }
});

/**
 * @route   GET /api/admin/roommates/stats
 * @desc    Get roommate statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProfiles,
      activeProfiles,
      flaggedProfiles,
      newThisMonth,
      totalMatches,
      successfulMatches,
      byCity
    ] = await Promise.all([
      RoommateProfile.countDocuments(),
      RoommateProfile.countDocuments({ isActive: true }),
      RoommateProfile.countDocuments({ isFlagged: true }),
      RoommateProfile.countDocuments({ createdAt: { $gte: thisMonth } }),
      RoommateMatch.countDocuments(),
      RoommateMatch.countDocuments({ status: 'accepted' }),
      RoommateProfile.aggregate([
        { $group: { _id: '$location.preferredCity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalProfiles,
        activeProfiles,
        flaggedProfiles,
        newThisMonth,
        matches: {
          total: totalMatches,
          successful: successfulMatches,
          successRate: totalMatches > 0 ? ((successfulMatches / totalMatches) * 100).toFixed(1) : 0
        },
        byCity
      }
    });
  } catch (error) {
    console.error('Roommate stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roommate statistics'
    });
  }
});

/**
 * @route   GET /api/admin/roommates/matches
 * @desc    Get all roommate matches
 * @access  Admin
 */
router.get('/matches', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const [matches, total] = await Promise.all([
      RoommateMatch.find(query)
        .populate({
          path: 'user1',
          populate: { path: 'user', select: 'firstName lastName email' }
        })
        .populate({
          path: 'user2',
          populate: { path: 'user', select: 'firstName lastName email' }
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      RoommateMatch.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        matches,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roommate matches'
    });
  }
});

/**
 * @route   GET /api/admin/roommates/:id
 * @desc    Get single roommate profile
 * @access  Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const profile = await RoommateProfile.findById(req.params.id)
      .populate('user', 'firstName lastName email profilePicture phone university');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    // Get matches for this profile
    const matches = await RoommateMatch.find({
      $or: [{ user1: profile._id }, { user2: profile._id }]
    })
      .populate({
        path: 'user1 user2',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get reports
    const reports = await Report.find({
      targetType: 'roommate_profile',
      targetId: profile._id
    })
      .populate('reporter', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        profile,
        matches,
        reports
      }
    });
  } catch (error) {
    console.error('Get roommate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roommate profile'
    });
  }
});

/**
 * @route   POST /api/admin/roommates/:id/flag
 * @desc    Flag roommate profile
 * @access  Admin
 */
router.post('/:id/flag', logAdminAction('roommate_flag', 'roommate'), async (req, res) => {
  try {
    const { reason } = req.body;

    const profile = await RoommateProfile.findByIdAndUpdate(
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

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile flagged',
      data: profile
    });
  } catch (error) {
    console.error('Flag roommate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag profile'
    });
  }
});

/**
 * @route   POST /api/admin/roommates/:id/unflag
 * @desc    Remove flag from roommate profile
 * @access  Admin
 */
router.post('/:id/unflag', async (req, res) => {
  try {
    const profile = await RoommateProfile.findByIdAndUpdate(
      req.params.id,
      {
        $set: { isFlagged: false },
        $unset: { flagReason: 1, flaggedAt: 1, flaggedBy: 1 }
      },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile unflagged',
      data: profile
    });
  } catch (error) {
    console.error('Unflag roommate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unflag profile'
    });
  }
});

/**
 * @route   DELETE /api/admin/roommates/:id
 * @desc    Delete roommate profile
 * @access  Admin
 */
router.delete('/:id', logAdminAction('roommate_delete', 'roommate'), async (req, res) => {
  try {
    const { reason } = req.body;

    const profile = await RoommateProfile.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user._id,
          deleteReason: reason
        }
      },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    // Cancel any pending matches
    await RoommateMatch.updateMany(
      {
        $or: [{ user1: profile._id }, { user2: profile._id }],
        status: 'pending'
      },
      { $set: { status: 'cancelled' } }
    );

    res.json({
      success: true,
      message: 'Roommate profile deleted'
    });
  } catch (error) {
    console.error('Delete roommate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile'
    });
  }
});

/**
 * @route   POST /api/admin/roommates/:id/activate
 * @desc    Activate/deactivate roommate profile
 * @access  Admin
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const { active } = req.body;

    const profile = await RoommateProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: active !== false } },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    res.json({
      success: true,
      message: profile.isActive ? 'Profile activated' : 'Profile deactivated',
      data: profile
    });
  } catch (error) {
    console.error('Activate roommate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile status'
    });
  }
});

module.exports = router;
