import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const AGENT_CONFIG_CONSTRAINTS = {
    MIN_DURATION_SECONDS: 60,
    MAX_DURATION_SECONDS: 3600,
    DEFAULT_DURATION_SECONDS: 300
};

export interface AgentConfig {
    systemPrompt: string;
    firstMessage: string;
    voice: string;
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
    systemPrompt: '',
    firstMessage: '',
    voice: '',
    language: 'en-US',
    maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
};

/**
 * Validates and merges partial config updates to ensure all required fields remain valid.
 * Prevents silent data loss from shallow merge operations.
 * 
 * @param config - Partial config update from user input
 * @param existingConfig - Current complete config state
 * @returns Complete validated AgentConfig with all required fields
 */
const validateAgentConfig = (config: Partial<AgentConfig>, existingConfig: AgentConfig): AgentConfig => {
    const merged = { ...existingConfig, ...config };

    // Ensure critical fields are never undefined/null after merge
    // Use nullish coalescing to preserve empty strings (valid for systemPrompt/firstMessage)
    const validated: AgentConfig = {
        systemPrompt: merged.systemPrompt ?? '',
        firstMessage: merged.firstMessage ?? '',
        voice: merged.voice ?? '',
        language: merged.language ?? 'en-US',
        maxDuration: merged.maxDuration ?? AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
    };

    return validated;
};

export const useAgentStore = create<AgentState>()(
    persist(
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
        }),
        {
            name: 'voxanne-agent-storage', // unique name in localStorage
            storage: createJSONStorage(() => localStorage),
            skipHydration: true, // we handle hydration manually if needed, or let Next.js handle it
        }
    )
);
