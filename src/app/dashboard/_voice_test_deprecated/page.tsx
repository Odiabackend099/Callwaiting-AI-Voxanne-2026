'use client';

import { useState, useEffect, useRef } from 'react';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

interface Transcript {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: Date;
}

export default function VoiceTestPage() {
  const {
    isConnected,
    isRecording,
    transcripts,
    error,
    startCall,
    stopCall,
    startRecording,
    stopRecording
  } = useVoiceAgent();

  const [displayTranscripts, setDisplayTranscripts] = useState<Transcript[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Sync transcripts from hook to display state
  useEffect(() => {
    if (transcripts && transcripts.length > 0) {
      setDisplayTranscripts(
        transcripts.map((t, idx) => ({
          id: `${idx}-${t.timestamp.getTime()}`,
          speaker: t.speaker,
          text: t.text,
          isFinal: t.isFinal,
          confidence: t.confidence || 0.95,
          timestamp: t.timestamp
        }))
      );
    }
  }, [transcripts]);

  // Auto-scroll to latest transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayTranscripts]);

  const handleStartCall = async () => {
    console.log('🎤 Starting voice call...');
    try {
      await startCall();
      // Auto-start recording after connection
      setTimeout(() => {
        startRecording();
      }, 500);
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const handleStopCall = async () => {
    console.log('🎤 Stopping voice call...');
    try {
      stopRecording();
      await stopCall();
    } catch (err) {
      console.error('Failed to stop call:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Voice Test</h1>
          <p className="text-slate-400">Test real-time voice calls with transcription</p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Connection Status</p>
              <p className={`text-lg font-semibold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Recording Status</p>
              <p className={`text-lg font-semibold ${isRecording ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isRecording ? '🔴 Recording' : '⚪ Idle'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Transcripts Received</p>
              <p className="text-lg font-semibold text-blue-400">{displayTranscripts.length}</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </p>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleStartCall}
            disabled={isConnected}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              isConnected
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            Start Call
          </button>
          <button
            onClick={handleStopCall}
            disabled={!isConnected}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              !isConnected
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            Stop Call
          </button>
        </div>

        {/* Transcripts Display */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Real-Time Transcription</h2>
          
          <div className="bg-slate-900 rounded-lg p-4 h-96 overflow-y-auto space-y-3">
            {displayTranscripts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500 text-center">
                  No transcripts yet. Start a call and speak to see transcriptions appear here.
                </p>
              </div>
            ) : (
              <>
                {displayTranscripts.map((transcript) => (
                  <div
                    key={transcript.id}
                    className={`p-3 rounded-lg ${
                      transcript.speaker === 'agent'
                        ? 'bg-blue-900/30 border border-blue-500/30'
                        : 'bg-emerald-900/30 border border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-sm font-semibold mb-1 ${
                          transcript.speaker === 'agent' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {transcript.speaker === 'agent' ? '🤖 Agent' : '👤 You'}
                        </p>
                        <p className="text-white text-sm leading-relaxed">
                          {transcript.text}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {!transcript.isFinal && (
                          <span className="text-xs px-2 py-1 bg-yellow-900/40 text-yellow-400 rounded">
                            Interim
                          </span>
                        )}
                        {transcript.isFinal && (
                          <span className="text-xs px-2 py-1 bg-emerald-900/40 text-emerald-400 rounded">
                            Final
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {Math.round(transcript.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-6 text-xs text-slate-500">
          <p>💡 Tip: Speak naturally. Transcripts will appear in real-time as you speak.</p>
        </div>
      </div>
    </div>
  );
}
