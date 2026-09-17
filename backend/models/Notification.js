const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['roommate_interest', 'roommate_match', 'roommate_interest_declined'],
    required: true,
  },
  // The RoommateMatch _id this notification is about - never a userId, so
  // nothing here can be confused with the identifiers above.
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  // Same reasoning as RoommateMatch.js: this unique index is a safety
  // guarantee against duplicate notifications (retries, the reciprocal
  // sendInterest path, double-clicks) and must be built through the one
  // explicit, awaited ensureCriticalIndexes() call in server.js, never
  // Mongoose's implicit background autoIndex build.
  autoIndex: false,
});

notificationSchema.index({ recipientUser: 1, entityId: 1, type: 1 }, { unique: true });
notificationSchema.index({ recipientUser: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
