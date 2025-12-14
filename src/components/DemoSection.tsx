"use client";

import { motion } from "framer-motion";
import { LiveVoiceInterface } from "@/components/LiveVoiceInterface";

export default function DemoSection() {
    return (
        <section className="py-24 px-6 bg-[#050505]">
            <div className="container mx-auto max-w-7xl">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="inline-block px-4 py-1.5 rounded-full bg-cyan-900/30 text-cyan-400 text-sm font-bold mb-4 border border-cyan-800"
                        >
                            LIVE DEMO
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl font-bold mb-6 text-white"
                        >
                            The Receptionist Who Never Sleeps.
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-zinc-400 mb-8 leading-relaxed"
                        >
                            Voxanne isn't a robot menu. She's a hyper-realistic AI that speaks with empathy, intelligence, and the professional tone your high-end clinic demands.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-zinc-900/50 p-6 rounded-xl border border-white/5 shadow-sm mb-8"
                        >
                            <p className="text-zinc-300 italic">
                                "Imagine it's 9 PM. A patient is scrolling Instagram, sees your BBL results, and calls. Instead of voicemail, they're greeted by Voxanne. She answers their questions about recovery time, quotes a price range, and books their consultation for Tuesday morning."
                            </p>
                        </motion.div>
                    </div>

                    <div className="relative h-[500px] w-full">
                        <LiveVoiceInterface />
                    </div>
                </div>
            </div>
        </section>
    );
}
