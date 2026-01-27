// Matching Algorithm - Compatibility Score Calculator

function calculateMatchScore(profile1, profile2) {
  if (!profile1 || !profile2) return { score: 0, details: {} };
  if (profile1.userId === profile2.userId) return { score: 0, details: {} };

  let score = 0;

  // University match (15 points)
  if (profile1.university === profile2.university) {
    score += 15;
  }

  // Location match (15 points)
  if (profile1.location === profile2.location) {
    score += 15;
  }

  // Cleanliness compatibility (15 points)
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

  // Sleep schedule compatibility (12 points)
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

  // Personality match (10 points)
  if (profile1.personality === profile2.personality) {
    score += 10;
  } else if (profile1.personality === 'Ambivert' || profile2.personality === 'Ambivert') {
    score += 7;
  } else {
    score += 3;
  }

  // Social level compatibility (10 points)
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

  // Smoking preference (10 points)
  if (profile1.smokingPreference === profile2.smokingPreference) {
    score += 10;
  } else if (
    (profile1.smokingPreference === 'No smoking' && profile2.smokingPreference === 'Occasionally') ||
    (profile1.smokingPreference === 'Occasionally' && profile2.smokingPreference === 'No smoking')
  ) {
    score += 5;
  }

  // Pets tolerance (8 points)
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

  // Budget overlap (10 points)
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

  // Interest overlap (5 points)
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
}

function sortByMatchScore(currentProfile, profiles) {
  return profiles
    .map(profile => ({
      profile,
      matchScore: calculateMatchScore(currentProfile, profile)
    }))
    .sort((a, b) => b.matchScore.score - a.matchScore.score);
}


























