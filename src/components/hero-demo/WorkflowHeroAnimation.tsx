'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone,
    Calendar,
    TrendingUp,
    MessageSquare,
    User,
    CheckCircle2,
    Clock,
    Zap,
    ArrowRight,
    ShieldCheck,
    Smartphone,
    Mail,
    CreditCard,
    FileUp,
    Mic,
    PhoneIncoming,
    CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── PHASE CONFIGURATION (3-PHASE WORKFLOW WITH SUBSTEPS) ────────────

const phases = [
    {
        id: 'setup',
        title: 'Live in 5 Minutes',
        subtitle: 'No IT department needed. Just connect and go.',
        color: 'text-surgical-600',
        bg: 'bg-surgical-50',
        accent: 'bg-surgical-600',
        icon: Zap,
        actionBadge: '5 Min Setup',
        substeps: [
            { icon: Phone, label: 'Get Number', duration: 2000 },
            { icon: Calendar, label: 'Sync Calendar', duration: 2000 },
            { icon: Zap, label: 'Deploy AI', duration: 2000 }
        ]
    },
    {
        id: 'customize',
        title: 'Your AI, Your Brand',
        subtitle: 'Upload FAQs. Choose voice. Customize responses.',
        color: 'text-obsidian',
        bg: 'bg-obsidian/5',
        accent: 'bg-obsidian',
        icon: MessageSquare,
        actionBadge: 'Customizable',
        substeps: [
            { icon: FileUp, label: 'Upload Knowledge', duration: 2000 },
            { icon: Mic, label: 'Select Voice', duration: 2000 },
            { icon: MessageSquare, label: 'Preview Agent', duration: 2000 }
        ]
    },
    {
        id: 'results',
        title: 'Revenue on Autopilot',
        subtitle: 'Calls answered. Appointments booked. While you sleep.',
        color: 'text-[#10B981]',
        bg: 'bg-[#D1FAE5]',
        accent: 'bg-[#10B981]',
        icon: TrendingUp,
        actionBadge: 'Automated',
        substeps: [
            { icon: PhoneIncoming, label: 'Call Received', duration: 2000 },
            { icon: CalendarCheck, label: 'Booked', duration: 2500 },
            { icon: TrendingUp, label: 'Revenue Tracked', duration: 2500 }
        ]
    },
];

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function TypingText({ text, active }: { text: string; active: boolean }) {
    return (
        <span className="inline-block relative">
            {active ? (
                <span className="animate-typing overflow-hidden whitespace-nowrap border-r-2 border-blue-400 pr-1">
                    {text}
                </span>
            ) : (
                text
            )}
        </span>
    );
}

function FloatingToast({ show, text, icon: Icon, color = "text-[#10B981]", bg = "bg-[#D1FAE5]" }: any) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-xl border border-surgical-100/50 backdrop-blur-sm"
                >
                    <div className={`p-1 rounded-full ${bg}`}>
                        <Icon className={`w-3 h-3 ${color}`} />
                    </div>
                    <span className="text-xs font-semibold text-obsidian whitespace-nowrap">{text}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── ANIMATION VARIANTS (STAGGERED CASCADING EFFECT) ─────────────────

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
        }
    }
};

// ─── PHASE 1: SETUP UI ───────────────────────────────────────────────

function Phase1SetupUI({ activeSubstep }: { activeSubstep: number }) {
    return (
        <div className="space-y-3">
            {/* Phone Number Card */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: activeSubstep >= 0 ? 1 : 0.3, x: 0 }}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-surgical-100"
            >
                <div className="w-10 h-10 rounded-full bg-surgical-50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-surgical-600" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-obsidian">Phone Number</p>
                    <p className="text-xs text-obsidian/60">(555) 123-4567</p>
                </div>
                {activeSubstep >= 0 && (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                )}
            </motion.div>

            {/* Calendar Card */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: activeSubstep >= 1 ? 1 : 0.3, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-surgical-100"
            >
                <div className="w-10 h-10 rounded-full bg-surgical-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-obsidian" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-obsidian">Google Calendar</p>
                    <p className="text-xs text-obsidian/60">work@clinic.com</p>
                </div>
                {activeSubstep >= 1 && (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                )}
            </motion.div>

            {/* Agent Active Badge */}
            {activeSubstep >= 2 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl flex items-center gap-2"
                    style={{ backgroundColor: '#D1FAE5' }}
                >
                    <Zap className="w-5 h-5 text-[#10B981] fill-[#10B981]" />
                    <span className="text-sm font-bold text-[#047857]">Agent Deployed & Live</span>
                </motion.div>
            )}
        </div>
    );
}

