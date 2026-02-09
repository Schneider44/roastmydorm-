const mongoose = require('mongoose');

/**
 * AdminAction Model
 * Tracks all administrative actions for auditing and security
 */
const adminActionSchema = new mongoose.Schema({
  // Admin who performed the action
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Type of action performed
  actionType: {
    type: String,
    required: true,
    enum: [
      // User actions
      'user_view',
      'user_ban',
      'user_suspend',
      'user_unban',
      'user_verify',
      'user_delete',
      'user_edit',
      'user_role_change',
      
      // Dorm actions
      'dorm_create',
      'dorm_edit',
      'dorm_delete',
      'dorm_approve',
      'dorm_reject',
      'dorm_feature',
      'dorm_unfeature',
      
      // Review actions
      'review_approve',
      'review_delete',
      'review_flag',
      'review_unflag',
      'review_verify',
      
      // Roommate actions
      'roommate_delete',
      'roommate_flag',
      
      // Report actions
      'report_resolve',
      'report_dismiss',
      'report_escalate',
      
      // System actions
      'settings_update',
      'bulk_action',
      'export_data',
      'login',
      'logout'
    ]
  },

  // Target entity type
  targetType: {
    type: String,
    enum: ['user', 'dorm', 'review', 'roommate', 'report', 'system', 'settings']
  },

  // Target entity ID
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },

  // Description of the action
  description: {
    type: String,
    required: true,
    maxlength: 500
  },

  // Previous state (for edit actions)
  previousState: {
    type: mongoose.Schema.Types.Mixed
  },

  // New state (for edit actions)
  newState: {
    type: mongoose.Schema.Types.Mixed
  },

  // Additional metadata
  metadata: {
    reason: String,
    notes: String,
    duration: Number, // For suspensions (in days)
    ipAddress: String,
    userAgent: String
  },

  // Status of the action
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },

  // Error details if failed
  error: {
    message: String,
    code: String
  }
}, {
  timestamps: true
});

// Indexes
adminActionSchema.index({ admin: 1, createdAt: -1 });
adminActionSchema.index({ actionType: 1, createdAt: -1 });
adminActionSchema.index({ targetType: 1, targetId: 1 });
adminActionSchema.index({ createdAt: -1 });

// Static method to log an action
adminActionSchema.statics.logAction = async function(data) {
  try {
    const action = new this(data);
    await action.save();
    return action;
  } catch (error) {
    console.error('Failed to log admin action:', error);
    return null;
  }
};

// Static method to get recent actions
adminActionSchema.statics.getRecentActions = async function(limit = 50) {
  return this.find()
    .populate('admin', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get actions by admin
adminActionSchema.statics.getByAdmin = async function(adminId, options = {}) {
  const { limit = 50, skip = 0, actionType } = options;
  const query = { admin: adminId };
  
  if (actionType) {
    query.actionType = actionType;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get actions for a target
adminActionSchema.statics.getByTarget = async function(targetType, targetId) {
  return this.find({ targetType, targetId })
    .populate('admin', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('AdminAction', adminActionSchema);
