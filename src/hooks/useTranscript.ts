import { useState, useEffect, useCallback } from 'react';

export interface TranscriptSegment {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence?: number;
}

interface TranscriptEvent {
  type: 'transcript';
  speaker: 'agent' | 'customer';
  text: string;
  is_final: boolean;
  confidence?: number;
  ts: number;
}

export function useTranscript(trackingId: string | null) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addSegment = useCallback((event: TranscriptEvent) => {
    if (event.type !== 'transcript') return;

    setSegments(prev => [...prev, {
      speaker: event.speaker,
      text: event.text,
      timestamp: event.ts,
      confidence: event.confidence
    }]);
  }, []);

  useEffect(() => {
    if (!trackingId) return;

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
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
