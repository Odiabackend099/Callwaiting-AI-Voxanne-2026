"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

export default function RevenueLeak() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.9, 1], [0, 1, 1, 0]);

    return (
        <section ref={containerRef} className="relative py-24 md:py-32 bg-[#050505] text-white overflow-hidden">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">

                    <motion.div
                        style={{ opacity }}
                        className="order-2 md:order-1 relative"
                    >
                        <div className="relative aspect-[4/5] w-full max-w-md mx-auto md:mr-auto rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                            {/* Using one of the provided assets for "Revenue Leak" contexts */}
                            <Image
                                src="/clinic-interior.png"
                                alt="Luxury Plastic Surgery Clinic Interior"
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 p-6">
                                <p className="text-red-400 font-bold tracking-wider uppercase mb-2">Critical Alert</p>
                                <h3 className="text-2xl font-bold">Unanswered Calls = Lost Revenue</h3>
                            </div>
                        </div>

                        {/* Floating stats card */}
                        <motion.div
                            style={{ y }}
                            className="absolute -right-4 top-1/2 -translate-y-1/2 bg-zinc-900/90 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-xl max-w-xs"
                        >
                            <p className="text-zinc-400 text-sm mb-1 uppercase tracking-wider">Missed Opportunity</p>
                            <p className="text-4xl font-bold text-white mb-2">$10,400</p>
                            <p className="text-xs text-zinc-500">Average weekly loss for clinics missing 15% of calls.</p>
                        </motion.div>
                    </motion.div>

                    <div className="order-1 md:order-2">
                        <motion.h2
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="text-4xl md:text-6xl font-bold mb-8 leading-tight"
                        >
                            The <span className="text-red-500">Silent</span> Revenue Drain.
                        </motion.h2>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="space-y-6 text-lg text-zinc-400 font-light"
                        >
                            <p>
                                Every time your front desk is busy, on a break, or the clinic is closed, you are losing high-value patients to competitors who pick up the phone.
                            </p>
                            <p>
                                <strong className="text-white font-semibold">The $10K Holiday Phone Tax</strong> is real. During peak seasons, call volume spikes, and missed calls skyrocket. Can you afford to ghost your future patients?
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            className="mt-10 grid grid-cols-2 gap-6"
                        >
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <p className="text-3xl font-bold text-white mb-1">62%</p>
                                <p className="text-sm text-zinc-500">Calls go to voicemail in typical clinics</p>
                            </div>
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <p className="text-3xl font-bold text-white mb-1">0%</p>
                                <p className="text-sm text-zinc-500">Leave a voicemail. They just call the next clinic.</p>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
}
