'use client';

// React Hook for Cookie Consent Management

import { useState, useEffect, useCallback } from 'react';
import {
  CookieConsentState,
  DEFAULT_CONSENT_STATE,
} from './cookieConsentConfig';
import {
  getStoredConsent,
  saveConsent,
  clearConsent,
  createConsentState,
  hasConsentBeenGiven,
  isCategoryConsented,
  respectDoNotTrack,
  isConsentExpired,
} from './cookieConsentUtils';

export interface UseCookieConsentReturn {
  // State
  consent: CookieConsentState | null;
  hasConsented: boolean;
  showBanner: boolean;

  // Category checks
  isAnalyticsConsented: boolean;
  isFunctionalConsented: boolean;
  isMarketingConsented: boolean;

  // Actions
  acceptAll: () => void;
  rejectNonEssential: () => void;
  updatePreferences: (preferences: {
    analytics?: boolean;
    functional?: boolean;
    marketing?: boolean;
  }) => void;
  openModal: () => void;
  closeModal: () => void;
  resetConsent: () => void;
}

/**
 * Hook to manage cookie consent state and actions
 * Handles localStorage persistence, expiry checking, and Do Not Track
 */
export function useCookieConsent(): UseCookieConsentReturn {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize consent state from localStorage on mount
  useEffect(() => {
    const storedConsent = getStoredConsent();

    if (!storedConsent) {
      // No stored consent - show banner unless Do Not Track is enabled
      const dnt = respectDoNotTrack();
      if (dnt) {
        // Respect DNT - set minimal consent and don't show banner
        setConsent(createConsentState({}));
        setShowBanner(false);
      } else {
        // Show banner for user choice
        setShowBanner(true);
      }
    } else {
      // Consent exists - load it and check expiry
      if (isConsentExpired(storedConsent)) {
        // Consent expired - show banner again
        clearConsent();
        setShowBanner(true);
      } else {
        // Consent valid - load it and hide banner
        setConsent(storedConsent);
        setShowBanner(false);
      }
    }

    setIsInitialized(true);
  }, []);

  // Accept all non-essential cookies
  const acceptAll = useCallback(() => {
    const newConsent = createConsentState({
      analytics: true,
      functional: true,
      marketing: true,
    });
    setConsent(newConsent);
    saveConsent(newConsent);
    setShowBanner(false);

    // Dispatch custom event for analytics loading
    window.dispatchEvent(
      new CustomEvent('cookieConsentChanged', { detail: newConsent })
    );
  }, []);

  // Reject non-essential cookies
  const rejectNonEssential = useCallback(() => {
    const newConsent = createConsentState({
      analytics: false,
      functional: false,
      marketing: false,
    });
    setConsent(newConsent);
    saveConsent(newConsent);
    setShowBanner(false);

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('cookieConsentChanged', { detail: newConsent })
    );
  }, []);

  // Update preferences (used by modal)
  const updatePreferences = useCallback(
    (preferences: {
      analytics?: boolean;
      functional?: boolean;
      marketing?: boolean;
    }) => {
      const newConsent = createConsentState(preferences);
      setConsent(newConsent);
      saveConsent(newConsent);
      setShowBanner(false);

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('cookieConsentChanged', { detail: newConsent })
      );
    },
    []
  );

  // Open modal (show settings)
  const openModal = useCallback(() => {
    // This will be handled by parent component that has modal state
    window.dispatchEvent(new Event('openCookieSettings'));
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    window.dispatchEvent(new Event('closeCookieSettings'));
  }, []);

  // Reset consent and show banner again
  const resetConsent = useCallback(() => {
    clearConsent();
    setConsent(null);
    setShowBanner(true);
  }, []);

  return {
    consent,
    hasConsented: !!consent && hasConsentBeenGiven(),
    showBanner: isInitialized && showBanner,
    isAnalyticsConsented: isCategoryConsented(consent, 'analytics'),
    isFunctionalConsented: isCategoryConsented(consent, 'functional'),
    isMarketingConsented: isCategoryConsented(consent, 'marketing'),
    acceptAll,
    rejectNonEssential,
    updatePreferences,
    openModal,
    closeModal,
    resetConsent,
  };
}
