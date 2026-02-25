'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import ConfettiEffect from './ConfettiEffect';

export default function StepCelebration() {
  const {
    areaCode,
    nextStep,
    setPhoneNumber,
    setProvisioningInProgress,
    provisioningInProgress,
    phoneNumber,
  } = useOnboardingStore();

  const [showButton, setShowButton] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Show "Continue" button after confetti
  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-provision phone number
  useEffect(() => {
    if (phoneNumber || provisioningInProgress) return;

    const provision = async () => {
      setProvisioningInProgress(true);
      try {
        const result = await authedBackendFetch<{
          success: boolean;
          phoneNumber?: string;
          error?: string;
        }>('/api/onboarding/provision-number', {
          method: 'POST',
          body: JSON.stringify({ area_code: areaCode || undefined }),
        });

        if (result?.phoneNumber) {
          setPhoneNumber(result.phoneNumber);
        } else {
          setProvisionError(result?.error || 'Could not provision a number.');
        }
      } catch (err: any) {
        setProvisionError(err.message || 'Failed to provision number.');
      } finally {
        setProvisioningInProgress(false);
      }
    };

    provision();
  }, [areaCode, phoneNumber, provisioningInProgress, setPhoneNumber, setProvisioningInProgress]);

  return (
    <>
      <ConfettiEffect duration={3000} particleCount={120} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0.0, 0.2, 1.0] }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surgical-50 border border-surgical-200 mb-6"
        >
          <PartyPopper className="w-10 h-10 text-surgical-600" />
        </motion.div>

        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-3">
          Your AI Receptionist is officially hired!
        </h1>
        <p className="text-base text-obsidian/60 mb-8">
          {provisioningInProgress
            ? 'Setting up your phone number...'
            : provisionError
              ? 'We had trouble setting up your number, but you can do it from the dashboard.'
              : 'Your new phone number is being prepared.'}
        </p>

        {showButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={nextStep}
            className="px-8 py-3 rounded-xl bg-surgical-600 text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all"
          >
            Continue
          </motion.button>
        )}
      </motion.div>
    </>
  );
}
