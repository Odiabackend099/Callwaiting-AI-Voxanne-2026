'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Phone, Clock, CalendarCheck, Loader2, Check } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import ConfettiEffect from '@/components/onboarding/ConfettiEffect';
import { PHONE_NUMBER_PRICING } from '@/lib/constants';

const VALUE_PROPS = [
  { icon: Phone, stat: '$150–400', label: 'Lost per missed call' },
  { icon: Clock, stat: '2 seconds', label: 'AI answers every call, 24/7' },
  { icon: CalendarCheck, stat: 'Direct booking', label: 'Patients book without back-and-forth' },
];

type Phase = 'checkout' | 'provisioning' | 'done';

export default function StepPayment() {
  const {
    selectedNumber,
    country,
    numberType,
    areaCode,
    callDirection,
    paymentComplete,
    phoneNumber,
    setPaymentComplete,
    setPhoneNumber,
    setVapiPhoneId,
    setProvisioningInProgress,
    provisioningInProgress,
    nextStep,
  } = useOnboardingStore();

  const { track } = useOnboardingTelemetry();

  const [phase, setPhase] = useState<Phase>(
    paymentComplete && phoneNumber ? 'done' : paymentComplete ? 'provisioning' : 'checkout'
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provisioningAttempted = useRef(false);

  // If payment is already complete (Stripe redirect), auto-provision
  useEffect(() => {
    if (paymentComplete && !phoneNumber && !provisioningAttempted.current) {
      provisioningAttempted.current = true;
      provisionNumber();
    }
  }, [paymentComplete, phoneNumber]);

  const handleCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      track('payment_viewed', 1, { selectedNumber, callDirection });

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
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const provisionNumber = async () => {
    setPhase('provisioning');
    setProvisioningInProgress(true);
    setError(null);

    try {
      const result = await authedBackendFetch<{
        success: boolean;
        phoneNumber: string;
        vapiPhoneId?: string;
        error?: string;
        alreadyProvisioned?: boolean;
      }>('/api/managed-telephony/provision', {
        method: 'POST',
        body: JSON.stringify({
          country,
          numberType,
          areaCode: areaCode || undefined,
          direction: callDirection || 'inbound',
        }),
      });

      if (result.success) {
        setPhoneNumber(result.phoneNumber);
        if (result.vapiPhoneId) setVapiPhoneId(result.vapiPhoneId);
        track('number_provisioned', 1, {
          phoneNumber: result.phoneNumber.slice(-4),
          alreadyProvisioned: result.alreadyProvisioned,
        });
        setPhase('done');
      } else {
        setError(result.error || 'Failed to provision number. Please try again.');
        setPhase('checkout');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to provision number.');
      setPhase('checkout');
    } finally {
      setProvisioningInProgress(false);
    }
  };

  // Phase: provisioning in progress
  if (phase === 'provisioning') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-6"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-surgical-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-surgical-600 animate-spin" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-obsidian tracking-tight">
            Setting up your number...
          </h2>
          <p className="text-sm text-obsidian/60 mt-2">
            This usually takes a few seconds.
          </p>
        </div>
      </motion.div>
    );
  }

  // Phase: provisioning complete — show confetti + continue
  if (phase === 'done' && phoneNumber) {
    return (
      <>
        <ConfettiEffect duration={3000} particleCount={80} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-surgical-50 flex items-center justify-center">
            <Check className="w-8 h-8 text-surgical-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-obsidian tracking-tight">
              Your number is ready!
            </h2>
            <p className="text-3xl font-mono font-bold text-surgical-600 mt-3">
              {phoneNumber}
            </p>
          </div>

          <button
            onClick={nextStep}
            className="px-8 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200"
          >
            Continue Setup
          </button>
        </motion.div>
      </>
    );
  }

  // Phase: checkout — show pricing + CTA
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="text-center space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
          Activate your AI line
        </h1>
        <p className="text-lg text-obsidian/60">
          Stop losing revenue to missed calls.
        </p>
      </div>

      {/* Selected number pill */}
      {selectedNumber && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surgical-50 border border-surgical-200">
          <Phone className="w-4 h-4 text-surgical-600" />
          <span className="font-mono font-medium text-obsidian">{selectedNumber}</span>
        </div>
      )}

      {/* Value props */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
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

      {/* Pricing */}
      <div className="bg-white border border-surgical-200 rounded-xl p-4 max-w-xs mx-auto">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-obsidian/60">Phone number</span>
          <span className="font-medium text-obsidian">{PHONE_NUMBER_PRICING.costDisplay}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-obsidian/60">Minimum top-up</span>
          <span className="font-medium text-obsidian">£25.00</span>
        </div>
        <div className="border-t border-surgical-100 pt-2 flex justify-between text-sm">
          <span className="text-obsidian/60">Total today</span>
          <span className="font-bold text-obsidian">£25.00</span>
        </div>
        <p className="text-xs text-obsidian/40 mt-2">
          Includes {PHONE_NUMBER_PRICING.costDisplay} number + £15 call credits
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={checkoutLoading}
        className="w-full max-w-xs mx-auto block px-6 py-4 rounded-xl bg-surgical-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {checkoutLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pay & Activate
          </span>
        )}
      </button>

      {error && (
        <p className="text-sm text-obsidian/70 bg-surgical-50 border border-surgical-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </motion.div>
  );
}