// ─── PHASE 2: CUSTOMIZE UI ───────────────────────────────────────────

function Phase2CustomizeUI({ activeSubstep }: { activeSubstep: number }) {
    const files = ['FAQs.pdf', 'Services.pdf', 'Pricing.pdf'];

    return (
        <div className="space-y-3">
            {/* Knowledge Base Upload */}
            {activeSubstep >= 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-2 border-dashed border-surgical-300 rounded-xl p-4 bg-surgical-50/50"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <FileUp className="w-4 h-4 text-obsidian/70" />
                        <span className="text-sm font-semibold text-obsidian">Knowledge Base</span>
                    </div>
                    <div className="space-y-1">
                        {files.map((file, idx) => (
                            <motion.div
                                key={file}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.3 }}
                                className="flex items-center gap-2 text-xs text-obsidian/60"
                            >
                                <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                                <span>{file}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Voice Selection */}
            {activeSubstep >= 1 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white p-3 rounded-xl border border-surgical-100"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Mic className="w-4 h-4 text-surgical-600" />
                        <span className="text-sm font-semibold text-obsidian">Voice: Voxanne</span>
                    </div>
                    <div className="flex gap-1 items-end h-6">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-surgical-400 rounded-full animate-pulse"
                                style={{
                                    height: Math.random() * 20 + 4 + 'px',
                                    animationDelay: i * 50 + 'ms'
                                }}
                            />
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Agent Preview */}
            {activeSubstep >= 2 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surgical-600 text-white p-4 rounded-2xl rounded-tr-sm"
                >
                    <div className="flex items-start gap-4">
                        <img src="/roxan_voice_interface.png" alt="Voxanne AI" className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
                        <div>
                            <p className="text-sm leading-relaxed">
                                Hi! I'm the clinic's AI assistant. How can I help you today?
                            </p>
                            <p className="text-xs text-surgical-200 mt-2 font-medium">Preview · Voxanne Voice</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ─── PHASE 3: RESULTS UI ────────────────────────────────────────────

function Phase3ResultsUI({ activeSubstep }: { activeSubstep: number }) {
    const [revenue, setRevenue] = useState(0);

    useEffect(() => {
        if (activeSubstep >= 2) {
            const interval = setInterval(() => {
                setRevenue(prev => Math.min(prev + 5, 150));
            }, 30);
            return () => clearInterval(interval);
        }
    }, [activeSubstep]);

    return (
        <div className="space-y-4">
            {/* Incoming Call */}
            {activeSubstep >= 0 && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-surgical-100"
                >
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-surgical-100 flex items-center justify-center text-surgical-600 font-bold text-lg">
                            SJ
                        </div>
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#10B981] border-2 border-white"></span>
                        </span>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-obsidian">Sarah Jenkins</h4>
                        <p className="text-xs text-obsidian/60">2:14 AM · "Need Botox appointment..."</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#10B981] animate-pulse">
                        <Phone className="w-4 h-4" />
                    </div>
                </motion.div>
            )}

            {/* Calendar Sync */}
            {activeSubstep >= 1 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-surgical-100 shadow-sm overflow-hidden"
                >
                    <div className="bg-surgical-50 p-3 border-b border-surgical-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-surgical-700">Appointment Booked</span>
                        <CheckCircle2 className="w-4 h-4 text-surgical-600" />
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-obsidian text-sm">Botox - Sarah Jenkins</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-3 h-3 text-obsidian/40" />
                            <span className="text-xs text-obsidian/60">Feb 24, 10:00 AM</span>
                        </div>
                        <p className="text-xs text-[#10B981] mt-2 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Synced to Google Calendar
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Revenue Counter */}
            {activeSubstep >= 2 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl p-4 flex items-center justify-between"
                    style={{ backgroundColor: '#D1FAE5' }}
                >
                    <div>
                        <p className="text-xs font-medium" style={{ color: '#047857' }}>Revenue Captured</p>
                        <h3 className="text-3xl font-bold mt-1" style={{ color: '#065F46' }}>
                            ${revenue}
                        </h3>
                    </div>
                    <TrendingUp className="w-8 h-8" style={{ color: '#10B981' }} />
                </motion.div>
            )}
        </div>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────

export default function WorkflowHeroAnimation() {
    const [currentPhase, setCurrentPhase] = useState(0);
    const [currentSubstep, setCurrentSubstep] = useState(0);

    useEffect(() => {
        const phase = phases[currentPhase];
        const substep = phase.substeps[currentSubstep];

        const timer = setTimeout(() => {
            if (currentSubstep < phase.substeps.length - 1) {
                // Advance to next substep within current phase
                setCurrentSubstep(prev => prev + 1);
            } else {
                // Move to next phase and reset substep counter
                setCurrentPhase((prev) => (prev + 1) % phases.length);
                setCurrentSubstep(0);
            }
        }, substep.duration);

        return () => clearTimeout(timer);
    }, [currentPhase, currentSubstep]);

    const phase = phases[currentPhase];
    const PhaseIcon = phase.icon;

    return (
        <div className="w-full max-w-[500px] mx-auto perspective-[2000px] group">

            {/* Floating Badge (Top Right) */}
            <div className="absolute -top-6 -right-6 z-20 hidden md:block animate-bounce-slow" style={{ willChange: 'transform' }}>
                <div className="bg-white/80 backdrop-blur-sm md:backdrop-blur-md border border-surgical-100 shadow-xl shadow-surgical-900/5 rounded-full px-4 py-2 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                    </span>
                    <span className="text-xs font-bold text-obsidian tracking-wide">{phase.actionBadge}</span>
                </div>
            </div>

            {/* 3D Container */}
            <motion.div
                initial={{ rotateX: 5, rotateY: -5 }}
                animate={{ rotateX: 0, rotateY: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ willChange: 'transform, opacity' }}
                className="relative bg-white/90 backdrop-blur-md md:backdrop-blur-xl rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(29,78,216,0.12)] border border-surgical-100 overflow-hidden"
            >
                {/* 1. Header with Progress Line */}
                <div className="relative px-8 pt-8 pb-4 border-b border-surgical-50/80">
                    <div className="flex items-start gap-4 mb-6">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-500", phase.bg)}>
                            <PhaseIcon className={cn("w-6 h-6 transition-colors duration-500", phase.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <AnimatePresence mode="wait">
                                <motion.h3
                                    key={phase.title}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-xl font-bold text-obsidian tracking-tight"
                                >
                                    {phase.title}
                                </motion.h3>
                            </AnimatePresence>
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={phase.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-sm text-obsidian/50 font-medium"
                                >
                                    {phase.subtitle}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Integrated Progress Bar */}
                    <div className="flex gap-2">
                        {phases.map((p, idx) => (
                            <div key={idx} className="h-1 flex-1 bg-surgical-100 rounded-full overflow-hidden">
                                {idx === currentPhase && (
                                    <motion.div
                                        className={cn("h-full rounded-full", p.accent)}
                                        initial={{ width: `${(currentSubstep / p.substeps.length) * 100}%` }}
                                        animate={{ width: `${((currentSubstep + 1) / p.substeps.length) * 100}%` }}
                                        transition={{ duration: p.substeps[currentSubstep].duration / 1000, ease: "linear" }}
                                    />
                                )}
                                {idx < currentPhase && <div className={cn("h-full w-full", p.accent)} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Dynamic Content Area */}
                <div className="p-6 min-h-[280px] bg-gradient-to-b from-white to-surgical-50/40 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentPhase}
                            initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                            transition={{ duration: 0.4 }}
                            style={{ willChange: 'transform, opacity, filter' }}
                            className="h-full"
                        >
                            {currentPhase === 0 && <Phase1SetupUI activeSubstep={currentSubstep} />}
                            {currentPhase === 1 && <Phase2CustomizeUI activeSubstep={currentSubstep} />}
                            {currentPhase === 2 && <Phase3ResultsUI activeSubstep={currentSubstep} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 3. Footer Actions */}
                <div className="px-6 py-4 bg-white border-t border-surgical-100 text-[10px] text-obsidian/40 font-mono flex justify-between items-center">
                    <span>VOXANNE-AI-V1.2</span>
                    <span className="flex items-center gap-1.5 font-bold" style={{ color: '#047857' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                        SYSTEM ONLINE
                    </span>
                </div>
            </motion.div>

            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-surgical-200/40 via-surgical-50 to-obsidian/5 rounded-full blur-[80px] -z-10 opacity-60 animate-pulse" />

            {/* Floaters */}
            <FloatingToast show={currentPhase === 1} text="Calendar Updated" icon={CheckCircle2} />
        </div>
    );
}
