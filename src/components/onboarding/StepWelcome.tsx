'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';

export default function StepWelcome() {
  const { clinicName, setClinicName, nextStep } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  const [localName, setLocalName] = useState(clinicName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localName.trim();
    if (!trimmed) return;

    setClinicName(trimmed);
    track('clinic_named', 0, { clinic_name: trimmed });
    nextStep();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surgical-50 border border-surgical-200 mb-6">
        <Building2 className="w-8 h-8 text-surgical-600" />
      </div>

      <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-3">
        What is the name of your clinic?
      </h1>
      <p className="text-base text-obsidian/60 mb-8">
        We&apos;ll personalize your AI receptionist for your practice.
      </p>

      <form onSubmit={handleSubmit} className="max-w-sm mx-auto">
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          placeholder="e.g. Bright Smile Dental"
          className="w-full px-4 py-3 rounded-xl border border-surgical-200 bg-white text-obsidian placeholder:text-obsidian/40 focus:outline-none focus:ring-2 focus:ring-surgical-600/30 focus:border-surgical-400 transition-all text-center text-lg"
          autoFocus
          maxLength={200}
        />

        <button
          type="submit"
          disabled={!localName.trim()}
          className="mt-6 w-full px-6 py-3 rounded-xl bg-surgical-600 text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
        >
          Continue
        </button>
      </form>
    </motion.div>
  );
}
