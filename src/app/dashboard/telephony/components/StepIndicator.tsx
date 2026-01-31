'use client';

import React from 'react';
import { Check } from 'lucide-react';

type WizardStep = 'country_selection' | 'phone_input' | 'verification' | 'carrier_selection' | 'forwarding_code' | 'confirmation';

interface StepIndicatorProps {
  currentStep: WizardStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: 'country_selection', label: 'Country' },
    { id: 'phone_input', label: 'Phone' },
    { id: 'verification', label: 'Verify' },
    { id: 'carrier_selection', label: 'Configure' },
    { id: 'forwarding_code', label: 'Activate' },
    { id: 'confirmation', label: 'Done' },
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, index) => (
        <React.Fragment key={s.id}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                currentIndex > index
                  ? 'bg-surgical-600 text-white'
                  : currentIndex === index
                  ? 'bg-surgical-600 text-white'
                  : 'bg-surgical-100 text-obsidian/60'
              }`}
            >
              {currentIndex > index ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <span className="text-xs mt-2 text-obsidian/60 hidden sm:block">
              {s.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-colors ${
                currentIndex > index
                  ? 'bg-surgical-600'
                  : 'bg-surgical-100'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
