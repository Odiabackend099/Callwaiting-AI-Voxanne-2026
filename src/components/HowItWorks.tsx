"use client";

import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Zap, Users, Settings } from "lucide-react";

const steps = [
    {
        number: "01",
        title: "15-Minute Setup Call",
        description: "We configure CALL WAITING AI LTD for your clinic. No technical knowledge required.",
        icon: Settings,
        details: [
            "Share your FAQ document and pricing",
            "Connect your EMR/booking system",
            "Set your availability and preferences",
            "Configure emergency escalation rules"
        ],
        duration: "15 minutes"
    },
    {
        number: "02",
        title: "48-Hour Training",
        description: "CALL WAITING AI LTD learns your procedures, pricing, and practice personality.",
        icon: Zap,
        details: [
            "Pre-trained on 500+ medical procedures",
            "Customized with your specific services",
            "Learns your pricing and packages",
            "Adapts to your practice's tone and style"
        ],
        duration: "48 hours (automated)"
    },
    {
        number: "03",
        title: "Go Live & Scale",
        description: "Forward calls or use our dedicated number. We handle the rest.",
        icon: Users,
        details: [
            "Instant activation - no downtime",
            "24/7 coverage from day one",
            "Real-time dashboard and analytics",
            "Continuous improvement with AI learning"
        ],
        duration: "Immediate"
    }
];

export default function HowItWorks() {
    return (
        <section className="py-24 bg-gradient-to-b from-black to-slate-950 relative overflow-hidden" id="how-it-works">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6"
                    >
                        <Zap className="w-4 h-4" />
                        <span>Simple 3-Step Process</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        How It Works
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 max-w-2xl mx-auto text-lg"
                    >
                        From setup to go-live in under 72 hours. No technical expertise required.
                    </motion.p>
                </div>

                {/* Steps */}
                <div className="max-w-6xl mx-auto space-y-12">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.2 }}
                            className="relative"
                        >
                            <div className="grid md:grid-cols-2 gap-8 items-center">
                                {/* Content (alternating sides) */}
                                <div className={`${index % 2 === 1 ? 'md:order-2' : ''}`}>
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="flex-shrink-0">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                                                {step.number}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                                                {step.title}
                                            </h3>
                                            <p className="text-slate-400 text-lg">
                                                {step.description}
                                            </p>
                                            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-medium">
                                                <Zap className="w-3 h-3" />
                                                {step.duration}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details List */}
                                    <ul className="space-y-3">
                                        {step.details.map((detail, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                                <span className="text-slate-300">{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Visual (alternating sides) */}
                                <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
                                    <div className="relative">
                                        <div className="bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-white/10 p-8 hover:border-cyan-500/30 transition-all duration-300">
                                            <div className="flex items-center justify-center h-64">
                                                <step.icon className="w-32 h-32 text-cyan-400/20" strokeWidth={1} />
                                            </div>
                                        </div>

                                        {/* Connecting Line (except last step) */}
                                        {index < steps.length - 1 && (
                                            <div className="hidden md:block absolute left-1/2 -bottom-12 transform -translate-x-1/2">
                                                <ArrowRight className="w-6 h-6 text-cyan-500 rotate-90" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-20 text-center"
                >
                    <div className="inline-flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20">
                        <p className="text-white text-xl font-semibold">
                            Ready to get started?
                        </p>
                        <button className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center gap-2">
                            Book Your Setup Call
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <p className="text-slate-400 text-sm">
                            No credit card required • 30-day money-back guarantee
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
