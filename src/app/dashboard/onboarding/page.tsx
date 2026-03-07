'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import StepNumberSelection from '@/components/onboarding/StepNumberSelection';
import StepPayment from '@/components/onboarding/StepPayment';
import StepTelecomRouting from '@/components/onboarding/StepTelecomRouting';
import StepAgentPersonality from '@/components/onboarding/StepAgentPersonality';
import StepSyncAndAha from '@/components/onboarding/StepSyncAndAha';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const STEP_COMPONENTS = [
  StepNumberSelection,   // Step 0: Direction + number search
  StepPayment,           // Step 1: Stripe checkout + auto-provision
  StepTelecomRouting,    // Step 2: Call forwarding or caller ID
  StepAgentPersonality,  // Step 3: Persona + voice + prompt
  StepSyncAndAha,        // Step 4: Sync agent to phone + success
];
const TOTAL_STEPS = STEP_COMPONENTS.length;

/**
 * Inner component uses useSearchParams — must be wrapped in <Suspense>.
 */
function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const { currentStep, slideDirection, goToStep, setPaymentComplete } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  const hasTrackedStart = useRef(false);
  const hasHandledReturn = useRef(false);

  // Fire "started" telemetry once on mount
  useEffect(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      track('started', 0);
    }
  }, [track]);

  // Detect Stripe return (?topup=success) — payment is now Step 1
  useEffect(() => {
    if (hasHandledReturn.current) return;

    const topup = searchParams.get('topup');
    if (topup === 'success') {
      hasHandledReturn.current = true;
      setPaymentComplete(true);
      track('payment_success', 1);
      // Jump to payment step (Step 1) — it will auto-provision the number
      goToStep(1);

      // Clean up URL params without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('topup');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, setPaymentComplete, goToStep, track]);

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-clinical-bg flex flex-col">
      {/* Progress bar at top */}
      <div className="pt-8 px-4">
        <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12 overflow-hidden">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={currentStep}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="w-full max-w-lg"
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Suspense boundary required by Next.js 15 for useSearchParams() in App Router.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  );
}
