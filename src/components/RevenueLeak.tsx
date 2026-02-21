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

    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.9, 1], [0, 1, 1, 0]);

    // Illustrative industry estimate based on published healthcare no-show data
    const lostRevenue = 35000;

    return (
        <section ref={containerRef} className="relative py-24 md:py-32 bg-obsidian text-white overflow-hidden">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">

                    <motion.div
                        style={{ opacity }}
                        className="order-2 md:order-1 relative"
                    >
                        <div className="relative aspect-[4/5] w-full max-w-md mx-auto md:mr-auto rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                            <Image
                                src="/clinic-interior.png"
                                alt="Empty Clinic Reception"
                                fill
                                sizes="(max-width: 768px) 100vw, 448px"
                                className="object-cover grayscale hover:grayscale-0 transition-all duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <p className="text-red-500 font-bold tracking-widest uppercase mb-2 text-sm flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    Estimated Monthly Loss
                                </p>
                                <p className="text-white text-xs mb-1 uppercase tracking-wider opacity-60">Average clinic revenue lost to missed calls per month</p>
                                <div className="text-5xl font-mono font-bold text-white tracking-tight tabular-nums">
                                    £{lostRevenue.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="order-1 md:order-2">
                        <motion.h2
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight"
                        >
                            THE SILENT <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600">
                                REVENUE MASSACRE
                            </span>
                        </motion.h2>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="space-y-6 text-lg text-surgical-100 font-light"
                        >
                            <p className="text-xl text-white font-medium border-l-4 border-red-500 pl-4">
                                Right now, while you&apos;re reading this:
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <span className="text-red-500 text-xl font-bold">❌</span>
                                    <span>3 BBL inquiries went to voicemail <span className="text-red-400 font-bold">(£25,500 lost)</span></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-500 text-xl font-bold">❌</span>
                                    <span>2 Botox appointments called your competitor <span className="text-red-400 font-bold">(£1,400 lost)</span></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-500 text-xl font-bold">❌</span>
                                    <span>1 rhinoplasty consult gave up after 4 rings <span className="text-red-400 font-bold">(£8,500 lost)</span></span>
                                </li>
                            </ul>

                            <div className="pt-6 border-t border-white/10 mt-6">
                                <p className="text-base">
                                    Your front desk isn&apos;t lazy. They&apos;re human. Humans take lunch breaks. Humans go home at 6 PM.
                                </p>
                                <p className="text-xl mt-2 text-white font-semibold">
                                    Your revenue doesn&apos;t.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
}
