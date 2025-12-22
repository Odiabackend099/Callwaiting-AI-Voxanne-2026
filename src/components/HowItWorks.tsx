"use client";

import { motion } from "framer-motion";
import { Phone, Bot, CheckCircle, Calendar, ArrowRight, Zap, Brain } from "lucide-react";
import { useState } from "react";

export default function HowItWorks() {
    const [activeStep, setActiveStep] = useState(0);

    const steps = [
        {
            number: "01",
            title: "Incoming Call",
            description: "A potential patient calls your clinic",
            icon: Phone,
            animation: "Call arrives at your dedicated number or forwarded line",
            details: ["24/7 availability", "Instant answer (500ms)", "Professional greeting"]
        },
        {
            number: "02",
            title: "AI Receptionist Answers",
            description: "Voxanne answers professionally and qualifies the lead",
            icon: Bot,
            animation: "AI engages caller, asks qualifying questions, gathers info",
            details: ["Asks about services", "Qualifies lead value", "Gathers contact info"]
        },
        {
            number: "03",
            title: "Smart Routing",
            description: "Intent analysis determines next action",
            icon: Brain,
            animation: "Real-time decision: Book appointment or escalate",
            details: ["Booking requests → Calendar", "Medical questions → Staff", "Pricing inquiries → Qualified lead"]
        },
        {
            number: "04",
            title: "Instant Booking",
            description: "Appointment confirmed directly into your calendar",
            icon: Calendar,
            animation: "Appointment booked, confirmation sent to patient",
            details: ["Auto-calendar integration", "SMS/Email confirmation", "No double-booking"]
        },
        {
            number: "05",
            title: "Lead Notification",
            description: "You receive qualified lead immediately",
            icon: CheckCircle,
            animation: "Real-time alert with call transcript and lead details",
            details: ["Instant notification", "Full call transcript", "Lead scoring"]
        }
    ];

    return (
        <section className="py-24 md:py-32 bg-gradient-to-b from-black via-slate-950 to-black relative overflow-hidden" id="how-it-works">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16 md:mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6"
                    >
                        <Zap className="w-4 h-4" />
                        <span className="font-display">Real-Time Lead Conversion</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-bold text-white mb-6 font-display"
                    >
                        How Voxanne Works
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 max-w-2xl mx-auto text-lg font-body"
                    >
                        From call to booked appointment in seconds. Watch how Voxanne captures every lead.
                    </motion.p>
                </div>

                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-wrap gap-3 justify-center mb-12 md:mb-16">
                        {steps.map((step, index) => (
                            <motion.button
                                key={index}
                                onClick={() => setActiveStep(index)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`relative px-4 py-3 rounded-full font-semibold text-sm transition-all duration-300 ${
                                    activeStep === index
                                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50"
                                        : "bg-slate-900/50 text-slate-300 border border-slate-700 hover:border-cyan-500/50"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">{step.number}</span>
                                    <span className="hidden sm:inline">{step.title}</span>
                                </div>
                            </motion.button>
                        ))}
                    </div>

                    <motion.div
                        key={activeStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-gradient-to-br from-slate-900/50 via-slate-900/30 to-slate-950/50 border border-cyan-500/20 rounded-3xl p-8 md:p-12 backdrop-blur-sm"
                    >
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div className="flex items-center justify-center">
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                                    className="relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl blur-2xl opacity-30 animate-pulse" />
                                    <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-3xl bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 flex items-center justify-center">
                                        <motion.div
                                            animate={{
                                                y: [0, -10, 0],
                                                scale: [1, 1.1, 1]
                                            }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            {(() => {
                                                const IconComponent = steps[activeStep].icon;
                                                return <IconComponent className="w-24 h-24 md:w-32 md:h-32 text-cyan-400" strokeWidth={1.5} />;
                                            })()}
                                        </motion.div>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="inline-flex items-center gap-3 mb-4"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg font-display">
                                            {steps[activeStep].number}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-bold text-white font-display">
                                                {steps[activeStep].title}
                                            </h3>
                                        </div>
                                    </motion.div>

                                    <motion.p
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="text-slate-400 text-lg font-body"
                                    >
                                        {steps[activeStep].description}
                                    </motion.p>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20"
                                >
                                    <p className="text-cyan-300 font-semibold text-sm font-body">
                                        ⚡ {steps[activeStep].animation}
                                    </p>
                                </motion.div>

                                <motion.ul
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="space-y-3"
                                >
                                    {steps[activeStep].details.map((detail, i) => (
                                        <motion.li
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.6 + i * 0.1 }}
                                            className="flex items-center gap-3"
                                        >
                                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                            <span className="text-slate-300 font-body">{detail}</span>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="mt-12 flex items-center justify-center gap-2"
                    >
                        {steps.map((_, index) => (
                            <motion.div
                                key={index}
                                animate={{
                                    width: activeStep === index ? 32 : 8,
                                    backgroundColor: activeStep === index ? "#06b6d4" : "#475569"
                                }}
                                transition={{ duration: 0.3 }}
                                className="h-2 rounded-full"
                            />
                        ))}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                        className="mt-16 text-center"
                    >
                        <p className="text-slate-400 mb-6 font-body">
                            Ready to start capturing every lead?
                        </p>
                        <button className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center gap-2 mx-auto font-display">
                            Book Your Demo
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
