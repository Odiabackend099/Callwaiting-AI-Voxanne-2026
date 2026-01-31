'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, Play, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowCardsCarousel } from './hero/WorkflowCardsCarousel';
import { getInboundAgentConfig } from '@/lib/supabaseHelpers';

export function HeroCalendlyStyle() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isLoadingAgent, setIsLoadingAgent] = useState(true);

    useEffect(() => {
        async function fetchAgent() {
            try {
                const config = await getInboundAgentConfig();
                if (config?.vapi_assistant_id) {
                    setAgentId(config.vapi_assistant_id);
                }
            } catch (error) {
                console.error('Failed to fetch agent config:', error);
            } finally {
                setIsLoadingAgent(false);
            }
        }
        fetchAgent();
    }, []);

    const handleDemoClick = () => {
        if (agentId) {
            console.log('Starting demo with Agent ID:', agentId);
            // Here we would initialize the Vapi call
            alert(`Starting demo with Agent ID: ${agentId}`);
        } else {
            console.warn('Agent ID not found');
        }
    };

    return (
        <section className="relative min-h-screen overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50 to-purple-50" />

            {/* Content Grid: 60/40 split */}
            <div className="container mx-auto grid min-h-screen gap-12 px-4 py-20 md:grid-cols-[60%_40%] md:items-center">
                {/* LEFT SIDE (60%) */}
                <div className="relative z-10 space-y-8">
                    {/* UK GDPR & HIPAA Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">UK GDPR & HIPAA Compliant AI</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
                        Stop Losing $8,000<br />Per Missed Call
                    </h1>

                    {/* Subheadline */}
                    <p className="max-w-xl text-lg text-gray-600 md:text-xl">
                        AI receptionists that sound human, book appointments in real-time,
                        and never miss a revenue opportunity—even at 2 AM.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <Button size="lg" className="bg-gradient-to-r from-[#006BFF] to-[#4169FF] text-white hover:opacity-90">
                            Get Your AI Receptionist
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-white"
                            onClick={handleDemoClick}
                            disabled={isLoadingAgent}
                        >
                            {isLoadingAgent ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-4 w-4" />
                            )}
                            Watch 2-Min Demo
                        </Button>
                    </div>

                    {/* Trust Indicators */}
                    <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Setup in 15 minutes
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            No credit card
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            $0 to start
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE (40%) */}
                <div className="relative z-10">
                    <WorkflowCardsCarousel />
                </div>
            </div>
        </section>
    );
}
