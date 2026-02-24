'use client';

import React from 'react';
import { Volume2, ChevronDown, Info, Clock } from 'lucide-react';
import { VoiceSelector } from '../../VoiceSelector';
import { AGENT_CONFIG_CONSTRAINTS } from '@/lib/constants';

interface Voice {
  id: string;
  name: string;
  provider: string;
  gender: string;
  language: string;
  characteristics: string;
  accent: string;
  bestFor: string;
  latency: string;
  quality: string;
  isDefault: boolean;
  requiresApiKey: boolean;
}

interface VoiceSectionProps {
  voice: string;
  voiceProvider: string;
  language: string;
  voiceStability: number | null;
  voiceSimilarityBoost: number | null;
  maxDuration: number;
  voices: Voice[];
  previewingVoiceId: string | null;
  previewPhase: 'idle' | 'loading' | 'playing';
  advancedVoiceOpen: boolean;
  onVoiceChange: (voiceId: string, provider: string) => void;
  onLanguageChange: (language: string) => void;
  onStabilityChange: (stability: number | null) => void;
  onSimilarityBoostChange: (boost: number | null) => void;
  onMaxDurationChange: (duration: number) => void;
  onPreviewVoice: (voiceId: string) => void;
  onStopPreview: () => void;
  onAdvancedVoiceToggle: (open: boolean) => void;
}

export const VoiceSection: React.FC<VoiceSectionProps> = ({
  voice,
  voiceProvider,
  language,
  voiceStability,
  voiceSimilarityBoost,
  maxDuration,
  voices,
  previewingVoiceId,
  previewPhase,
  advancedVoiceOpen,
  onVoiceChange,
  onLanguageChange,
  onStabilityChange,
  onSimilarityBoostChange,
  onMaxDurationChange,
  onPreviewVoice,
  onStopPreview,
  onAdvancedVoiceToggle,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6">
      <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-surgical-600" />
        Voice Settings
      </h3>
      <div className="space-y-4">
        {/* Voice Selector Component */}
        <VoiceSelector
          voices={voices}
          selected={voice}
          onSelect={onVoiceChange}
          onPreviewVoice={onPreviewVoice}
          onStopPreview={onStopPreview}
          previewingVoiceId={previewingVoiceId}
          previewPhase={previewPhase}
        />

        {/* Language Selector */}
        <div>
          <label className="block text-sm font-medium text-obsidian/60 mb-2">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-surgical-200 text-obsidian focus:ring-2 focus:ring-surgical-500 outline-none"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es-ES">Spanish (Spain)</option>
            <option value="es-MX">Spanish (Mexico)</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
          </select>
        </div>

        {/* Advanced Voice Settings accordion */}
        <div>
          <button
            type="button"
            onClick={() => onAdvancedVoiceToggle(!advancedVoiceOpen)}
            className="flex items-center justify-between w-full py-2 text-sm font-medium text-obsidian/60 hover:text-obsidian transition-colors select-none"
            aria-expanded={advancedVoiceOpen}
          >
            <span>Advanced Voice Settings</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                advancedVoiceOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
              advancedVoiceOpen
                ? 'max-h-96 opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
            {...(!advancedVoiceOpen ? { inert: true as any } : {})}
          >
            <div className="mt-3 space-y-5 pt-3 border-t border-surgical-100">
              {voiceProvider === 'elevenlabs' ? (
                <>
                  {/* Stability slider */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-sm font-medium text-obsidian/70">
                        Voice Stability
                      </label>
                      <span
                        title="Higher = more consistent but less expressive. Lower = more dynamic but less predictable."
                        className="text-obsidian/40 hover:text-obsidian/60 cursor-help"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <span className="ml-auto flex items-center gap-2 text-xs font-mono text-surgical-600">
                        {voiceStability != null
                          ? voiceStability.toFixed(2)
                          : 'default'}
                        {voiceStability != null && (
                          <button
                            type="button"
                            onClick={() => onStabilityChange(null)}
                            className="font-sans text-obsidian/40 hover:text-obsidian/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-surgical-500 rounded-sm"
                            title="Reset to provider default"
                          >
                            Reset
                          </button>
                        )}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={voiceStability ?? 0.5}
                      onChange={(e) =>
                        onStabilityChange(parseFloat(e.target.value))
                      }
                      className="w-full voice-slider"
                    />
                    <div className="flex justify-between text-xs text-obsidian/40 mt-0.5">
                      <span>Expressive</span>
                      <span>Consistent</span>
                    </div>
                  </div>

                  {/* Similarity Boost slider */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-sm font-medium text-obsidian/70">
                        Voice Similarity
                      </label>
                      <span
                        title="Higher = voice sounds closer to the original sample. Lower = allows more flexibility."
                        className="text-obsidian/40 hover:text-obsidian/60 cursor-help"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <span className="ml-auto flex items-center gap-2 text-xs font-mono text-surgical-600">
                        {voiceSimilarityBoost != null
                          ? voiceSimilarityBoost.toFixed(2)
                          : 'default'}
                        {voiceSimilarityBoost != null && (
                          <button
                            type="button"
                            onClick={() => onSimilarityBoostChange(null)}
                            className="font-sans text-obsidian/40 hover:text-obsidian/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-surgical-500 rounded-sm"
                            title="Reset to provider default"
                          >
                            Reset
                          </button>
                        )}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={voiceSimilarityBoost ?? 0.75}
                      onChange={(e) =>
                        onSimilarityBoostChange(parseFloat(e.target.value))
                      }
                      className="w-full voice-slider"
                    />
                    <div className="flex justify-between text-xs text-obsidian/40 mt-0.5">
                      <span>Flexible</span>
                      <span>Original</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-obsidian/50 italic py-1">
                  Advanced voice parameters (stability, similarity) are
                  available for ElevenLabs voices only.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Call Limits */}
        <div className="pt-4 mt-4 border-t border-surgical-100">
          <label className="block text-sm font-medium text-obsidian/60 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Max Duration (Seconds)
          </label>
          <input
            type="number"
            value={maxDuration}
            onChange={(e) =>
              onMaxDurationChange(
                parseInt(e.target.value) ||
                  AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
              )
            }
            min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
            max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-surgical-200 text-obsidian focus:ring-2 focus:ring-surgical-500 outline-none"
          />
          <p className="text-xs text-obsidian/60 mt-1">
            Auto-end call after this time.
          </p>
        </div>
      </div>
    </div>
  );
};
