/** Tunable weights for Recommendation V1. No ML. */
export const WEIGHTS = {
  onWishlist: 40,
  missingFromTracked: 28,
  completesSet: 22,
  fewMissingLeft: 12,
  followedSet: 8,
  availableInJapan: 10,
  belowTarget: 18,
  belowMedian: 12,
  newlyAvailable: 10,
  listingJump: 6,
  stalePenalty: -15,
  loosePenalty: -30,
}

export const OPPORTUNITY_MEDIAN_PCT = 0.15
export const FRESH_HOURS = 48
export const NEWLY_AVAILABLE_DAYS = 7
