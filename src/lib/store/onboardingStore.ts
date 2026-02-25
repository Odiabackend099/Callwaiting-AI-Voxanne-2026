'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface OnboardingState {
  // Wizard navigation
  currentStep: number;
  direction: 1 | -1;

  // User data
  clinicName: string;
  specialty: string | null;
  areaCode: string;

  // Payment state
  paymentComplete: boolean;

  // Provisioned number
  phoneNumber: string | null;
  provisioningInProgress: boolean;

  // Session tracking (groups telemetry events)
  sessionId: string;

  // Actions
  setClinicName: (name: string) => void;
  setSpecialty: (specialty: string) => void;
  setAreaCode: (code: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setPaymentComplete: (complete: boolean) => void;
  setPhoneNumber: (number: string) => void;
  setProvisioningInProgress: (inProgress: boolean) => void;
  reset: () => void;
}

function generateSessionId(): string {
  return `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const TOTAL_STEPS = 5;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 0,
      direction: 1 as 1 | -1,
      clinicName: '',
      specialty: null,
      areaCode: '',
      paymentComplete: false,
      phoneNumber: null,
      provisioningInProgress: false,
      sessionId: generateSessionId(),

      setClinicName: (name) => set({ clinicName: name }),
      setSpecialty: (specialty) => set({ specialty }),
      setAreaCode: (code) => set({ areaCode: code.replace(/\D/g, '').slice(0, 3) }),

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS - 1),
          direction: 1,
        })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
          direction: -1,
        })),

      goToStep: (step) =>
        set((state) => ({
          currentStep: Math.max(0, Math.min(step, TOTAL_STEPS - 1)),
          direction: step > state.currentStep ? 1 : -1,
        })),

      setPaymentComplete: (complete) => set({ paymentComplete: complete }),
      setPhoneNumber: (number) => set({ phoneNumber: number }),
      setProvisioningInProgress: (inProgress) => set({ provisioningInProgress: inProgress }),

      reset: () =>
        set({
          currentStep: 0,
          direction: 1,
          clinicName: '',
          specialty: null,
          areaCode: '',
          paymentComplete: false,
          phoneNumber: null,
          provisioningInProgress: false,
          sessionId: generateSessionId(),
        }),
    }),
    {
      name: 'voxanne-onboarding',
      // sessionStorage clears when the browser tab closes — appropriate for a one-time wizard.
      // This persists clinicName/specialty/areaCode across the Stripe redirect so step 4
      // can personalise the Aha Moment screen with the correct clinic name.
      storage: createJSONStorage(() => sessionStorage),
      // Partialize excludes function references and provisioningInProgress (ephemeral UI state)
      partialize: (state) => ({
        currentStep: state.currentStep,
        clinicName: state.clinicName,
        specialty: state.specialty,
        areaCode: state.areaCode,
        paymentComplete: state.paymentComplete,
        phoneNumber: state.phoneNumber,
        sessionId: state.sessionId,
      }),
    }
  )
);
