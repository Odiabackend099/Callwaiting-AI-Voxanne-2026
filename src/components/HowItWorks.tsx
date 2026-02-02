"use client";

import { motion } from "framer-motion";
import { Phone, Bot, CheckCircle, Calendar, ArrowRight, Zap, Brain } from "lucide-react";
import { useState, useEffect } from "react";
import FadeIn from "@/components/ui/FadeIn";

export default function HowItWorks() {
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 5);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

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
        <section className="py-24 md:py-32 bg-slate-50 relative overflow-hidden" id="how-it-works">
            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16 md:mb-24">
                    <FadeIn>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surgical-50 border border-surgical-100 text-surgical-600 text-sm font-medium mb-6">
                            <Zap className="w-4 h-4" />
                            <span className="font-display">Real-Time Lead Conversion</span>
                        </div>

                        <h2 className="text-4xl md:text-6xl font-bold text-navy-900 mb-6 font-display tracking-tight">
                            How Voxanne Works
                        </h2>

                        <p className="text-slate-600 max-w-2xl mx-auto text-lg font-body">
                            From call to booked appointment in seconds. Watch how Voxanne captures every lead.
                        </p>
                    </FadeIn>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap gap-3 justify-center mb-12 md:mb-16">
                        {steps.map((step, index) => (
                            <motion.button
                                key={index}
                                onClick={() => setActiveStep(index)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`relative px-4 py-3 rounded-full font-semibold text-sm transition-all duration-300 ${
                                    activeStep === index
                                        ? "bg-surgical-600 text-white shadow-lg shadow-surgical-500/30"
                                        : "bg-white text-slate-500 border border-slate-200 hover:border-surgical-200 hover:text-surgical-600"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${activeStep === index ? "text-white" : "text-slate-400"}`}>{step.number}</span>
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
                        className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50"
                    >
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="flex items-center justify-center order-2 md:order-1">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="relative"
                                >
                                    <div className="absolute inset-0 bg-surgical-100 rounded-full blur-3xl opacity-60 animate-pulse" />
                                    <div className="relative w-64 h-64 rounded-3xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 flex items-center justify-center shadow-inner">
                                        <motion.div
                                            animate={{
                                                y: [0, -10, 0],
                                                scale: [1, 1.05, 1]
                                            }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                        >
                                            {(() => {
                                                const IconComponent = steps[activeStep].icon;
                                                return <IconComponent className="w-32 h-32 text-surgical-600" strokeWidth={1.5} />;
                                            })()}
                                        </motion.div>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="space-y-8 order-1 md:order-2">
                                <div>
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="inline-flex items-center gap-3 mb-4"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-surgical-50 flex items-center justify-center text-surgical-700 font-bold text-lg font-display border border-surgical-100">
                                            {steps[activeStep].number}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-bold text-navy-900 font-display">
                                                {steps[activeStep].title}
                                            </h3>
                                        </div>
                                    </motion.div>

                                    <motion.p
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="text-slate-600 text-lg font-body leading-relaxed"
                                    >
                                        {steps[activeStep].description}
                                    </motion.p>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="p-4 rounded-xl bg-slate-50 border border-slate-100"
                                >
                                    <p className="text-surgical-700 font-semibold text-sm font-body flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        {steps[activeStep].animation}
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
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.6 + i * 0.1 }}
                                            className="flex items-center gap-3"
                                        >
                                            <div className="bg-green-100 rounded-full p-1">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                            </div>
                                            <span className="text-slate-600 font-body">{detail}</span>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                            </div>
                        </div>
                    </motion.div>

                    <FadeIn delay={0.6}>
                        <div className="mt-16 text-center">
                            <p className="text-slate-600 mb-6 font-body">
                                Ready to start capturing every lead?
                            </p>
                            <a href="https://calendly.com/austyneguale/30min" target="_blank" rel="noopener noreferrer" className="inline-block">
                                <button className="px-8 py-4 rounded-full bg-surgical-600 text-white font-bold text-lg hover:bg-surgical-700 hover:shadow-xl hover:shadow-surgical-500/20 transition-all flex items-center gap-2 mx-auto font-display transform hover:scale-105">
                                    Book Your Demo
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </a>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
}
