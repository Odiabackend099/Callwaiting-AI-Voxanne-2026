'use client';

import { useCallback } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useOnboardingStore } from '@/lib/store/onboardingStore';

export type OnboardingEventName =
  // Legacy events (keep for existing data)
  | 'started'
  | 'clinic_named'
  | 'specialty_chosen'
  | 'payment_viewed'
  | 'payment_success'
  | 'test_call_completed'
  // New wizard events (v2)
  | 'direction_chosen'
  | 'number_searched'
  | 'number_selected'
  | 'number_provisioned'
  | 'telecom_routing_viewed'
  | 'forwarding_code_copied'
  | 'caller_id_verified'
  | 'telecom_routing_skipped'
  | 'agent_persona_selected'
  | 'agent_voice_selected'
  | 'agent_configured'
  | 'agent_syncing'
  | 'agent_sync_complete'
  | 'onboarding_complete'
  | 'test_call_initiated';

export function useOnboardingTelemetry() {
  const sessionId = useOnboardingStore((s) => s.sessionId);

  const track = useCallback(
    async (
      eventName: OnboardingEventName,
      stepIndex: number,
      metadata?: Record<string, unknown>
    ) => {
      try {
        await authedBackendFetch('/api/onboarding/event', {
          method: 'POST',
          body: JSON.stringify({
            event_name: eventName,
            step_index: stepIndex,
            metadata: metadata || {},
            session_id: sessionId,
          }),
        });
      } catch {
        // Fire-and-forget — never block the UI
      }
    },
    [sessionId]
  );

  return { track };
}
