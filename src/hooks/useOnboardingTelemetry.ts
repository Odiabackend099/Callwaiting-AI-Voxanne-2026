'use client';

import { useCallback } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useOnboardingStore } from '@/lib/store/onboardingStore';

export type OnboardingEventName =
  | 'started'
  | 'clinic_named'
  | 'specialty_chosen'
  | 'payment_viewed'
  | 'payment_success'
  | 'test_call_completed';

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
