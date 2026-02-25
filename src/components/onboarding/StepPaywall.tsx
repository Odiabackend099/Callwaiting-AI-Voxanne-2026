'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Clock, CalendarCheck } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const VALUE_PROPS = [
  {
    icon: Phone,
    stat: '$150–400',
    label: 'Lost per missed call',
  },
  {
    icon: Clock,
    stat: '2 seconds',
    label: 'AI answers every call, 24/7',
  },
  {
    icon: CalendarCheck,
    stat: 'Direct booking',
    label: 'Patients book without back-and-forth',
  },
];

export default function StepPaywall() {
  const { areaCode, setAreaCode } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Area code validation: empty = OK (picks any local number); 3 digits = OK; 1-2 digits = invalid
  const areaCodeInvalid = areaCode.length > 0 && areaCode.length < 3;

  // Fire telemetry on mount
  useEffect(() => {
    track('payment_viewed', 2);
  }, [track]);

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await authedBackendFetch<{ url?: string }>('/api/billing/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({
          amount_pence: 2500, // £25 minimum top-up
          return_url: '/dashboard/onboarding',
        }),
      });

      if (response?.url) {
        window.location.href = response.url;
      } else {
        setError('Unable to create checkout session. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="text-center"
    >
      <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
        Stop losing revenue to missed calls.
      </h1>
      <p className="text-lg text-obsidian/60 mb-8">
        Activate your 24/7 AI Receptionist.
      </p>

      {/* Value proposition cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
        {VALUE_PROPS.map(({ icon: Icon, stat, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
            className="p-4 rounded-xl border border-surgical-200 bg-white"
          >
            <Icon className="w-5 h-5 text-surgical-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-obsidian">{stat}</p>
            <p className="text-xs text-obsidian/50">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Area code input */}
      <div className="max-w-xs mx-auto mb-6">
        <label className="block text-sm font-medium text-obsidian/70 mb-2">
          Choose your local area code
        </label>
        <input
          type="text"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          placeholder="e.g. 415"
          maxLength={3}
          className={`w-full px-4 py-3 rounded-xl border bg-white text-obsidian placeholder:text-obsidian/40 focus:outline-none focus:ring-2 transition-all text-center text-lg font-mono tracking-widest ${
            areaCodeInvalid
              ? 'border-surgical-400 focus:ring-surgical-600/40 focus:border-surgical-500'
              : 'border-surgical-200 focus:ring-surgical-600/30 focus:border-surgical-400'
          }`}
        />
        {areaCodeInvalid ? (
          <p className="text-xs text-obsidian/70 mt-1">
            Area codes are 3 digits — e.g. 415, 212, 310.
          </p>
        ) : (
          <p className="text-xs text-obsidian/40 mt-1">
            Your patients will see a local number they trust.
          </p>
        )}
      </div>

      {/* CTA button */}
      <button
        onClick={handleCheckout}
        disabled={loading || areaCodeInvalid}
        className="w-full max-w-xs mx-auto block px-6 py-4 rounded-xl bg-surgical-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          'Get My AI Number'
        )}
      </button>

      <p className="text-xs text-obsidian/40 mt-3">
        Starts at £25. Covers your first AI phone number + call credits.
      </p>

      {error && (
        <p className="text-sm text-obsidian/70 mt-4 bg-surgical-50 border border-surgical-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </motion.div>
  );
}
