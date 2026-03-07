'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Volume2, Loader2, Play, Square, ArrowRight } from 'lucide-react';
import { useOnboardingStore } from '@/lib/store/onboardingStore';
import { useOnboardingTelemetry } from '@/hooks/useOnboardingTelemetry';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import {
  PROMPT_TEMPLATES,
  OUTBOUND_PROMPT_TEMPLATES,
  type PromptTemplate,
} from '@/lib/prompt-templates';

interface VoiceOption {
  id: string;
  label: string;
  provider: string;
  gender: string;
}

/**
 * Step 3: Agent Personality — Simplified config
 * - Persona template picker (auto-fills prompt + first message)
 * - Editable system prompt
 * - Voice selector grid with preview
 */
export default function StepAgentPersonality() {
  const {
    callDirection,
    selectedPersonaTemplateId,
    agentSystemPrompt,
    agentFirstMessage,
    agentName,
    agentVoiceId,
    agentVoiceProvider,
    setSelectedPersonaTemplateId,
    setAgentSystemPrompt,
    setAgentFirstMessage,
    setAgentName,
    setAgentVoiceId,
    setAgentVoiceProvider,
    nextStep,
  } = useOnboardingStore();

  const { track } = useOnboardingTelemetry();

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  const templates = callDirection === 'outbound' ? OUTBOUND_PROMPT_TEMPLATES : PROMPT_TEMPLATES;

  // Fetch available voices on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await authedBackendFetch<{
          voices: VoiceOption[];
          default: string;
        }>('/api/founder-console/voices', { requireAuth: false });

        setVoices(data.voices || []);

        // Auto-select default voice if none selected
        if (!agentVoiceId && data.default) {
          const defaultVoice = data.voices.find((v) => v.id === data.default);
          setAgentVoiceId(data.default);
          setAgentVoiceProvider(defaultVoice?.provider || 'vapi');
        }
      } catch {
        // Non-blocking — user can still proceed
      } finally {
        setVoicesLoading(false);
      }
    })();
  }, []);

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedPersonaTemplateId(template.id);
    setAgentSystemPrompt(template.systemPrompt);
    setAgentFirstMessage(template.firstMessage);
    setAgentName(template.persona);
    track('agent_persona_selected', 3, { templateId: template.id });
  };

  const handleSelectVoice = (voice: VoiceOption) => {
    setAgentVoiceId(voice.id);
    setAgentVoiceProvider(voice.provider);
    track('agent_voice_selected', 3, { voiceId: voice.id });
  };

  const handleContinue = () => {
    track('agent_configured', 3, {
      templateId: selectedPersonaTemplateId,
      voiceId: agentVoiceId,
    });
    nextStep();
  };

  // Voice preview is complex (needs TTS API); for onboarding just show a simple grid
  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setPreviewAudio(null);
    }
    setPreviewingVoiceId(null);
  };

  const canContinue = agentSystemPrompt.length > 0 && agentVoiceId.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-obsidian tracking-tighter mb-2">
          Design your AI personality
        </h1>
        <p className="text-sm text-obsidian/60">
          Pick a persona template and a voice. You can customise everything later.
        </p>
      </div>

      {/* Persona template grid */}
      <div>
        <label className="block text-sm font-medium text-obsidian/70 mb-2">
          <Sparkles className="w-4 h-4 inline mr-1 -mt-0.5" />
          Persona Template
        </label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                selectedPersonaTemplateId === t.id
                  ? 'border-surgical-600 bg-surgical-50'
                  : 'border-surgical-200 bg-white hover:border-surgical-300'
              }`}
            >
              <span className="text-xl mb-1 block">{t.icon}</span>
              <p className="text-sm font-semibold text-obsidian">{t.name}</p>
              <p className="text-xs text-obsidian/50 mt-0.5 line-clamp-2">{t.tagline}</p>
            </button>
          ))}
        </div>
      </div>

      {/* System prompt (editable, shown after template selected) */}
      {agentSystemPrompt && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <label className="block text-sm font-medium text-obsidian/70 mb-1.5">
            System Prompt <span className="text-obsidian/40">(editable)</span>
          </label>
          <textarea
            value={agentSystemPrompt}
            onChange={(e) => setAgentSystemPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 border border-surgical-200 rounded-xl text-obsidian text-sm focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent resize-none"
          />
        </motion.div>
      )}

      {/* Voice selector */}
      <div>
        <label className="block text-sm font-medium text-obsidian/70 mb-2">
          <Volume2 className="w-4 h-4 inline mr-1 -mt-0.5" />
          Voice
        </label>
        {voicesLoading ? (
          <div className="flex items-center gap-2 text-sm text-obsidian/50 py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading voices...
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {voices.slice(0, 12).map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelectVoice(v)}
                className={`px-3 py-2 rounded-lg border text-left transition-all duration-200 ${
                  agentVoiceId === v.id
                    ? 'border-surgical-600 bg-surgical-50'
                    : 'border-surgical-200 bg-white hover:border-surgical-300'
                }`}
              >
                <p className="text-xs font-medium text-obsidian truncate">{v.label.split(' – ')[0]}</p>
                <p className="text-[10px] text-obsidian/40 capitalize">{v.gender}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Continue */}
      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surgical-600 text-white font-semibold text-sm hover:bg-surgical-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>

      <p className="text-xs text-center text-obsidian/40">
        Want more control? You can fine-tune everything in Agent Config after setup.
      </p>
    </motion.div>
  );
}
