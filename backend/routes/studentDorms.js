const express = require('express');
const router = express.Router();
const StudentDorm = require('../models/StudentDorm');
const auth = require('../middleware/auth');

// GET /api/student-dorms - Get dorms by city with filters
router.get('/', async (req, res) => {
  try {
    const {
      city,
      minPrice,
      maxPrice,
      roomType,
      amenities,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'available' };

    // City filter (required)
    if (city) {
      filter.city = city.toLowerCase();
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    // Room type filter
    if (roomType && roomType !== 'all') {
      filter.roomType = roomType;
    }

    // Amenities filter
    if (amenities) {
      const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
      filter.amenities = { $all: amenitiesArray };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const dorms = await StudentDorm.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('landlordId', 'name email verified');

    const total = await StudentDorm.countDocuments(filter);

    res.json({
      success: true,
      data: dorms,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching student dorms:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dorms',
      error: error.message
    });
  }
});

// GET /api/student-dorms/:id - Get single dorm details
router.get('/:id', async (req, res) => {
  try {
    const dorm = await StudentDorm.findById(req.params.id)
      .populate('landlordId', 'name email phone verified');

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // Increment view count
    dorm.views += 1;
    await dorm.save();

    res.json({
      success: true,
      data: dorm
    });
  } catch (error) {
    console.error('Error fetching dorm:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dorm',
      error: error.message
    });
  }
});

// POST /api/student-dorms - Create new dorm (landlord only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is landlord
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only landlords can create dorm listings'
      });
    }

    const dormData = {
      ...req.body,
      landlordId: req.user._id,
      landlord: {
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        verified: req.user.verified
      }
    };

    // Set default payment options
    if (!dormData.paymentOptions || dormData.paymentOptions.length === 0) {
      dormData.paymentOptions = [
        {
          id: 'credit-card',
          title: 'Pay by Credit Card',
          description: 'Direct payment to landlord',
          note: 'Payment handled outside the platform'
        },
        {
          id: 'face-to-face',
          title: 'Pay Face to Face',
          description: 'Arrange with landlord upon arrival',
          note: 'Arrange with the landlord upon arrival'
        }
      ];
    }

    const dorm = new StudentDorm(dormData);
    await dorm.save();

    res.status(201).json({
      success: true,
      data: dorm,
      message: 'Dorm listing created successfully'
    });
  } catch (error) {
    console.error('Error creating dorm:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating dorm listing',
      error: error.message
    });
  }
});

// PUT /api/student-dorms/:id - Update dorm (landlord only)
router.put('/:id', auth, async (req, res) => {
  try {
    const dorm = await StudentDorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // Check if user owns the dorm or is admin
    if (dorm.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own listings'
      });
    }

    const updatedDorm = await StudentDorm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedDorm,
      message: 'Dorm listing updated successfully'
    });
  } catch (error) {
    console.error('Error updating dorm:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating dorm listing',
      error: error.message
    });
  }
});

// DELETE /api/student-dorms/:id - Delete dorm (landlord only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const dorm = await StudentDorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // Check if user owns the dorm or is admin
    if (dorm.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own listings'
      });
    }

    await StudentDorm.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Dorm listing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dorm:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting dorm listing',
      error: error.message
    });
  }
});

// GET /api/student-dorms/landlord/:landlordId - Get dorms by landlord
router.get('/landlord/:landlordId', auth, async (req, res) => {
  try {
    // Check if user is requesting their own dorms or is admin
    if (req.params.landlordId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own listings'
      });
    }

    const dorms = await StudentDorm.find({ landlordId: req.params.landlordId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: dorms
    });
  } catch (error) {
    console.error('Error fetching landlord dorms:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching landlord dorms',
      error: error.message
    });
  }
});

// POST /api/student-dorms/:id/inquiry - Add inquiry to dorm
router.post('/:id/inquiry', async (req, res) => {
  try {
    const dorm = await StudentDorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    dorm.inquiries += 1;
    await dorm.save();

    // Here you would typically save the inquiry details to a separate collection
    // and send notification to landlord

    res.json({
      success: true,
      message: 'Inquiry submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting inquiry',
      error: error.message
    });
  }
});

// GET /api/student-dorms/cities/stats - Get city statistics
router.get('/cities/stats', async (req, res) => {
  try {
    const stats = await StudentDorm.aggregate([
      {
        $match: { status: 'available' }
      },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching city stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching city statistics',
      error: error.message
    });
  }
});

module.exports = router;
