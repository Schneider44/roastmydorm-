const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { checkBlocked } = require('../middleware/block');
const { Message } = require('../models/Message');
const Block = require('../models/Block');

// GET /api/messages - Get user messages
router.get('/', auth, async (req, res) => {
  try {
    // Placeholder - return empty array
    res.json({
      success: true,
      messages: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
});


// POST /api/messages - Send a message
router.post('/', auth, checkBlocked, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content) return res.status(400).json({ error: 'recipientId and content required' });

    // Check if blocked (redundant, but double safety)
    const block = await Block.findOne({
      $or: [
        { blockerUserId: req.user._id, blockedUserId: recipientId },
        { blockerUserId: recipientId, blockedUserId: req.user._id }
      ]
    });
    if (block) return res.status(403).json({ error: 'You cannot message this user.' });

    // Chat safety flagging
    const flagKeywords = [
      'deposit', 'advance', 'urgent', 'send money', 'western union', 'whatsapp', 'cash', 'virement', 'transfert', 'dépôt', 'avance', 'تحويل', 'فلوس', 'واتساب'
    ];
    const flags = flagKeywords.filter(word => content.toLowerCase().includes(word));

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content,
      flags,
      isReported: false
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
});


// GET /api/messages/conversations - Get user's own conversations (block enforced)
router.get('/conversations', auth, async (req, res) => {
  try {
    // Only show conversations where user is a participant and not blocked
    const { MessageThread } = require('../models/Message');
    const Block = require('../models/Block');
    const threads = await MessageThread.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .lean();
    // Filter out threads where a block exists between participants
    const filtered = [];
    for (const thread of threads) {
      const otherUserId = thread.participants.find(id => id.toString() !== req.user._id.toString());
      if (!otherUserId) continue;
      const block = await Block.findOne({
        $or: [
          { blockerUserId: req.user._id, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: req.user._id }
        ]
      });
      if (!block) filtered.push(thread);
    }
    res.json({
      success: true,
      conversations: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
});

module.exports = router;
