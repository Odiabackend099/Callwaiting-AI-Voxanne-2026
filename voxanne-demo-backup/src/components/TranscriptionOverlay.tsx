
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate, spring } from 'remotion';

export interface TranscriptEvent {
    start_time: number;
    end_time: number;
    rotation?: number;
    speaker_name: string;
    text: string;
}

export const TranscriptionOverlay: React.FC<{
    events: TranscriptEvent[];
}> = ({ events }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    // Find active event
    const activeEvent = events.find(
        (e) => currentTime >= e.start_time && currentTime < e.end_time
    );

    if (!activeEvent) return null;

    return (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center items-end px-12 pb-12">
            <div
                className={`
                    relative max-w-4xl p-8 rounded-3xl shadow-2xl backdrop-blur-md border border-white/20
                    ${activeEvent.speaker_name.includes("AI") || activeEvent.speaker_name.includes("Lisa")
                        ? "bg-slate-900/90 text-white rounded-bl-none"
                        : "bg-white/90 text-slate-900 rounded-br-none ml-auto"}
                `}
                style={{
                    transform: `scale(${spring({
                        frame: frame - (activeEvent.start_time * fps),
                        fps,
                        config: { damping: 200 }
                    })})`
                }}
            >
                <div className="flex items-center gap-4 mb-2">
                    <span className={`text-sm font-bold uppercase tracking-wider ${activeEvent.speaker_name.includes("AI") ? "text-blue-400" : "text-blue-600"
                        }`}>
                        {activeEvent.speaker_name}
                    </span>
                </div>
                <p className="text-3xl font-medium leading-relaxed">
                    {activeEvent.text}
                </p>
            </div>
        </div>
    );
};
