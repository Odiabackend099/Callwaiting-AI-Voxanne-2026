import { useState, useEffect, useRef } from 'react';

// Define the shape of your script based on the JSON provided
export type ScriptEvent = {
    start_time: number;
    end_time: number;
    type: 'scene_change' | 'transcript_event' | 'transition' | 'sfx';
    text?: string;
    speaker_id?: string;
    scene_id?: string;
    vad_active?: boolean;
};

export const useAudioSync = (script: ScriptEvent[]) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeEvent, setActiveEvent] = useState<ScriptEvent | null>(null);

    // The Game Loop
    useEffect(() => {
        let animationFrameId: number;

        const tick = () => {
            if (!audioRef.current) return;

            const time = audioRef.current.currentTime;
            setCurrentTime(time);

            // Find the current active event efficiently
            const current = script.find(
                (e) => time >= e.start_time && time < e.end_time
            );

            // Only update state if the event CHANGED (prevents re-renders)
            if (current && current !== activeEvent) {
                setActiveEvent(current);
            }

            if (isPlaying) {
                animationFrameId = requestAnimationFrame(tick);
            }
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(tick);
        } else {
            // Ensure we capture the final state or pause state
            tick();
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, script, activeEvent]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
        }
        setIsPlaying(!isPlaying);
    };

    return { audioRef, isPlaying, togglePlay, currentTime, activeEvent };
};
