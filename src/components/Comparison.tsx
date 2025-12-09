"use client";

import { motion } from "framer-motion";
import { Check, X, Shield, Activity, Database, BrainCircuit } from "lucide-react";

export default function Comparison() {
    return (
        <section className="py-24 px-6 bg-[#050505]">
            <div className="container mx-auto max-w-7xl">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-4xl font-bold mb-4 text-white"
                    >
                        Why Clinics Choose <span className="text-cyan-500">Roxanne</span>
                    </motion.h2>
                    <p className="text-zinc-400">Generic AI makes mistakes. Medical AI makes money.</p>
                </div>

                <div className="grid md:grid-cols-2 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                    {/* Generic AI - The Problem */}
                    <div className="p-10 bg-zinc-900/50 grayscale transition-all duration-500 hover:grayscale-0 relative group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
                        <h3 className="text-2xl font-bold mb-8 text-zinc-500 flex items-center gap-3">
                            <BrainCircuit className="w-8 h-8" />
                            Generic AI Assistants
                        </h3>
                        <ul className="space-y-6">
                            {[
                                { text: "Hallucinates medical advice", detail: "Risk of liability & lawsuits." },
                                { text: "Confuses cosmetic vs medical", detail: "Sends Botox leads to nurses." },
                                { text: "No EMR Integration", detail: "Manual data entry required." },
                                { text: "Generic Security", detail: "Not HIPAA verified for voice." },
                            ].map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex flex-col gap-1 text-zinc-500 group-hover:text-red-400/80 transition-colors"
                                >
                                    <div className="flex items-center gap-3 font-semibold">
                                        <X className="w-5 h-5 text-red-500/50" />
                                        <span>{item.text}</span>
                                    </div>
                                    <span className="text-sm pl-8 opacity-60 italic">{item.detail}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    {/* Roxanne - The Solution */}
                    <div className="p-10 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400"></div>
                        <div className="absolute inset-0 bg-cyan-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
                        <h3 className="text-2xl font-bold mb-8 text-white flex items-center gap-3">
                            <Activity className="w-8 h-8 text-cyan-400" />
                            Roxanne Medical AI
                        </h3>
                        <ul className="space-y-6 relative z-10">
                            {[
                                { text: "Zero Clinical Hallucinations", detail: "Strict medical guardrails enabled." },
                                { text: "Trained on CPT Codes", detail: "Understands BBL, Rhinoplasty, etc." },
                                { text: "Direct EMR Sync", detail: "Nextech, Mindbody, DrChrono." },
                                { text: "HIPAA & BAA Certified", detail: "Enterprise-grade patient privacy." },
                            ].map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex flex-col gap-1 text-white"
                                >
                                    <div className="flex items-center gap-3 font-semibold">
                                        <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[10px]"><Check strokeWidth={4} /></div>
                                        <span>{item.text}</span>
                                    </div>
                                    <span className="text-sm pl-8 text-cyan-400 font-medium">{item.detail}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
