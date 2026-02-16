const Block = require('../models/Block');

// Middleware to check if users are blocked from interacting
async function checkBlocked(req, res, next) {
  const userId = req.user._id;
  const { recipientId, targetUserId } = req.body;
  const otherUserId = recipientId || targetUserId || req.params.userId;
  if (!otherUserId) return next();
  const block = await Block.findOne({
    $or: [
      { blockerUserId: userId, blockedUserId: otherUserId },
      { blockerUserId: otherUserId, blockedUserId: userId }
    ]
  });
  if (block) {
    return res.status(403).json({ error: 'You cannot message this user.' });
  }
  next();
}

module.exports = { checkBlocked };
