"use client";

import { motion } from "framer-motion";
import { FadeInOnScroll, SlideInOnScroll } from "./ParallaxSection";
import { CheckCircle2, Phone, Ear, Calendar, BellRing } from "lucide-react";

const steps = [
    {
        number: "01",
        title: "Patient Calls",
        description: "A patient calls your clinic number. Voxanne AI answers immediately.",
        color: "bg-surgical-600",
        icon: Phone,
    },
    {
        number: "02",
        title: "AI Listens",
        description: "The AI understands the patient's needs and asks clarifying questions.",
        color: "bg-surgical-500",
        icon: Ear,
    },
    {
        number: "03",
        title: "Books Appointment",
        description: "AI checks availability and books the appointment in your system.",
        color: "bg-surgical-400",
        icon: Calendar,
    },
    {
        number: "04",
        title: "You're Notified",
        description: "Your team gets instant notifications with patient details and call recording.",
        color: "bg-surgical-600",
        icon: BellRing,
    },
];

export default function HowItWorksRedesigned() {
    return (
        <section id="how-it-works" className="relative py-32 bg-surgical-50 overflow-hidden">
            <div className="section-container relative z-10">
                {/* Section Header */}
                <FadeInOnScroll>
                    <div className="text-center mb-20">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-obsidian tracking-tight mb-5">
                                How It <span className="font-sans font-semibold">Works</span>
                            </h2>
                            <p className="text-lg text-obsidian/50 max-w-2xl mx-auto">
                                Simple, automated, and seamless patient communication in 4 steps.
                            </p>
                        </motion.div>
                    </div>
                </FadeInOnScroll>

                {/* Timeline */}
                <div className="max-w-4xl mx-auto">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <SlideInOnScroll
                                key={index}
                                direction={index % 2 === 0 ? "left" : "right"}
                                delay={index * 0.15}
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                    className="flex gap-8 mb-16 relative items-start"
                                >
                                    {/* Timeline Line */}
                                    {index < steps.length - 1 && (
                                        <div className="absolute left-[2.25rem] top-20 w-0.5 h-full bg-surgical-200" />
                                    )}

                                    {/* Step Icon Circle */}
                                    <div className={`relative z-10 flex-shrink-0 w-20 h-20 rounded-xl ${step.color} flex items-center justify-center transition-transform duration-500 hover:scale-105 group`}>
                                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full border border-surgical-200 flex items-center justify-center text-xs font-medium text-surgical-700">
                                            {step.number}
                                        </div>
                                        <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                                    </div>

                                    {/* Step Content */}
                                    <div className="flex-1 pt-3">
                                        <div className="bg-white p-8 rounded-xl border border-surgical-200 transition-shadow duration-500 hover:shadow-md">
                                            <h3 className="text-2xl font-semibold text-obsidian mb-2">
                                                {step.title}
                                            </h3>
                                            <p className="text-obsidian/60 text-lg leading-relaxed">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            </SlideInOnScroll>
                        );
                    })}
                </div>

                {/* Benefits Summary */}
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                        className="mt-8 text-center"
                    >
                        <div className="inline-flex flex-wrap justify-center gap-4 md:gap-8 bg-white px-8 py-4 rounded-xl border border-surgical-200 mx-auto">
                            {[
                                "No missed calls",
                                "Instant 24/7 responses",
                                "More focused staff",
                            ].map((benefit, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-surgical-600 flex-shrink-0" />
                                    <span className="text-obsidian/70 font-medium">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
