"use client";

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Activity, Phone, Instagram, AlertCircle, PhoneMissed } from 'lucide-react';

interface AudioDemo {
    id: string;
    title: string;
    metrics: string;
    duration: string;
    icon: React.ElementType;
    color: string;
    src: string;
    transcript: string;
    context: string;
    result: string;
}

const demos: AudioDemo[] = [
    {
        id: 'bbl',
        title: 'BBL Inquiry (High Ticket)',
        metrics: '£9,500 Procedure',
        duration: '0:42',
        icon: Activity,
        color: 'cyan',
        src: '/audio/demos/bbl-inquiry-pricing.mp3',
        context: "Caller is scared of pain and asks about BBL pricing.",
        transcript: "I hear your concern about the pain, and that's completely normal. Our surgeons use a specialized technique to minimize discomfort. Regarding pricing, BBL packages typically range from £8,000 to £12,000 depending on your goals. I can book you a complimentary consultation to get an exact quote.",
        result: "Booked consultation for Tuesday 2 PM"
    },
    {
        id: 'emergency',
        title: 'Post-Op Emergency',
        metrics: 'Risk Avoided',
        duration: '0:28',
        icon: AlertCircle,
        color: 'red',
        src: '/audio/demos/after-hours-triage.mp3',
        context: "Caller says 'My face is swollen 2 days after filler'.",
        transcript: "I am flagging this as a potential priority. Since you mentioned swelling 48 hours post-procedure, I need to connect you with our on-call nurse immediately for a proper assessment. Please stay on the line.",
        result: "Transferred to nurse in 8 seconds"
    },
    {
        id: 'angry',
        title: 'Frustrated Caller',
        metrics: 'Patient Retained',
        duration: '0:31',
        icon: PhoneMissed,
        color: 'yellow',
        src: '/audio/demos/angry-caller.mp3', // Placeholder
        context: "Caller complains 'I've called 3 times and no one answers!'",
        transcript: "I am so sorry for the frustration. You have reached me now, and I am here to help. I apologize that we missed you earlier. Let me make this right immediately. How can I help you today?",
        result: "Calmed down & booked appointment"
    }
];

export const MedicalAudioDemos = () => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = (demo: AudioDemo) => {
        if (activeId === demo.id) {
            audioRef.current?.pause();
            setActiveId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.src = demo.src;
                audioRef.current.play().catch(e => console.log("Audio play failed (expected without file):", e));
            }
            setActiveId(demo.id);
        }
    };

    return (
        <section id="proof-section" className="py-24 bg-slate-950 relative border-t border-slate-900">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
                        <Phone className="w-4 h-4" />
                        <span>Hear the Difference</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Don&apos;t Believe Us? <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                            Listen to the Proof.
                        </span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Real conversations. Real medical compliance. Real revenue captured.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {demos.map((demo) => {
                        const isActive = activeId === demo.id;
                        const Icon = demo.icon;

                        return (
                            <motion.div
                                key={demo.id}
                                whileHover={{ y: -5 }}
                                className={`
                                    relative p-8 rounded-3xl border transition-all duration-300
                                    ${isActive
                                        ? 'bg-slate-900 border-cyan-500/50 shadow-2xl shadow-cyan-500/10'
                                        : 'bg-black/40 border-white/10 hover:border-white/20'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center
                                        ${demo.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                                        ${demo.color === 'red' ? 'bg-red-500/20 text-red-400' : ''}
                                        ${demo.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                                        ${demo.color === 'purple' ? 'bg-purple-500/20 text-purple-400' : ''}
                                    `}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">
                                        {demo.duration}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-1">{demo.title}</h3>
                                <p className="text-sm font-medium text-green-400 mb-6 flex items-center gap-1">
                                    Result: {demo.metrics}
                                </p>

                                {/* Player Interface */}
                                <div className="bg-black/50 rounded-xl p-3 mb-6 relative overflow-hidden group border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => togglePlay(demo)}
                                            className={`
                                                w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0
                                                ${isActive
                                                    ? 'bg-cyan-500 text-white'
                                                    : 'bg-white/10 text-white hover:bg-white/20'
                                                }
                                            `}
                                        >
                                            {isActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-0.5 h-6">
                                                {[...Array(15)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        className={`w-1 rounded-full flex-1 ${isActive ? 'bg-cyan-500' : 'bg-slate-800'}`}
                                                        animate={isActive ? {
                                                            height: [4, Math.random() * 20 + 4, 4],
                                                            opacity: [0.5, 1, 0.5]
                                                        } : { height: 4 }}
                                                        transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transcript Analysis */}
                                <div className="space-y-3 relative">
                                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-800" />

                                    <div className="pl-4">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Context</div>
                                        <p className="text-xs text-slate-400 italic mb-3">
                                            &quot;{demo.context}&quot;
                                        </p>
                                    </div>

                                    <div className="pl-4">
                                        <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-1">Call Waiting AI&apos;s Response</div>
                                        <p className="text-sm text-slate-200 leading-relaxed">
                                            {demo.transcript}
                                        </p>
                                    </div>

                                    <div className="pl-4 pt-2">
                                        <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">Outcome</div>
                                        <p className="text-xs text-green-400 font-semibold">
                                            ✓ {demo.result}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <audio ref={audioRef} onEnded={() => setActiveId(null)} className="hidden" />
            </div>
        </section>
    );
};
