'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Download, X, SkipBack, SkipForward } from 'lucide-react';
import { useAudioPlayerStore } from '@/store/audioPlayerStore';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface Call {
  id: string;
  caller_name: string;
  phone_number: string;
  duration_seconds: number;
  created_at: string;
}

interface AudioPlayerModalProps {
  call: Call;
  onClose: () => void;
}

export function AudioPlayerModal({ call, onClose }: AudioPlayerModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    currentCallId,
    play,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    setCurrentTime,
    setDuration,
    initAudioRef,
  } = useAudioPlayerStore();

  // Initialize audio ref in store (runs when audio element mounts)
  useEffect(() => {
    if (audioRef.current) {
      initAudioRef(audioRef.current);
      console.log('✅ Audio element initialized in store');
    }
  }, [initAudioRef, recordingUrl]); // Re-run when recordingUrl changes (audio element mounts)

  // Fetch recording URL
  useEffect(() => {
    const fetchRecordingUrl = async () => {
      try {
        setLoading(true);
        const data = await authedBackendFetch<any>(`/api/calls-dashboard/${call.id}/recording-url`);

        if (data.recording_url) {
          setRecordingUrl(data.recording_url);
          // Auto-play when URL is loaded (wait for audio element to mount and initialize)
          setTimeout(() => {
            if (audioRef.current) {
              console.log('▶️ Auto-playing recording...');
              play(call.id, data.recording_url);
            } else {
              console.warn('⚠️ Audio ref not ready yet, skipping auto-play');
            }
          }, 300); // Increased timeout to ensure initialization
        } else {
          throw new Error('No recording available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordingUrl();
  }, [call.id, play]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (currentCallId === call.id) {
            isPlaying ? pause() : play(call.id, recordingUrl || undefined);
          }
          break;
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, volume, currentCallId, call.id, recordingUrl, pause, play, seek, setVolume, toggleMute, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleDownload = async () => {
    if (!recordingUrl || downloading) return;

    try {
      setDownloading(true);
      console.log('📥 Downloading recording...');

      // Fetch the audio file as a blob to handle CORS properly
      const response = await fetch(recordingUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.status}`);
      }

      const blob = await response.blob();

      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `call-${call.caller_name || 'recording'}-${new Date(call.created_at).toISOString().split('T')[0]}.mp3`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      console.log('✅ Download started successfully');
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Failed to download recording. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const isThisCallPlaying = currentCallId === call.id && isPlaying;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 bg-black/50 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal Content */}
      <motion.div
        key="modal-content"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-obsidian">
                Call Recording - {call.caller_name}
              </h3>
              <p className="text-sm text-obsidian/60 mt-1">
                {call.phone_number} • {formatDuration(call.duration_seconds)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
              aria-label="Close player"
            >
              <X className="w-5 h-5 text-obsidian/60" />
            </button>
          </div>

          {/* Audio Element */}
          {recordingUrl && (
            <audio
              ref={audioRef}
              src={recordingUrl}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => pause()}
            />
          )}

          {/* Loading/Error States */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-surgical-600 mx-auto"></div>
              <p className="mt-2 text-sm text-obsidian/60">Loading recording...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Controls (only show when loaded) */}
          {!loading && !error && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surgical-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #0891b2 0%, #0891b2 ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-obsidian/60">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Play/Pause + Skip Buttons */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => seek(Math.max(0, currentTime - 10))}
                  className="p-3 hover:bg-surgical-50 rounded-full transition-colors"
                  aria-label="Skip backward 10 seconds"
                >
                  <SkipBack className="w-5 h-5 text-obsidian/60" />
                </button>

                <button
                  onClick={() => isThisCallPlaying ? pause() : play(call.id, recordingUrl || undefined)}
                  className="p-4 bg-surgical-600 hover:bg-surgical-700 rounded-full transition-colors"
                  aria-label={isThisCallPlaying ? 'Pause' : 'Play'}
                >
                  {isThisCallPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => seek(Math.min(duration, currentTime + 10))}
                  className="p-3 hover:bg-surgical-50 rounded-full transition-colors"
                  aria-label="Skip forward 10 seconds"
                >
                  <SkipForward className="w-5 h-5 text-obsidian/60" />
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-obsidian/60" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-obsidian/60" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-surgical-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-obsidian/60 w-10 text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!loading && !error && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surgical-200">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 border border-surgical-200 rounded-lg hover:bg-surgical-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-surgical-600"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download
                  </>
                )}
              </button>
            </div>
          )}

          {/* Keyboard Shortcuts Hint */}
          <div className="text-xs text-obsidian/40 text-center">
            Space: Play/Pause • ← →: Skip 10s • ↑ ↓: Volume • M: Mute • Esc: Close
          </div>
        </div>
      </motion.div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #0891b2;
          border-radius: 50%;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #0891b2;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </>
  );
}
