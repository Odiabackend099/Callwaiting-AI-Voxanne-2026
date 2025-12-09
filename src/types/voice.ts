// Voice Agent TypeScript Types

export interface VoiceSession {
    id: string;
    sessionId: string;
    status: 'connecting' | 'connected' | 'active' | 'disconnected' | 'error';
    startedAt: Date;
    endedAt?: Date;
    durationSeconds?: number;
    totalMessages: number;
}

export interface TranscriptMessage {
    id: string;
    speaker: 'user' | 'agent';
    text: string;
    confidence?: number;
    isFinal: boolean;
    timestamp: Date;
}

export interface VoiceAgentConfig {
    businessName?: string;
    systemPrompt?: string;
    voicePersonality?: 'professional' | 'friendly' | 'casual';
    language?: string;
}

export interface WebSocketEvent {
    type: 'connected' | 'transcript' | 'response' | 'audio' | 'error' | 'interrupt' | 'reset_complete' | 'state';
    message?: string;
    speaker?: 'user' | 'agent';
    text?: string;
    confidence?: number;
    is_final?: boolean;
    audio?: string; // base64 encoded audio
    audio_format?: {
        encoding: string;
        sample_rate: number;
    };
    user?: {
        id: string;
        business_name?: string;
    };
    details?: string;
    error?: string;
    to?: 'SPEAKING' | 'LISTENING' | 'IDLE';
}

export interface AudioFormat {
    encoding: 'linear16' | 'mp3';
    sampleRate: number;
    channels: number;
}

export interface VoiceAgentState {
    isConnected: boolean;
    isRecording: boolean;
    isSpeaking: boolean;
    transcripts: TranscriptMessage[];
    error: string | null;
    session: VoiceSession | null;
}
