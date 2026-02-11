"use client";

import { motion } from "framer-motion";
import { FadeInOnScroll, SlideInOnScroll } from "./ParallaxSection";
import { CheckCircle2 } from "lucide-react";

const steps = [
    {
        number: "01",
        title: "Patient Calls",
        description: "A patient calls your clinic number. Voxanne AI answers immediately.",
        color: "bg-surgical-900",
    },
    {
        number: "02",
        title: "AI Listens",
        description: "The AI understands the patient's needs and asks clarifying questions.",
        color: "bg-surgical-600",
    },
    {
        number: "03",
        title: "Books Appointment",
        description: "AI checks availability and books the appointment in your system.",
        color: "bg-surgical-400",
    },
    {
        number: "04",
        title: "You're Notified",
        description: "Your team gets instant notifications with patient details and call recording.",
        color: "bg-surgical-900",
    },
];

export default function HowItWorksRedesigned() {
    return (
        <section id="how-it-works" className="relative py-20 md:py-32 bg-gradient-to-b from-surgical-100 to-surgical-50 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-surgical-900/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-surgical-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                {/* Section Header */}
                <FadeInOnScroll>
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-h2-desktop md:text-h2-mobile font-display font-bold text-obsidian mb-4">
                                How It Works
                            </h2>
                            <p className="text-lg text-obsidian/70 max-w-2xl mx-auto">
                                Simple, automated, and seamless patient communication.
                            </p>
                        </motion.div>
                    </div>
                </FadeInOnScroll>

                {/* Timeline */}
                <div className="max-w-3xl mx-auto">
                    {steps.map((step, index) => (
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
                                className="flex gap-8 mb-12 relative"
                            >
                                {/* Timeline Line */}
                                {index < steps.length - 1 && (
                                    <div className="absolute left-6 top-20 w-1 h-24 bg-gradient-to-b from-surgical-900 via-surgical-600 to-surgical-400 opacity-30" />
                                )}

                                {/* Step Number Circle */}
                                <div className={`flex-shrink-0 w-12 h-12 rounded-full ${step.color} text-white flex items-center justify-center font-display font-bold text-lg`}>
                                    {step.number}
                                </div>

                                {/* Step Content */}
                                <div className="flex-1 pt-2">
                                    <h3 className="text-2xl font-bold text-obsidian mb-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-obsidian/70 text-lg leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </motion.div>
                        </SlideInOnScroll>
                    ))}
                </div>

                {/* Benefits Summary */}
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                        className="mt-16 bg-surgical-50 border border-surgical-200 rounded-lg p-8 md:p-12"
                    >
                        <h3 className="text-2xl font-bold text-obsidian mb-8">Why It Works</h3>
                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                "No more missed calls or lost revenue",
                                "Patients get instant responses 24/7",
                                "Your team focuses on patient care",
                            ].map((benefit, index) => (
                                <div key={index} className="flex gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-surgical-600 flex-shrink-0 mt-1" />
                                    <p className="text-obsidian/70">{benefit}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
