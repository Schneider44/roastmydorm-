const express = require('express');
const router = express.Router();
const PropertyRequest = require('../models/PropertyRequest');
const { auth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { asyncHandler, errors } = require('../utils/helpers');
const { sendPropertySubmissionAlert, sendPropertyDecisionEmail } = require('../utils/email');

// ─────────────────────────────────────────────
// PUBLIC — POST /api/property-requests
// Landlord submits a property for review
// ─────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const {
    landlordName, landlordEmail, landlordPhone, landlordType,
    title, propertyType, city, neighborhood, address,
    price, description, amenities, furnished, availableFrom,
    bedrooms, bathrooms, squareFootage, leaseDuration, images
  } = req.body;

  // Basic validation
  if (!landlordName || !landlordEmail || !title || !propertyType || !city || !price || !description) {
    throw errors.badRequest('Please fill in all required fields.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(landlordEmail)) {
    throw errors.badRequest('Please provide a valid email address.');
  }

  const submission = await PropertyRequest.create({
    landlordName, landlordEmail, landlordPhone, landlordType,
    title, propertyType, city, neighborhood, address,
    price: Number(price), description,
    bedrooms: bedrooms !== undefined ? Number(bedrooms) : 0,
    bathrooms: bathrooms !== undefined ? Number(bathrooms) : 1,
    squareFootage: squareFootage ? Number(squareFootage) : undefined,
    leaseDuration: leaseDuration || undefined,
    amenities: Array.isArray(amenities) ? amenities : [],
    furnished: Boolean(furnished),
    availableFrom: availableFrom ? new Date(availableFrom) : undefined,
    images: Array.isArray(images) ? images.slice(0, 10) : []
  });

  // Notify admin (non-blocking — don't fail the request if email fails)
  sendPropertySubmissionAlert(submission).catch(err =>
    console.error('Admin email notification failed:', err.message)
  );

  res.status(201).json({
    success: true,
    message: 'Your property has been submitted for review. We will contact you within 24 hours.',
    data: { id: submission._id }
  });
}));

// ─────────────────────────────────────────────
// ADMIN — GET /api/property-requests
// List all submissions (filterable by status)
// ─────────────────────────────────────────────
router.get('/', auth, isAdmin, asyncHandler(async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const filter = status === 'all' ? {} : { status };

  const [submissions, total] = await Promise.all([
    PropertyRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    PropertyRequest.countDocuments(filter)
  ]);

  res.json({ success: true, data: submissions, total, page: Number(page) });
}));

// ─────────────────────────────────────────────
// ADMIN — PATCH /api/property-requests/:id
// Approve or reject a submission
// ─────────────────────────────────────────────
router.patch('/:id', auth, isAdmin, asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw errors.badRequest('Status must be "approved" or "rejected".');
  }

  const submission = await PropertyRequest.findByIdAndUpdate(
    req.params.id,
    {
      status,
      adminNote: adminNote || '',
      reviewedAt: new Date(),
      reviewedBy: req.user._id
    },
    { new: true }
  );

  if (!submission) throw errors.notFound('Property submission');

  // Email landlord the decision (non-blocking)
  sendPropertyDecisionEmail(submission, status, adminNote).catch(err =>
    console.error('Landlord decision email failed:', err.message)
  );

  res.json({
    success: true,
    message: `Submission ${status}.`,
    data: submission
  });
}));

// ─────────────────────────────────────────────
// ADMIN — GET /api/property-requests/stats
// Count by status (for dashboard badge)
// ─────────────────────────────────────────────
router.get('/stats', auth, isAdmin, asyncHandler(async (req, res) => {
  const stats = await PropertyRequest.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const result = { pending: 0, approved: 0, rejected: 0 };
  stats.forEach(s => { result[s._id] = s.count; });
  res.json({ success: true, data: result });
}));

module.exports = router;
