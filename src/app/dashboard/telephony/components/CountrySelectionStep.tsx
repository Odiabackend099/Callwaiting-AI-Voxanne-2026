'use client';

import React, { useEffect, useState } from 'react';
import { Globe, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

// Country data with flag emojis
const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    description: 'Forward to US local number',
    costInfo: 'Local rate',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    description: 'Forward to UK local number',
    costInfo: 'Local rate',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    description: 'Forward to US number (cost savings)',
    costInfo: '~₦30/min (92% savings)',
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    description: 'Forward to US number (cost savings)',
    costInfo: 'Standard international rate',
  },
];

interface CountrySelectionStepProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
  isLoadingCountry?: boolean;
  error?: string | null;
}

export function CountrySelectionStep({
  selectedCountry,
  onCountrySelect,
  onNext,
  isLoading = false,
  isLoadingCountry = false,
  error = null,
}: CountrySelectionStepProps) {
  const [countryWarning, setCountryWarning] = useState<string | null>(null);

  // Fetch country warning when country is selected
  useEffect(() => {
    if (!selectedCountry) {
      setCountryWarning(null);
      return;
    }

    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true;

    const fetchCountryWarning = async () => {
      try {
        const data = await authedBackendFetch<{ warning?: string }>('/api/telephony/select-country', {
          method: 'POST',
          body: JSON.stringify({ countryCode: selectedCountry }),
        });

        // Only update state if component is still mounted
        if (isMounted && data) {
          setCountryWarning(data.warning || null);
        }
      } catch (error: any) {
        // Silent fail - warning is optional, doesn't affect core functionality
        if (isMounted) {
          console.error('Failed to fetch country warning:', error);
        }
      }
    };

    fetchCountryWarning();

    // Cleanup: mark component as unmounted
    return () => {
      isMounted = false;
    };
  }, [selectedCountry]);

  const handleCountryClick = async (countryCode: string) => {
    await onCountrySelect(countryCode);
  };

  const handleContinue = () => {
    if (!selectedCountry) return;
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surgical-50 mb-4">
          <Globe className="w-6 h-6 text-surgical-600" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-obsidian mb-2">
          Where is your clinic located?
        </h2>
        <p className="text-sm text-obsidian/60 max-w-md mx-auto">
          We'll configure the optimal call forwarding route for your region to minimize costs and latency.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">
                Error
              </p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Country Selection Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {COUNTRIES.map((country) => (
          <button
            type="button"
            key={country.code}
            onClick={() => handleCountryClick(country.code)}
            disabled={isLoading || isLoadingCountry}
            className={`relative p-6 rounded-xl border transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedCountry === country.code
                ? 'border-surgical-600 bg-surgical-50 shadow-lg scale-[1.02]'
                : 'border-surgical-200 bg-white hover:border-surgical-600 hover:shadow-md hover:scale-[1.01]'
            }`}
          >
            {/* Flag */}
            <div className="text-4xl mb-3">{country.flag}</div>

            {/* Country Name */}
            <div className="font-semibold text-base text-obsidian mb-1">
              {country.name}
            </div>

            {/* Description */}
            <div className="text-sm text-obsidian/60 mb-2">
              {country.description}
            </div>

            {/* Cost Info Badge */}
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surgical-50 text-surgical-600 border border-surgical-200">
              {country.costInfo}
            </div>

            {/* Selected Indicator */}
            {selectedCountry === country.code && (
              <div className="absolute top-4 right-4">
                <div className="w-6 h-6 rounded-full bg-surgical-600 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Country-Specific Warning (Nigeria/Turkey) */}
      {selectedCountry && countryWarning && (
        <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-surgical-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-obsidian mb-1">
                Important Cost Information
              </p>
              <p className="text-xs text-obsidian/60 leading-relaxed">
                {countryWarning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Regulatory Info Cards (TR/UK/CA) */}
      {selectedCountry === 'TR' && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🇹🇷</div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">
                Turkey Regulatory Requirements
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 mb-3">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>BTK (Turkish Telecom Authority) approval required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Business must have Turkish Tax ID (VKN)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Approval process takes 5-10 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span><strong>BYOC recommended</strong> for immediate setup</span>
                </li>
              </ul>
              <p className="text-xs text-blue-700">
                The BYOC (Bring Your Own Carrier) flow allows you to verify your existing Turkish mobile number and start forwarding calls immediately, without waiting for regulatory approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCountry === 'GB' && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🇬🇧</div>
            <div className="flex-1">
              <h4 className="font-semibold text-purple-900 mb-2">
                United Kingdom Regulatory Requirements
              </h4>
              <ul className="text-sm text-purple-800 space-y-1 mb-3">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">•</span>
                  <span>Ofcom registration required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">•</span>
                  <span>Companies House registration number needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">•</span>
                  <span>UK business address verification required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">•</span>
                  <span>Approval process takes 10-15 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">•</span>
                  <span><strong>BYOC recommended</strong> for immediate setup</span>
                </li>
              </ul>
              <p className="text-xs text-purple-700">
                BYOC allows you to verify your existing UK mobile number and start forwarding calls immediately, bypassing the regulatory waiting period.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCountry === 'CA' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🇨🇦</div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-2">
                Canada Regulatory Requirements
              </h4>
              <ul className="text-sm text-red-800 space-y-1 mb-3">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>CRTC (Canadian Radio-television) approval required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>Canadian Business Registry number needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>CASL (Canada's Anti-Spam Legislation) compliance required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>Approval process takes 7-14 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>BYOC recommended</strong> for immediate setup</span>
                </li>
              </ul>
              <p className="text-xs text-red-700">
                Use BYOC to verify your existing Canadian mobile number and begin forwarding calls immediately, avoiding the regulatory approval timeline.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCountry === 'US' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🇺🇸</div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 mb-2">
                United States - Ready for Immediate Setup
              </h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>No additional regulatory approval required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>BYOC setup completes in minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Works with all major US carriers (AT&T, T-Mobile, Verizon)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {selectedCountry === 'NG' && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🇳🇬</div>
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-900 mb-2">
                Nigeria - Smart Routing Enabled
              </h4>
              <ul className="text-sm text-emerald-800 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span><strong>92% cost savings</strong> via US routing (\u20A630/min vs \u20A6350/min)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span>BYOC setup works with Glo, MTN, Airtel, 9mobile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span>Setup completes in minutes</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Loading State - Skeleton Loader */}
      {isLoadingCountry && (
        <div className="space-y-3 py-4">
          <div className="h-4 bg-surgical-100 rounded animate-pulse"></div>
          <div className="h-4 bg-surgical-100 rounded w-3/4 animate-pulse"></div>
          <div className="text-xs text-center text-obsidian/60 mt-2">
            Loading carrier information...
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedCountry || isLoading || isLoadingCountry}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2 ${
            !selectedCountry || isLoading || isLoadingCountry
              ? 'bg-surgical-100 text-obsidian/40 cursor-not-allowed'
              : 'bg-surgical-600 hover:bg-surgical-700 text-white shadow-md hover:shadow-xl hover:scale-[1.02]'
          }`}
        >
          {isLoading || isLoadingCountry ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>Continue to Carrier Selection</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {/* Helper Text */}
      {!selectedCountry && (
        <p className="text-xs text-center text-obsidian/40">
          Select your country to see available mobile carriers and forwarding options
        </p>
      )}
    </div>
  );
}
