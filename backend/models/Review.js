const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Basic Information
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Review Content
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Ratings
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  ratings: {
    cleanliness: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    safety: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    location: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    landlord: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    }
  },
  
  // Living Experience
  livingPeriod: {
    startDate: Date,
    endDate: Date,
    duration: Number, // in months
    roomType: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad', 'studio', 'apartment']
    }
  },
  
  // Pros and Cons
  pros: [String],
  cons: [String],
  
  // Images
  images: [{
    url: String,
    caption: String
  }],
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: ['email', 'student_id', 'booking_confirmation', 'manual'],
    default: 'email'
  },
  verifiedAt: Date,
  
  // Landlord Response
  landlordResponse: {
    content: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Engagement
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: Boolean, // true for helpful, false for not helpful
    createdAt: { type: Date, default: Date.now }
  }],
  helpfulCount: { type: Number, default: 0 },
  
  // Moderation
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  moderationNotes: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  
  // Reporting
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'fake', 'spam', 'harassment', 'other']
    },
    description: String,
    reportedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  
  // Analytics
  views: { type: Number, default: 0 },
  shares: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes for better performance
reviewSchema.index({ dorm: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ overallRating: -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ isVerified: 1 });
reviewSchema.index({ 'ratings.cleanliness': 1 });
reviewSchema.index({ 'ratings.safety': 1 });
reviewSchema.index({ 'ratings.location': 1 });
reviewSchema.index({ 'ratings.landlord': 1 });
reviewSchema.index({ 'ratings.value': 1 });

// Compound index for unique user review per dorm
reviewSchema.index({ dorm: 1, user: 1 }, { unique: true });

// Virtual for average category rating
reviewSchema.virtual('averageCategoryRating').get(function() {
  const ratings = this.ratings;
  return Math.round(((ratings.cleanliness + ratings.safety + ratings.location + ratings.landlord + ratings.value) / 5) * 10) / 10;
});

// Virtual for review age
reviewSchema.virtual('age').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Update helpful count
reviewSchema.methods.updateHelpfulCount = function() {
  this.helpfulCount = this.helpful.filter(h => h.helpful === true).length;
  return this.save();
};

// Add helpful vote
reviewSchema.methods.addHelpfulVote = function(userId, isHelpful) {
  // Remove existing vote from this user
  this.helpful = this.helpful.filter(h => !h.user.equals(userId));
  
  // Add new vote
  this.helpful.push({
    user: userId,
    helpful: isHelpful
  });
  
  return this.updateHelpfulCount();
};

// Report review
reviewSchema.methods.reportReview = function(userId, reason, description) {
  this.reports.push({
    reportedBy: userId,
    reason: reason,
    description: description
  });
  return this.save();
};

// Get public data
reviewSchema.methods.getPublicData = function() {
  const reviewObject = this.toObject();
  delete reviewObject.moderationNotes;
  delete reviewObject.reports;
  return reviewObject;
};

// Pre-save middleware to update dorm rating
reviewSchema.post('save', async function() {
  if (this.status === 'approved') {
    await this.model('Dorm').findByIdAndUpdate(
      this.dorm,
      { $addToSet: { reviews: this._id } }
    );
    
    // Update dorm's average rating
    const dorm = await this.model('Dorm').findById(this.dorm);
    if (dorm) {
      await dorm.updateRating();
    }
  }
});

// Pre-remove middleware to update dorm rating
reviewSchema.pre('remove', async function() {
  await this.model('Dorm').findByIdAndUpdate(
    this.dorm,
    { $pull: { reviews: this._id } }
  );
  
  // Update dorm's average rating
  const dorm = await this.model('Dorm').findById(this.dorm);
  if (dorm) {
    await dorm.updateRating();
  }
});

module.exports = mongoose.model('Review', reviewSchema);

