"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { User, Bot, ShieldCheck, PhoneCall, CheckCircle2 } from "lucide-react";

interface Message {
    id: number;
    role: "user" | "ai" | "system";
    text: string;
    icon?: React.ElementType;
    delay: number;
}

const sequence: Message[] = [
    { id: 1, role: "user", text: "Do you have any openings for a hydrafacial tomorrow?", icon: User, delay: 1000 },
    { id: 2, role: "ai", text: "Checking availability...", delay: 2500 },
    { id: 3, role: "ai", text: "Yes, we have a slot at 2:00 PM. Would you like to book that?", delay: 4000 },
    { id: 4, role: "user", text: "Great! Also, is my data secure? UK GDPR & HIPAA compliant?", icon: User, delay: 6000 },
    { id: 5, role: "ai", text: "Absolutely. We are fully UK GDPR and HIPAA compliant with all data encrypted. 🔒", icon: ShieldCheck, delay: 8000 },
    { id: 6, role: "user", text: "What happens if I have a complex medical question?", icon: User, delay: 10500 },
    { id: 7, role: "ai", text: "I can transfer you to a live clinical specialist for that. Connecting you now...", icon: PhoneCall, delay: 12500 },
    { id: 8, role: "system", text: "Transferring call to Front Desk...", delay: 14500 },
];

export default function HeroChatAnimation() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let timeouts: NodeJS.Timeout[] = [];

        const runSequence = () => {
            setMessages([]);
            
            sequence.forEach((msg) => {
                // Show typing indicator before AI messages (except the "Checking availability" one if we want fast response)
                if (msg.role === "ai") {
                    const typingDelay = msg.delay - 1000;
                    if (typingDelay > 0) {
                        const t1 = setTimeout(() => setIsTyping(true), typingDelay);
                        timeouts.push(t1);
                    }
                }

                const t2 = setTimeout(() => {
                    setIsTyping(false);
                    setMessages((prev) => [...prev, msg]);
                }, msg.delay);
                timeouts.push(t2);
            });

            // Loop the animation
            const resetDelay = sequence[sequence.length - 1].delay + 5000;
            const t3 = setTimeout(() => {
                runSequence();
            }, resetDelay);
            timeouts.push(t3);
        };

        runSequence();

        return () => timeouts.forEach(clearTimeout);
    }, []);

    return (
        <div className="w-full max-w-[380px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[500px] relative">
            {/* Header */}
            <div className="bg-navy-900 p-4 flex items-center gap-3 shadow-sm z-10">
                <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-surgical-500 to-surgical-700 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        V
                    </div>
                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-navy-900 animate-pulse" />
                </div>
                <div>
                    <h3 className="text-white font-semibold text-sm">Voxanne AI</h3>
                    <p className="text-surgical-100 text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                        Online & Ready
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-slate-50 p-4 overflow-hidden relative flex flex-col gap-3">
                <div className="absolute inset-0 opacity-[0.03]" 
                    style={{ backgroundImage: 'radial-gradient(#006BFF 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
                />
                
                <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2 relative z-10`}
                        >
                            {msg.role !== "user" && msg.role !== "system" && (
                                <div className="h-6 w-6 rounded-full bg-surgical-100 flex-shrink-0 flex items-center justify-center text-surgical-600 text-xs font-bold border border-surgical-200">
                                    AI
                                </div>
                            )}
                            
                            {msg.role === "system" ? (
                                <div className="w-full flex justify-center my-2">
                                    <span className="bg-slate-200/80 backdrop-blur-sm text-slate-500 text-xs py-1 px-3 rounded-full flex items-center gap-1.5">
                                        <PhoneCall className="h-3 w-3" />
                                        {msg.text}
                                    </span>
                                </div>
                            ) : (
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        msg.role === "user"
                                            ? "bg-surgical-600 text-white rounded-tr-none"
                                            : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-start items-end gap-2"
                    >
                        <div className="h-6 w-6 rounded-full bg-surgical-100 flex-shrink-0 flex items-center justify-center text-surgical-600 text-xs font-bold border border-surgical-200">
                            AI
                        </div>
                        <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center h-[42px]">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        </div>
                    </motion.div>
                )}
                
                {/* Spacer to push content up if needed, though flex-col handles it */}
                <div className="mt-auto" />
            </div>

            {/* Input Mockup */}
            <div className="p-3 bg-white border-t border-slate-100 z-10">
                <div className="bg-slate-50 rounded-full h-10 border border-slate-200 flex items-center px-4 text-slate-400 text-sm justify-between">
                    <span>Type a message...</span>
                    <div className="h-6 w-6 rounded-full bg-surgical-600 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
