'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default function StepAhaMoment() {
  const router = useRouter();
  const { phoneNumber, clinicName, specialty } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  const [completing, setCompleting] = useState(false);

  const markComplete = async () => {
    try {
      await authedBackendFetch('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          clinic_name: clinicName,
          specialty,
        }),
      });
    } catch {
      // Best-effort — still redirect
    }
  };

  const handleSetupAgent = async () => {
    if (completing) return;
    setCompleting(true);

    track('test_call_completed', 4, { phone_number: phoneNumber });
    await markComplete();
    router.push('/dashboard/agent-config');
  };

  const handleSkip = async () => {
    if (completing) return;
    setCompleting(true);

    await markComplete();
    router.push('/dashboard');
  };

  const displayNumber = phoneNumber
    ? formatPhoneNumber(phoneNumber)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surgical-50 border border-surgical-200 mb-6">
        <Sparkles className="w-8 h-8 text-surgical-600" />
      </div>

      <h1 className="text-2xl font-bold text-obsidian tracking-tighter mb-2">
        Your number is ready!
      </h1>
      <p className="text-base text-obsidian/60 mb-6">
        Now let&apos;s teach your AI what to say.
      </p>

      {/* Phone number display */}
      {displayNumber && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-surgical-50 border border-surgical-200 mb-6"
        >
          <Phone className="w-4 h-4 text-surgical-500" />
          <p className="text-lg font-mono font-semibold text-obsidian tracking-tight">
            {displayNumber}
          </p>
        </motion.div>
      )}

      <p className="text-sm text-obsidian/50 mb-8 max-w-xs mx-auto">
        Set up your AI agent&apos;s greeting, knowledge base, and call handling rules
        {clinicName ? ` for ${clinicName}` : ''}.
      </p>

      {/* Primary CTA */}
      <button
        onClick={handleSetupAgent}
        disabled={completing}
        className="w-full max-w-xs mx-auto block px-6 py-4 rounded-xl bg-surgical-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {completing ? 'Setting up...' : 'Set Up My AI Agent'}
      </button>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        disabled={completing}
        className="mt-4 text-sm text-obsidian/40 hover:text-obsidian/60 underline underline-offset-4 transition-colors disabled:opacity-40"
      >
        I&apos;ll set this up later
      </button>
    </motion.div>
  );
}
