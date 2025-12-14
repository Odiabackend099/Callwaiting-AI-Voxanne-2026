"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const LiveVoiceInterface = () => {
    const [transcript, setTranscript] = useState<
        { role: "user" | "ai"; text: string; id: number }[]
    >([]);
    const [isTalking, setIsTalking] = useState(false);
    const [typingText, setTypingText] = useState("");

    const conversationFlow = [
        { role: "user", text: "Do you have any appointments this Saturday?" },
        { role: "ai", text: "Yes! Dr. Sarah has an opening at 2:00 PM. Shall I book that for you?" },
        { role: "user", text: "That works. How much is the consultation?" },
        { role: "ai", text: "The consultation is $150, which goes towards your treatment." }
    ];

    useEffect(() => {
        let currentIndex = 0;
        let charIndex = 0;
        let timeout: NodeJS.Timeout;

        const runConversation = () => {
            if (currentIndex >= conversationFlow.length) {
                setTimeout(() => {
                    setTranscript([]);
                    currentIndex = 0;
                    runConversation();
                }, 5000); // Reset after 5s
                return;
            }

            const currentMessage = conversationFlow[currentIndex];
            setIsTalking(true);

            // Simulate typing/speaking
            const typeWriter = () => {
                if (charIndex < currentMessage.text.length) {
                    setTypingText(currentMessage.text.slice(0, charIndex + 1));
                    charIndex++;
                    timeout = setTimeout(typeWriter, 50); // Typing speed
                } else {
                    // Message complete
                    setIsTalking(false);
                    setTranscript((prev) => [
                        ...prev,
                        { role: currentMessage.role as "user" | "ai", text: currentMessage.text, id: Date.now() }
                    ]);
                    setTypingText("");
                    charIndex = 0;
                    currentIndex++;
                    timeout = setTimeout(runConversation, 1500); // Pause between turns
                }
            };

            typeWriter();
        };

        runConversation();

        return () => clearTimeout(timeout);
    }, []);

    return (
        <div className="relative w-full h-[500px] bg-slate-900/90 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col font-sans">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isTalking ? "bg-cyan-500 animate-pulse" : "bg-slate-500"}`}></div>
                        {isTalking && <div className="absolute inset-0 w-3 h-3 rounded-full bg-cyan-400 animate-ping opacity-75"></div>}
                    </div>
                    <span className="text-sm font-medium text-slate-300">
                        {isTalking ? "Voxanne is listening..." : "Voxanne is ready"}
                    </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">LIVE DEMO</div>
            </div>

            {/* Visualizer (Background) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="flex items-center justify-center gap-1 h-32">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="w-2 bg-cyan-500 rounded-full"
                            animate={{
                                height: isTalking ? [20, Math.random() * 100 + 20, 20] : 20,
                            }}
                            transition={{
                                duration: 0.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto z-10 scroll-smooth">
                <AnimatePresence>
                    {transcript.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${msg.role === "ai" ? "justify-start" : "justify-end"}`}
                        >
                            <div
                                className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.role === "ai"
                                        ? "bg-slate-800 text-cyan-50 rounded-tl-none border border-slate-700"
                                        : "bg-cyan-600 text-white rounded-tr-none"
                                    }`}
                            >
                                <span className="block text-[10px] opacity-70 mb-1 font-bold uppercase tracking-wider">
                                    {msg.role === "ai" ? "Voxanne AI" : "Caller"}
                                </span>
                                {msg.text}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                {typingText && (
                    <motion.div
                        className={`flex ${conversationFlow[transcript.length % conversationFlow.length]?.role === "ai" ? "justify-start" : "justify-end"}`}
                    >
                        <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-lg opacity-80 ${conversationFlow[transcript.length % conversationFlow.length]?.role === "ai"
                                ? "bg-slate-800 text-cyan-50 rounded-tl-none border border-slate-700"
                                : "bg-cyan-600 text-white rounded-tr-none"
                            }`}>
                            <span className="block text-[10px] opacity-70 mb-1 font-bold uppercase tracking-wider">
                                {conversationFlow[transcript.length % conversationFlow.length]?.role === "ai" ? "Voxanne AI" : "Caller"}
                            </span>
                            {typingText}
                            <span className="animate-pulse">|</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Control Bar (Mock) */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-center gap-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <div className="w-6 h-6 border-2 border-slate-500 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};
