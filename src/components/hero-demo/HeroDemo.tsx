'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useAudioSync, ScriptEvent } from './useAudioSync';
import AvatarView from './AvatarView';
import TranscriptView from './TranscriptView';
// Import the JSON directly.
import demoData from './script.json';

export default function HeroDemo() {
    // Sort timeline once to ensure order
    const script = useMemo(() => {
        // Cast the JSON data to our type. Be careful with 'type' matching.
        return (demoData.timeline as any[]).sort((a, b) => a.start_time - b.start_time) as ScriptEvent[];
    }, []);

    const { audioRef, isPlaying, togglePlay, currentTime, activeEvent } = useAudioSync(script);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Determine current scene (default to intro if null)
    // We look at the active event's scene_id. If the active event is just a transcript line, 
    // we need to know what "scene" we are in. 
    // The JSON structure has long "scene_change" events that span the duration, 
    // OR we can infer it. Based on the provided JSON, scene_change events span time ranges.

    // Find the active Scene event (type === 'scene_change')
    const currentSceneEvent = script.find(
        e => e.type === 'scene_change' && currentTime >= e.start_time && currentTime < e.end_time
    );

    const currentSceneId = currentSceneEvent?.scene_id || 'intro_avatar';

    const handlePlay = () => {
        setHasInteracted(true);
        togglePlay();
    }

    return (
        <div className="relative w-full max-w-5xl mx-auto aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 ring-1 ring-white/10">

            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                src={demoData.meta.assets.audio_master}
                preload="metadata"
                onEnded={() => togglePlay()}
                crossOrigin="anonymous"
            />

            {/* --- SCENE 1 & 3: AVATAR VIEW --- */}
            {/* We keep the AvatarView mounted but hide it when in transcript mode to allow smooth transition context if needed, 
          or we can conditionally render. Fade opacity is smoother. */}
            <div
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${currentSceneId === 'transcription_ui' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
            >
                <AvatarView
                    isPlaying={isPlaying}
                    isTalking={activeEvent?.vad_active || false}
                    onPlay={handlePlay}
                />
            </div>

            {/* --- SCENE 2: TRANSCRIPT UI --- */}
            <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${currentSceneId === 'transcription_ui' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
                    }`}
            >
                {/* Only render complex UI if we are near or in the scene to save resources, 
            but for smooth fading, keeping it mounted is often better if not too heavy. */}
                <TranscriptView
                    currentTime={currentTime}
                    script={script}
                />
            </div>

            {/* --- PLAY BUTTON OVERLAY (Initial State) --- */}
            {!isPlaying && !hasInteracted && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
                    <button
                        onClick={handlePlay}
                        className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-3"
                    >
                        <span className="text-xl">▶</span>
                        <span>See Voxanne in Action</span>
                        <div className="absolute inset-0 rounded-full ring-2 ring-white/50 animate-ping opacity-50"></div>
                    </button>
                </div>
            )}

            {/* --- REPLAY BUTTON (End State) --- */}
            {!isPlaying && hasInteracted && currentTime > (script[script.length - 1]?.end_time || 90) && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
                    <button
                        onClick={() => {
                            if (audioRef.current) audioRef.current.currentTime = 0;
                            handlePlay();
                        }}
                        className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                    >
                        Replay Demo
                    </button>
                </div>
            )}

            {/* --- CONTROLS OVERLAY (Pause/Play) --- */}
            {hasInteracted && (
                <div className="absolute bottom-6 left-6 z-40 opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <button
                        onClick={togglePlay}
                        className="p-3 bg-black/50 text-white rounded-full backdrop-blur-md border border-white/10 hover:bg-black/70"
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                </div>
            )}
        </div>
    );
}
