const express = require('express');
const router = express.Router();
const Dorm = require('../models/Dorm');
const auth = require('../middleware/auth');

// GET /api/dorms - Get all dorms with filters
router.get('/', async (req, res) => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      roomType,
      amenities,
      distance,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'active' };

    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
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

    // Distance filter (if coordinates are available)
    if (distance && distance !== 'all') {
      // This would require geospatial queries in a real implementation
      // For now, we'll filter by the distanceToUniversity field
      const distanceMap = {
        '<1km': { $regex: /<1km|0\.\d+km/ },
        '<3km': { $regex: /<3km|<2km|<1km|0\.\d+km|1\.\d+km|2\.\d+km/ },
        '<5km': { $regex: /<5km|<4km|<3km|<2km|<1km|0\.\d+km|1\.\d+km|2\.\d+km|3\.\d+km|4\.\d+km/ }
      };
      if (distanceMap[distance]) {
        filter.distanceToUniversity = distanceMap[distance];
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const dorms = await Dorm.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('landlordId', 'name email verified');

    const total = await Dorm.countDocuments(filter);

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
    console.error('Error fetching dorms:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dorms',
      error: error.message
    });
  }
});

// GET /api/dorms/:id - Get single dorm details
router.get('/:id', async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id)
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

// POST /api/dorms - Create new dorm (landlord only)
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

    const dorm = new Dorm(dormData);
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

// PUT /api/dorms/:id - Update dorm (landlord only)
router.put('/:id', auth, async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

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

    const updatedDorm = await Dorm.findByIdAndUpdate(
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

// DELETE /api/dorms/:id - Delete dorm (landlord only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

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

    await Dorm.findByIdAndDelete(req.params.id);

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

// GET /api/dorms/landlord/:landlordId - Get dorms by landlord
router.get('/landlord/:landlordId', auth, async (req, res) => {
  try {
    // Check if user is requesting their own dorms or is admin
    if (req.params.landlordId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own listings'
      });
    }

    const dorms = await Dorm.find({ landlordId: req.params.landlordId })
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

// POST /api/dorms/:id/inquiry - Add inquiry to dorm
router.post('/:id/inquiry', async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

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

module.exports = router;
