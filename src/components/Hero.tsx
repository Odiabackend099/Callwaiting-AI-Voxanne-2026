"use client";

import { motion } from "framer-motion";
import { ArrowRight, Phone, Play, Pause } from "lucide-react";
import OutboundDemo from "./OutboundDemo";
import { useState, useRef } from "react";
import { SafetyDisclaimer } from "./SafetyDisclaimer";

interface HeroProps {
    onBookDemo?: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    badgeText?: string;
    ctaText?: string;
}

export default function Hero({
    onBookDemo,
    title,
    subtitle,
    badgeText = "#1 AI Receptionist for Aesthetic Clinics, Med Spas & Plastic Surgeons",
    ctaText = "Book a Demo"
}: HeroProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const toggleAudio = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black text-white pt-24 pb-20">
            {/* Subtle Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-red-900/20 via-transparent to-purple-900/20 rounded-full blur-[100px]" />
            </div>

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center max-w-5xl mx-auto">

                {/* Badge - Urgent */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span className="text-xs uppercase tracking-widest text-red-400 font-bold">
                            {badgeText}
                        </span>
                    </div>
                </motion.div>

                {/* Main Headline - Reptilian Brain Target */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-[1.05]"
                >
                    {title || (
                        <>
                            Every Missed Call <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                                Is a Patient Who Chose
                            </span>
                            <br />
                            <span className="text-red-500">Your Competitor.</span>
                        </>
                    )}
                </motion.h1>

                {/* Safety Disclaimer - Immediately Visible */}
                <SafetyDisclaimer />

                {/* Subheadline - Pain + Solution */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed"
                >
                    {subtitle || (
                        <>
                            Voxanne captures every lead, 24/7. Your competition already installed her.
                            She&apos;s <strong className="text-white font-semibold">safe</strong>, compliant, and books revenue for your aesthetic practice while you sleep.
                        </>
                    )}
                </motion.p>

                {/* PRIMARY CTA - The Demo Call */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="w-full max-w-xl mb-8"
                >
                    <p className="text-white font-medium mb-4 flex items-center justify-center gap-2 text-sm uppercase tracking-wide opacity-80">
                        <Phone className="w-4 h-4 text-cyan-400" />
                        Hear Voxanne Now - Call in 10 Seconds
                    </p>
                    <OutboundDemo />
                </motion.div>

                {/* Secondary CTA - Visible Button */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="flex flex-col sm:flex-row items-center gap-6 mb-12"
                >
                    <button
                        onClick={onBookDemo}
                        className="group px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-slate-200 transition-all duration-300 flex items-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
                    >
                        {ctaText}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <span className="text-slate-500 text-sm">No credit card required • Set up in 15 mins</span>
                </motion.div>

                {/* Audio Demo Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="flex items-center gap-3 text-slate-500 text-sm bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => {
                        const proofSection = document.getElementById('proof-section');
                        if (proofSection) proofSection.scrollIntoView({ behavior: 'smooth' });
                    }}
                >
                    <span className="flex items-center gap-2">
                        <Play className="w-3 h-3 fill-current" />
                        Listen to difficult caller recording
                    </span>
                </motion.div>

            </div>
        </section>
    );
}
