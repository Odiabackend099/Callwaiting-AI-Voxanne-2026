"use client";

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Activity, Phone, Instagram, AlertCircle } from 'lucide-react';

interface AudioDemo {
    id: string;
    title: string;
    subtitle: string;
    duration: string;
    icon: React.ElementType;
    color: string;
    src: string; // Placeholder path
    transcript: string;
    context: string;
}

const demos: AudioDemo[] = [
    {
        id: 'bbl',
        title: 'BBL Inquiry & Pricing',
        subtitle: 'Handling price objections and booking pre-op',
        duration: '0:30',
        icon: Activity,
        color: 'cyan',
        src: '/audio/demos/bbl-inquiry-pricing.mp3',
        context: "User asks: 'I'm dying for a BBL but I heard it's super expensive. What's the price?'",
        transcript: "I completely understand why you'd ask about pricing first. It's a significant investment in yourself. Dr. Chen's all-inclusive BBL packages start at £8,500. That covers everything—anesthesia, facility fees, and your post-op care—so there are absolutely no hidden costs..."
    },
    {
        id: 'emergency',
        title: 'After-Hours Nurse Triage',
        subtitle: 'Escalating post-op complications safely',
        duration: '0:20',
        icon: AlertCircle,
        color: 'red',
        src: '/audio/demos/after-hours-triage.mp3',
        context: "User says: 'My leg is really red and hot and I'm 3 days post-op. I'm freaking out.'",
        transcript: "I hear that your leg is red and hot three days post-op. I am flagging this immediately. While I don't want you to panic, standard protocol requires us to assess this right away to rule out any complications. I am connecting you directly to Nurse Sarah..."
    },
    {
        id: 'lead',
        title: 'Instagram Lead Conversion',
        subtitle: 'Turning DM inquiries into bookings',
        duration: '0:25',
        icon: Instagram,
        color: 'purple',
        src: '/audio/demos/instagram-lead-conversion.mp3',
        context: "User DMs: 'Does the lunch break Botox really only take 15 mins? I have zero free time.'",
        transcript: "Thanks for reaching out! The 'Lunch Break' Botox is honestly a game changer. It only takes about 15 minutes, so you can come in, get refreshed, and be back to your day instantly. We have a 'Glow and Go' spot available this Thursday..."
    }
];

export const MedicalAudioDemos = () => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = (demo: AudioDemo) => {
        if (activeId === demo.id) {
            // Pause
            audioRef.current?.pause();
            setActiveId(null);
        } else {
            // Play new
            if (audioRef.current) {
                audioRef.current.src = demo.src;
                audioRef.current.play().catch(e => console.log("Audio play failed (expected without file):", e));
            }
            setActiveId(demo.id);
        }
    };

    return (
        <section className="py-24 bg-slate-900 relative">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
                        <Phone className="w-4 h-4" />
                        <span>Hear Roxanne in Action</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Don&apos;t just read about it. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            Listen to the medical accuracy.
                        </span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Hear how Roxanne handles complex medical questions, price shoppers, and emergencies with the empathy of a human staff member.
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
                                        ? 'bg-slate-800 border-cyan-500/50 shadow-2xl shadow-cyan-500/10'
                                        : 'bg-slate-950/50 border-white/10 hover:border-white/20'
                                    }
                                `}
                            >
                                {/* Icon Header */}
                                <div className={`
                                    w-14 h-14 rounded-2xl flex items-center justify-center mb-6
                                    ${demo.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                                    ${demo.color === 'red' ? 'bg-red-500/20 text-red-400' : ''}
                                    ${demo.color === 'purple' ? 'bg-purple-500/20 text-purple-400' : ''}
                                `}>
                                    <Icon className="w-7 h-7" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2">{demo.title}</h3>
                                <p className="text-slate-400 text-sm mb-8 h-10">{demo.subtitle}</p>

                                {/* Player Interface */}
                                <div className="bg-slate-900 rounded-xl p-4 mb-6 relative overflow-hidden group">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => togglePlay(demo)}
                                            className={`
                                                w-12 h-12 rounded-full flex items-center justify-center transition-all
                                                ${isActive
                                                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                                    : 'bg-white/10 text-white hover:bg-white/20'
                                                }
                                            `}
                                        >
                                            {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                                        </button>
                                        <div className="flex-1">
                                            {/* Dummy Waveform Visual */}
                                            <div className="flex items-center gap-1 h-8">
                                                {[...Array(12)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        className={`w-1 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-700'}`}
                                                        animate={isActive ? {
                                                            height: [10, Math.random() * 24 + 8, 10],
                                                            opacity: [0.5, 1, 0.5]
                                                        } : { height: 8 }}
                                                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-xs font-mono text-slate-500">{demo.duration}</span>
                                    </div>
                                </div>

                                {/* Transcript Snippet */}
                                <div className="space-y-3">
                                    <div className="text-xs font-medium text-cyan-400 uppercase tracking-wider">in response to:</div>
                                    <p className="text-sm text-slate-500 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        {demo.context}
                                    </p>

                                    <div className="relative pl-4 border-l-2 border-slate-700">
                                        <div className="text-xs font-medium text-white mb-1">Roxanne:</div>
                                        <p className="text-sm text-slate-300 italic leading-relaxed">
                                            &quot;{demo.transcript}&quot;
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Hidden Audio Element */}
                <audio ref={audioRef} onEnded={() => setActiveId(null)} className="hidden" />
            </div>
        </section>
    );
};
