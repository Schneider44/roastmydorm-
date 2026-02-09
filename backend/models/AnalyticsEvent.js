const mongoose = require('mongoose');

/**
 * AnalyticsEvent Model
 * Tracks user events for analytics and behavioral insights
 */
const analyticsEventSchema = new mongoose.Schema({
  // User who triggered the event (optional for anonymous)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Session ID for anonymous tracking
  sessionId: {
    type: String,
    index: true
  },

  // Event type
  eventType: {
    type: String,
    required: true,
    enum: [
      // Page views
      'page_view',
      'dorm_view',
      'profile_view',
      'blog_view',
      
      // User actions
      'user_register',
      'user_login',
      'user_logout',
      'user_verify',
      'profile_update',
      'profile_photo_upload',
      
      // Search events
      'search',
      'search_filter',
      'search_result_click',
      
      // Dorm interactions
      'dorm_favorite',
      'dorm_unfavorite',
      'dorm_share',
      'dorm_contact',
      'dorm_photo_view',
      
      // Review events
      'review_create',
      'review_edit',
      'review_delete',
      'review_upvote',
      'review_downvote',
      'review_photo_upload',
      
      // Q&A events
      'question_create',
      'question_view',
      'answer_create',
      'answer_vote',
      
      // Roommate events
      'roommate_profile_create',
      'roommate_profile_update',
      'roommate_match_view',
      'roommate_message_send',
      'roommate_match_accept',
      'roommate_match_reject',
      
      // Blog events
      'blog_read',
      'blog_share',
      'blog_comment',
      
      // Conversion events
      'signup_started',
      'signup_completed',
      'landlord_contact',
      'booking_inquiry'
    ],
    index: true
  },

  // Event category for grouping
  category: {
    type: String,
    enum: ['navigation', 'user', 'search', 'dorm', 'review', 'qa', 'roommate', 'blog', 'conversion'],
    index: true
  },

  // Event metadata
  metadata: {
    // Page/URL info
    page: String,
    referrer: String,
    url: String,
    
    // Search-related
    searchQuery: String,
    searchFilters: mongoose.Schema.Types.Mixed,
    searchResultCount: Number,
    
    // Dorm-related
    dormId: mongoose.Schema.Types.ObjectId,
    dormName: String,
    dormCity: String,
    
    // Review-related
    reviewId: mongoose.Schema.Types.ObjectId,
    rating: Number,
    
    // User-related
    targetUserId: mongoose.Schema.Types.ObjectId,
    
    // General metadata
    value: Number,
    label: String,
    data: mongoose.Schema.Types.Mixed
  },

  // Device and browser info
  device: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet']
    },
    os: String,
    browser: String,
    screenSize: String
  },

  // Location data
  location: {
    country: String,
    city: String,
    region: String,
    ip: String
  },

  // UTM tracking
  utm: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ category: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ 'metadata.dormId': 1, timestamp: -1 });
analyticsEventSchema.index({ 'location.city': 1, timestamp: -1 });

// Static method to track an event
analyticsEventSchema.statics.track = async function(eventData) {
  try {
    const event = new this({
      ...eventData,
      timestamp: new Date()
    });
    await event.save();
    return event;
  } catch (error) {
    console.error('Failed to track event:', error);
    return null;
  }
};

// Get events count by type within date range
analyticsEventSchema.statics.getEventCounts = async function(startDate, endDate, groupBy = 'day') {
  const matchStage = {
    timestamp: { $gte: startDate, $lte: endDate }
  };

  let dateFormat;
  switch (groupBy) {
    case 'hour':
      dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } };
      break;
    case 'day':
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
      break;
    case 'week':
      dateFormat = { $dateToString: { format: '%Y-W%V', date: '$timestamp' } };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$timestamp' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: dateFormat,
          eventType: '$eventType'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        events: {
          $push: {
            type: '$_id.eventType',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Get top viewed dorms
analyticsEventSchema.statics.getTopDorms = async function(startDate, endDate, limit = 10) {
  return this.aggregate([
    {
      $match: {
        eventType: 'dorm_view',
        timestamp: { $gte: startDate, $lte: endDate },
        'metadata.dormId': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$metadata.dormId',
        dormName: { $first: '$metadata.dormName' },
        city: { $first: '$metadata.dormCity' },
        views: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        dormId: '$_id',
        dormName: 1,
        city: 1,
        views: 1,
        uniqueViews: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { views: -1 } },
    { $limit: limit }
  ]);
};

// Get search analytics
analyticsEventSchema.statics.getSearchAnalytics = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        eventType: 'search',
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$metadata.searchQuery',
        count: { $sum: 1 },
        avgResults: { $avg: '$metadata.searchResultCount' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 50 }
  ]);
};

// Get user funnel data
analyticsEventSchema.statics.getFunnelData = async function(startDate, endDate) {
  const funnelSteps = [
    'page_view',
    'dorm_view',
    'user_register',
    'review_create',
    'roommate_profile_create'
  ];

  const results = await Promise.all(
    funnelSteps.map(async (step) => {
      const count = await this.countDocuments({
        eventType: step,
        timestamp: { $gte: startDate, $lte: endDate }
      });
      return { step, count };
    })
  );

  return results;
};

// Get device breakdown
analyticsEventSchema.statics.getDeviceBreakdown = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
        'device.type': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$device.type',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Get city analytics
analyticsEventSchema.statics.getCityAnalytics = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        eventType: 'dorm_view',
        timestamp: { $gte: startDate, $lte: endDate },
        'metadata.dormCity': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$metadata.dormCity',
        views: { $sum: 1 }
      }
    },
    { $sort: { views: -1 } },
    { $limit: 10 }
  ]);
};

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
