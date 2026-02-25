'use client';

import { motion } from 'framer-motion';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="h-1.5 bg-surgical-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-surgical-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1.0] }}
        />
      </div>
      <p className="text-xs text-obsidian/40 mt-2 text-center">
        Step {currentStep + 1} of {totalSteps}
      </p>
    </div>
  );
}
