// Matching Algorithm - Compatibility Score Calculator
// Compares two roommate profiles and returns compatibility score (0-100%)

/**
 * Calculate compatibility score between two profiles
 * @param {Object} profile1 - First roommate profile
 * @param {Object} profile2 - Second roommate profile
 * @returns {Object} - { score: number (0-100), details: Object }
 */
const calculateMatchScore = (profile1, profile2) => {
  if (!profile1 || !profile2) return { score: 0, details: {} };
  if (profile1.userId === profile2.userId) return { score: 0, details: {} };

  let score = 0;
  let maxScore = 100;

  // 1. University match (15 points)
  if (profile1.university === profile2.university) {
    score += 15;
  }

  // 2. Location match (15 points)
  if (profile1.location === profile2.location) {
    score += 15;
  }

  // 3. Cleanliness compatibility (15 points)
  const cleanlinessDiff = Math.abs(profile1.cleanlinessLevel - profile2.cleanlinessLevel);
  if (cleanlinessDiff === 0) {
    score += 15;
  } else if (cleanlinessDiff === 1) {
    score += 12;
  } else if (cleanlinessDiff === 2) {
    score += 8;
  } else {
    score += 3;
  }

  // 4. Sleep schedule compatibility (12 points)
  if (profile1.sleepSchedule === profile2.sleepSchedule) {
    score += 12;
  } else if (
    (profile1.sleepSchedule.includes('Early') && profile2.sleepSchedule.includes('Early')) ||
    (profile1.sleepSchedule.includes('Night') && profile2.sleepSchedule.includes('Night')) ||
    profile1.sleepSchedule === 'Flexible' || profile2.sleepSchedule === 'Flexible'
  ) {
    score += 8;
  } else {
    score += 4;
  }

  // 5. Personality match (10 points)
  if (profile1.personality === profile2.personality) {
    score += 10;
  } else if (profile1.personality === 'Ambivert' || profile2.personality === 'Ambivert') {
    score += 7;
  } else {
    score += 3;
  }

  // 6. Social level compatibility (10 points)
  if (profile1.socialLevel === profile2.socialLevel) {
    score += 10;
  } else if (
    profile1.socialLevel === 'Moderate' || profile2.socialLevel === 'Moderate' ||
    (profile1.socialLevel.includes('Social') && profile2.socialLevel.includes('Social'))
  ) {
    score += 7;
  } else {
    score += 4;
  }

  // 7. Smoking preference (10 points) - critical for some
  if (profile1.smokingPreference === profile2.smokingPreference) {
    score += 10;
  } else if (
    (profile1.smokingPreference === 'No smoking' && profile2.smokingPreference === 'Occasionally') ||
    (profile1.smokingPreference === 'Occasionally' && profile2.smokingPreference === 'No smoking')
  ) {
    score += 5;
  } else {
    score += 0; // Deal breaker if one wants no smoking and other regularly smokes
  }

  // 8. Pets tolerance (8 points)
  if (profile1.petsTolerance === profile2.petsTolerance) {
    score += 8;
  } else if (
    (profile1.petsTolerance === 'Love pets' && profile2.petsTolerance !== 'No pets') ||
    (profile1.petsTolerance !== 'No pets' && profile2.petsTolerance === 'Love pets')
  ) {
    score += 5;
  } else {
    score += 2;
  }

  // 9. Budget overlap (10 points)
  const budget1Min = profile1.budgetMin || 0;
  const budget1Max = profile1.budgetMax || 10000;
  const budget2Min = profile2.budgetMin || 0;
  const budget2Max = profile2.budgetMax || 10000;

  const overlapMin = Math.max(budget1Min, budget2Min);
  const overlapMax = Math.min(budget1Max, budget2Max);

  if (overlapMin <= overlapMax) {
    const overlapSize = overlapMax - overlapMin;
    const budget1Size = budget1Max - budget1Min;
    const budget2Size = budget2Max - budget2Min;
    const avgSize = (budget1Size + budget2Size) / 2;
    const overlapPercentage = Math.min(overlapSize / avgSize, 1);
    score += Math.round(10 * overlapPercentage);
  }

  // 10. Interest overlap (5 points)
  if (profile1.interests && profile2.interests) {
    const interests1 = Array.isArray(profile1.interests) ? profile1.interests : [];
    const interests2 = Array.isArray(profile2.interests) ? profile2.interests : [];
    const commonInterests = interests1.filter(i => interests2.includes(i));
    
    if (commonInterests.length > 0) {
      const maxInterests = Math.max(interests1.length, interests2.length, 1);
      score += Math.round(5 * (commonInterests.length / maxInterests));
    }
  }

  return {
    score: Math.round(score),
    details: {
      university: profile1.university === profile2.university,
      location: profile1.location === profile2.location,
      cleanlinessDiff: Math.abs(profile1.cleanlinessLevel - profile2.cleanlinessLevel),
      sleepSchedule: profile1.sleepSchedule === profile2.sleepSchedule,
      personality: profile1.personality === profile2.personality,
      socialLevel: profile1.socialLevel === profile2.socialLevel,
      smoking: profile1.smokingPreference === profile2.smokingPreference,
      pets: profile1.petsTolerance === profile2.petsTolerance,
      budgetOverlap: overlapMin <= overlapMax,
      commonInterests: profile1.interests?.filter(i => profile2.interests?.includes(i)).length || 0
    }
  };
};

/**
 * Sort profiles by match score
 * @param {Object} currentProfile - Current user's profile
 * @param {Array} profiles - Array of other profiles
 * @returns {Array} - Sorted array of { profile, matchScore }
 */
const sortByMatchScore = (currentProfile, profiles) => {
  return profiles
    .map(profile => ({
      profile,
      matchScore: calculateMatchScore(currentProfile, profile)
    }))
    .sort((a, b) => b.matchScore.score - a.matchScore.score);
};

module.exports = {
  calculateMatchScore,
  sortByMatchScore
};


























