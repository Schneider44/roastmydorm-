/**
 * Gamification Service - Badge system and user achievements
 */

const Badge = require('../models/Badge');
const { UserBadge } = require('../models/Badge');
const Review = require('../models/Review');
const Question = require('../models/Question');
const User = require('../models/User');

/**
 * Badge definitions for initial seeding
 */
const BADGE_DEFINITIONS = [
  {
    name: 'First Review',
    slug: 'first-review',
    description: 'Wrote your first dorm review',
    icon: '✍️',
    color: '#10b981',
    category: 'reviewer',
    requirement: { type: 'first_review', value: 1 },
    rarity: 'common',
    points: 10
  },
  {
    name: 'Review Rookie',
    slug: 'review-rookie',
    description: 'Wrote 5 reviews',
    icon: '📝',
    color: '#3b82f6',
    category: 'reviewer',
    requirement: { type: 'reviews_count', value: 5 },
    rarity: 'common',
    points: 25
  },
  {
    name: 'Seasoned Reviewer',
    slug: 'seasoned-reviewer',
    description: 'Wrote 25 reviews',
    icon: '📚',
    color: '#8b5cf6',
    category: 'reviewer',
    requirement: { type: 'reviews_count', value: 25 },
    rarity: 'uncommon',
    points: 75
  },
  {
    name: 'Top Reviewer',
    slug: 'top-reviewer',
    description: 'Wrote 100 reviews',
    icon: '🏆',
    color: '#f59e0b',
    category: 'reviewer',
    requirement: { type: 'reviews_count', value: 100 },
    rarity: 'rare',
    points: 200
  },
  {
    name: 'Elite Reviewer',
    slug: 'elite-reviewer',
    description: 'Wrote 250 reviews',
    icon: '👑',
    color: '#ef4444',
    category: 'reviewer',
    requirement: { type: 'reviews_count', value: 250 },
    rarity: 'epic',
    points: 500
  },
  {
    name: 'Verified Resident',
    slug: 'verified-resident',
    description: 'Verified as a current/former resident',
    icon: '✅',
    color: '#10b981',
    category: 'verification',
    requirement: { type: 'verified_status', value: 1 },
    rarity: 'uncommon',
    points: 50
  },
  {
    name: 'Helpful Hand',
    slug: 'helpful-hand',
    description: 'Received 10 helpful votes on reviews',
    icon: '🤝',
    color: '#06b6d4',
    category: 'community',
    requirement: { type: 'helpful_votes', value: 10 },
    rarity: 'common',
    points: 30
  },
  {
    name: 'Community Helper',
    slug: 'community-helper',
    description: 'Received 50 helpful votes',
    icon: '💪',
    color: '#8b5cf6',
    category: 'community',
    requirement: { type: 'helpful_votes', value: 50 },
    rarity: 'uncommon',
    points: 100
  },
  {
    name: 'Most Helpful Reviewer',
    slug: 'most-helpful-reviewer',
    description: 'Received 250 helpful votes',
    icon: '⭐',
    color: '#f59e0b',
    category: 'community',
    requirement: { type: 'helpful_votes', value: 250 },
    rarity: 'rare',
    points: 300
  },
  {
    name: 'Question Guru',
    slug: 'question-guru',
    description: 'Answered 20 questions',
    icon: '🎓',
    color: '#6366f1',
    category: 'community',
    requirement: { type: 'answers_count', value: 20 },
    rarity: 'uncommon',
    points: 60
  },
  {
    name: 'Knowledge Master',
    slug: 'knowledge-master',
    description: 'Answered 100 questions',
    icon: '🧠',
    color: '#ec4899',
    category: 'community',
    requirement: { type: 'answers_count', value: 100 },
    rarity: 'rare',
    points: 200
  },
  {
    name: 'Profile Pro',
    slug: 'profile-pro',
    description: 'Completed your profile 100%',
    icon: '👤',
    color: '#14b8a6',
    category: 'achievement',
    requirement: { type: 'profile_complete', value: 1 },
    rarity: 'common',
    points: 15
  },
  {
    name: 'Early Adopter',
    slug: 'early-adopter',
    description: 'Joined during launch phase',
    icon: '🚀',
    color: '#f97316',
    category: 'special',
    requirement: { type: 'special_event', value: 1 },
    rarity: 'legendary',
    points: 100
  },
  {
    name: 'Veteran',
    slug: 'veteran',
    description: 'Member for over 1 year',
    icon: '🎖️',
    color: '#a855f7',
    category: 'achievement',
    requirement: { type: 'time_on_platform', value: 365 },
    rarity: 'uncommon',
    points: 50
  }
];

/**
 * Seed badges into database
 */
