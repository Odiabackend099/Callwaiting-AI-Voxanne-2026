"use client";

import { motion } from "framer-motion";
import { Phone, Clock, Shield, BarChart3, Zap, Users } from "lucide-react";
import { FadeInOnScroll, SlideInOnScroll } from "./ParallaxSection";

const features = [
    {
        icon: Phone,
        title: "AI Receptionist",
        description: "Answers calls 24/7, books appointments, and qualifies leads automatically.",
        color: "text-cyan",
    },
    {
        icon: Clock,
        title: "Always Available",
        description: "Never miss a call. AI handles inquiries during business hours and after.",
        color: "text-lime",
    },
    {
        icon: Shield,
        title: "HIPAA Compliant",
        description: "Medical-grade security and privacy for patient data.",
        color: "text-blue-deep",
    },
    {
        icon: BarChart3,
        title: "Real-Time Analytics",
        description: "Track call metrics, conversion rates, and patient insights.",
        color: "text-cyan",
    },
    {
        icon: Zap,
        title: "Instant Integration",
        description: "Connects with your existing systems in minutes.",
        color: "text-lime",
    },
    {
        icon: Users,
        title: "Patient-Centric",
        description: "Natural conversations that feel human and professional.",
        color: "text-blue-deep",
    },
];

export default function FeaturesRedesigned() {
    return (
        <section id="features" className="relative py-20 md:py-32 bg-cream overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sage/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan/5 rounded-full blur-[80px]" />
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
                            <h2 className="text-h2-desktop md:text-h2-mobile font-display font-bold text-charcoal mb-4">
                                Powerful Features for Modern Clinics
                            </h2>
                            <p className="text-lg text-charcoal/70 max-w-2xl mx-auto">
                                Everything you need to automate patient communication and grow your practice.
                            </p>
                        </motion.div>
                    </div>
                </FadeInOnScroll>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-8">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <SlideInOnScroll
                                key={index}
                                direction={index % 2 === 0 ? "left" : "right"}
                                delay={index * 0.1}
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                    className="bg-cream-light border border-sage-dark rounded-lg p-8 hover:shadow-card-hover transition-all duration-300 group"
                                >
                                    <div className={`w-12 h-12 rounded-lg bg-sage flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${feature.color}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-charcoal mb-3">
                                        {feature.title}
                                    </h3>
                                    <p className="text-charcoal/70 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </motion.div>
                            </SlideInOnScroll>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
