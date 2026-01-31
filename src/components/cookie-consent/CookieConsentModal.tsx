'use client';

import React, { useState } from 'react';
import { useCookieConsent } from './useCookieConsent';
import { COOKIE_CATEGORIES } from './cookieConsentConfig';
import { X, Check } from 'lucide-react';

interface CookieConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CookieConsentModal Component
 *
 * Detailed cookie settings modal where users can:
 * - View all cookie categories
 * - Toggle non-essential categories
 * - See detailed descriptions and examples
 * - Save preferences or accept all
 */
export function CookieConsentModal({ isOpen, onClose }: CookieConsentModalProps) {
  const { consent, updatePreferences, acceptAll } = useCookieConsent();

  const [preferences, setPreferences] = useState({
    analytics: consent?.consent.analytics ?? false,
    functional: consent?.consent.functional ?? false,
    marketing: consent?.consent.marketing ?? false,
  });

  const handleToggle = (category: 'analytics' | 'functional' | 'marketing') => {
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSavePreferences = () => {
    updatePreferences(preferences);
    onClose();
  };

  const handleAcceptAll = () => {
    setPreferences({
      analytics: true,
      functional: true,
      marketing: true,
    });
    acceptAll();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-deep-obsidian">
            Cookie Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8 space-y-6">
          {/* Essential Cookies - Always enabled, non-toggleable */}
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  {COOKIE_CATEGORIES.essential.name}
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Always On
                  </span>
                </h3>
                <p className="text-sm text-slate-600 mt-2">
                  {COOKIE_CATEGORIES.essential.description}
                </p>
              </div>
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
            </div>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              {COOKIE_CATEGORIES.essential.cookies.map((cookie) => (
                <li key={cookie.name} className="text-xs">
                  • <strong>{cookie.name}</strong>: {cookie.purpose}
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Cookie Categories */}
          {(['analytics', 'functional', 'marketing'] as const).map((category) => {
            const config = COOKIE_CATEGORIES[category];
            const isEnabled = preferences[category];

            return (
              <div
                key={category}
                className={`rounded-lg p-6 border-2 transition-colors ${
                  isEnabled
                    ? 'bg-surgical-50 border-surgical-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {config.name}
                    </h3>
                    <p className="text-sm text-slate-600 mt-2">
                      {config.description}
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(category)}
                    className={`relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                      isEnabled ? 'bg-surgical-600' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={isEnabled}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform mt-0.5 ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Cookie Details */}
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium hover:text-slate-700">
                    View cookies ({config.cookies.length})
                  </summary>
                  <ul className="mt-2 space-y-1 ml-4">
                    {config.cookies.map((cookie) => (
                      <li key={cookie.name}>
                        • <strong>{cookie.name}</strong>: {cookie.purpose}
                        {cookie.retention && ` (${cookie.retention})`}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-2">PECR Compliance Notice</p>
            <p>
              Under UK Privacy and Electronic Communications Regulations (PECR), we must obtain your explicit consent before storing optional cookies. Essential cookies for security and functionality do not require consent.
            </p>
            <p className="mt-2">
              Your consent will expire after 12 months. You can withdraw consent anytime via your dashboard preferences.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePreferences}
            className="px-6 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Save Preferences
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-6 py-2 text-sm font-medium text-white bg-surgical-600 hover:bg-surgical-700 rounded-lg transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </>
  );
}
