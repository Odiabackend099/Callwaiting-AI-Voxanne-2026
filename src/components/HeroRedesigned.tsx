"use client";

import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { useState, useRef } from "react";
import { ParallaxBackground, FadeInOnScroll } from "./ParallaxSection";

interface HeroRedesignedProps {
    onBookDemo?: () => void;
}

export default function HeroRedesigned({ onBookDemo }: HeroRedesignedProps) {
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
        <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-gradient-cream-sage pt-24 pb-20">
            {/* Parallax Background Elements */}
            <ParallaxBackground speed={0.3} className="z-0">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-deep/10 via-transparent to-cyan/10 rounded-full blur-[100px]" />
            </ParallaxBackground>

            <ParallaxBackground speed={0.5} className="z-0">
                <div className="absolute bottom-1/4 right-0 w-[600px] h-[300px] bg-gradient-to-l from-sage-dark/20 via-transparent to-transparent rounded-full blur-[80px]" />
            </ParallaxBackground>

            {/* Main Content */}
            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center max-w-5xl mx-auto">
                {/* Badge */}
                <FadeInOnScroll delay={0.1}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-6"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage border border-sage-dark">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan"></span>
                            </span>
                            <span className="text-sm font-semibold text-blue-deep">
                                #1 AI Receptionist for Aesthetic Clinics
                            </span>
                        </div>
                    </motion.div>
                </FadeInOnScroll>

                {/* Main Headline */}
                <FadeInOnScroll delay={0.2}>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1] text-charcoal"
                    >
                        Every Missed Call <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-deep via-cyan to-lime">
                            Is Revenue Lost
                        </span>
                    </motion.h1>
                </FadeInOnScroll>

                {/* Subheadline */}
                <FadeInOnScroll delay={0.3}>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg md:text-xl text-charcoal/80 mb-8 max-w-2xl leading-relaxed"
                    >
                        CallWaiting AI handles patient calls 24/7, books appointments, answers questions, and qualifies leads—so your team focuses on care.
                    </motion.p>
                </FadeInOnScroll>

                {/* CTA Buttons */}
                <FadeInOnScroll delay={0.4}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 mb-12"
                    >
                        <button
                            onClick={onBookDemo}
                            className="px-8 py-4 bg-blue-deep text-cream font-semibold rounded-lg hover:bg-blue-deep/90 transition-all duration-300 hover:shadow-card-hover flex items-center justify-center gap-2 group"
                        >
                            Book a Demo
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            className="px-8 py-4 bg-sage text-charcoal font-semibold rounded-lg hover:bg-sage-dark transition-all duration-300 hover:shadow-card-hover flex items-center justify-center gap-2"
                        >
                            <Phone className="w-5 h-5" />
                            See Live Demo
                        </button>
                    </motion.div>
                </FadeInOnScroll>

                {/* Audio Demo */}
                <FadeInOnScroll delay={0.5}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="w-full max-w-md"
                    >
                        <div className="bg-cream rounded-lg p-6 shadow-card border border-gray-light">
                            <p className="text-sm font-semibold text-charcoal mb-4">Hear it in action:</p>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={toggleAudio}
                                    className="flex-shrink-0 w-12 h-12 bg-cyan text-cream rounded-full flex items-center justify-center hover:bg-cyan/90 transition-colors"
                                >
                                    {isPlaying ? '⏸' : '▶'}
                                </button>
                                <div className="flex-1">
                                    <p className="text-sm text-charcoal font-medium">Patient Call Recording</p>
                                    <p className="text-xs text-charcoal/60">Real AI receptionist handling a patient inquiry</p>
                                </div>
                            </div>
                            <audio
                                ref={audioRef}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />
                        </div>
                    </motion.div>
                </FadeInOnScroll>

                {/* Trust Indicators */}
                <FadeInOnScroll delay={0.6}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="mt-16 pt-8 border-t border-sage-dark flex flex-col sm:flex-row gap-8 justify-center text-charcoal/70"
                    >
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-deep">98%</p>
                            <p className="text-sm">Call Completion Rate</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-cyan">24/7</p>
                            <p className="text-sm">Always Available</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-lime">HIPAA</p>
                            <p className="text-sm">Compliant & Secure</p>
                        </div>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
