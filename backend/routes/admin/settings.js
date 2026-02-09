const express = require('express');
const router = express.Router();
const { logAdminAction, isSuperAdmin } = require('../../middleware/admin');

// In-memory settings store (in production, use database or config service)
let systemSettings = {
  general: {
    siteName: 'RoastMyDorm',
    siteDescription: 'Student housing reviews and roommate matching platform',
    supportEmail: 'support@roastmydorm.com',
    maintenanceMode: false,
    maintenanceMessage: 'We are performing scheduled maintenance. Please check back soon.',
    timezone: 'Africa/Casablanca'
  },
  moderation: {
    autoApproveReviews: false,
    autoApproveDorms: false,
    minReviewLength: 50,
    maxReviewLength: 5000,
    requirePhotoForReview: false,
    profanityFilterEnabled: true,
    spamFilterEnabled: true,
    newUserReviewDelay: 0, // hours
    maxReviewsPerUserPerDay: 5
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60,
    requireEmailVerification: true,
    allowSocialLogin: true,
    twoFactorEnabled: false,
    adminIpWhitelist: []
  },
  notifications: {
    emailNotificationsEnabled: true,
    newReviewNotification: true,
    newReportNotification: true,
    weeklyDigestEnabled: true,
    marketingEmailsEnabled: false
  },
  features: {
    roommateMatchingEnabled: true,
    landlordChatEnabled: true,
    qnaEnabled: true,
    blogEnabled: true,
    compareDormsEnabled: true,
    priceAlertsEnabled: true,
    virtualToursEnabled: false
  },
  seo: {
    defaultMetaTitle: 'RoastMyDorm - Student Housing Reviews',
    defaultMetaDescription: 'Find the best student housing with real reviews from students.',
    googleAnalyticsId: '',
    facebookPixelId: '',
    enableSitemap: true,
    enableRobotsTxt: true
  },
  limits: {
    maxImagesPerDorm: 20,
    maxImagesPerReview: 5,
    maxFileUploadSizeMB: 10,
    maxProfilePhotoSizeMB: 5,
    dormPaginationLimit: 20,
    reviewPaginationLimit: 10,
    searchResultsLimit: 50
  },
  cache: {
    enabled: true,
    dormListCacheTTL: 300, // seconds
    dormDetailCacheTTL: 60,
    reviewListCacheTTL: 120,
    searchCacheTTL: 180
  }
};

/**
 * @route   GET /api/admin/settings
 * @desc    Get all system settings
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: systemSettings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

/**
 * @route   GET /api/admin/settings/:category
 * @desc    Get settings for a specific category
 * @access  Admin
 */
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;

    if (!systemSettings[category]) {
      return res.status(404).json({
        success: false,
        message: 'Settings category not found'
      });
    }

    res.json({
      success: true,
      data: {
        category,
        settings: systemSettings[category]
      }
    });
  } catch (error) {
    console.error('Get category settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

/**
 * @route   PUT /api/admin/settings/:category
 * @desc    Update settings for a category
 * @access  Super Admin
 */
router.put('/:category',
  isSuperAdmin,
  logAdminAction('settings_update', 'settings'),
  async (req, res) => {
    try {
      const { category } = req.params;
      const updates = req.body;

      if (!systemSettings[category]) {
        return res.status(404).json({
          success: false,
          message: 'Settings category not found'
        });
      }

      // Store previous for audit
      const previous = { ...systemSettings[category] };

      // Merge updates
      systemSettings[category] = {
        ...systemSettings[category],
        ...updates
      };

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: {
          category,
          settings: systemSettings[category],
          previous
        }
      });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings'
      });
    }
  }
);

/**
 * @route   POST /api/admin/settings/reset/:category
 * @desc    Reset settings to defaults
 * @access  Super Admin
 */
