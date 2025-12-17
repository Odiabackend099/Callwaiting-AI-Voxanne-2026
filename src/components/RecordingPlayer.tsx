import React, { useState, useRef } from 'react';
import { Play, Pause, Download, Volume2 } from 'lucide-react';

interface RecordingPlayerProps {
  callId: string;
  recordingUrl?: string;
  duration?: number;
}

export function RecordingPlayer({ callId, recordingUrl, duration }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recording URL if not provided
  React.useEffect(() => {
    if (recordingUrl) return;

    const fetchRecordingUrl = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/calls/${callId}/recording`);
        if (!response.ok) {
          throw new Error('Failed to fetch recording');
        }
        const data = await response.json();
        if (audioRef.current) {
          audioRef.current.src = data.recordingUrl;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordingUrl();
  }, [callId, recordingUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = async () => {
    if (!audioRef.current?.src) return;
    try {
      const response = await fetch(audioRef.current.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-${callId}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
        Loading recording...
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="p-2 hover:bg-gray-100 rounded-full transition"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-blue-600" />
          ) : (
            <Play className="w-5 h-5 text-blue-600" />
          )}
        </button>

        <div className="flex-1">
          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            className="w-full"
          />
          <input
            type="range"
            min="0"
            max={audioRef.current?.duration || 0}
            value={currentTime}
            onChange={(e) => {
              if (audioRef.current) {
                audioRef.current.currentTime = Number(e.target.value);
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(audioRef.current?.duration || 0)}</span>
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="p-2 hover:bg-gray-100 rounded-full transition"
          title="Download"
        >
          <Download className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