const seedBadges = async () => {
  try {
    for (const badgeDef of BADGE_DEFINITIONS) {
      await Badge.findOneAndUpdate(
        { slug: badgeDef.slug },
        badgeDef,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Badges seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding badges:', error);
  }
};

/**
 * Check and award badges for a user
 */
const checkAndAwardBadges = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return [];

  const awardedBadges = [];
  const badges = await Badge.find({ isActive: true });

  for (const badge of badges) {
    // Skip if user already has this badge
    const existingBadge = await UserBadge.findOne({ user: userId, badge: badge._id });
    if (existingBadge) continue;

    let shouldAward = false;

    switch (badge.requirement.type) {
      case 'first_review':
        const reviewCount = await Review.countDocuments({ user: userId, status: 'approved' });
        shouldAward = reviewCount >= 1;
        break;

      case 'reviews_count':
        const totalReviews = await Review.countDocuments({ user: userId, status: 'approved' });
        shouldAward = totalReviews >= badge.requirement.value;
        break;

      case 'helpful_votes':
        const reviews = await Review.find({ user: userId });
        const totalHelpful = reviews.reduce((sum, r) => sum + (r.helpfulCount || 0), 0);
        shouldAward = totalHelpful >= badge.requirement.value;
        break;

      case 'verified_status':
        shouldAward = user.isVerified || user.university?.email;
        break;

      case 'answers_count':
        const answersCount = await Question.aggregate([
          { $unwind: '$answers' },
          { $match: { 'answers.author': userId } },
          { $count: 'total' }
        ]);
        shouldAward = (answersCount[0]?.total || 0) >= badge.requirement.value;
        break;

      case 'profile_complete':
        shouldAward = isProfileComplete(user);
        break;

      case 'time_on_platform':
        const daysOnPlatform = Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24));
        shouldAward = daysOnPlatform >= badge.requirement.value;
        break;

      default:
        break;
    }

    if (shouldAward) {
      const userBadge = await UserBadge.create({
        user: userId,
        badge: badge._id,
        reason: `Earned by meeting requirement: ${badge.requirement.type}`
      });
      
      // Update badge stats
      await Badge.findByIdAndUpdate(badge._id, { $inc: { totalAwarded: 1 } });
      
      awardedBadges.push({
        badge,
        userBadge
      });
    }
  }

  return awardedBadges;
};

/**
 * Check if user profile is complete
 */
const isProfileComplete = (user) => {
  const requiredFields = [
    'firstName',
    'lastName',
    'email',
    'profilePicture',
    'university.name'
  ];

  return requiredFields.every(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], user);
    return value && value.toString().trim() !== '';
  });
};

/**
 * Get user's badges
 */
const getUserBadges = async (userId) => {
  return UserBadge.find({ user: userId })
    .populate('badge')
    .sort({ awardedAt: -1 });
};

/**
 * Get user's badge count by category
 */
const getUserBadgeStats = async (userId) => {
  const badges = await getUserBadges(userId);
  
  const stats = {
    total: badges.length,
    totalPoints: 0,
    byCategory: {},
    byRarity: {}
  };

  badges.forEach(ub => {
    const badge = ub.badge;
    stats.totalPoints += badge.points;
    
    stats.byCategory[badge.category] = (stats.byCategory[badge.category] || 0) + 1;
    stats.byRarity[badge.rarity] = (stats.byRarity[badge.rarity] || 0) + 1;
  });

  return stats;
};

/**
 * Award a special badge manually
 */
const awardSpecialBadge = async (userId, badgeSlug, reason) => {
  const badge = await Badge.findOne({ slug: badgeSlug });
  if (!badge) throw new Error('Badge not found');

  const existingBadge = await UserBadge.findOne({ user: userId, badge: badge._id });
  if (existingBadge) throw new Error('User already has this badge');

  const userBadge = await UserBadge.create({
    user: userId,
    badge: badge._id,
    reason
  });

  await Badge.findByIdAndUpdate(badge._id, { $inc: { totalAwarded: 1 } });

  return userBadge;
};

/**
 * Get leaderboard
 */
const getLeaderboard = async (limit = 10) => {
  const leaderboard = await UserBadge.aggregate([
    {
      $lookup: {
        from: 'badges',
        localField: 'badge',
        foreignField: '_id',
        as: 'badgeData'
      }
    },
    { $unwind: '$badgeData' },
    {
      $group: {
        _id: '$user',
        totalPoints: { $sum: '$badgeData.points' },
        badgeCount: { $sum: 1 }
      }
    },
    { $sort: { totalPoints: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        totalPoints: 1,
        badgeCount: 1,
        'user.firstName': 1,
        'user.lastName': 1,
        'user.profilePicture': 1,
        'user.university.name': 1
      }
    }
  ]);

  return leaderboard;
};

module.exports = {
  BADGE_DEFINITIONS,
  seedBadges,
  checkAndAwardBadges,
  getUserBadges,
  getUserBadgeStats,
  awardSpecialBadge,
  getLeaderboard,
  isProfileComplete
};
