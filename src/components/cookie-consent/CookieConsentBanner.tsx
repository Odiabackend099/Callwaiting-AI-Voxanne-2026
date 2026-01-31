'use client';

import React, { useState } from 'react';
import { useCookieConsent } from './useCookieConsent';
import { CookieConsentModal } from './CookieConsentModal';
import Link from 'next/link';

/**
 * CookieConsentBanner Component
 *
 * Displays a PECR-compliant cookie consent banner at the bottom of the page
 * Appears on first visit or when consent has expired
 *
 * Features:
 * - Accept All button
 * - Reject Non-Essential button
 * - Customize button (opens modal)
 * - Links to Privacy Policy and Cookie Policy
 * - Smooth animations
 */
export function CookieConsentBanner() {
  const {
    showBanner,
    acceptAll,
    rejectNonEssential,
    openModal,
  } = useCookieConsent();

  const [showModal, setShowModal] = useState(false);

  // Listen for open/close modal events
  React.useEffect(() => {
    const handleOpen = () => setShowModal(true);
    const handleClose = () => setShowModal(false);

    window.addEventListener('openCookieSettings', handleOpen);
    window.addEventListener('closeCookieSettings', handleClose);

    return () => {
      window.removeEventListener('openCookieSettings', handleOpen);
      window.removeEventListener('closeCookieSettings', handleClose);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Content Container */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Left: Message */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <span className="text-2xl">🍪</span>
                <h3 className="font-semibold text-slate-900">
                  We Use Cookies
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                We use essential cookies for security and functionality, and optional cookies for analytics. You can customize your preferences.
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                <Link
                  href="/privacy"
                  className="hover:text-surgical-600 transition-colors underline"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/cookie-policy"
                  className="hover:text-surgical-600 transition-colors underline"
                >
                  Cookie Policy
                </Link>
              </div>
            </div>

            {/* Right: Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button
                onClick={rejectNonEssential}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                Reject Non-Essential
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Customize
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-surgical-600 hover:bg-surgical-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Accept All
              </button>
            </div>
          </div>

          {/* Legal notice */}
          <p className="text-xs text-slate-400 mt-4 sm:mt-0 sm:text-right">
            We respect your privacy. Consent expires after 12 months.
          </p>
        </div>
      </div>

      {/* Cookie Consent Modal */}
      {showModal && (
        <CookieConsentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Spacer to prevent content overlap */}
      <div className="h-24 sm:h-20" />
    </>
  );
}