router.post('/reset/:category',
  isSuperAdmin,
  logAdminAction('settings_reset', 'settings'),
  async (req, res) => {
    try {
      const { category } = req.params;

      // Default settings by category
      const defaults = {
        general: {
          siteName: 'RoastMyDorm',
          siteDescription: 'Student housing reviews and roommate matching platform',
          supportEmail: 'support@roastmydorm.com',
          maintenanceMode: false,
          maintenanceMessage: 'We are performing scheduled maintenance.',
          timezone: 'Africa/Casablanca'
        },
        moderation: {
          autoApproveReviews: false,
          autoApproveDorms: false,
          minReviewLength: 50,
          maxReviewLength: 5000,
          requirePhotoForReview: false,
          profanityFilterEnabled: true,
          spamFilterEnabled: true,
          newUserReviewDelay: 0,
          maxReviewsPerUserPerDay: 5
        },
        security: {
          maxLoginAttempts: 5,
          lockoutDurationMinutes: 30,
          sessionTimeoutMinutes: 60,
          requireEmailVerification: true,
          allowSocialLogin: true,
          twoFactorEnabled: false,
          adminIpWhitelist: []
        },
        notifications: {
          emailNotificationsEnabled: true,
          newReviewNotification: true,
          newReportNotification: true,
          weeklyDigestEnabled: true,
          marketingEmailsEnabled: false
        },
        features: {
          roommateMatchingEnabled: true,
          landlordChatEnabled: true,
          qnaEnabled: true,
          blogEnabled: true,
          compareDormsEnabled: true,
          priceAlertsEnabled: true,
          virtualToursEnabled: false
        },
        seo: {
          defaultMetaTitle: 'RoastMyDorm - Student Housing Reviews',
          defaultMetaDescription: 'Find the best student housing with real reviews.',
          googleAnalyticsId: '',
          facebookPixelId: '',
          enableSitemap: true,
          enableRobotsTxt: true
        },
        limits: {
          maxImagesPerDorm: 20,
          maxImagesPerReview: 5,
          maxFileUploadSizeMB: 10,
          maxProfilePhotoSizeMB: 5,
          dormPaginationLimit: 20,
          reviewPaginationLimit: 10,
          searchResultsLimit: 50
        },
        cache: {
          enabled: true,
          dormListCacheTTL: 300,
          dormDetailCacheTTL: 60,
          reviewListCacheTTL: 120,
          searchCacheTTL: 180
        }
      };

      if (!defaults[category]) {
        return res.status(404).json({
          success: false,
          message: 'Settings category not found'
        });
      }

      systemSettings[category] = { ...defaults[category] };

      res.json({
        success: true,
        message: 'Settings reset to defaults',
        data: {
          category,
          settings: systemSettings[category]
        }
      });
    } catch (error) {
      console.error('Reset settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset settings'
      });
    }
  }
);

/**
 * @route   POST /api/admin/settings/maintenance
 * @desc    Toggle maintenance mode
 * @access  Super Admin
 */
router.post('/maintenance',
  isSuperAdmin,
  logAdminAction('maintenance_toggle', 'settings'),
  async (req, res) => {
    try {
      const { enabled, message } = req.body;

      systemSettings.general.maintenanceMode = enabled;
      if (message) {
        systemSettings.general.maintenanceMessage = message;
      }

      res.json({
        success: true,
        message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
        data: {
          maintenanceMode: systemSettings.general.maintenanceMode,
          maintenanceMessage: systemSettings.general.maintenanceMessage
        }
      });
    } catch (error) {
      console.error('Toggle maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle maintenance mode'
      });
    }
  }
);

/**
 * @route   POST /api/admin/settings/cache/clear
 * @desc    Clear all caches
 * @access  Admin
 */
router.post('/cache/clear',
  logAdminAction('cache_clear', 'settings'),
  async (req, res) => {
    try {
      // In production, this would clear Redis/Memcached
      // For now, just return success
      
      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache'
      });
    }
  }
);

/**
 * @route   GET /api/admin/settings/export
 * @desc    Export all settings as JSON
 * @access  Super Admin
 */
router.get('/export',
  isSuperAdmin,
  async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=settings-export.json');
      
      res.json({
        exportedAt: new Date().toISOString(),
        settings: systemSettings
      });
    } catch (error) {
      console.error('Export settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export settings'
      });
    }
  }
);

/**
 * @route   POST /api/admin/settings/import
 * @desc    Import settings from JSON
 * @access  Super Admin
 */
router.post('/import',
  isSuperAdmin,
  logAdminAction('settings_import', 'settings'),
  async (req, res) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings format'
        });
      }

      // Validate categories
      const validCategories = Object.keys(systemSettings);
      const importedCategories = Object.keys(settings);
      
      const invalidCategories = importedCategories.filter(
        cat => !validCategories.includes(cat)
      );

      if (invalidCategories.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid categories: ${invalidCategories.join(', ')}`
        });
      }

      // Merge imported settings
      for (const category of importedCategories) {
        if (typeof settings[category] === 'object') {
          systemSettings[category] = {
            ...systemSettings[category],
            ...settings[category]
          };
        }
      }

      res.json({
        success: true,
        message: 'Settings imported successfully',
        data: {
          importedCategories
        }
      });
    } catch (error) {
      console.error('Import settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import settings'
      });
    }
  }
);

/**
 * @route   GET /api/admin/settings/feature-flags
 * @desc    Get all feature flags
 * @access  Admin
 */
router.get('/feature-flags', async (req, res) => {
  try {
    res.json({
      success: true,
      data: systemSettings.features
    });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flags'
    });
  }
});

/**
 * @route   PUT /api/admin/settings/feature-flags/:flag
 * @desc    Toggle a feature flag
 * @access  Super Admin
 */
router.put('/feature-flags/:flag',
  isSuperAdmin,
  logAdminAction('feature_flag_toggle', 'settings'),
  async (req, res) => {
    try {
      const { flag } = req.params;
      const { enabled } = req.body;

      if (!(flag in systemSettings.features)) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found'
        });
      }

      const previous = systemSettings.features[flag];
      systemSettings.features[flag] = Boolean(enabled);

      res.json({
        success: true,
        message: `Feature ${flag} ${enabled ? 'enabled' : 'disabled'}`,
        data: {
          flag,
          enabled: systemSettings.features[flag],
          previous
        }
      });
    } catch (error) {
      console.error('Toggle feature flag error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle feature flag'
      });
    }
  }
);

module.exports = router;
