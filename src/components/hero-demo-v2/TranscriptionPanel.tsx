import React, { useEffect, useRef } from 'react';
import { TRANSCRIPT_DATA, TranscriptEvent, TIMING } from './preciseTimeline';
import { cn } from '@/lib/utils'; // Assuming standard cn utility is available

interface TranscriptionPanelProps {
    currentTime: number;
    isVisible: boolean;
}

export default function TranscriptionPanel({ currentTime, isVisible }: TranscriptionPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter history based on current time
    // Only show lines that have STARTED
    const history = TRANSCRIPT_DATA.filter(t => currentTime >= t.start);

    // Auto-scroll to bottom when history changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history.length, isVisible]);

    if (!isVisible && currentTime < TIMING.CALL_START) return null;

    return (
        <div
            className={cn(
                "absolute top-0 right-0 h-full w-[400px] bg-white/80 backdrop-blur-xl border-l border-white/20 shadow-2xl transition-transform duration-500 ease-out z-20 flex flex-col pointer-events-auto",
                isVisible ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-white/50">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <h3 className="font-semibold text-gray-800">Live Transcript</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">AI Receptionist active</p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                {history.map((item, i) => {
                    const isAi = item.speaker === 'Lisa (AI)';
                    const isActive = currentTime >= item.start && currentTime < item.end;

                    return (
                        <div
                            key={i}
                            className={cn(
                                "flex flex-col gap-1 transition-opacity duration-500",
                                isActive ? "opacity-100 scale-100" : "opacity-70 scale-95"
                            )}
                        >
                            <span className={cn(
                                "text-xs font-bold uppercase tracking-wider",
                                isAi ? "text-purple-600 self-start" : "text-teal-600 self-end"
                            )}>
                                {item.speaker}
                            </span>

                            <div className={cn(
                                "p-4 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-sm",
                                isAi
                                    ? "bg-purple-50 text-purple-900 self-start rounded-tl-none border border-purple-100"
                                    : "bg-teal-50 text-teal-900 self-end rounded-tr-none border border-teal-100",
                                isActive && "ring-2 ring-offset-2 ring-blue-400 shadow-md"
                            )}>
                                {item.text}
                            </div>
                        </div>
                    );
                })}

                {/* Spacer for scroll */}
                <div className="h-20" />
            </div>
        </div>
    );
}
