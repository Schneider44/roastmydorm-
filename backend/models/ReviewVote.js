const mongoose = require('mongoose');

const reviewVoteSchema = new mongoose.Schema({
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  voteType: {
    type: String,
    enum: ['upvote', 'downvote'],
    required: true
  }
}, {
  timestamps: true
});

// Ensure one vote per user per review
reviewVoteSchema.index({ review: 1, user: 1 }, { unique: true });
reviewVoteSchema.index({ review: 1, voteType: 1 });
reviewVoteSchema.index({ user: 1 });

// Static method to vote on a review
reviewVoteSchema.statics.vote = async function(reviewId, userId, voteType) {
  const Review = require('./Review');
  
  // Check if user already voted
  const existingVote = await this.findOne({ review: reviewId, user: userId });
  
  if (existingVote) {
    if (existingVote.voteType === voteType) {
      // Remove vote if clicking the same type
      await existingVote.deleteOne();
    } else {
      // Change vote type
      existingVote.voteType = voteType;
      await existingVote.save();
    }
  } else {
    // Create new vote
    await this.create({ review: reviewId, user: userId, voteType });
  }
  
  // Update review vote counts
  const upvotes = await this.countDocuments({ review: reviewId, voteType: 'upvote' });
  const downvotes = await this.countDocuments({ review: reviewId, voteType: 'downvote' });
  
  await Review.findByIdAndUpdate(reviewId, {
    upvoteCount: upvotes,
    downvoteCount: downvotes,
    voteScore: upvotes - downvotes
  });
  
  return {
    upvoteCount: upvotes,
    downvoteCount: downvotes,
    voteScore: upvotes - downvotes
  };
};

// Get user's vote on a review
reviewVoteSchema.statics.getUserVote = async function(reviewId, userId) {
  const vote = await this.findOne({ review: reviewId, user: userId });
  return vote ? vote.voteType : null;
};

module.exports = mongoose.model('ReviewVote', reviewVoteSchema);
