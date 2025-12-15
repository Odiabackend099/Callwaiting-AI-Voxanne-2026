"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Mic, MicOff, Volume2, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { TranscriptDisplay } from "@/components/voice/TranscriptDisplay";

export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: "bot" | "user" | "system"; text: string }[]>([
        { role: "bot", text: "Hi there! 👋 I'm Voxanne. I can answer calls, book appointments, and handle FAQs for your clinic 24/7." },
        { role: "bot", text: "How can I help you today?" }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Voice mode state
    const [mode, setMode] = useState<"chat" | "voice">("chat");
    const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);

    // Voice agent hook
    const {
        isConnected,
        isRecording,
        isSpeaking,
        transcripts,
        error: voiceAgentError,
        startCall: connect,
        stopCall: disconnect,
        startRecording,
        stopRecording,
    } = useVoiceAgent({
        onConnected: () => {
            setVoiceError(null);
        },
        onDisconnected: () => {
            // Optionally reset state
        },
        onError: (err) => {
            setVoiceError(err);
        },
    });

    // Sync voice agent error
    useEffect(() => {
        if (voiceAgentError) {
            setVoiceError(voiceAgentError);
        }
    }, [voiceAgentError]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Request microphone permission
    const requestMicPermission = async (): Promise<boolean> => {
        try {
            setVoiceError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop()); // release immediately
            setHasMicPermission(true);
            return true;
        } catch (err: any) {
            console.error("Microphone permission denied:", err);
            setHasMicPermission(false);
            setVoiceError(
                "Microphone access was blocked. Please enable it in your browser settings to use voice mode."
            );
            return false;
        }
    };

    // Enter voice mode
    const handleEnterVoiceMode = async () => {
        setMode("voice");

        // Ask for mic permission if we don't know yet
        if (hasMicPermission === null) {
            const ok = await requestMicPermission();
            if (!ok) return;
        }

        if (!isConnected) {
            await connect();
        }
    };

    // Exit voice mode
    const handleExitVoiceMode = () => {
        setMode("chat");
        stopRecording();
        disconnect();
    };

    // Toggle mic on/off
    const handleToggleMic = async () => {
        // If we're not connected yet, try to connect first and ask user to try again
        if (!isConnected) {
            const ok = hasMicPermission === true || (await requestMicPermission());
            if (!ok) return;

            setVoiceError(null);
            await connect();

            // Do not auto-start recording here; wait until connection succeeds and user taps again
            if (!isConnected) {
                setVoiceError("Unable to connect to the Voxanne voice server. Please try again in a moment.");
            }
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            const ok = hasMicPermission === true || (await requestMicPermission());
            if (!ok) return;

            // Extra guard: avoid calling startRecording if connection dropped between renders
            if (!isConnected) {
                setVoiceError("Lost connection to the Voxanne voice server. Please try again.");
                return;
            }

            await startRecording();
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue;
        setInputValue("");
        setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: messages
                        .map(m => ({ role: m.role === "bot" ? "assistant" : m.role, content: m.text }))
                        .concat({ role: "user", content: userMessage })
                }),
            });

            const data = await response.json();

            if (data.reply) {
                setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
            } else {
                throw new Error("No reply from AI");
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "bot", text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[50] flex flex-col items-end safe-area-bottom">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 w-[350px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                        {/* Header with Mode Toggle */}
                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
                                        <Image src="/callwaiting-ai-logo.png" alt="Voxanne" width={40} height={40} className="object-contain" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">Voxanne AI</h3>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${mode === "voice" && isConnected ? "bg-green-400" : "bg-green-400"} animate-pulse`} />
                                            <span className="text-xs text-white/90">
                                                {mode === "voice"
                                                    ? isConnected ? "Voice Agent Ready" : "Connecting…"
                                                    : "Online Now"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (mode === "voice") handleExitVoiceMode();
                                        setIsOpen(false);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex items-center justify-center">
                                <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 text-xs text-white/80">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (mode === "voice") handleExitVoiceMode();
                                            setMode("chat");
                                        }}
                                        className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                                            mode === "chat" ? "bg-white text-cyan-700 shadow-sm font-medium" : "bg-transparent hover:bg-white/10"
                                        }`}
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Chat
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (mode === "chat") handleEnterVoiceMode();
                                        }}
                                        className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                                            mode === "voice" ? "bg-white text-cyan-700 shadow-sm font-medium" : "bg-transparent hover:bg-white/10"
                                        }`}
                                    >
                                        <Mic className="w-3.5 h-3.5" />
                                        Voice
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Body - Mode Specific Content */}
                        <div className="h-[350px] bg-slate-50 dark:bg-slate-950/50 flex flex-col">
                            {mode === "chat" ? (
                                <>
                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                                                        msg.role === "user"
                                                            ? "bg-cyan-600 text-white rounded-tr-none"
                                                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm"
                                                    }`}
                                                >
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                        <input
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="Type a message..."
                                            className="flex-1 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!inputValue.trim() || isLoading}
                                            className="p-2 rounded-full bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
                                        >
                                            <Send className={`w-4 h-4 ${isLoading ? "opacity-0" : "opacity-100"}`} />
                                            {isLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    {/* Voice Transcript Timeline */}
                                    <div className="flex-1 overflow-hidden">
                                        <TranscriptDisplay
                                            transcripts={transcripts}
                                            isSpeaking={isSpeaking}
                                            className="h-full pt-4 pb-2"
                                        />
                                    </div>

                                    {/* Voice Controls */}
                                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                        {/* Error Messages */}
                                        {voiceError && (
                                            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                                {voiceError}
                                            </p>
                                        )}

                                        {hasMicPermission === false && !voiceError && (
                                            <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                                Microphone access is blocked. Please enable it in your browser settings to use voice mode.
                                            </p>
                                        )}

                                        {/* Controls Row */}
                                        <div className="flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={handleToggleMic}
                                                disabled={hasMicPermission === false}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    isRecording
                                                        ? "bg-red-600 text-white shadow-lg shadow-red-500/40 hover:bg-red-700 ring-2 ring-red-400/70 animate-pulse"
                                                        : "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-700"
                                                }`}
                                            >
                                                {isRecording ? (
                                                    <>
                                                        <MicOff className="w-4 h-4" />
                                                        Mute
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mic className="w-4 h-4" />
                                                        Start Talking
                                                    </>
                                                )}
                                            </button>

                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Volume2 className={`w-4 h-4 transition-colors ${isSpeaking ? "text-cyan-500" : ""}`} />
                                                <span>
                                                    {isConnected
                                                        ? isSpeaking
                                                            ? "Voxanne is speaking…"
                                                            : isRecording
                                                                ? "Listening…"
                                                                : "Ready"
                                                        : voiceError
                                                            ? "Unable to reach voice server"
                                                            : "Connecting…"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 flex items-center justify-center hover:shadow-xl transition-shadow"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </motion.button>
        </div>
    );
};
