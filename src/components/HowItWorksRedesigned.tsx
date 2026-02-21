"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Phone, Ear, Calendar, BellRing, CheckCircle2 } from "lucide-react";

const steps = [
    {
        number: "01",
        title: "Patient Calls",
        description: "A patient dials your clinic number. Voxanne AI answers on the first ring — every time, 24/7.",
        icon: Phone,
        accent: "#3B82F6",
        glow: "rgba(59,130,246,0.4)",
    },
    {
        number: "02",
        title: "AI Listens & Understands",
        description: "The AI understands the patient's intent using natural language — no menus, no hold music.",
        icon: Ear,
        accent: "#1D4ED8",
        glow: "rgba(29,78,216,0.4)",
    },
    {
        number: "03",
        title: "Books Appointment",
        description: "AI checks live calendar availability and books the appointment instantly in your system.",
        icon: Calendar,
        accent: "#60A5FA",
        glow: "rgba(96,165,250,0.4)",
    },
    {
        number: "04",
        title: "You're Notified",
        description: "Your team gets an instant notification with patient details, call summary, and recording.",
        icon: BellRing,
        accent: "#93C5FD",
        glow: "rgba(147,197,253,0.35)",
    },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const Icon = step.icon;
    const isEven = index % 2 === 0;

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: isEven ? -40 : 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: index * 0.12, ease: 'easeOut' }}
            className="relative flex gap-6 md:gap-10 items-start group"
        >
            {/* Vertical line connector */}
            {index < steps.length - 1 && (
                <motion.div
                    initial={{ scaleY: 0 }}
                    animate={isInView ? { scaleY: 1 } : {}}
                    transition={{ duration: 0.8, delay: 0.3 + index * 0.15 }}
                    style={{ originY: 0, background: `linear-gradient(to bottom, ${step.accent}, ${steps[index + 1].accent})` }}
                    className="absolute left-[2.375rem] top-20 w-[2px] h-[calc(100%+2rem)]"
                />
            )}

            {/* Icon circle */}
            <div className="relative flex-shrink-0 z-10">
                {/* Rotating gradient ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    style={{ background: `conic-gradient(${step.accent}, transparent, ${step.accent})` }}
                    className="w-20 h-20 rounded-2xl p-[2px]"
                >
                    <div className="w-full h-full rounded-2xl bg-[#0A0F1E] flex items-center justify-center">
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            style={{ boxShadow: `0 0 20px ${step.glow}` }}
                            className="w-14 h-14 rounded-xl flex items-center justify-center"
                            animate={{ boxShadow: [`0 0 15px ${step.glow}`, `0 0 30px ${step.glow}`, `0 0 15px ${step.glow}`] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Icon className="w-7 h-7" style={{ color: step.accent }} strokeWidth={1.5} />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Step number badge */}
                <div className="absolute -top-2 -right-3 w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/70 backdrop-blur-sm">
                    {step.number}
                </div>
            </div>

            {/* Content card */}
            <motion.div
                whileHover={{ y: -3, borderColor: `${step.accent}60` }}
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                className="flex-1 mb-10 rounded-2xl border bg-white/5 backdrop-blur-sm p-7 transition-all duration-400"
            >
                {/* Top gradient accent line */}
                <div
                    className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(90deg, transparent, ${step.accent}, transparent)` }}
                />
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-3 tracking-tight">
                    {step.title}
                </h3>
                <p className="text-white/55 text-base leading-relaxed">
                    {step.description}
                </p>
            </motion.div>
        </motion.div>
    );
}

export default function HowItWorksRedesigned() {
    const headerRef = useRef<HTMLDivElement>(null);
    const isHeaderInView = useInView(headerRef, { once: true });

    return (
        <section id="how-it-works" className="relative py-32 bg-[#030712] overflow-hidden">
            {/* Ambient radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, #1D4ED8 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at bottom right, #3B82F6 0%, transparent 70%)' }} />

            {/* Grid dot overlay */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

            <div className="section-container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 28 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7 }}
                    className="text-center mb-20"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/70 uppercase tracking-widest mb-6 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-surgical-400 animate-pulse" />
                        How It Works
                    </span>
                    <h2 className="font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-5">
                        From Call to{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-surgical-400 via-surgical-300 to-surgical-500">
                            Booked Appointment
                        </span>
                    </h2>
                    <p className="text-lg text-white/45 max-w-2xl mx-auto">
                        Simple, automated, and seamless patient communication in 4 steps.
                    </p>
                </motion.div>

                {/* Steps timeline */}
                <div className="max-w-3xl mx-auto">
                    {steps.map((step, index) => (
                        <StepCard key={step.number} step={step} index={index} />
                    ))}
                </div>

                {/* Benefits bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-8 flex flex-wrap justify-center gap-4 md:gap-8"
                >
                    {["No missed calls", "Instant 24/7 responses", "More focused staff", "Full audit trail"].map((benefit) => (
                        <div
                            key={benefit}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/7 border border-white/10 backdrop-blur-sm"
                        >
                            <CheckCircle2 className="w-4 h-4 text-surgical-400 flex-shrink-0" />
                            <span className="text-white/70 text-sm font-medium">{benefit}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
