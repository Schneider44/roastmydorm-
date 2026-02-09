const express = require('express');
const router = express.Router();
const multer = require('multer');
const Dorm = require('../../models/Dorm');
const Review = require('../../models/Review');
const { logAdminAction, capturePreviousState } = require('../../middleware/admin');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * @route   GET /api/admin/dorms
 * @desc    Get all dorms with filtering
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      city,
      status,
      propertyType,
      featured,
      verified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      priceMin,
      priceMax
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address.street': { $regex: search, $options: 'i' } }
      ];
    }

    if (city) {
      query['location.address.city'] = { $regex: city, $options: 'i' };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (propertyType && propertyType !== 'all') {
      query.propertyType = propertyType;
    }

    if (featured !== undefined) {
      query.isFeatured = featured === 'true';
    }

    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }

    if (priceMin || priceMax) {
      query['pricing.baseRent'] = {};
      if (priceMin) query['pricing.baseRent'].$gte = parseInt(priceMin);
      if (priceMax) query['pricing.baseRent'].$lte = parseInt(priceMax);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [dorms, total] = await Promise.all([
      Dorm.find(query)
        .populate('landlord', 'firstName lastName email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Dorm.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        dorms,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get dorms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dorms'
    });
  }
});

/**
 * @route   GET /api/admin/dorms/stats
 * @desc    Get dorm statistics
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalDorms,
      activeDorms,
      pendingDorms,
      featuredDorms,
      verifiedDorms,
      byCity,
      byType,
      avgPrice
    ] = await Promise.all([
      Dorm.countDocuments(),
      Dorm.countDocuments({ status: 'active' }),
      Dorm.countDocuments({ status: 'pending' }),
      Dorm.countDocuments({ isFeatured: true }),
      Dorm.countDocuments({ isVerified: true }),
      Dorm.aggregate([
        { $group: { _id: '$location.address.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Dorm.aggregate([
        { $group: { _id: '$propertyType', count: { $sum: 1 } } }
      ]),
      Dorm.aggregate([
        { $group: { _id: null, avgRent: { $avg: '$pricing.baseRent' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total: totalDorms,
        active: activeDorms,
        pending: pendingDorms,
        featured: featuredDorms,
        verified: verifiedDorms,
        byCities: byCity,
        byPropertyType: byType,
        averageRent: avgPrice[0]?.avgRent?.toFixed(0) || 0
      }
    });
  } catch (error) {
    console.error('Dorm stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dorm statistics'
    });
  }
});

/**
 * @route   GET /api/admin/dorms/pending
 * @desc    Get pending dorm submissions
 * @access  Admin
 */
router.get('/pending', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const [dorms, total] = await Promise.all([
      Dorm.find({ status: 'pending' })
        .populate('landlord', 'firstName lastName email phone')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Dorm.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        dorms,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get pending dorms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending dorms'
    });
  }
});

/**
 * @route   GET /api/admin/dorms/:id
 * @desc    Get single dorm with full details
 * @access  Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id)
      .populate('landlord', 'firstName lastName email phone landlordInfo');

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // Get reviews for this dorm
    const reviews = await Review.find({ dorm: dorm._id })
      .populate('user', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get admin actions
    const AdminAction = require('../../models/AdminAction');
    const adminHistory = await AdminAction.getByTarget('dorm', dorm._id);

    res.json({
      success: true,
      data: {
        dorm,
        reviews,
        adminHistory
      }
    });
  } catch (error) {
    console.error('Get dorm error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dorm'
    });
  }
});

/**
 * @route   POST /api/admin/dorms
 * @desc    Create new dorm listing
 * @access  Admin
 */
router.post('/', 
  upload.array('images', 10),
  logAdminAction('dorm_create', 'dorm'),
  async (req, res) => {
    try {
      const dormData = JSON.parse(req.body.data || '{}');

      // Generate slug
      const slug = dormData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const dorm = new Dorm({
        ...dormData,
        slug,
        status: 'active',
        createdBy: req.user._id
      });

      // Handle image uploads if any
      if (req.files && req.files.length > 0) {
        // In production, upload to Cloudinary
        dorm.images = req.files.map((file, index) => ({
          url: `/uploads/dorms/${dorm._id}_${index}.jpg`,
          caption: '',
          isPrimary: index === 0
        }));
      }

      await dorm.save();

      res.status(201).json({
        success: true,
        message: 'Dorm created successfully',
        data: dorm
      });
    } catch (error) {
      console.error('Create dorm error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create dorm'
      });
    }
  }
);

