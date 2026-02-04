/**
 * Global Audio Player Store
 * Manages audio playback state across the application
 * Prevents multiple audio streams from playing simultaneously
 */
import { create } from 'zustand';

interface AudioPlayerState {
  // State
  currentCallId: string | null;      // Which call is currently playing
  isPlaying: boolean;                // Play/pause state
  currentTime: number;               // Current playback position (seconds)
  duration: number;                  // Total duration (seconds)
  recordingUrl: string | null;       // Fetched recording URL
  volume: number;                    // Volume (0-1)
  isMuted: boolean;                  // Mute state
  error: string | null;              // Error message
  loading: boolean;                  // Fetching recording URL

  // Audio element ref (stored at store level for cross-component access)
  audioRef: HTMLAudioElement | null;

  // Actions
  play: (callId: string, recordingUrl?: string) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setRecordingUrl: (url: string) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  initAudioRef: (ref: HTMLAudioElement) => void;
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  // Initial state
  currentCallId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  recordingUrl: null,
  volume: 0.8, // 80% default volume
  isMuted: false,
  error: null,
  loading: false,
  audioRef: null,

  // Play action - Start or resume playback
  play: (callId, recordingUrl) => {
    const audio = get().audioRef;
    if (!audio) {
      console.error('❌ Audio element not initialized. The audio element must be mounted before calling play().');
      console.error('   Tip: Wait for the AudioPlayerModal to fully render with recordingUrl.');
      return;
    }

    // Stop previous playback if different call
    if (get().currentCallId && get().currentCallId !== callId) {
      audio.pause();
      audio.currentTime = 0;
    }

    set({
      currentCallId: callId,
      isPlaying: true,
      recordingUrl: recordingUrl || get().recordingUrl,
      error: null
    });

    // Set audio source if provided
    if (recordingUrl && audio.src !== recordingUrl) {
      audio.src = recordingUrl;
    }

    // Play audio
    audio.play().catch((err) => {
      console.error('Play failed:', err);
      set({ error: err.message, isPlaying: false });
    });
  },

  // Pause action
  pause: () => {
    const audio = get().audioRef;
    if (audio) {
      audio.pause();
      set({ isPlaying: false });
    }
  },

  // Stop action - Pause and reset to beginning
  stop: () => {
    const audio = get().audioRef;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    set({
      currentCallId: null,
      isPlaying: false,
      currentTime: 0,
      recordingUrl: null,
      error: null
    });
  },

  // Seek to specific time
  seek: (time) => {
    const audio = get().audioRef;
    if (audio && !isNaN(time) && time >= 0 && time <= audio.duration) {
      audio.currentTime = time;
      set({ currentTime: time });
    }
  },

  // Set volume (0-1)
  setVolume: (volume) => {
    const audio = get().audioRef;
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (audio) {
      audio.volume = clampedVolume;
      set({ volume: clampedVolume, isMuted: false });

      // Persist volume to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('audioPlayerVolume', clampedVolume.toString());
      }
    }
  },

  // Toggle mute
  toggleMute: () => {
    const audio = get().audioRef;
    const isMuted = get().isMuted;

    if (audio) {
      audio.muted = !isMuted;
      set({ isMuted: !isMuted });
    }
  },

  // Setters for time updates
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setRecordingUrl: (url) => set({ recordingUrl: url }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),

  // Initialize audio element ref
  initAudioRef: (ref) => {
    set({ audioRef: ref });

    // Restore volume from localStorage
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('audioPlayerVolume');
      if (savedVolume) {
        const volume = parseFloat(savedVolume);
        if (!isNaN(volume) && volume >= 0 && volume <= 1) {
          ref.volume = volume;
          set({ volume });
        }
      }
    }
  }
}));
