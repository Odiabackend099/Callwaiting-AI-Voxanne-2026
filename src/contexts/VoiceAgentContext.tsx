'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import type { VoiceAgentState } from '@/types/voice';

interface VoiceAgentContextValue extends VoiceAgentState {
  startCall: () => Promise<void>;
  stopCall: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  const agent = useVoiceAgent({ preventAutoDisconnectOnUnmount: true });

  const value = useMemo<VoiceAgentContextValue>(() => {
    return {
      isConnected: agent.isConnected,
      isRecording: agent.isRecording,
      isSpeaking: agent.isSpeaking,
      transcripts: agent.transcripts,
      error: agent.error,
      session: agent.session,
      startCall: agent.startCall,
      stopCall: agent.stopCall,
      startRecording: agent.startRecording,
      stopRecording: agent.stopRecording,
    };
  }, [
    agent.isConnected,
    agent.isRecording,
    agent.isSpeaking,
    agent.transcripts,
    agent.error,
    agent.session,
    agent.startCall,
    agent.stopCall,
    agent.startRecording,
    agent.stopRecording,
  ]);

  return <VoiceAgentContext.Provider value={value}>{children}</VoiceAgentContext.Provider>;
}

export function useVoiceAgentContext() {
  const ctx = useContext(VoiceAgentContext);
  if (!ctx) {
    throw new Error('useVoiceAgentContext must be used within a VoiceAgentProvider');
  }
  return ctx;
}
