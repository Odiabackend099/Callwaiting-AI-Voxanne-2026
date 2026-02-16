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
    CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── STAGE CONFIGURATION ─────────────────────────────────────────────

const stages = [
    {
        id: 'call',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        accent: 'bg-blue-600',
        icon: Phone,
        title: 'Instant Response',
        subtitle: 'AI answers immediately, 24/7.',
        actionBadge: 'Incoming Call',
    },
    {
        id: 'book',
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        accent: 'bg-purple-600',
        icon: Calendar,
        title: 'Smart Scheduling',
        subtitle: 'Bookings sync directly to your calendar.',
        actionBadge: 'Booking...',
    },
    {
        id: 'roi',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        accent: 'bg-emerald-600',
        icon: TrendingUp,
        title: 'Revenue Growth',
        subtitle: 'Capture every opportunity.',
        actionBadge: 'Recovered',
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

function FloatingToast({ show, text, icon: Icon, color = "text-green-600", bg = "bg-green-100" }: any) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-xl border border-slate-100/50 backdrop-blur-sm"
                >
                    <div className={`p-1 rounded-full ${bg}`}>
                        <Icon className={`w-3 h-3 ${color}`} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{text}</span>
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
            ease: [0.25, 0.1, 0.25, 1],
        }
    }
};

// ─── CALL STAGE UI ───────────────────────────────────────────────────

