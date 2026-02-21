"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import Image from "next/image";

export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: "bot" | "user" | "system"; text: string }[]>([
        { role: "bot", text: "👋 Hi there! I'm Voxanne, your AI front desk assistant for Voxanne AI. I'm here to help you 24/7!" },
        { role: "bot", text: "I can answer questions about our AI receptionist, pricing, features, integrations, security, setup, or anything else you'd like to know. Whether you're a prospect exploring options or an existing customer needing support, I'm here to help!" }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue;
        setInputValue("");
        setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
        setHasInteracted(true);
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
            setMessages((prev) => [...prev, { role: "bot", text: "I'm having trouble connecting to my knowledge base right now. Please try again in a moment, or reach out to our team at support@callwaitingai.dev for immediate assistance. We're here to help! 🙏" }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (action: string) => {
        setInputValue(action);
        setHasInteracted(true);
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
                        {/* Header */}
                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
                                        <Image src="/Brand/3.png" alt="Voxanne AI" width={40} height={40} className="object-contain" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm font-display">Voxanne Support</h3>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                            <span className="text-xs text-white/90">Always Available</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages */}
                        <div className="h-[400px] bg-slate-50 dark:bg-slate-950/50 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                                    ? "bg-cyan-600 text-white rounded-tr-none"
                                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm"
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {!hasInteracted && messages.length === 2 && (
                                    <div className="space-y-2 mt-4">
                                        <p className="text-xs text-slate-500 font-semibold">Quick questions:</p>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleQuickAction("What is Voxanne AI and how does it work?")}
                                                className="w-full text-left px-3 py-2 rounded-lg bg-cyan-50 dark:bg-slate-800/50 hover:bg-cyan-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 transition-colors border border-cyan-200 dark:border-slate-700"
                                            >
                                                📱 How does it work?
                                            </button>
                                            <button
                                                onClick={() => handleQuickAction("What are your pricing plans?")}
                                                className="w-full text-left px-3 py-2 rounded-lg bg-cyan-50 dark:bg-slate-800/50 hover:bg-cyan-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 transition-colors border border-cyan-200 dark:border-slate-700"
                                            >
                                                💰 Pricing & Plans
                                            </button>
                                            <button
                                                onClick={() => handleQuickAction("Is it GDPR and HIPAA compliant?")}
                                                className="w-full text-left px-3 py-2 rounded-lg bg-cyan-50 dark:bg-slate-800/50 hover:bg-cyan-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 transition-colors border border-cyan-200 dark:border-slate-700"
                                            >
                                                🔒 Security & Compliance
                                            </button>
                                            <button
                                                onClick={() => handleQuickAction("How do I get started?")}
                                                className="w-full text-left px-3 py-2 rounded-lg bg-cyan-50 dark:bg-slate-800/50 hover:bg-cyan-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 transition-colors border border-cyan-200 dark:border-slate-700"
                                            >
                                                🚀 Getting Started
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <div className="relative">
                {/* Hover tooltip */}
                {!isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.92 }}
                        whileHover={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute bottom-full right-0 mb-3 px-3 py-1.5 bg-obsidian text-white text-xs font-medium rounded-lg whitespace-nowrap pointer-events-none"
                        style={{ transformOrigin: 'bottom right' }}
                    >
                        Chat with us ✨
                        <div className="absolute bottom-[-4px] right-4 w-2 h-2 bg-obsidian rotate-45" />
                    </motion.div>
                )}

                <motion.button
                    animate={!isOpen ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    whileHover={{ scale: 1.08, boxShadow: '0 12px 30px rgba(29,78,216,0.40)' }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative w-14 h-14 rounded-full bg-gradient-to-br from-surgical-500 to-surgical-700 text-white shadow-lg shadow-surgical-600/35 flex items-center justify-center transition-shadow"
                >
                    {/* Notification pulse dot */}
                    {!isOpen && (
                        <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-white" />
                        </span>
                    )}
                    <AnimatePresence mode="wait" initial={false}>
                        {isOpen ? (
                            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                                <X className="w-6 h-6" />
                            </motion.div>
                        ) : (
                            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                                <MessageCircle className="w-6 h-6 fill-white/20" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
};
