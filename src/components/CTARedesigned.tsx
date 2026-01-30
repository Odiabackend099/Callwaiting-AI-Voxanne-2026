"use client";

import { motion } from "framer-motion";
import { FadeInOnScroll } from "./ParallaxSection";
import { ArrowRight } from "lucide-react";

interface CTARedesignedProps {
    onBookDemo?: () => void;
}

export default function CTARedesigned({ onBookDemo }: CTARedesignedProps) {
    return (
        <section className="relative py-20 md:py-32 bg-gradient-to-r from-blue-deep via-cyan to-lime overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h2 className="text-h2-desktop md:text-h2-mobile font-display font-bold text-cream mb-6">
                            Ready to Stop Missing Calls?
                        </h2>
                        <p className="text-xl text-cream/90 mb-8 leading-relaxed">
                            Join 500+ aesthetic clinics using Voxanne AI to automate patient communication and grow their practice.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={onBookDemo}
                                className="px-8 py-4 bg-cream text-blue-deep font-semibold rounded-lg hover:bg-cream/90 transition-all duration-300 hover:shadow-card-hover flex items-center justify-center gap-2 group"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                className="px-8 py-4 bg-transparent text-cream font-semibold rounded-lg border-2 border-cream hover:bg-cream/10 transition-all duration-300"
                            >
                                Schedule a Call
                            </button>
                        </div>

                        <p className="text-cream/70 text-sm mt-8">
                            No credit card required. 14-day free trial. Cancel anytime.
                        </p>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