function CallStageUI({ active }: { active: boolean }) {
    return (
        <div className="flex flex-col gap-4 relative">
            {/* Caller ID Card */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500 rounded-l-2xl" />
                <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm z-10 relative">
                        <User className="w-6 h-6 text-slate-400" />
                    </div>
                    {active && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
                        </span>
                    )}
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-slate-900 leading-tight">Sarah Jenkins</h4>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> (555) 012-3456
                    </p>
                    <p className="text-xs text-slate-600 italic mt-1.5">"Hi, I need a Botox appointment next week..."</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 opacity-50"><Phone className="w-4 h-4 rotate-[135deg]" /></div>
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 animate-pulse"><Phone className="w-4 h-4" /></div>
                </div>
            </motion.div>

            {/* AI Response Bubble */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="self-end max-w-[85%]"
            >
                <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-sm shadow-lg shadow-blue-600/20 relative">
                    <div className="flex items-start gap-3">
                        <div className="min-w-[20px] mt-1">
                            <Zap className="w-4 h-4 text-blue-200 fill-blue-200" />
                        </div>
                        <p className="text-sm font-medium leading-relaxed">
                            {active ? (
                                <TypingText text="Hi Sarah! Dr. Smith has Botox appointments available on Tuesday at 10:00 AM or Thursday at 2:00 PM. Which works better for you?" active={true} />
                            ) : (
                                "Hi Sarah! Dr. Smith has Botox appointments available on Tuesday at 10:00 AM or Thursday at 2:00 PM. Which works better for you?"
                            )}
                        </p>
                    </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right mt-1.5 font-medium px-1">Voxanne AI • Just now</div>
            </motion.div>
        </div>
    );
}

// ─── BOOK STAGE UI ───────────────────────────────────────────────────

function BookStageUI({ active }: { active: boolean }) {
    return (
        <motion.div
            className="space-y-3 relative"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {/* Calendar Event Card */}
            <motion.div
                layoutId="calendar-card"
                variants={itemVariants}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
                <div className="bg-purple-50/50 p-3 border-b border-purple-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Suggested Slot</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-purple-600 border border-purple-100 font-semibold shadow-sm">AI Optimized</span>
                </div>
                <div className="p-4 flex gap-4 items-center">
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg p-2 min-w-[60px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Feb</span>
                        <span className="text-xl font-bold text-slate-900">24</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">Botox Treatment - Sarah Jenkins</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500 font-medium">10:00 AM - 10:45 AM</span>
                        </div>
                        <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Synced to Google Calendar
                        </p>
                    </div>
                    <div className="ml-auto transform transition-transform hover:scale-110">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Confirmation SMS */}
            <motion.div
                variants={itemVariants}
                className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-3"
            >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-bold text-slate-700">SMS to Sarah</span>
                        <span className="text-[10px] text-slate-400">✓ Delivered</span>
                    </div>
                    <p className="text-xs text-slate-500">Your Botox appointment with Dr. Smith is confirmed for Tuesday, Feb 24 at 10:00 AM. Reply CANCEL to reschedule.</p>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── ROI STAGE UI ────────────────────────────────────────────────────

function RoiStageUI({ active }: { active: boolean }) {
    return (
        <motion.div
            className="grid grid-cols-2 gap-3 relative h-full"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {/* Stat Card 1 */}
            <motion.div
                variants={itemVariants}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+12%</span>
                </div>
                <div>
                    <span className="text-xs text-slate-400 font-medium">Revenue Recovered</span>
                    <h4 className="text-xl font-bold text-slate-900">$150.00</h4>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Botox treatment value</p>
                </div>
            </motion.div>

            {/* Stat Card 2 */}
            <motion.div
                variants={itemVariants}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <User className="w-4 h-4 text-blue-600" />
                    </div>
                </div>
                <div>
                    <span className="text-xs text-slate-400 font-medium">New Patient</span>
                    <h4 className="text-lg font-bold text-slate-900 truncate">Sarah J.</h4>
                    <span className="text-[10px] text-slate-400">Lead Captured</span>
                </div>
            </motion.div>

            {/* Bottom Wide Card */}
            <motion.div
                variants={itemVariants}
                className="col-span-2 bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between shadow-lg"
            >
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-300">HIPAA Compliant</span>
                        <span className="text-[10px] text-slate-500">Data Secure & Encrypted</span>
                    </div>
                </div>
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[8px] font-bold">
                            AI
                        </div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────

export default function WorkflowHeroAnimation() {
    const [currentStage, setCurrentStage] = useState(0);
    const [progress, setProgress] = useState(0);

    // Cycle duration in ms
    const CYCLE_DURATION = 5000;

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentStage((prev) => (prev + 1) % stages.length);
            setProgress(0);
        }, CYCLE_DURATION);

        const progressTimer = setInterval(() => {
            setProgress(old => Math.min(old + (100 / (CYCLE_DURATION / 50)), 100));
        }, 50);

        return () => {
            clearInterval(timer);
            clearInterval(progressTimer);
        };
    }, []);

    const stage = stages[currentStage];
    const StageIcon = stage.icon;

    return (
        <div className="w-full max-w-[500px] mx-auto perspective-[2000px] group">

            {/* Floating Badge (Top Right) */}
            <div className="absolute -top-6 -right-6 z-20 hidden md:block animate-bounce-slow" style={{ willChange: 'transform' }}>
                <div className="bg-white/80 backdrop-blur-sm md:backdrop-blur-md border border-white/50 shadow-xl shadow-blue-900/5 rounded-full px-4 py-2 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-bold text-slate-700 tracking-wide">{stage.actionBadge}</span>
                </div>
            </div>

            {/* 3D Container */}
            <motion.div
                initial={{ rotateX: 5, rotateY: -5 }}
                animate={{ rotateX: 0, rotateY: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ willChange: 'transform, opacity' }}
                className="relative bg-white/90 backdrop-blur-md md:backdrop-blur-xl rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] border border-white/50 overflow-hidden"
            >
                {/* 1. Header with Progress Line */}
                <div className="relative px-8 pt-8 pb-4 border-b border-slate-100/50">
                    <div className="flex items-start gap-4 mb-6">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-500", stage.bg)}>
                            <StageIcon className={cn("w-6 h-6 transition-colors duration-500", stage.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <AnimatePresence mode="wait">
                                <motion.h3
                                    key={stage.title}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-xl font-bold text-slate-900 tracking-tight"
                                >
                                    {stage.title}
                                </motion.h3>
                            </AnimatePresence>
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={stage.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-sm text-slate-500 font-medium truncate"
                                >
                                    {stage.subtitle}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Integrated Progress Bar */}
                    <div className="flex gap-2">
                        {stages.map((s, idx) => (
                            <div key={idx} className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                {idx === currentStage && (
                                    <motion.div
                                        className={cn("h-full rounded-full", s.accent)}
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: CYCLE_DURATION / 1000, ease: "linear" }}
                                    />
                                )}
                                {idx < currentStage && <div className={cn("h-full w-full", s.accent)} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Dynamic Content Area */}
                <div className="p-6 min-h-[280px] bg-gradient-to-b from-white to-slate-50/50 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStage}
                            initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                            transition={{ duration: 0.4 }}
                            style={{ willChange: 'transform, opacity, filter' }}
                            className="h-full"
                        >
                            {currentStage === 0 && <CallStageUI active={true} />}
                            {currentStage === 1 && <BookStageUI active={true} />}
                            {currentStage === 2 && <RoiStageUI active={true} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 3. Footer Actions */}
                <div className="px-6 py-4 bg-white border-t border-slate-100 text-[10px] text-slate-400 font-mono flex justify-between items-center">
                    <span>AI-AGENT-V1.2</span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        SYSTEM ONLINE
                    </span>
                </div>
            </motion.div>

            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-200/20 via-purple-200/20 to-emerald-200/20 rounded-full blur-3xl -z-10 opacity-60 animate-pulse" />

            {/* Floaters */}
            <FloatingToast show={currentStage === 1} text="Calendar Updated" icon={CheckCircle2} />
        </div>
    );
}
