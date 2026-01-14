/**
 * Lead Scoring Service
 * Analyzes call transcripts and metadata to score leads as hot/warm/cold
 * Used to prioritize follow-ups and identify high-value prospects
 */

import { log } from './logger';

/**
 * High-value service keywords that indicate strong buying intent
 */
const HIGH_VALUE_KEYWORDS = [
  'botox', 'filler', 'laser', 'microneedling', 'chemical peel',
  'facelift', 'liposuction', 'breast augmentation', 'rhinoplasty',
  'jaw contouring', 'dermal filler', 'skin tightening', 'collagen',
  'vampire facial', 'stem cell', 'platelet rich plasma', 'prp',
  'anti-aging', 'wrinkle reduction', 'age spots', 'pigmentation'
];

/**
 * Medium-value keywords that indicate interest
 */
const MEDIUM_VALUE_KEYWORDS = [
  'consultation', 'treatment', 'procedure', 'pricing', 'cost',
  'package', 'membership', 'discount', 'offer', 'special',
  'appointment', 'available', 'schedule', 'book', 'reserve'
];

/**
 * Urgency keywords that indicate time sensitivity
 */
const URGENCY_KEYWORDS = [
  'today', 'tomorrow', 'urgent', 'asap', 'immediately',
  'next week', 'soon', 'quickly', 'this month', 'this weekend',
  'before', 'deadline', 'expire', 'limited', 'ending', 'saturday',
  'sunday', 'weekend'
];

/**
 * Low-urgency keywords indicating delays
 */
const LOW_URGENCY_KEYWORDS = [
  'eventually', 'maybe', 'possibly', 'thinking about', 'considering',
  'not sure', 'later', 'someday', 'next year', 'probably',
  'might', 'could', 'uncertain', 'undecided'
];

interface ScoringResult {
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  details: string;
}

/**
 * Score a lead based on transcript and metadata
 * @param orgId - Organization ID (for logging)
 * @param transcript - Call transcript or conversation text
 * @param sentiment - Call sentiment ('positive', 'neutral', 'negative')
 * @param metadata - Additional metadata (serviceType, urgency, etc.)
 * @returns Lead score, tier, and scoring breakdown
 */
export async function scoreLead(
  orgId: string,
  transcript: string,
  sentiment: 'positive' | 'neutral' | 'negative',
  metadata?: { serviceType?: string; urgency?: string }
): Promise<ScoringResult> {
  try {
    const transcriptLower = (transcript || '').toLowerCase();

    // Extract keywords from transcript
    const foundKeywords = new Set<string>();

    HIGH_VALUE_KEYWORDS.forEach(kw => {
      if (transcriptLower.includes(kw)) {
        foundKeywords.add(kw);
      }
    });

    MEDIUM_VALUE_KEYWORDS.forEach(kw => {
      if (transcriptLower.includes(kw)) {
        foundKeywords.add(kw);
      }
    });

    // Calculate score
    let score = 50; // Base score
    const scoreBreakdown: string[] = [];

    // Count high-value keywords (+40 each, max 40)
    const highValueMatches = Array.from(foundKeywords).filter(kw =>
      HIGH_VALUE_KEYWORDS.includes(kw)
    ).length;
    if (highValueMatches > 0) {
      score += Math.min(highValueMatches * 40, 40);
      scoreBreakdown.push(`High-value keywords (${highValueMatches}): +${Math.min(highValueMatches * 40, 40)}`);
    }

    // Count medium-value keywords (+20, max 20)
    const mediumValueMatches = Array.from(foundKeywords).filter(kw =>
      MEDIUM_VALUE_KEYWORDS.includes(kw)
    ).length;
    if (mediumValueMatches > 0) {
      score += Math.min(mediumValueMatches * 20, 20);
      scoreBreakdown.push(`Medium-value keywords (${mediumValueMatches}): +${Math.min(mediumValueMatches * 20, 20)}`);
    }

    // Sentiment scoring (+30 positive, -20 negative)
    if (sentiment === 'positive') {
      score += 30;
      scoreBreakdown.push('Positive sentiment: +30');
    } else if (sentiment === 'negative') {
      score -= 20;
      scoreBreakdown.push('Negative sentiment: -20');
    }

    // Urgency scoring
    const urgencyMatches = URGENCY_KEYWORDS.filter(kw => transcriptLower.includes(kw)).length;
    const lowUrgencyMatches = LOW_URGENCY_KEYWORDS.filter(kw => transcriptLower.includes(kw)).length;

    if (urgencyMatches > 0) {
      score += 30;
      scoreBreakdown.push(`Urgency indicators (${urgencyMatches}): +30`);
    } else if (lowUrgencyMatches > 0) {
      score -= 10;
      scoreBreakdown.push(`Low urgency indicators (${lowUrgencyMatches}): -10`);
    }

    // Cap score at 100
    score = Math.min(Math.max(score, 0), 100);

    // Determine tier
    let tier: 'hot' | 'warm' | 'cold';
    if (score >= 70) {
      tier = 'hot';
    } else if (score >= 40) {
      tier = 'warm';
    } else {
      tier = 'cold';
    }

    const details = scoreBreakdown.join(' | ') || 'Standard scoring applied';

    log.info('LeadScoring', 'Lead scored', {
      orgId,
      score,
      tier,
      sentiment,
      highValueMatches,
      mediumValueMatches,
      urgencyMatches
    });

    return { score, tier, details };
  } catch (error: any) {
    log.error('LeadScoring', 'Error scoring lead', { orgId, error: error?.message });
    // Return default warm score on error
    return {
      score: 50,
      tier: 'warm',
      details: 'Default scoring applied due to analysis error'
    };
  }
}

