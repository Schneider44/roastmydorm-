const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  voteScore: { type: Number, default: 0 },
  isVerifiedResident: { type: Boolean, default: false },
  isAccepted: { type: Boolean, default: false },
  reports: [{
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    reportedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['active', 'hidden', 'removed'],
    default: 'active'
  }
}, {
  timestamps: true
});

const questionSchema = new mongoose.Schema({
  // Question Content
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Associations
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Categorization
  category: {
    type: String,
    enum: [
      'amenities',
      'pricing',
      'location',
      'safety',
      'landlord',
      'roommates',
      'utilities',
      'rules',
      'move-in',
      'general'
    ],
    default: 'general'
  },
  tags: [String],
  
  // Answers
  answers: [answerSchema],
  answersCount: { type: Number, default: 0 },
  
  // Engagement
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  voteScore: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['open', 'answered', 'closed', 'hidden'],
    default: 'open'
  },
  isResolved: { type: Boolean, default: false },
  
  // Moderation
  reports: [{
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'duplicate', 'off-topic', 'other']
    },
    description: String,
    reportedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes
questionSchema.index({ dorm: 1, createdAt: -1 });
questionSchema.index({ author: 1 });
questionSchema.index({ category: 1 });
questionSchema.index({ voteScore: -1 });
questionSchema.index({ status: 1 });
questionSchema.index({ title: 'text', content: 'text' });

// Update vote score
questionSchema.methods.updateVoteScore = function() {
  this.voteScore = this.upvotes.length - this.downvotes.length;
  return this.save();
};

// Update answers count
questionSchema.methods.updateAnswersCount = function() {
  this.answersCount = this.answers.filter(a => a.status === 'active').length;
  if (this.answersCount > 0 && this.status === 'open') {
    this.status = 'answered';
  }
  return this.save();
};

// Vote on question
questionSchema.methods.vote = function(userId, isUpvote) {
  const userIdStr = userId.toString();
  
  // Remove any existing vote
  this.upvotes = this.upvotes.filter(id => id.toString() !== userIdStr);
  this.downvotes = this.downvotes.filter(id => id.toString() !== userIdStr);
  
  // Add new vote
  if (isUpvote) {
    this.upvotes.push(userId);
  } else {
    this.downvotes.push(userId);
  }
  
  this.voteScore = this.upvotes.length - this.downvotes.length;
  return this.save();
};

module.exports = mongoose.model('Question', questionSchema);
