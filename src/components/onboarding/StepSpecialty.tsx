'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Smile,
  Sparkles,
  Activity,
  Heart,
  Stethoscope,
  MoreHorizontal,
} from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';

const SPECIALTIES = [
  { id: 'dental', label: 'Dental', icon: Smile },
  { id: 'medspa', label: 'Med Spa', icon: Sparkles },
  { id: 'chiropractic', label: 'Chiropractic', icon: Activity },
  { id: 'physio', label: 'Physio', icon: Heart },
  { id: 'dermatology', label: 'Dermatology', icon: Stethoscope },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
] as const;

export default function StepSpecialty() {
  const { setSpecialty, nextStep } = useOnboardingStore();
  const { track } = useOnboardingTelemetry();
  const [selected, setSelected] = useState<string | null>(null);
  // Ref prevents calling nextStep() on an already-unmounted component
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(advanceTimer.current);
  }, []);

  const handleSelect = (specialtyId: string) => {
    setSelected(specialtyId);
    setSpecialty(specialtyId);
    track('specialty_chosen', 1, { specialty: specialtyId });

    // Auto-advance after a brief delay for visual feedback
    advanceTimer.current = setTimeout(() => {
      nextStep();
    }, 400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="text-center"
    >
      <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-3">
        What is your specialty?
      </h1>
      <p className="text-base text-obsidian/60 mb-8">
        This helps us tailor your AI&apos;s knowledge and tone.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-md mx-auto">
        {SPECIALTIES.map(({ id, label, icon: Icon }) => {
          const isSelected = selected === id;
          return (
            <motion.button
              key={id}
              onClick={() => handleSelect(id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`
                flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 cursor-pointer transition-all
                ${
                  isSelected
                    ? 'border-surgical-600 bg-surgical-50 shadow-md'
                    : 'border-surgical-200 bg-white hover:border-surgical-300 hover:shadow-sm'
                }
              `}
            >
              <Icon
                className={`w-7 h-7 ${
                  isSelected ? 'text-surgical-600' : 'text-obsidian/50'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isSelected ? 'text-surgical-600' : 'text-obsidian/70'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
