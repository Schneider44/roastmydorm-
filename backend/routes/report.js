const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Report = require('../models/Report');

// POST /api/reports - Submit a report
router.post('/', auth, async (req, res) => {
  try {
    const { targetType, targetId, reason, details, conversationId } = req.body;
    if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Missing required fields' });
    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      description: details,
      conversationId,
      status: 'open'
    });
    res.status(201).json({ success: true, report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/me - List user's submitted reports
router.get('/me', auth, async (req, res) => {
  const reports = await Report.find({ reporter: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, reports });
});

module.exports = router;
