'use client';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
import {
    Bot, Clock, Shield, BarChart3, Zap, Mic,
    Activity, Lock, CheckCircle2, TrendingUp, Sparkles, Headphones
} from 'lucide-react';

// ── Advanced Layered Icon Compositions ───────────────────────────────────────

const BotIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center group-hover:[--ring-scale:1.15] transition-all duration-500">
        {/* Orbital pulse ring */}
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-surgical-400/30"
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Main square icon */}
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-surgical-500 to-surgical-700 rounded-xl flex items-center justify-center shadow-lg shadow-surgical-500/30 group-hover:scale-110 transition-transform duration-500">
            <Bot className="text-white w-6 h-6" />
        </div>
        {/* Accent badge */}
        <div className="absolute -right-1.5 -top-1.5 w-6 h-6 bg-white rounded-full border border-surgical-100 shadow-sm flex items-center justify-center">
            <Activity className="w-3 h-3 text-surgical-500" />
        </div>
    </div>
);

const ClockIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-surgical-300/40"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-surgical-400 to-surgical-600 rounded-xl flex items-center justify-center shadow-lg shadow-surgical-400/30 group-hover:scale-110 transition-transform duration-500">
            <Clock className="text-white w-6 h-6" />
        </div>
        <div className="absolute -right-1.5 -bottom-1.5 w-6 h-6 bg-white rounded-full border border-surgical-100 shadow-sm flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-surgical-600" />
        </div>
    </div>
);

const ShieldIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-obsidian/10"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-obsidian to-obsidian/80 rounded-xl flex items-center justify-center shadow-lg shadow-obsidian/20 group-hover:scale-110 transition-transform duration-500">
            <Shield className="text-white w-6 h-6" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 w-6 h-6 bg-white rounded-full border border-surgical-100 shadow-sm flex items-center justify-center">
            <Lock className="w-3 h-3 text-obsidian" />
        </div>
    </div>
);

const AnalyticsIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-surgical-200"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        />
        <div className="relative z-10 w-12 h-12 bg-white border border-surgical-100 rounded-xl flex items-center justify-center shadow-lg shadow-surgical-200/50 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 className="text-surgical-600 w-6 h-6" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 w-6 h-6 bg-surgical-50 rounded-full border border-surgical-100 shadow-sm flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-surgical-600" />
        </div>
    </div>
);

const SetupIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-surgical-500/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        />
        <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-surgical-100 to-surgical-200 rounded-xl flex items-center justify-center border border-surgical-300 shadow-lg shadow-surgical-200/50 group-hover:scale-110 transition-transform duration-500">
            <Zap className="text-surgical-700 w-6 h-6 fill-surgical-700" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 w-6 h-6 bg-white rounded-full border border-surgical-200 shadow-sm flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-surgical-600" />
        </div>
    </div>
);

const VoiceIcon = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-surgical-400/40"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        />
        {/* Realistic Image for Human-Like Voice */}
        <div className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-surgical-400/30 group-hover:scale-110 transition-transform duration-500 overflow-hidden border border-surgical-200">
            <Image src="/roxan_voice_interface.png" alt="Voice interface" width={48} height={48} className="object-cover w-full h-full" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 w-6 h-6 bg-white rounded-full border border-surgical-100 shadow-sm flex items-center justify-center">
            <Headphones className="w-3 h-3 text-surgical-600" />
        </div>
    </div>
);

// ── Feature Data ──────────────────────────────────────────────────────────────

