const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Block = require('../models/Block');
const User = require('../models/User');

// POST /api/block - Block a user
router.post('/', auth, async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    if (!blockedUserId) return res.status(400).json({ error: 'blockedUserId required' });
    if (blockedUserId === req.user._id.toString()) return res.status(400).json({ error: 'Cannot block yourself' });
    await Block.create({ blockerUserId: req.user._id, blockedUserId });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Already blocked' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/block/:blockedUserId - Unblock a user
router.delete('/:blockedUserId', auth, async (req, res) => {
  try {
    await Block.deleteOne({ blockerUserId: req.user._id, blockedUserId: req.params.blockedUserId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/block - List blocked users
router.get('/', auth, async (req, res) => {
  const blocks = await Block.find({ blockerUserId: req.user._id }).populate('blockedUserId', 'firstName lastName email');
  res.json({ success: true, blocks });
});

module.exports = router;
