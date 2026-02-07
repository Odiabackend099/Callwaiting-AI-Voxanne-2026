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

export function HeroCalendlyReplica() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

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
            {/* ✅ UPDATED: Background Blob with Approved Colors */}
            <div className="absolute right-0 top-0 h-full w-[55%] bg-surgical-blue rounded-bl-[200px] z-0 hidden lg:block overflow-hidden">
                {/* Subtle gradient overlay for depth */}
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
                        <h1 className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.15] md:leading-[1.1]">
                            Deploy a digital employee that{' '}
                            <span className="text-blue-600 block sm:inline">never sleeps.</span>
                        </h1>

                        {/* Subheadline with improved mobile sizing */}
                        <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-lg">
                            Answers every call on the first ring, never takes a sick day, and works holidays.
                            Stop losing revenue to missed calls.
                        </p>

                        {/* CTA Buttons - optimized for mobile */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 md:pt-4">
                            <Link href="/start">
                                <Button
                                    size="lg"
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 sm:py-7 text-base sm:text-lg rounded-full font-semibold shadow-lg shadow-blue-200 transition-transform hover:scale-105 active:scale-95"
                                >
                                    Get Started
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-slate-300 px-8 py-6 sm:py-7 text-base sm:text-lg rounded-full font-semibold transition-transform hover:scale-105 active:scale-95"
                                onClick={handleDemoClick}
                            >
                                <Play className="mr-2 h-5 w-5 fill-slate-900" />
                                Watch Demo
                            </Button>
                        </div>

                        {/* Trust Badges - better mobile organization */}
                        <div className="pt-6 md:pt-8">
                            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-3 sm:mb-4 uppercase tracking-wider">
                                Trusted by 500+ Clinics
                            </p>
                            <div className="flex flex-wrap gap-4 sm:gap-6 md:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all items-center">
                                {/* Refined Logo Placeholders - mobile optimized */}
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-800 rounded-full flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-slate-800 whitespace-nowrap">DermCare</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-800 rounded-sm flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-slate-800 whitespace-nowrap">EliteMed</span>
                                </div>
                                <div className="flex items-center gap-2 hidden sm:flex">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-800 rotate-45 flex-shrink-0" />
                                    <span className="font-bold text-base sm:text-lg md:text-xl text-slate-800 whitespace-nowrap">AestheticPro</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Workflow Animation - hidden on mobile/tablet */}
                    <div className="relative h-[600px] hidden lg:flex items-center justify-center">
                        <div className="relative w-full max-w-lg perspective-1000">
                            {/* Base Card Container with Glass Morphism */}
                            <GlassMorphCard
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.8 }}
                                blur="xl"
                                opacity="medium"
                                border={true}
                                className="p-8 relative z-20"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-bold text-slate-900">Live Workflow</h3>
                                    <div className="flex gap-2">
                                        <motion.div 
                                            animate={{ scale: activeStep === 0 ? 1.2 : 1, backgroundColor: activeStep === 0 ? '#3B82F6' : '#E2E8F0' }}
                                            className="w-3 h-3 rounded-full" 
                                        />
                                        <motion.div 
                                            animate={{ scale: activeStep === 1 ? 1.2 : 1, backgroundColor: activeStep === 1 ? '#3B82F6' : '#E2E8F0' }}
                                            className="w-3 h-3 rounded-full" 
                                        />
                                        <motion.div 
                                            animate={{ scale: activeStep >= 2 ? 1.2 : 1, backgroundColor: activeStep >= 2 ? '#3B82F6' : '#E2E8F0' }}
                                            className="w-3 h-3 rounded-full" 
                                        />
                                    </div>
                                </div>

                                <div className="relative min-h-[320px]">
                                    <AnimatePresence mode="wait">
                                        {/* Step 1: Incoming Call */}
                                        {activeStep === 0 && (
                                            <motion.div 
                                                key="step1"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className="space-y-4"
                                            >
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shadow-sm">
                                                        <Phone className="w-7 h-7 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-lg">Incoming Call</p>
                                                        <p className="text-sm text-slate-500">Patient calling...</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
                                                    <div className="flex gap-3">
                                                        <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0" />
                                                        <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700 leading-relaxed">
                                                            "Do you have any openings for a consultation tomorrow?"
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 flex-row-reverse">
                                                        <div className="w-8 h-8 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center shadow-md">
                                                            <span className="text-white text-xs font-bold">AI</span>
                                                        </div>
                                                        <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none shadow-md text-sm leading-relaxed">
                                                            "Yes, Dr. Smith has an opening at 2:00 PM. Shall I book that for you?"
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Step 2: Booking */}
                                        {activeStep === 1 && (
                                            <motion.div 
                                                key="step2"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className="space-y-6"
                                            >
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center shadow-sm">
                                                        <Calendar className="w-7 h-7 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-lg">Calendar Sync</p>
                                                        <p className="text-sm text-slate-500">Booking appointment...</p>
                                                    </div>
                                                </div>

                                                <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
                                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                                        <span className="font-bold text-slate-900">Tomorrow</span>
                                                        <span className="text-blue-600 text-sm font-medium bg-blue-50 px-2 py-1 rounded-md">Confirmed</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3 p-2 rounded-lg">
                                                            <div className="w-2 h-2 bg-slate-400 rounded-full" />
                                                            <span className="text-sm text-slate-500">1:00 PM - Unavailable</span>
                                                        </div>
                                                        <motion.div 
                                                            initial={{ scale: 0.95, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 shadow-sm"
                                                        >
                                                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                                            <span className="text-sm font-bold text-slate-900">2:00 PM - New Patient Consult</span>
                                                        </motion.div>
                                                        <div className="flex items-center gap-3 p-2 rounded-lg">
                                                            <div className="w-2 h-2 bg-slate-400 rounded-full" />
                                                            <span className="text-sm text-slate-500">3:00 PM - Follow-up</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Step 3: SMS */}
                                        {activeStep >= 2 && (
                                            <motion.div 
                                                key="step3"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className="space-y-6"
                                            >
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shadow-sm">
                                                        <MessageSquare className="w-7 h-7 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-lg">SMS Confirmation</p>
                                                        <p className="text-sm text-slate-500">Sent to patient</p>
                                                    </div>
                                                </div>

                                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
                                                    <div className="flex gap-4 items-start">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <span className="font-bold text-slate-600">V</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-slate-900">Voxanne AI</p>
                                                            <p className="text-sm text-slate-600 leading-relaxed">
                                                                Hi! Your appointment with Dr. Smith is confirmed for tomorrow at 2:00 PM. Reply C to confirm.
                                                            </p>
                                                            <p className="text-xs text-slate-400">Just now</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <motion.div 
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ delay: 0.5 }}
                                                    className="flex justify-center pt-4"
                                                >
                                                    <div className="bg-green-100 text-green-700 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Workflow Complete
                                                    </div>
                                                </motion.div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </GlassMorphCard>

                            {/* Floating Elements behind */}
                            <motion.div 
                                animate={{ y: [0, -15, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-12 -right-12 bg-white p-5 rounded-2xl shadow-xl z-10 hidden md:block border border-slate-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <span className="text-green-600 font-bold text-xl">£</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Revenue Saved</p>
                                        <p className="font-bold text-slate-900 text-lg">£120.00</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div 
                                animate={{ y: [0, 15, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute -bottom-8 -left-8 bg-white p-5 rounded-2xl shadow-xl z-30 hidden md:block border border-slate-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <p className="font-bold text-slate-900 text-base">Zero Wait Time</p>
                                </div>
                            </motion.div>
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
        </section>
    );
}
