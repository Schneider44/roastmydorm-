const mongoose = require('mongoose');

const roommateMatchSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  confirmedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

roommateMatchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

module.exports = mongoose.model('RoommateMatch', roommateMatchSchema);
