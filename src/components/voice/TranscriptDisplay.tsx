"use client";

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptMessage } from '@/types/voice';
import { User, Bot } from 'lucide-react';

interface TranscriptDisplayProps {
    transcripts: TranscriptMessage[];
    isSpeaking?: boolean;
    className?: string;
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
    transcripts,
    isSpeaking = false,
    className = '',
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Smooth auto-scroll to bottom when new messages arrive
    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
            });
        };

        // Debounce scroll to avoid jank
        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [transcripts]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div
            ref={scrollRef}
            className={`overflow-y-auto space-y-4 px-4 scroll-smooth ${className}`}
        >
            <AnimatePresence initial={false}>
                {transcripts.map((transcript, index) => {
                    const isLastMessage = index === transcripts.length - 1;
                    const showTimestamp = index === 0 ||
                        (transcripts[index - 1] &&
                            Math.abs(transcript.timestamp.getTime() - transcripts[index - 1].timestamp.getTime()) > 60000);

                    return (
                        <React.Fragment key={transcript.id}>
                            {/* Timestamp Divider */}
                            {showTimestamp && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-center my-4"
                                >
                                    <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                                        {formatTime(transcript.timestamp)}
                                    </span>
                                </motion.div>
                            )}

                            {/* Message Bubble */}
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className={`flex gap-3 ${transcript.speaker === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                {/* AI Avatar */}
                                {transcript.speaker === 'agent' && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                                    >
                                        <Bot className="w-4 h-4 text-white" />
                                    </motion.div>
                                )}

                                {/* Message Content */}
                                <div className={`max-w-[75%] ${transcript.speaker === 'user' ? 'order-first' : ''}`}>
                                    <motion.div
                                        className={`rounded-2xl px-4 py-3 ${transcript.speaker === 'user'
                                            ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-tr-sm'
                                            : 'bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-sm backdrop-blur-sm'
                                            }`}
                                        whileHover={{ scale: 1.01 }}
                                        transition={{ duration: 0.1 }}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {transcript.text}
                                        </p>
                                    </motion.div>

                                    {/* Confidence Badge (optional) */}
                                    {transcript.confidence && transcript.confidence < 0.9 && (
                                        <div className="flex items-center gap-2 mt-1 px-2">
                                            <span className="text-xs text-slate-600">
                                                {Math.round(transcript.confidence * 100)}% confidence
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* User Avatar */}
                                {transcript.speaker === 'user' && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
                                    >
                                        <User className="w-4 h-4 text-white" />
                                    </motion.div>
                                )}
                            </motion.div>
                        </React.Fragment>
                    );
                })}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isSpeaking && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 justify-start"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm">
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-slate-400 rounded-full"
                                    animate={{
                                        y: [0, -6, 0],
                                        opacity: [0.5, 1, 0.5],
                                    }}
                                    transition={{
                                        duration: 0.6,
                                        repeat: Infinity,
                                        delay: i * 0.1,
                                        ease: "easeInOut",
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Empty State */}
            {transcripts.length === 0 && !isSpeaking && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center justify-center h-full text-center py-12"
                >
                    <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm mb-2">No conversation yet</p>
                    <p className="text-slate-600 text-xs max-w-xs">
                        Start speaking to begin your conversation with Voxanne
                    </p>
                </motion.div>
            )}

            {/* Scroll Anchor */}
            <div ref={messagesEndRef} />
        </div>
    );
};