const features = [
    {
        IconComponent: BotIcon,
        title: 'AI Receptionist 24/7',
        description: 'Never miss a call, even at 2 AM. Your AI receptionist works around the clock.',
        stat: '100% Uptime',
        statColor: 'bg-surgical-50 text-surgical-700 border-surgical-100',
        gradientLine: 'from-surgical-400 via-surgical-500 to-surgical-600',
        colSpan: 'md:col-span-2',
    },
    {
        IconComponent: ClockIcon,
        title: 'Instant Responses',
        description: 'Patients get answers in under 1 second. No hold music, no waiting.',
        stat: '<1s Response',
        statColor: 'bg-white text-surgical-600 border-surgical-200',
        gradientLine: 'from-surgical-300 via-surgical-400 to-surgical-500',
        colSpan: '',
    },
    {
        IconComponent: ShieldIcon,
        title: 'UK GDPR & HIPAA Compliant',
        description: 'Enterprise-grade security with full UK GDPR and HIPAA compliance built-in.',
        statColor: 'bg-obsidian/5 text-obsidian border-obsidian/10',
        gradientLine: 'from-obsidian/70 via-obsidian to-obsidian/70',
        colSpan: '',
    },
    {
        IconComponent: AnalyticsIcon,
        title: 'Real-Time Analytics',
        description: 'Track every call, booking, and revenue opportunity from your dashboard.',
        statColor: 'bg-surgical-50 text-surgical-800 border-surgical-200',
        gradientLine: 'from-surgical-200 via-surgical-300 to-surgical-400',
        colSpan: '',
    },
    {
        IconComponent: SetupIcon,
        title: '15-Minute Setup',
        description: 'Upload your knowledge base, connect your calendar, and go live.',
        stat: '15 min',
        statColor: 'bg-white text-surgical-700 border-surgical-300',
        gradientLine: 'from-surgical-100 via-surgical-200 to-surgical-300',
        colSpan: '',
    },
    {
        IconComponent: VoiceIcon,
        title: 'Human-Like Voice',
        description: 'Natural conversations that patients trust. 98% satisfaction rate.',
        stat: '98% Satisfaction',
        statColor: 'bg-surgical-600 text-white border-surgical-500 shadow-sm',
        gradientLine: 'from-surgical-500 via-surgical-600 to-surgical-700',
        colSpan: 'md:col-span-2',
    },
];

// ── Tilt Card Wrapper ─────────────────────────────────────────────────────────

function TiltCard({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inViewRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(inViewRef, { once: true, margin: '-50px' });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
        ref.current.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) translateZ(4px)`;
    };

    const handleMouseLeave = () => {
        if (!ref.current) return;
        ref.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
    };

    return (
        <div ref={inViewRef} className={colSpan}>
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ transformStyle: 'preserve-3d', transition: 'box-shadow 0.3s ease' }}
                whileHover={{ boxShadow: '0 20px 50px rgba(29,78,216,0.10)' }}
                className={`group relative rounded-2xl border border-surgical-100 bg-white p-8 overflow-hidden cursor-default w-full h-full ${className}`}
            >
                {children}
            </motion.div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FeaturesBentoGrid() {
    return (
        <section id="features" className="py-32 bg-white relative overflow-hidden">
            {/* Subtle background grid */}
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(#1D4ED8 1px, transparent 1px), linear-gradient(90deg, #1D4ED8 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

            <div className="section-container relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-20"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-surgical-50 border border-surgical-100 rounded-full text-xs font-semibold text-surgical-700 uppercase tracking-widest mb-6">
                        <Sparkles className="w-3 h-3" />
                        Core Features
                    </span>
                    <h2 className="mb-5 font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-obsidian tracking-tight">
                        Everything Your Front Desk Does.
                        <br />
                        <span className="font-sans font-semibold text-surgical-600">Just Faster.</span>
                    </h2>
                    <p className="text-lg text-obsidian/50 max-w-2xl mx-auto">
                        Powered by AI that sounds human, works 24/7, and integrates with your existing tools.
                    </p>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-4">
                    {features.map((feature, index) => (
                        <TiltCard key={feature.title} colSpan={feature.colSpan}>
                            {/* Animated top gradient line on hover */}
                            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${feature.gradientLine} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                            {/* Subtle corner glow */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-surgical-50/80 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="mb-6">
                                <feature.IconComponent />
                            </div>

                            {feature.stat && (
                                <motion.div
                                    initial={{ opacity: 0, x: -8 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.2 + index * 0.05 }}
                                    className={`mb-4 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${feature.statColor}`}
                                >
                                    {feature.stat}
                                </motion.div>
                            )}

                            <h3 className="mb-3 text-xl font-semibold text-obsidian group-hover:text-surgical-700 transition-colors duration-300">
                                {feature.title}
                            </h3>
                            <p className="text-obsidian/55 leading-relaxed text-sm">
                                {feature.description}
                            </p>
                        </TiltCard>
                    ))}
                </div>
            </div>
        </section>
    );
}
