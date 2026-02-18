'use client';

import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { VideoModal } from '@/components/VideoModal';
import { getInboundAgentConfig } from '@/lib/supabaseHelpers';
import Link from 'next/link';
import WorkflowHeroAnimation from '@/components/hero-demo/WorkflowHeroAnimation';

export function HeroCalendlyReplica() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

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

    return (
        <section className="relative min-h-screen overflow-hidden">
            {/* Split background: White left (60%), Blue right (40%) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-y-0 left-0 w-[60%] bg-white" />
                <div className="absolute inset-y-0 right-0 w-[40%] bg-gradient-to-br from-surgical-500 to-surgical-600" />
            </div>

            <div className="section-container relative z-10 pt-32 sm:pt-40 pb-16 sm:pb-24">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[75vh]">

                    {/* LEFT COLUMN: Copy */}
                    <div className="max-w-xl space-y-8 md:space-y-10">
                        {/* Bold geometric headline — matches reference */}
                        <h1 className="font-sans font-bold text-[2.75rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] tracking-tight text-obsidian leading-[1.08]">
                            Deploy a digital employee that{' '}
                            <span className="font-sans font-semibold text-surgical-600">never&nbsp;sleeps.</span>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg sm:text-xl text-obsidian/60 leading-relaxed max-w-lg">
                            Answers every call on the first ring, never takes a sick day, and works holidays.
                            Stop losing revenue to missed calls.
                        </p>

                        {/* CTA Buttons — sharper, IEQ-style */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 md:pt-6">
                            <Link href="/start">
                                <button
                                    className="btn-fill w-full sm:w-auto bg-surgical-600 text-white px-10 py-4 text-sm font-semibold rounded-lg tracking-wide uppercase hover:text-white transition-all duration-500"
                                >
                                    Get Started
                                </button>
                            </Link>
                            <button
                                className="w-full sm:w-auto bg-transparent text-obsidian/70 border border-surgical-200 hover:border-surgical-400 px-10 py-4 text-sm font-semibold rounded-lg tracking-wide uppercase hover:text-obsidian transition-all duration-500 flex items-center justify-center gap-2"
                                onClick={() => setIsDemoModalOpen(true)}
                            >
                                <Play className="h-4 w-4 fill-current" />
                                Watch Demo
                            </button>
                        </div>

                        {/* Trust Badges — restrained */}
                        <div className="pt-10 md:pt-14">
                            <p className="text-xs text-obsidian/40 font-medium mb-4 uppercase tracking-widest">
                                Trusted by 47 Clinics
                            </p>
                            <div className="flex flex-wrap gap-6 md:gap-10 opacity-50 hover:opacity-70 transition-opacity duration-500 items-center">
                                <span className="font-medium text-sm md:text-base text-obsidian tracking-wide">DermCare</span>
                                <span className="font-medium text-sm md:text-base text-obsidian tracking-wide">EliteMed</span>
                                <span className="font-medium text-sm md:text-base text-obsidian tracking-wide hidden sm:inline">AestheticPro</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Workflow Animation */}
                    <div className="relative hidden lg:flex items-center justify-center w-full h-full min-h-[500px] z-10 overflow-hidden">
                        <WorkflowHeroAnimation />
                    </div>
                </div>
            </div>

            {/* Video Demo Modal */}
            <VideoModal
                isOpen={isDemoModalOpen}
                onClose={() => setIsDemoModalOpen(false)}
                videoSrc="/demo/voxanne-testimonial.mp4"
                title="Voxanne AI Platform Demo"
            />
        </section>
    );
}
