import { create } from 'zustand';

export const AGENT_CONFIG_CONSTRAINTS = {
    MIN_DURATION_SECONDS: 60,
    MAX_DURATION_SECONDS: 3600,
    DEFAULT_DURATION_SECONDS: 300
};

export interface AgentConfig {
    name: string;
    systemPrompt: string;
    firstMessage: string;
    voice: string;
    voiceProvider?: string;
    language: string;
    maxDuration: number;
}

interface AgentState {
    inboundConfig: AgentConfig;
    outboundConfig: AgentConfig;

    // Actions
    setInboundConfig: (config: Partial<AgentConfig>) => void;
    setOutboundConfig: (config: Partial<AgentConfig>) => void;
    resetConfigs: () => void;
}

export const INITIAL_CONFIG: AgentConfig = {
    name: '',
    systemPrompt: '',
    firstMessage: '',
    voice: '',
    language: 'en-US',
    maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
};

/**
 * Validates and merges partial config updates to ensure all required fields remain valid.
 * Prevents silent data loss from shallow merge operations.
 */
const validateAgentConfig = (config: Partial<AgentConfig>, existingConfig: AgentConfig): AgentConfig => {
    const merged = { ...existingConfig, ...config };

    const validated: AgentConfig = {
        name: merged.name ?? '',
        systemPrompt: merged.systemPrompt ?? '',
        firstMessage: merged.firstMessage ?? '',
        voice: merged.voice ?? '',
        voiceProvider: merged.voiceProvider,
        language: merged.language ?? 'en-US',
        maxDuration: merged.maxDuration ?? AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
    };

    return validated;
};

// Memory-only store. DB is the single source of truth (PRD rule).
// No localStorage persistence — page always loads fresh from /api/founder-console/agent/config.
export const useAgentStore = create<AgentState>()(
    (set) => ({
        inboundConfig: INITIAL_CONFIG,
        outboundConfig: INITIAL_CONFIG,

        setInboundConfig: (config) => set((state) => ({
            inboundConfig: validateAgentConfig(config, state.inboundConfig)
        })),

        setOutboundConfig: (config) => set((state) => ({
            outboundConfig: validateAgentConfig(config, state.outboundConfig)
        })),

        resetConfigs: () => set({
            inboundConfig: INITIAL_CONFIG,
            outboundConfig: INITIAL_CONFIG
        })
    })
);
