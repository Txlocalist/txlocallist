/**
 * Tier definitions and utility functions.
 *
 * This is the single source of truth for feature gating and tier capabilities.
 * All feature checks should go through these functions to keep the system cohesive.
 */

export interface TierFeatures {
  MAX_PHOTOS: number;
  SHOW_CONTACT: boolean;
  SHOW_WEBSITE: boolean;
  SHOW_SOCIALS: boolean;
  JOB_POSTINGS: number; // max number of active job postings
  FEATURED: boolean;
  PRIORITY_SEARCH: boolean;
}

export const TIER_NAMES = {
  FREE: "free",
  STARTER: "starter",
} as const;

export const TIER_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Paid",
};

export const TIER_PRICES: Record<string, number> = {
  free: 0, // in cents
  starter: 2000,
};

/**
 * Parse tier features from JSON string.
 * Fallback to Free tier defaults if parsing fails.
 */
export function parseFeatures(featuresJson?: string | null): TierFeatures {
  if (!featuresJson) {
    return getFeatures("free");
  }

  try {
    return JSON.parse(featuresJson);
  } catch {
    console.warn("Failed to parse features JSON, using Free tier defaults");
    return getFeatures("free");
  }
}

/**
 * Get the feature set for a given tier slug.
 */
export function getFeatures(tierSlug?: string | null): TierFeatures {
  switch ((tierSlug ?? "free").toLowerCase()) {
    case TIER_NAMES.STARTER:
      return {
        MAX_PHOTOS: 20,
        SHOW_CONTACT: true,
        SHOW_WEBSITE: true,
        SHOW_SOCIALS: true,
        JOB_POSTINGS: 3,
        FEATURED: true,
        PRIORITY_SEARCH: true,
      };

    case TIER_NAMES.FREE:
    default:
      return {
        MAX_PHOTOS: 1,
        SHOW_CONTACT: false,
        SHOW_WEBSITE: false,
        SHOW_SOCIALS: false,
        JOB_POSTINGS: 0,
        FEATURED: false,
        PRIORITY_SEARCH: false,
      };
  }
}

/**
 * Check if a tier has a specific feature enabled.
 * Usage: canShowContact(business.plan?.features)
 */
export function canShowContact(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).SHOW_CONTACT;
}

export function canShowWebsite(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).SHOW_WEBSITE;
}

export function canShowSocials(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).SHOW_SOCIALS;
}

export function canPostJobs(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).JOB_POSTINGS > 0;
}

export function canBeFeatured(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).FEATURED;
}

export function getMaxPhotos(featuresJson?: string | null): number {
  return parseFeatures(featuresJson).MAX_PHOTOS;
}

export function getMaxJobPostings(featuresJson?: string | null): number {
  return parseFeatures(featuresJson).JOB_POSTINGS;
}

export function hasPrioritySearch(featuresJson?: string | null): boolean {
  return parseFeatures(featuresJson).PRIORITY_SEARCH;
}

/**
 * Get price in dollars (for display).
 */
export function getPriceInDollars(tierSlug: string): number {
  return TIER_PRICES[tierSlug.toLowerCase()] / 100;
}

/**
 * Get a human-readable tier label.
 */
export function getTierLabel(tierSlug?: string | null): string {
  if (!tierSlug) return TIER_LABELS.free;
  return TIER_LABELS[tierSlug.toLowerCase()] || TIER_LABELS.free;
}