/**
 * Calculate lead score from components (used for testing/granular control)
 * @param keywords - Array of keywords found in transcript
 * @param sentiment - Sentiment label
 * @param urgency - Urgency level
 * @param serviceType - Type of service being discussed
 * @returns Numeric score 0-100
 */
export function calculateLeadScore(
  keywords: string[],
  sentiment: string,
  urgency: string,
  serviceType: string
): number {
  let score = 50;

  // Keywords contribution
  const highValueCount = keywords.filter(kw => HIGH_VALUE_KEYWORDS.includes(kw.toLowerCase())).length;
  const mediumValueCount = keywords.filter(kw => MEDIUM_VALUE_KEYWORDS.includes(kw.toLowerCase())).length;

  score += Math.min(highValueCount * 40, 40);
  score += Math.min(mediumValueCount * 20, 20);

  // Sentiment contribution
  if (sentiment === 'positive') score += 30;
  else if (sentiment === 'negative') score -= 20;

  // Urgency contribution
  if (URGENCY_KEYWORDS.some(kw => urgency.toLowerCase().includes(kw))) {
    score += 30;
  } else if (LOW_URGENCY_KEYWORDS.some(kw => urgency.toLowerCase().includes(kw))) {
    score -= 10;
  }

  // Service type bonus (premium services)
  const premiumServices = ['botox', 'laser', 'surgical'];
  if (premiumServices.some(svc => serviceType.toLowerCase().includes(svc))) {
    score += 15;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Get emoji tier indicator for UI display
 */
export function getTierEmoji(tier: 'hot' | 'warm' | 'cold'): string {
  switch (tier) {
    case 'hot':
      return '🔥';
    case 'warm':
      return '🌡️';
    case 'cold':
      return '❄️';
    default:
      return '📊';
  }
}

/**
 * Format lead tier with emoji for display
 */
export function formatTierWithEmoji(tier: 'hot' | 'warm' | 'cold'): string {
  return `${getTierEmoji(tier)} ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
}

/**
 * Estimate financial value of a lead based on procedure keywords
 * used for dashboard pipeline visualization
 */
export function estimateLeadValue(transcript: string): number {
  const t = transcript.toLowerCase();

  // Harley Street Market Rates (Conservative Estimates)
  if (t.includes('rhinoplasty') || t.includes('nose job')) return 8000;
  if (t.includes('facelift') || t.includes('face lift')) return 15000;
  if (t.includes('breast augmentation') || t.includes('boob job')) return 7500;
  if (t.includes('liposuction')) return 4000;
  if (t.includes('tummy tuck') || t.includes('abdominoplasty')) return 9000;
  if (t.includes('hair transplant')) return 6000;
  if (t.includes('blepharoplasty') || t.includes('eyelid')) return 3500;

  // Non-surgical
  if (t.includes('botox') || t.includes('filler')) return 350;
  if (t.includes('facial') || t.includes('peel')) return 150;
  if (t.includes('consultation')) return 200;

  return 0; // Unknown value
}
