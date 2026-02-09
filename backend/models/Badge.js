const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  // Badge Information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  // Visual
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#667eea'
  },
  
  // Category
  category: {
    type: String,
    enum: ['reviewer', 'community', 'verification', 'achievement', 'special'],
    required: true
  },
  
  // Requirements
  requirement: {
    type: {
      type: String,
      enum: [
        'reviews_count',
        'helpful_votes',
        'verified_status',
        'first_review',
        'answers_count',
        'questions_answered',
        'profile_complete',
        'time_on_platform',
        'special_event'
      ],
      required: true
    },
    value: { type: Number, default: 1 },
    description: String
  },
  
  // Rarity
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  
  // Points awarded
  points: { type: Number, default: 10 },
  
  // Status
  isActive: { type: Boolean, default: true },
  
  // Stats
  totalAwarded: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes
badgeSchema.index({ slug: 1 });
badgeSchema.index({ category: 1 });
badgeSchema.index({ 'requirement.type': 1 });

module.exports = mongoose.model('Badge', badgeSchema);

// User Badge schema (for tracking which users have which badges)
const userBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
    required: true
  },
  awardedAt: {
    type: Date,
    default: Date.now
  },
  reason: String,
  isDisplayed: { type: Boolean, default: true }
}, {
  timestamps: true
});

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, awardedAt: -1 });

const UserBadge = mongoose.model('UserBadge', userBadgeSchema);

module.exports.UserBadge = UserBadge;
