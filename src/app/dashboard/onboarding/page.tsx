'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import StepWelcome from '@/components/onboarding/StepWelcome';
import StepSpecialty from '@/components/onboarding/StepSpecialty';
import StepPaywall from '@/components/onboarding/StepPaywall';
import StepCelebration from '@/components/onboarding/StepCelebration';
import StepAhaMoment from '@/components/onboarding/StepAhaMoment';

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

// Fix 11: derive from array so it never drifts out of sync
const STEP_COMPONENTS = [
  StepWelcome,
  StepSpecialty,
  StepPaywall,
  StepCelebration,
  StepAhaMoment,
];
const TOTAL_STEPS = STEP_COMPONENTS.length;

/**
 * Inner component uses useSearchParams — must be wrapped in <Suspense> (Fix 2).
 */
function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const { currentStep, direction, goToStep, setPaymentComplete } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  // Refs prevent React Strict Mode's double-invocation of effects from firing duplicate events
  const hasTrackedStart = useRef(false);
  const hasHandledReturn = useRef(false);

  // Fire "started" telemetry once on mount
  useEffect(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      track('started', 0);
    }
  }, [track]);

  // Detect Stripe return (?topup=success)
  useEffect(() => {
    if (hasHandledReturn.current) return;

    const topup = searchParams.get('topup');
    if (topup === 'success') {
      hasHandledReturn.current = true;
      setPaymentComplete(true);
      track('payment_success', 2);
      // Jump to celebration step (step 3)
      goToStep(3);

      // Clean up URL params without reload — Fix 7: use url.toString() to preserve other params
      const url = new URL(window.location.href);
      url.searchParams.delete('topup');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, setPaymentComplete, goToStep, track]);

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    // Fix 13: bg-clinical-bg design token instead of hardcoded #F0F9FF
    <div className="fixed inset-0 z-50 bg-clinical-bg flex flex-col">
      {/* Progress bar at top */}
      <div className="pt-8 px-4">
        <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
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
 * Fix 2: Suspense boundary required by Next.js 15 for useSearchParams() in App Router.
 * The inner component is suspended during SSR; the wrapper renders immediately.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  );
}
