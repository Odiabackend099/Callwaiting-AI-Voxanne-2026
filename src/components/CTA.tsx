"use client";

import { motion } from "framer-motion";

export default function CTA({ onBookDemo }: { onBookDemo?: () => void }) {
    return (
        <section className="py-32 relative overflow-hidden bg-black flex items-center justify-center">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black" />

            <div className="container px-4 md:px-6 relative z-10 text-center">
                <motion.h2
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="text-4xl md:text-7xl font-bold text-white tracking-tight mb-8"
                >
                    Every Missed Call is Lost Revenue.
                </motion.h2>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
                        Stop losing £50K+ annually to unanswered calls. Deploy Voxanne today and capture every lead, 24/7.
                    </p>

                    <button
                        onClick={onBookDemo}
                        className="px-10 py-5 bg-white text-black text-xl font-bold rounded-full hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                    >
                        Book Demo Now
                    </button>
                </motion.div>
            </div>
        </section>
    );
}
