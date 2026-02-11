'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Phone, Calendar, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoModal } from '@/components/VideoModal';
import { GlassMorphCard } from '@/components/ui/GlassMorphCard';
import { AmbientOrbs, GradientOrb } from '@/components/ui/AmbientOrbs';
import { getInboundAgentConfig } from '@/lib/supabaseHelpers';
import Link from 'next/link';
import HeroDemoCard from '@/components/hero-demo-v2/HeroDemoCard';

export function HeroCalendlyReplica() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    const [isInlineDemoActive, setIsInlineDemoActive] = useState(false);

    // Animation sequence
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 4); // 0: Call, 1: Booking, 2: SMS, 3: Pause
        }, 3500); // Slightly slower for better readability
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        async function fetchAgent() {
            try {
                const config = await getInboundAgentConfig();
                if (config?.vapi_assistant_id) {
                    setAgentId(config.vapi_assistant_id);
                }
            } catch (error) {
                console.error('Failed to fetch agent config:', error);
            }
        }
        fetchAgent();
    }, []);

    const handleDemoClick = () => {
        setIsDemoModalOpen(true);
    };

    return (
        <section className="relative min-h-[85vh] sm:min-h-[90vh] overflow-hidden bg-white pt-16 sm:pt-20 pb-8 sm:pb-0">
            {/* ✅ UPDATED: Dynamic Hero Section (Demo Container) */}
            {/* ✅ UPDATED: Static Blue Blob Background */}
            <div className="absolute right-0 top-0 h-full w-[55%] bg-surgical-blue rounded-bl-[200px] z-0 hidden lg:block overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-surgical-blue to-clinical-blue opacity-100" />

                {/* Ambient floating orbs for 2025 AI design aesthetic */}
                <AmbientOrbs
                    count={4}
                    colors={['clinical-blue', 'sky-mist', 'surgical-blue']}
                    className="opacity-20"
                />

                {/* Decorative organic shapes */}
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-white opacity-5 rounded-full blur-3xl" />
                <GradientOrb
                    size={300}
                    color="sky-mist"
                    opacity={0.15}
                    className="bottom-[-10%] left-[-5%]"
                />
            </div>

            <div className="container mx-auto px-4 sm:px-6 h-full relative z-10">
                <div className="grid lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center min-h-[75vh] sm:min-h-[80vh]">

                    {/* LEFT COLUMN: Copy */}
                    <div className="max-w-xl space-y-6 md:space-y-8">
                        {/* Headline with better mobile line breaks */}
                        <h1 className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-obsidian leading-[1.15] md:leading-[1.1]">
                            Deploy a digital employee that{' '}
                            <span className="text-surgical-600 block sm:inline">never sleeps.</span>
                        </h1>

                        {/* Subheadline with improved mobile sizing */}
                        <p className="text-lg sm:text-xl text-obsidian/70 leading-relaxed max-w-lg">
                            Answers every call on the first ring, never takes a sick day, and works holidays.
                            Stop losing revenue to missed calls.
                        </p>

                        {/* CTA Buttons - optimized for mobile */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 md:pt-4">
                            <Link href="/start">
                                <Button
                                    size="lg"
                                    className="w-full sm:w-auto bg-surgical-600 hover:bg-surgical-700 text-white px-8 py-6 sm:py-7 text-base sm:text-lg rounded-full font-semibold shadow-lg shadow-surgical-600/25 hover:shadow-xl hover:shadow-surgical-600/35 hover:scale-105 active:scale-95 transition-all duration-200"
                                >
                                    Get Started
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto bg-white hover:bg-surgical-50 text-obsidian border-2 border-surgical-200 hover:border-surgical-300 px-8 py-6 sm:py-7 text-base sm:text-lg rounded-full font-semibold hover:scale-105 active:scale-95 transition-all duration-200"
                                onClick={() => setIsInlineDemoActive(true)}
                            >
                                <Play className="mr-2 h-5 w-5 fill-obsidian" />
                                Watch Demo
                            </Button>
                        </div>

                        {/* Trust Badges - better mobile organization */}
                        <div className="pt-6 md:pt-8">
                            <p className="text-xs sm:text-sm text-obsidian/50 font-medium mb-3 sm:mb-4 uppercase tracking-wider">
                                Trusted by 47 Clinics
                            </p>
                            <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all items-center">
                                {/* Refined Logo Placeholders - mobile optimized */}
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-obsidian rounded-full flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-obsidian whitespace-nowrap">DermCare</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-obsidian rounded-sm flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-obsidian whitespace-nowrap">EliteMed</span>
                                </div>
                                <div className="flex items-center gap-2 hidden sm:flex">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-obsidian rotate-45 flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-obsidian whitespace-nowrap">AestheticPro</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Interactive Hero Demo Card */}
                    <div className="relative hidden lg:flex items-center justify-center w-full h-full min-h-[600px] z-10 pointer-events-none">
                        <div className="w-[420px] pointer-events-auto transform transition-transform hover:scale-[1.02] duration-500">
                            <HeroDemoCard
                                isActive={isInlineDemoActive}
                                onToggle={() => setIsInlineDemoActive(!isInlineDemoActive)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Video Demo Modal */}
            <VideoModal
                isOpen={isDemoModalOpen}
                onClose={() => setIsDemoModalOpen(false)}
                videoSrc="/videos/voxanne-demo.mp4"
                title="Voxanne AI Platform Demo"
            />
        </section >
    );
}
