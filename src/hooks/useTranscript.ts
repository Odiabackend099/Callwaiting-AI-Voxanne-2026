import { useState, useEffect, useCallback } from 'react';

export interface TranscriptSegment {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence?: number;
  messageHash?: string;
}

interface TranscriptEvent {
  type: 'transcript';
  speaker: 'agent' | 'customer';
  text: string;
  is_final: boolean;
  confidence?: number;
  ts: number;
}

/**
 * Create a hash of transcript message to prevent duplicates
 * Uses speaker + text to create a unique identifier
 */
function createMessageHash(speaker: string, text: string): string {
  const message = `${speaker}:${text}`;
  // Use a simple hash function since crypto is not available in browser
  // Create a deterministic hash from the message
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function useTranscript(trackingId: string | null) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageHash, setLastMessageHash] = useState<string>('');

  const addSegment = useCallback((event: TranscriptEvent) => {
    if (event.type !== 'transcript') return;

    // Create hash of this message to detect duplicates
    const messageHash = createMessageHash(event.speaker, event.text);

    // Skip if exact duplicate (same speaker and text)
    if (messageHash === lastMessageHash) {
      console.warn('Duplicate transcript suppressed:', {
        speaker: event.speaker,
        text: event.text.substring(0, 50),
        hash: messageHash
      });
      return;
    }

    setLastMessageHash(messageHash);

    setSegments(prev => [...prev, {
      speaker: event.speaker,
      text: event.text,
      timestamp: event.ts,
      confidence: event.confidence,
      messageHash
    }]);
  }, [lastMessageHash]);

  useEffect(() => {
    if (!trackingId) return;

    // Connect to WebSocket on backend (port 3001)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // Send subscription message for this tracking ID
      ws.send(JSON.stringify({
        type: 'subscribe',
        trackingId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          addSegment(data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [trackingId, addSegment]);

  const clearTranscript = useCallback(() => {
    setSegments([]);
  }, []);

  return {
    segments,
    isConnected,
    clearTranscript
  };
}
