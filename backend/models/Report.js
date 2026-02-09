const mongoose = require('mongoose');

/**
 * Report Model
 * Handles user reports for reviews, dorms, users, and other content
 */
const reportSchema = new mongoose.Schema({
  // Reporter
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // What is being reported
  targetType: {
    type: String,
    required: true,
    enum: ['review', 'dorm', 'user', 'roommate_profile', 'question', 'answer', 'message']
  },

  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Report reason
  reason: {
    type: String,
    required: true,
    enum: [
      'spam',
      'fake_content',
      'inappropriate',
      'harassment',
      'hate_speech',
      'misinformation',
      'duplicate',
      'copyright',
      'scam',
      'safety_concern',
      'other'
    ]
  },

  // Detailed description
  description: {
    type: String,
    maxlength: 1000
  },

  // Evidence/Screenshots
  evidence: [{
    url: String,
    type: { type: String, enum: ['image', 'link', 'text'] }
  }],

  // Report status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Admin handling the report
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Resolution details
  resolution: {
    action: {
      type: String,
      enum: ['no_action', 'warning_issued', 'content_removed', 'user_suspended', 'user_banned', 'escalated_to_legal']
    },
    notes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },

  // Metadata for spam detection
  metadata: {
    ipAddress: String,
    userAgent: String,
    previousReportsCount: Number
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ status: 1, priority: -1, createdAt: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ assignedTo: 1, status: 1 });

// Get pending reports count
reportSchema.statics.getPendingCount = async function() {
  return this.countDocuments({ status: { $in: ['pending', 'under_review'] } });
};

// Get reports by status
reportSchema.statics.getByStatus = async function(status, options = {}) {
  const { limit = 20, skip = 0, priority } = options;
  const query = { status };
  
  if (priority) {
    query.priority = priority;
  }
  
  return this.find(query)
    .populate('reporter', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName')
    .sort({ priority: -1, createdAt: 1 })
    .skip(skip)
    .limit(limit);
};

// Check for duplicate reports
reportSchema.statics.checkDuplicate = async function(reporterId, targetType, targetId) {
  const existingReport = await this.findOne({
    reporter: reporterId,
    targetType,
    targetId,
    status: { $in: ['pending', 'under_review'] }
  });
  return !!existingReport;
};

// Get report statistics
reportSchema.statics.getStats = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          reason: '$reason',
          targetType: '$targetType'
        },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Report', reportSchema);
