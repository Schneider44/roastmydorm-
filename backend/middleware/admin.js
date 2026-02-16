const AdminAction = require('../models/AdminAction');

/**
 * Admin Middleware
 * Handles admin authentication, authorization, and action logging
 */

/**
 * Check if user is admin
 */

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Check if user is super admin (has elevated privileges)
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'admin' || !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }

  next();
};

/**
 * Log admin action middleware
 */
const logAdminAction = (actionType, targetType) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to log action after successful response
    res.json = async (data) => {
      // Only log successful actions
      if (data.success !== false && res.statusCode < 400) {
        try {
          await AdminAction.logAction({
            admin: req.user._id,
            actionType,
            targetType,
            targetId: req.params.id || req.body.targetId || data.data?._id,
            description: generateActionDescription(actionType, req, data),
            previousState: req.previousState,
            newState: data.data,
            metadata: {
              reason: req.body.reason,
              notes: req.body.notes,
              duration: req.body.duration,
              ipAddress: req.ip || req.headers['x-forwarded-for'],
              userAgent: req.headers['user-agent']
            },
            status: 'success'
          });
        } catch (error) {
          console.error('Failed to log admin action:', error);
        }
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * Generate human-readable action description
 */
function generateActionDescription(actionType, req, data) {
  const actions = {
    user_view: `Viewed user profile`,
    user_ban: `Banned user: ${req.body.reason || 'No reason provided'}`,
    user_suspend: `Suspended user for ${req.body.duration || 'indefinite'} days`,
    user_unban: `Unbanned user`,
    user_verify: `Verified user account`,
    user_delete: `Deleted user account`,
    user_edit: `Updated user profile`,
    user_role_change: `Changed user role to ${req.body.newRole}`,
    
    dorm_create: `Created new dorm listing: ${req.body.name}`,
    dorm_edit: `Updated dorm listing`,
    dorm_delete: `Deleted dorm listing`,
    dorm_approve: `Approved dorm listing`,
    dorm_reject: `Rejected dorm listing: ${req.body.reason || 'No reason'}`,
    dorm_feature: `Featured dorm listing`,
    dorm_unfeature: `Removed dorm from featured`,
    
    review_approve: `Approved review`,
    review_delete: `Deleted review: ${req.body.reason || 'No reason'}`,
    review_flag: `Flagged review for investigation`,
    review_unflag: `Removed flag from review`,
    review_verify: `Verified review`,
    
    roommate_delete: `Removed roommate profile`,
    roommate_flag: `Flagged roommate profile`,
    
    report_resolve: `Resolved report with action: ${req.body.action}`,
    report_dismiss: `Dismissed report: ${req.body.reason}`,
    report_escalate: `Escalated report to higher priority`,
    
    settings_update: `Updated system settings`,
    bulk_action: `Performed bulk action on ${req.body.count || 'multiple'} items`,
    export_data: `Exported ${req.body.dataType} data`,
    login: `Admin logged in`,
    logout: `Admin logged out`
  };

  return actions[actionType] || `Performed action: ${actionType}`;
}

/**
 * Rate limiting for admin actions
 */
const adminRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each admin to 500 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to capture previous state for logging edits
 */
const capturePreviousState = (Model) => {
  return async (req, res, next) => {
    if (req.params.id) {
      try {
        const doc = await Model.findById(req.params.id).lean();
        req.previousState = doc;
      } catch (error) {
        console.error('Failed to capture previous state:', error);
      }
    }
    next();
  };
};

/**
 * Security headers for admin routes
 */
const adminSecurityHeaders = (req, res, next) => {
  // Prevent search engine indexing
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  next();
};

/**
 * Validate admin IP (optional whitelist)
 */
const validateAdminIP = (whitelist = []) => {
  return (req, res, next) => {
    // Skip if no whitelist configured
    if (whitelist.length === 0) {
      return next();
    }

    const clientIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    
    if (!whitelist.includes(clientIP)) {
      // Log suspicious access attempt
      console.warn(`Admin access attempt from non-whitelisted IP: ${clientIP}`);
      
      return res.status(403).json({
        success: false,
        message: 'Access denied from this location'
      });
    }

    next();
  };
};

module.exports = {
  isAdmin,
  isSuperAdmin,
  logAdminAction,
  adminRateLimit,
  capturePreviousState,
  adminSecurityHeaders,
  validateAdminIP
};
