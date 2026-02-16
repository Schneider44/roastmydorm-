const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const Report = require('../models/Report');
const Profile = require('../models/Profile');

// GET /api/admin/reports - List all open/reviewing reports
router.get('/reports', auth, isAdmin, async (req, res) => {
  const reports = await Report.find({ status: { $in: ['open', 'reviewing'] } }).sort({ createdAt: -1 });
  res.json({ success: true, reports });
});

// PATCH /api/admin/reports/:id - Update report status
router.patch('/reports/:id', auth, isAdmin, async (req, res) => {
  const { status, adminNote } = req.body;
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status, 'resolution.notes': adminNote },
    { new: true }
  );
  res.json({ success: true, report });
});

// PATCH /api/admin/profiles/:profileId/verify - Mark profile as verified
router.patch('/profiles/:profileId/verify', auth, isAdmin, async (req, res) => {
  const { isVerified, verificationLevel } = req.body;
  const profile = await Profile.findByIdAndUpdate(
    req.params.profileId,
    { isVerified, verificationLevel },
    { new: true }
  );
  res.json({ success: true, profile });
});

module.exports = router;
