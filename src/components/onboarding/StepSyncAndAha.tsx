'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import ConfettiEffect from './ConfettiEffect';

type SyncPhase = 'idle' | 'creating_agent' | 'binding_phone' | 'completing' | 'done' | 'error';

interface SyncStep {
  id: SyncPhase;
  label: string;
  activeLabel: string;
}

const SYNC_STEPS: SyncStep[] = [
  { id: 'creating_agent', label: 'Create AI agent', activeLabel: 'Creating AI agent...' },
  { id: 'binding_phone', label: 'Connect to phone number', activeLabel: 'Connecting to phone number...' },
  { id: 'completing', label: 'Go live', activeLabel: 'Going live...' },
];

/**
 * Step 4: Sync & Aha Moment — The Finale
 * - Auto-syncs agent to phone number on mount (3 sequential API calls)
 * - Animated progress checklist
 * - Success screen with confetti + phone number display
 */
export default function StepSyncAndAha() {
  const {
    callDirection,
    selectedNumber,
    vapiPhoneId,
    agentName,
    agentSystemPrompt,
    agentFirstMessage,
    agentVoiceId,
    agentVoiceProvider,
    agentLanguage,
    agentSynced,
    setAgentSynced,
    setVapiAssistantId,
  } = useOnboardingStore();

  const { track } = useOnboardingTelemetry();

  const [phase, setPhase] = useState<SyncPhase>(agentSynced ? 'done' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedSync = useRef(false);

  // Auto-start sync on mount (once)
  useEffect(() => {
    if (hasStartedSync.current || agentSynced) return;
    hasStartedSync.current = true;
    runSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSync() {
    setErrorMessage(null);
    track('agent_syncing', 4);

    try {
      // Step 1: Create / update agent via founder-console
      setPhase('creating_agent');

      const role = callDirection || 'inbound';
      const agentPayload: Record<string, any> = {
        name: agentName || undefined,
        systemPrompt: agentSystemPrompt,
        firstMessage: agentFirstMessage || undefined,
        voiceId: agentVoiceId || undefined,
        voiceProvider: agentVoiceProvider || undefined,
        language: agentLanguage || undefined,
      };

      // Include vapiPhoneNumberId for outbound agents (SSOT — critical invariant)
      if (role === 'outbound' && vapiPhoneId) {
        agentPayload.vapiPhoneNumberId = vapiPhoneId;
      }

      const agentResult = await authedBackendFetch<{
        success?: boolean;
        agents?: { inbound?: { vapiAssistantId?: string }; outbound?: { vapiAssistantId?: string } };
      }>('/api/founder-console/agent/behavior', {
        method: 'POST',
        body: JSON.stringify({
          [role]: agentPayload,
        }),
      });

      const assistantId = agentResult?.agents?.[role]?.vapiAssistantId;
      if (assistantId) {
        setVapiAssistantId(assistantId);
      }

      // Step 2: Bind assistant to phone number
      setPhase('binding_phone');

      if (vapiPhoneId) {
        await authedBackendFetch('/api/integrations/vapi/assign-number', {
          method: 'POST',
          body: JSON.stringify({
            phoneNumberId: vapiPhoneId,
            phoneNumber: selectedNumber,
            role,
          }),
        });
      }

      // Step 3: Mark onboarding complete
      setPhase('completing');

      await authedBackendFetch('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Done
      setPhase('done');
      setAgentSynced(true);
      track('agent_sync_complete', 4);
      track('onboarding_complete', 4);
    } catch (err: any) {
      setPhase('error');
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    }
  }

  function handleRetry() {
    hasStartedSync.current = false;
    setPhase('idle');
    setErrorMessage(null);
    // Re-trigger sync
    hasStartedSync.current = true;
    runSync();
  }

  function handleGoToDashboard() {
    window.location.href = '/dashboard';
  }

  const isDone = phase === 'done';
  const isError = phase === 'error';
  const isSyncing = !isDone && !isError && phase !== 'idle';

  // Determine which steps are complete based on current phase
  function stepStatus(stepId: SyncPhase): 'pending' | 'active' | 'done' {
    const order: SyncPhase[] = ['creating_agent', 'binding_phone', 'completing'];
    const currentIdx = order.indexOf(phase);
    const stepIdx = order.indexOf(stepId);

    if (isDone) return 'done';
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-8"
    >
      {isDone && <ConfettiEffect duration={4000} particleCount={200} />}

      <AnimatePresence mode="wait">
        {isDone ? (
          /* ───── Success Screen ───── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-surgical-100 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-surgical-600" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
                Voxanne is Live!
              </h1>
              <p className="text-sm text-obsidian/60">
                Your AI agent is ready to answer calls. Try it now.
              </p>
            </div>

            {/* Phone number display */}
            {selectedNumber && (
              <div className="bg-white border-2 border-surgical-200 rounded-2xl p-6 max-w-xs mx-auto">
                <p className="text-xs text-obsidian/40 uppercase tracking-wider mb-1">
                  Your AI Number
                </p>
                <p className="text-2xl font-bold text-obsidian tracking-tight font-mono">
                  {selectedNumber}
                </p>
              </div>
            )}

            {/* CTA buttons */}
            <div className="space-y-3 max-w-xs mx-auto">
              {selectedNumber && (
                <a
                  href={`tel:${selectedNumber}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200"
                >
                  <Phone className="w-4 h-4" />
                  Call Your Number Now
                </a>
              )}

              <button
                onClick={handleGoToDashboard}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-surgical-200 bg-white text-obsidian font-semibold text-sm hover:border-surgical-300 active:scale-[0.98] transition-all duration-200"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-obsidian/40">
              Fine-tune your agent anytime from the dashboard.
            </p>
          </motion.div>
        ) : (
          /* ───── Syncing / Error Screen ───── */
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-6"
          >
            <div>
              <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
                {isError ? 'Setup encountered an issue' : 'Setting up your AI agent'}
              </h1>
              <p className="text-sm text-obsidian/60">
                {isError
                  ? 'Don\u2019t worry \u2014 your number and payment are safe.'
                  : 'This only takes a moment...'}
              </p>
            </div>

            {/* Progress checklist */}
            <div className="bg-white rounded-2xl border border-surgical-200 p-5 max-w-sm mx-auto text-left space-y-4">
              {SYNC_STEPS.map((step) => {
                const status = isError ? (stepStatus(step.id) === 'done' ? 'done' : 'pending') : stepStatus(step.id);
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {status === 'done' ? (
                        <div className="w-6 h-6 rounded-full bg-surgical-100 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-surgical-600" />
                        </div>
                      ) : status === 'active' ? (
                        <Loader2 className="w-6 h-6 text-surgical-500 animate-spin" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-surgical-200" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-sm ${
                        status === 'done'
                          ? 'text-obsidian/70'
                          : status === 'active'
                            ? 'text-obsidian font-medium'
                            : 'text-obsidian/40'
                      }`}
                    >
                      {status === 'active' ? step.activeLabel : step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error state */}
            {isError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-start gap-2 bg-surgical-50 border border-surgical-200 rounded-xl px-4 py-3 max-w-sm mx-auto text-left">
                  <AlertCircle className="w-4 h-4 text-surgical-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-obsidian/70">{errorMessage}</p>
                </div>

                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
