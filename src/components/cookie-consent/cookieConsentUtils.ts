// Cookie Consent Utility Functions

import {
  CookieConsentState,
  COOKIE_CONSENT_STORAGE_KEY,
  CONSENT_EXPIRY_DURATION,
  DEFAULT_CONSENT_STATE,
} from './cookieConsentConfig';

/**
 * Check if consent has been given
 */
export function hasConsentBeenGiven(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  return !!stored;
}

/**
 * Check if consent has expired
 */
export function isConsentExpired(consentState: CookieConsentState): boolean {
  if (!consentState.expiry) return true;
  return new Date().getTime() > new Date(consentState.expiry).getTime();
}

/**
 * Get stored consent from localStorage
 */
export function getStoredConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!stored) return null;

    const parsed: CookieConsentState = JSON.parse(stored);

    // Check if consent has expired
    if (isConsentExpired(parsed)) {
      localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing stored consent:', error);
    return null;
  }
}

/**
 * Save consent to localStorage
 */
export function saveConsent(consentState: CookieConsentState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consentState));
  } catch (error) {
    console.error('Error saving consent:', error);
  }
}

/**
 * Clear consent from localStorage
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing consent:', error);
  }
}

/**
 * Create a new consent state with updated preferences
 */
export function createConsentState(preferences: {
  analytics?: boolean;
  functional?: boolean;
  marketing?: boolean;
}): CookieConsentState {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    expiry: new Date(Date.now() + CONSENT_EXPIRY_DURATION).toISOString(),
    consent: {
      essential: true, // Always true
      analytics: preferences.analytics ?? false,
      functional: preferences.functional ?? false,
      marketing: preferences.marketing ?? false,
    },
  };
}

/**
 * Check if a specific cookie category is consented to
 */
export function isCategoryConsented(
  consentState: CookieConsentState | null,
  category: 'analytics' | 'functional' | 'marketing'
): boolean {
  if (!consentState) return false;
  return consentState.consent[category] ?? false;
}

/**
 * Validate consent state structure
 */
export function isValidConsentState(obj: any): obj is CookieConsentState {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.version === 1 &&
    obj.timestamp &&
    obj.expiry &&
    obj.consent &&
    typeof obj.consent.essential === 'boolean' &&
    typeof obj.consent.analytics === 'boolean' &&
    typeof obj.consent.functional === 'boolean' &&
    typeof obj.consent.marketing === 'boolean'
  );
}

/**
 * Respect Do Not Track signal
 */
export function respectDoNotTrack(): boolean {
  if (typeof window === 'undefined') return false;

  const dnt = navigator.doNotTrack || (window as any).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/**
 * Generate consent summary for debugging
 */
export function getConsentSummary(consentState: CookieConsentState | null): string {
  if (!consentState) return 'No consent recorded';

  const { consent } = consentState;
  const categories = Object.entries(consent)
    .filter(([key]) => key !== 'essential')
    .map(([key, value]) => `${key}: ${value ? 'granted' : 'denied'}`)
    .join(', ');

  return `Essential: always, ${categories}`;
}
