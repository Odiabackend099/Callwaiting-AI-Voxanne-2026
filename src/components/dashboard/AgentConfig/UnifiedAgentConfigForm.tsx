'use client';

import React from 'react';
import { Save, Trash2, Phone } from 'lucide-react';
import { PersonaSection } from './PersonaSection';
import { VoiceSection } from './VoiceSection';
import { PromptSection } from './PromptSection';
import { IdentitySection } from './IdentitySection';
import { PhoneSection } from './PhoneSection';
import type { PromptTemplate } from '@/lib/prompt-templates';
import type { AgentConfig } from '@/lib/store/agentStore';

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

interface InboundStatus {
  configured: boolean;
  inboundNumber?: string;
}

interface VapiNumber {
  id: string;
  number: string;
}

interface UnifiedAgentConfigFormProps {
  // Agent identity
  agentType: 'inbound' | 'outbound';

  // Configuration
  config: AgentConfig;
  originalConfig?: AgentConfig | null;

  // Phone settings
  inboundStatus?: InboundStatus;
  outboundNumberId?: string;
  vapiNumbers?: VapiNumber[];

  // UI state
  hasChanges: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  error?: string;
  isDeleting?: boolean;

  // Voice preview
  previewingVoiceId: string | null;
  previewPhase: 'idle' | 'loading' | 'playing';

  // Data
  personas: PromptTemplate[];
  voices: Voice[];

  // Advanced voice settings
  advancedVoiceOpen: boolean;
  onAdvancedVoiceToggle: (open: boolean) => void;

  // Callbacks
  onConfigChange: (updates: Partial<AgentConfig>) => void;
  onSave: () => void;
  onPreviewVoice: (voiceId: string) => void;
  onStopPreview: () => void;
  onDelete?: () => void;
  onTestCall?: () => void;
}

/**
 * Unified form component for both inbound and outbound agent configuration
 *
 * Combines extracted section components into a cohesive layout:
 * - Left column: Identity, Phone, Voice
 * - Right column: Persona, Prompts
 * - Footer: Save/Delete/Test buttons
 *
 * Props are designed to work for both agent types with minimal conditionals.
 */
export const UnifiedAgentConfigForm: React.FC<UnifiedAgentConfigFormProps> = ({
  agentType,
  config,
  originalConfig,
  inboundStatus,
  outboundNumberId,
  vapiNumbers,
  hasChanges,
  isSaving,
  saveSuccess,
  error,
  isDeleting,
  previewingVoiceId,
  previewPhase,
  personas,
  voices,
  advancedVoiceOpen,
  onAdvancedVoiceToggle,
  onConfigChange,
  onSave,
  onPreviewVoice,
  onStopPreview,
  onDelete,
  onTestCall,
}) => {
  const setConfig = (updates: Partial<AgentConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main Configuration Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Identity & Voice */}
        <div className="lg:col-span-1 space-y-6">
          <IdentitySection
            name={config.name}
            agentType={agentType}
            onNameChange={(name) => setConfig({ name })}
          />

          <PhoneSection
            agentType={agentType}
            inboundStatus={inboundStatus}
            outboundNumberId={outboundNumberId}
            vapiNumbers={vapiNumbers}
          />

          <VoiceSection
            voice={config.voice || ''}
            voiceProvider={config.voiceProvider || ''}
            language={config.language || 'en-US'}
            voiceStability={config.voiceStability ?? null}
            voiceSimilarityBoost={config.voiceSimilarityBoost ?? null}
            maxDuration={config.maxDuration || 300}
            voices={voices}
            previewingVoiceId={previewingVoiceId}
            previewPhase={previewPhase}
            advancedVoiceOpen={advancedVoiceOpen}
            onVoiceChange={(voiceId, provider) =>
              setConfig({ voice: voiceId, voiceProvider: provider })
            }
            onLanguageChange={(language) => setConfig({ language })}
            onStabilityChange={(stability) =>
              setConfig({ voiceStability: stability })
            }
            onSimilarityBoostChange={(boost) =>
              setConfig({ voiceSimilarityBoost: boost })
            }
            onMaxDurationChange={(duration) =>
              setConfig({ maxDuration: duration })
            }
            onPreviewVoice={onPreviewVoice}
            onStopPreview={onStopPreview}
            onAdvancedVoiceToggle={onAdvancedVoiceToggle}
          />
        </div>

        {/* Right Column: Personality & Prompts */}
        <div className="lg:col-span-2 space-y-6">
          <PersonaSection
            templates={personas}
            selectedTemplateId={null}
            onSelectTemplate={(templateId) => {
              const template = personas.find((p) => p.id === templateId);
              if (template) {
                onConfigChange({
                  systemPrompt: template.systemPrompt,
                  firstMessage: template.firstMessage,
                });
              }
            }}
          />

          <PromptSection
            systemPrompt={config.systemPrompt}
            firstMessage={config.firstMessage}
            onSystemPromptChange={(prompt) =>
              setConfig({ systemPrompt: prompt })
            }
            onFirstMessageChange={(msg) => setConfig({ firstMessage: msg })}
          />
        </div>
      </div>

      {/* Footer: Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-surgical-200">
        <div className="flex gap-3">
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isDeleting || isSaving}
              className="px-4 py-2 rounded-lg font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
              title="Delete this agent configuration"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {onTestCall && (
            <button
              onClick={onTestCall}
              disabled={isSaving || !config.voice}
              className="px-4 py-2 rounded-lg font-medium text-surgical-600 bg-surgical-50 hover:bg-surgical-100 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
              title="Make a test call with this agent"
            >
              <Phone className="w-4 h-4" />
              Test Call
            </button>
          )}

          <button
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm ${
              saveSuccess
                ? 'bg-surgical-50 text-surgical-600 border border-surgical-200'
                : hasChanges
                  ? 'bg-surgical-600 hover:bg-surgical-700 text-white shadow-surgical-500/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title={
              !hasChanges
                ? 'No changes to save'
                : isSaving
                  ? 'Saving...'
                  : 'Save agent configuration'
            }
          >
            <Save className="w-4 h-4" />
            {saveSuccess ? 'Saved' : isSaving ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {saveSuccess && (
        <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
          <p className="text-sm text-surgical-600 font-medium">
            ✓ Agent configuration saved successfully
          </p>
        </div>
      )}
    </div>
  );
};
