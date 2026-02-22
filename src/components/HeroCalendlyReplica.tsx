'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, ArrowRight, Phone, Calendar, Shield } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { VideoModal } from '@/components/VideoModal';
import { getInboundAgentConfig } from '@/lib/supabaseHelpers';
import Link from 'next/link';
import WorkflowHeroAnimation from '@/components/hero-demo/WorkflowHeroAnimation';

const statPills = [
    { icon: Phone, label: '24/7', sub: 'Always On', color: 'from-surgical-600 to-surgical-700' },
    { icon: Calendar, label: '<1s', sub: 'Response', color: 'from-surgical-500 to-surgical-600' },
    { icon: Shield, label: 'HIPAA', sub: 'Compliant', color: 'from-surgical-700 to-surgical-800' },
];

const containerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, ease: 'easeOut' as const },
    },
};

export function HeroCalendlyReplica() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    // Framer Motion v12 + Next.js App Router: initial="hidden" renders opacity:0 on the
    // server and animations only fire after client hydration. isMounted gates animate so
    // the stagger runs reliably after mount regardless of React Strict Mode double-invocation.
    const [isMounted, setIsMounted] = useState(false);
    const heroRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const pillY = useTransform(scrollYProgress, [0, 1], [0, -60]);
    const demoY = useTransform(scrollYProgress, [0, 1], [0, 40]);

    useEffect(() => {
        setIsMounted(true);
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

    return (
        <section ref={heroRef} className="relative min-h-screen overflow-hidden" id="hero">
            {/* ── Split background: White left (60%), Blue right (40%) ── */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-y-0 left-0 w-[60%] bg-white" />
                <div className="absolute inset-y-0 right-0 w-[40%] bg-gradient-to-br from-surgical-500 to-surgical-700" />
                {/* Crisp diagonal separator — eliminates any bleed */}
                <div className="absolute inset-y-0 left-[58%] w-[6%] bg-gradient-to-r from-white to-surgical-500" />
            </div>

            {/* ── Decorative dots (left panel) ── */}
            <div className="absolute top-0 left-0 w-[50%] h-full z-0 opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #1D4ED8 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            {/* ── Blue panel ambient glow (right panel only) ── */}
            <div className="absolute top-0 right-0 w-[40%] h-full z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] rounded-full bg-white/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full bg-surgical-400/20 blur-[60px]" />
            </div>

            <div className="section-container relative z-10 pt-32 sm:pt-40 pb-16 sm:pb-24">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[75vh]">

                    {/* ── LEFT COLUMN: Copy ── */}
                    <motion.div
                        className="max-w-xl space-y-8 md:space-y-10"
                        variants={containerVariants}
                        initial="hidden"
                        animate={isMounted ? "visible" : "hidden"}
                    >
                        {/* Eyebrow badge */}
                        <motion.div variants={itemVariants}>
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surgical-50 border border-surgical-200 text-xs font-semibold text-surgical-700 uppercase tracking-widest">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surgical-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-surgical-600" />
                                </span>
                                #1 AI Receptionist for Clinics
                            </span>
                        </motion.div>

                        {/* Bold geometric headline */}
                        <motion.h1
                            variants={itemVariants}
                            className="font-sans font-bold text-[2.75rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] tracking-tight text-obsidian leading-[1.08]"
                        >
                            Deploy a digital{' '}
                            <br className="hidden md:block" />
                            employee that{' '}
                            <span className="relative inline-block">
                                <span className="relative z-10 font-sans font-semibold text-surgical-600">
                                    never&nbsp;sleeps.
                                </span>
                                {/* Underline accent */}
                                <motion.span
                                    className="absolute bottom-1 left-0 h-[3px] bg-surgical-400/50 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    transition={{ delay: 0.9, duration: 0.6, ease: 'easeOut' }}
                                />
                            </span>
                        </motion.h1>

                        {/* Subheadline */}
                        <motion.p
                            variants={itemVariants}
                            className="text-lg sm:text-xl text-obsidian/60 leading-relaxed max-w-lg"
                        >
                            Answers every call on the first ring, never takes a sick day, and works holidays.{' '}
                            Stop losing revenue to missed calls.
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
                            <Link href="/start">
                                <motion.button
                                    whileHover={{ scale: 1.04, boxShadow: '0 8px 30px rgba(29,78,216,0.35)' }}
                                    whileTap={{ scale: 0.97 }}
                                    className="relative group w-full sm:w-auto bg-surgical-600 text-white px-10 py-4 text-sm font-semibold rounded-lg tracking-wide uppercase overflow-hidden transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    {/* Shimmer sweep */}
                                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]" />
                                    <span className="relative z-10">GET STARTED</span>
                                    <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                                </motion.button>
                            </Link>
                            <motion.button
                                whileHover={{ scale: 1.03, borderColor: '#1D4ED8' }}
                                whileTap={{ scale: 0.97 }}
                                className="w-full sm:w-auto bg-transparent text-obsidian/70 border border-surgical-200 hover:border-surgical-400 px-10 py-4 text-sm font-semibold rounded-lg tracking-wide uppercase hover:text-obsidian transition-all duration-300 flex items-center justify-center gap-2"
                                onClick={() => setIsDemoModalOpen(true)}
                            >
                                <Play className="h-4 w-4 fill-current" />
                                WATCH DEMO
                            </motion.button>
                        </motion.div>

                        {/* Floating stat pills */}
                        <motion.div
                            variants={itemVariants}
                            style={{ y: pillY }}
                            className="flex flex-wrap gap-3 pt-2"
                        >
                            {statPills.map((pill, i) => (
                                <motion.div
                                    key={pill.label}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={isMounted ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                                    transition={{ delay: 0.7 + i * 0.1, duration: 0.4, ease: 'backOut' }}
                                    whileHover={{ y: -3, boxShadow: '0 8px 20px rgba(29,78,216,0.15)' }}
                                    className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-surgical-100 shadow-sm cursor-default"
                                >
                                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${pill.color} flex items-center justify-center flex-shrink-0`}>
                                        <pill.icon className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-obsidian leading-none">{pill.label}</p>
                                        <p className="text-[10px] text-obsidian/50 leading-none mt-0.5">{pill.sub}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Trust logos */}
                        <motion.div variants={itemVariants} className="pt-4">
                            <p className="text-xs text-obsidian/40 font-medium mb-4 uppercase tracking-widest">
                                Trusted by Real Clinics
                            </p>
                            <div className="flex flex-wrap gap-6 md:gap-10 items-center">
                                {['Dr. Martinez', 'Dr. Chen', 'Dr. Williams'].map((name, i) => (
                                    <motion.span
                                        key={name}
                                        initial={{ opacity: 0 }}
                                        animate={isMounted ? { opacity: 0.45 } : { opacity: 0 }}
                                        transition={{ delay: 1 + i * 0.15 }}
                                        whileHover={{ opacity: 0.75 }}
                                        className="font-medium text-sm md:text-base text-obsidian tracking-wide transition-opacity duration-300 cursor-default"
                                    >
                                        {name}
                                    </motion.span>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* ── RIGHT COLUMN: Workflow Animation ── */}
                    {/* Key fix: bg-transparent + overflow-visible so no color bleed */}
                    <motion.div
                        style={{ y: demoY }}
                        className="relative hidden lg:flex items-center justify-center w-full h-full min-h-[520px] z-10"
                        initial={{ opacity: 0, x: 40 }}
                        animate={isMounted ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
                        transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
                    >
                        {/* Subtle glow ring behind demo */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[80%] h-[80%] rounded-3xl bg-white/15 blur-2xl" />
                        </div>
                        <WorkflowHeroAnimation />
                    </motion.div>
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