/**
 * @route   PUT /api/admin/dorms/:id
 * @desc    Update dorm listing
 * @access  Admin
 */
router.put('/:id',
  upload.array('images', 10),
  capturePreviousState(Dorm),
  logAdminAction('dorm_edit', 'dorm'),
  async (req, res) => {
    try {
      const updateData = JSON.parse(req.body.data || JSON.stringify(req.body));

      const dorm = await Dorm.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!dorm) {
        return res.status(404).json({
          success: false,
          message: 'Dorm not found'
        });
      }

      res.json({
        success: true,
        message: 'Dorm updated successfully',
        data: dorm
      });
    } catch (error) {
      console.error('Update dorm error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update dorm'
      });
    }
  }
);

/**
 * @route   POST /api/admin/dorms/:id/approve
 * @desc    Approve pending dorm
 * @access  Admin
 */
router.post('/:id/approve', logAdminAction('dorm_approve', 'dorm'), async (req, res) => {
  try {
    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'active',
          approvedAt: new Date(),
          approvedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // TODO: Send notification to landlord

    res.json({
      success: true,
      message: 'Dorm approved successfully',
      data: dorm
    });
  } catch (error) {
    console.error('Approve dorm error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve dorm'
    });
  }
});

/**
 * @route   POST /api/admin/dorms/:id/reject
 * @desc    Reject pending dorm
 * @access  Admin
 */
router.post('/:id/reject', logAdminAction('dorm_reject', 'dorm'), async (req, res) => {
  try {
    const { reason } = req.body;

    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: req.user._id,
          rejectionReason: reason
        }
      },
      { new: true }
    );

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // TODO: Send notification to landlord

    res.json({
      success: true,
      message: 'Dorm rejected',
      data: dorm
    });
  } catch (error) {
    console.error('Reject dorm error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject dorm'
    });
  }
});

/**
 * @route   POST /api/admin/dorms/:id/feature
 * @desc    Feature/unfeature dorm
 * @access  Admin
 */
router.post('/:id/feature', logAdminAction('dorm_feature', 'dorm'), async (req, res) => {
  try {
    const { featured } = req.body;

    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isFeatured: featured !== false,
          featuredAt: featured !== false ? new Date() : null
        }
      },
      { new: true }
    );

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      message: dorm.isFeatured ? 'Dorm featured' : 'Dorm unfeatured',
      data: dorm
    });
  } catch (error) {
    console.error('Feature dorm error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured status'
    });
  }
});

/**
 * @route   DELETE /api/admin/dorms/:id
 * @desc    Delete dorm listing
 * @access  Admin
 */
router.delete('/:id', logAdminAction('dorm_delete', 'dorm'), async (req, res) => {
  try {
    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          deletedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      message: 'Dorm deleted successfully'
    });
  } catch (error) {
    console.error('Delete dorm error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dorm'
    });
  }
});

/**
 * @route   POST /api/admin/dorms/:id/images
 * @desc    Upload images for dorm
 * @access  Admin
 */
router.post('/:id/images', upload.array('images', 10), async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // In production, upload to Cloudinary
    const newImages = req.files.map((file, index) => ({
      url: `/uploads/dorms/${dorm._id}_${Date.now()}_${index}.jpg`,
      caption: '',
      isPrimary: dorm.images.length === 0 && index === 0
    }));

    dorm.images.push(...newImages);
    await dorm.save();

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: dorm.images
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images'
    });
  }
});

/**
 * @route   DELETE /api/admin/dorms/:id/images/:imageId
 * @desc    Delete image from dorm
 * @access  Admin
 */
router.delete('/:id/images/:imageId', async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    dorm.images = dorm.images.filter(img => img._id.toString() !== req.params.imageId);
    await dorm.save();

    res.json({
      success: true,
      message: 'Image deleted successfully',
      data: dorm.images
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image'
    });
  }
});

/**
 * @route   GET /api/admin/dorms/duplicates
 * @desc    Find potential duplicate listings
 * @access  Admin
 */
router.get('/check/duplicates', async (req, res) => {
  try {
    // Find dorms with similar names or addresses
    const duplicates = await Dorm.aggregate([
      {
        $group: {
          _id: { 
            name: { $toLower: '$name' },
            city: '$location.address.city'
          },
          count: { $sum: 1 },
          dorms: { $push: { _id: '$_id', name: '$name', status: '$status' } }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: duplicates
    });
  } catch (error) {
    console.error('Find duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find duplicates'
    });
  }
});

module.exports = router;
