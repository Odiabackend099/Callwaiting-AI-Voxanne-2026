"use client";

import { motion } from "framer-motion";
import OutboundDemo from "./OutboundDemo";
import HeroAudioPlayer from "./HeroAudioPlayer";

interface HeroProps {
    onBookDemo?: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    badgeText?: string;
    ctaText?: string;
}

export default function Hero({
    onBookDemo,
    title = <>Stop <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-800">Bleeding Revenue.</span></>,
    subtitle = <>Roxanne answers every missed call, qualifies BBL & Rhinoplasty leads instantly, and books patients directly into your EMR.<br /><span className="text-white font-medium">She doesn&apos;t just save you money—she actively drives revenue and delivers exceptional ROI.</span></>,
    badgeText = "The #1 AI Receptionist for Clinics & Spas",
    ctaText = "Book Your Strategy Call"
}: HeroProps) {
    return (
        <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black text-white">
            {/* Background Ambience */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow [animation-delay:1s]" />
            </div>

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-6"
                >
                    <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-sm font-light tracking-wider uppercase backdrop-blur-md">
                        {badgeText}
                    </span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
                >
                    {title}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                    className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 font-light leading-relaxed"
                >
                    {subtitle}
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                    className="flex flex-col items-center gap-6 w-full"
                >
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <button
                            onClick={onBookDemo}
                            className="px-8 py-4 bg-white text-black rounded-full text-lg font-semibold hover:bg-slate-200 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
                        >
                            {ctaText}
                        </button>
                    </div>

                    <div className="w-full max-w-2xl mt-8 flex flex-col items-center gap-8">
                        {/* Passive Audio Experience */}
                        <HeroAudioPlayer />

                        {/* Active Divider */}
                        <div className="flex items-center gap-4 w-full opacity-50">
                            <div className="h-[1px] bg-white/20 flex-1" />
                            <span className="text-xs uppercase tracking-widest text-slate-500">OR Try It Live</span>
                            <div className="h-[1px] bg-white/20 flex-1" />
                        </div>

                        {/* Active Call Experience */}
                        <div className="w-full max-w-md">
                            <p className="text-center text-sm text-slate-500 mb-3 uppercase tracking-widest font-medium">
                                Enter your number to get a call:
                            </p>
                            <OutboundDemo />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Scroll</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-slate-500 to-transparent opacity-50" />
            </motion.div>
        </section>
    );
}
