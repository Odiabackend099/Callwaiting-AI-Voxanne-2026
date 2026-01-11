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

export const useAgentStore = create<AgentState>()(
    persist(
        (set) => ({
            inboundConfig: INITIAL_CONFIG,
            outboundConfig: INITIAL_CONFIG,

            setInboundConfig: (config) => set((state) => ({
                inboundConfig: { ...state.inboundConfig, ...config }
            })),

            setOutboundConfig: (config) => set((state) => ({
                outboundConfig: { ...state.outboundConfig, ...config }
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
