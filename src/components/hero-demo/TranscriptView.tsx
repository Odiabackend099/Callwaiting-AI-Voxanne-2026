import { useEffect, useRef } from 'react';
import { ScriptEvent } from './useAudioSync';

interface TranscriptViewProps {
    currentTime: number;
    script: ScriptEvent[];
}

export default function TranscriptView({ currentTime, script }: TranscriptViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter only transcript events
    const lines = script.filter((e) => e.type === 'transcript_event');

    // Auto-scroll to the active line
    useEffect(() => {
        const activeIndex = lines.findIndex((e) => currentTime >= e.start_time && currentTime < e.end_time);
        if (activeIndex !== -1 && scrollRef.current) {
            const activeEl = scrollRef.current.children[activeIndex] as HTMLElement;
            // Smooth scroll the container
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTime, lines]);

    return (
        <div className="w-[90%] max-w-2xl h-[80%] bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h3 className="text-white font-semibold">Live Transcription</h3>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-red-400 text-sm font-medium">Recording</span>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                {lines.map((line, idx) => {
                    const isActive = currentTime >= line.start_time && currentTime < line.end_time;
                    const isPast = currentTime > line.end_time;

                    return (
                        <div
                            key={idx}
                            className={`transition-all duration-500 transform ${isActive ? 'opacity-100 scale-100 translate-x-2' : isPast ? 'opacity-50' : 'opacity-30 blur-sm'
                                }`}
                        >
                            <div className={`text-xs font-bold mb-1 uppercase tracking-wider ${line.speaker_id === 'ai_lisa' ? 'text-blue-400' : 'text-purple-400'
                                }`}>
                                {line.speaker_id === 'ai_lisa' ? 'Voxanne AI' : 'Anna (Caller)'}
                            </div>
                            <p className={`text-lg leading-relaxed ${isActive ? 'text-white font-medium' : 'text-gray-300'}`}>
                                {line.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
