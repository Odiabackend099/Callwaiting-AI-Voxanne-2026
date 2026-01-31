'use client';

import React, { useEffect, useState } from 'react';
import { Globe, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

// Country data with flag emojis
const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    flag: '\u{1F1FA}\u{1F1F8}',
    description: 'Forward to US local number',
    costInfo: 'Local rate',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '\u{1F1EC}\u{1F1E7}',
    description: 'Forward to UK local number',
    costInfo: 'Local rate',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '\u{1F1F3}\u{1F1EC}',
    description: 'Forward to US number (cost savings)',
    costInfo: '~\u20A630/min (92% savings)',
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '\u{1F1F9}\u{1F1F7}',
    description: 'Forward to US number (cost savings)',
    costInfo: 'Standard international rate',
  },
];

interface CountrySelectionStepProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string) => void;
  onNext: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function CountrySelectionStep({
  selectedCountry,
  onCountrySelect,
  onNext,
  isLoading = false,
  error = null,
}: CountrySelectionStepProps) {
  const [countryWarning, setCountryWarning] = useState<string | null>(null);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);

  // Fetch country warning when country is selected
  useEffect(() => {
    if (!selectedCountry) {
      setCountryWarning(null);
      return;
    }

    // Create AbortController to cancel in-flight requests on unmount/re-render
    const abortController = new AbortController();

    const fetchCountryWarning = async () => {
      setIsLoadingCarriers(true);
      try {
        const response = await fetch(`/api/telephony/select-country`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode: selectedCountry }),
          signal: abortController.signal, // Pass abort signal
        });

        // Only update state if request wasn't aborted
        if (!abortController.signal.aborted && response.ok) {
          const data = await response.json();
          setCountryWarning(data.warning || null);
        }
      } catch (error: any) {
        // Ignore AbortError (expected when component unmounts or country changes)
        if (error.name === 'AbortError') {
          console.log('Country fetch cancelled:', selectedCountry);
          return;
        }
        console.error('Failed to fetch country details:', error);
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortController.signal.aborted) {
          setIsLoadingCarriers(false);
        }
      }
    };

    fetchCountryWarning();

    // Cleanup: abort fetch if component unmounts or selectedCountry changes
    return () => {
      abortController.abort();
    };
  }, [selectedCountry]);

  const handleCountryClick = (countryCode: string) => {
    onCountrySelect(countryCode);
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
            key={country.code}
            onClick={() => handleCountryClick(country.code)}
            disabled={isLoading || isLoadingCarriers}
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
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
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

      {/* Loading State - Skeleton Loader */}
      {isLoadingCarriers && (
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
          onClick={handleContinue}
          disabled={!selectedCountry || isLoading || isLoadingCarriers}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2 ${
            !selectedCountry || isLoading || isLoadingCarriers
              ? 'bg-surgical-100 text-obsidian/40 cursor-not-allowed'
              : 'bg-surgical-600 hover:bg-surgical-700 text-white shadow-md hover:shadow-xl hover:scale-[1.02]'
          }`}
        >
          {isLoading || isLoadingCarriers ? (
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
