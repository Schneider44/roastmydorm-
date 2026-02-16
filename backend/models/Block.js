const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  blockerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blockedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique index to prevent duplicate blocks
blockSchema.index({ blockerUserId: 1, blockedUserId: 1 }, { unique: true });

module.exports = mongoose.model('Block', blockSchema);
