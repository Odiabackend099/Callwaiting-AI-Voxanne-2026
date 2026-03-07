'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---- Types ----

export type CallDirection = 'inbound' | 'outbound';
export type NumberType = 'local' | 'toll_free';

export interface OnboardingState {
  // Wizard navigation
  currentStep: number;
  /** Animation slide direction — renamed from `direction` to avoid collision with callDirection */
  slideDirection: 1 | -1;

  // Step 0: Number selection
  callDirection: CallDirection | null;
  country: string;
  numberType: NumberType;
  selectedNumber: string | null;
  areaCode: string;

  // Step 1: Payment & provisioning
  paymentComplete: boolean;
  phoneNumber: string | null;
  vapiPhoneId: string | null;
  provisioningInProgress: boolean;

  // Step 3: Agent personality
  agentName: string;
  agentSystemPrompt: string;
  agentFirstMessage: string;
  agentVoiceId: string;
  agentVoiceProvider: string;
  agentLanguage: string;
  selectedPersonaTemplateId: string | null;

  // Step 4: Sync state (ephemeral — not persisted)
  agentSynced: boolean;
  vapiAssistantId: string | null;

  // Session tracking (groups telemetry events)
  sessionId: string;

  // ---- Actions ----
  setCallDirection: (dir: CallDirection) => void;
  setCountry: (code: string) => void;
  setNumberType: (type: NumberType) => void;
  setSelectedNumber: (number: string | null) => void;
  setAreaCode: (code: string) => void;

  setPaymentComplete: (complete: boolean) => void;
  setPhoneNumber: (number: string) => void;
  setVapiPhoneId: (id: string) => void;
  setProvisioningInProgress: (inProgress: boolean) => void;

  setAgentName: (name: string) => void;
  setAgentSystemPrompt: (prompt: string) => void;
  setAgentFirstMessage: (msg: string) => void;
  setAgentVoiceId: (id: string) => void;
  setAgentVoiceProvider: (provider: string) => void;
  setAgentLanguage: (lang: string) => void;
  setSelectedPersonaTemplateId: (id: string | null) => void;

  setAgentSynced: (synced: boolean) => void;
  setVapiAssistantId: (id: string | null) => void;

  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  reset: () => void;
}

// ---- Helpers ----

function generateSessionId(): string {
  return `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const TOTAL_STEPS = 5;

/** Version 2: new wizard flow (number → pay → telecom → agent → sync) */
const STORE_VERSION = 2;

// ---- Initial state (data only, no actions) ----

const INITIAL_STATE = {
  currentStep: 0,
  slideDirection: 1 as 1 | -1,
  callDirection: null as CallDirection | null,
  country: 'US',
  numberType: 'local' as NumberType,
  selectedNumber: null as string | null,
  areaCode: '',
  paymentComplete: false,
  phoneNumber: null as string | null,
  vapiPhoneId: null as string | null,
  provisioningInProgress: false,
  agentName: '',
  agentSystemPrompt: '',
  agentFirstMessage: '',
  agentVoiceId: '',
  agentVoiceProvider: '',
  agentLanguage: 'en',
  selectedPersonaTemplateId: null as string | null,
  agentSynced: false,
  vapiAssistantId: null as string | null,
  sessionId: generateSessionId(),
};

// ---- Store ----

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      // Step 0 actions
      setCallDirection: (dir) => set({ callDirection: dir }),
      setCountry: (code) => set({ country: code, areaCode: '' }),
      setNumberType: (type) => set({ numberType: type }),
      setSelectedNumber: (number) => set({ selectedNumber: number }),
      setAreaCode: (code) => set({ areaCode: code.replace(/\D/g, '').slice(0, 5) }),

      // Step 1 actions
      setPaymentComplete: (complete) => set({ paymentComplete: complete }),
      setPhoneNumber: (number) => set({ phoneNumber: number }),
      setVapiPhoneId: (id) => set({ vapiPhoneId: id }),
      setProvisioningInProgress: (inProgress) => set({ provisioningInProgress: inProgress }),

      // Step 3 actions
      setAgentName: (name) => set({ agentName: name }),
      setAgentSystemPrompt: (prompt) => set({ agentSystemPrompt: prompt }),
      setAgentFirstMessage: (msg) => set({ agentFirstMessage: msg }),
      setAgentVoiceId: (id) => set({ agentVoiceId: id }),
      setAgentVoiceProvider: (provider) => set({ agentVoiceProvider: provider }),
      setAgentLanguage: (lang) => set({ agentLanguage: lang }),
      setSelectedPersonaTemplateId: (id) => set({ selectedPersonaTemplateId: id }),

      // Step 4 actions
      setAgentSynced: (synced) => set({ agentSynced: synced }),
      setVapiAssistantId: (id) => set({ vapiAssistantId: id }),

      // Navigation
      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS - 1),
          slideDirection: 1,
        })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
          slideDirection: -1,
        })),

      goToStep: (step) =>
        set((state) => ({
          currentStep: Math.max(0, Math.min(step, TOTAL_STEPS - 1)),
          slideDirection: step > state.currentStep ? 1 : -1,
        })),

      reset: () =>
        set({
          ...INITIAL_STATE,
          sessionId: generateSessionId(),
        }),
    }),
    {
      name: 'voxanne-onboarding',
      version: STORE_VERSION,
      storage: createJSONStorage(() => sessionStorage),

      // Persist user data that must survive Stripe redirect.
      // Excludes: function refs, ephemeral UI state, sync state.
      partialize: (state) => ({
        currentStep: state.currentStep,
        callDirection: state.callDirection,
        country: state.country,
        numberType: state.numberType,
        selectedNumber: state.selectedNumber,
        areaCode: state.areaCode,
        paymentComplete: state.paymentComplete,
        phoneNumber: state.phoneNumber,
        vapiPhoneId: state.vapiPhoneId,
        agentName: state.agentName,
        agentSystemPrompt: state.agentSystemPrompt,
        agentFirstMessage: state.agentFirstMessage,
        agentVoiceId: state.agentVoiceId,
        agentVoiceProvider: state.agentVoiceProvider,
        agentLanguage: state.agentLanguage,
        selectedPersonaTemplateId: state.selectedPersonaTemplateId,
        sessionId: state.sessionId,
      }),

      // When the persisted version differs (v1 → v2), wipe stale state cleanly.
      migrate: (_persistedState, version) => {
        if (version < STORE_VERSION) {
          return { ...INITIAL_STATE, sessionId: generateSessionId() };
        }
        return _persistedState as OnboardingState;
      },
    }
  )
);
