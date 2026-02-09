import { useState, useEffect, useRef, useCallback } from 'react';
import { TIMING, TRANSCRIPT_DATA, TranscriptEvent } from './preciseTimeline';

export interface AudioState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isCallActive: boolean;
    isIntro: boolean;
    isOutro: boolean;
    activeTranscript: TranscriptEvent | null;
    annaSpeaking: boolean;
}

export const useAudioSyncV2 = (audioSrc: string) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<AudioState>({
        isPlaying: false,
        currentTime: 0,
        duration: TIMING.TOTAL_DURATION, // Default to known duration
        isCallActive: false,
        isIntro: true,
        isOutro: false,
        activeTranscript: null,
        annaSpeaking: false,
    });

    // Initialize audio
    useEffect(() => {
        const audio = new Audio(audioSrc);
        audio.preload = 'auto'; // Load immediately
        audioRef.current = audio;

        const handleEnded = () => {
            setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
        };

        audio.addEventListener('ended', handleEnded);
        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.pause();
        };
    }, [audioSrc]);

    // Animation Frame Loop
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            if (audioRef.current) {
                const t = audioRef.current.currentTime;
                // Calculate derived states
                const isIntro = t < TIMING.INTRO_END;
                const isCallActive = t >= TIMING.CALL_START && t < TIMING.CALL_END;
                const isOutro = t >= TIMING.OUTRO_START;

                // Find active transcript
                const activeLine = TRANSCRIPT_DATA.find(
                    line => t >= line.start && t < line.end
                ) || null;

                // Determine if Anna is speaking
                let annaSpeaking = false;

                if (isIntro) {
                    // Approximate intro speech: 0.5-1.7s, 2.8-11.6s
                    if ((t > 0.5 && t < 1.7) || (t > 2.8 && t < 11.6)) annaSpeaking = true;
                } else if (isOutro) {
                    // Approximate outro speech: > 132.5s
                    if (t > 132.5 && t < 145) annaSpeaking = true;
                } else if (activeLine && activeLine.speaker === 'Anna') {
                    annaSpeaking = true;
                }

                setState({
                    isPlaying: !audioRef.current.paused,
                    currentTime: t,
                    duration: audioRef.current.duration || TIMING.TOTAL_DURATION,
                    isCallActive,
                    isIntro,
                    isOutro,
                    activeTranscript: activeLine,
                    annaSpeaking
                });
            }
            animationFrameId = requestAnimationFrame(loop);
        };

        if (state.isPlaying) {
            loop();
        } else {
            // Run once to update state if paused (e.g. seeking)
            if (audioRef.current) loop();
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [state.isPlaying]);

    const togglePlay = useCallback(() => {
        if (audioRef.current) {
            if (state.isPlaying) {
                audioRef.current.pause();
                setState(prev => ({ ...prev, isPlaying: false }));
            } else {
                audioRef.current.play().catch(e => console.error("Playback failed", e));
                setState(prev => ({ ...prev, isPlaying: true }));
            }
        }
    }, [state.isPlaying]);

    return { ...state, togglePlay, audioRef };
};
