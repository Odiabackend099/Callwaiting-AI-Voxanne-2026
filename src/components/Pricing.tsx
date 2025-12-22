"use client";

import { motion } from "framer-motion";
import { Check, X, Info } from "lucide-react";

export default function Pricing({ onBookDemo }: { onBookDemo?: () => void }) {
    return (
        <section className="py-24 px-6 bg-slate-950 relative border-t border-slate-900" id="pricing">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80" />

            <div className="container mx-auto max-w-7xl relative z-10">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Transparent Pricing, No Hidden Fees
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
                        Simple, Affordable Plans <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                            For Every Practice Size
                        </span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Start with a one-time setup, then pay a monthly subscription. Scale as you grow.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                    {/* STARTER TIER */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 flex flex-col h-full hover:border-white/20 transition-all duration-300 relative group"
                    >
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">Starter</h3>
                            <div className="mb-4">
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-sm font-medium text-slate-500">Setup:</span>
                                    <span className="text-3xl font-bold text-white tracking-tight">$2,000</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-medium text-slate-500">Then:</span>
                                    <span className="text-3xl font-bold text-white tracking-tight">$500</span>
                                    <span className="text-slate-500">/mo</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-6">
                                Perfect for solo injectors or boutique aesthetic clinics.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:bg-slate-200 transition-all"
                                >
                                    Start Free Trial
                                </button>
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white hover:text-black transition-all bg-transparent"
                                >
                                    Book Demo
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-8 border-t border-white/5 flex-grow">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">What you get</div>
                            {[
                                "24/7 Call Answering",
                                "Lead Qualification",
                                "Appointment Booking",
                                "Call Transcripts",
                                "Email Notifications",
                                "Basic Analytics"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* GROWTH TIER (MOST POPULAR) */}
                    <motion.div
                        initial={{ scale: 0.95 }}
                        whileInView={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-8 flex flex-col h-full shadow-2xl shadow-cyan-900/20 relative z-10"
                    >
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                            Most Popular
                        </div>

                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-cyan-400 mb-2">Professional</h3>
                            <div className="mb-4">
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-sm font-medium text-slate-300">Setup:</span>
                                    <span className="text-3xl font-bold text-white tracking-tight">$5,000</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-medium text-slate-300">Then:</span>
                                    <span className="text-3xl font-bold text-white tracking-tight">$1,200</span>
                                    <span className="text-slate-300">/mo</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 mb-6">
                                For growing practices. Advanced features and priority support.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-slate-200 transition-all"
                                >
                                    Start Free Trial
                                </button>
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
                                >
                                    Book a Demo
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-500 mt-3">Custom setup included</p>
                        </div>

                        <div className="space-y-4 pt-8 border-t border-white/10 flex-grow">
                            <div className="text-xs font-bold text-cyan-500 uppercase tracking-wider mb-2">Everything in Starter, plus:</div>
                            {[
                                "Advanced Lead Qualification",
                                "CRM Integration (Salesforce, HubSpot)",
                                "Multi-location Support",
                                "Custom Workflows",
                                "Priority Support",
                                "Advanced Analytics & Reporting"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-white font-medium">
                                    <div className="bg-cyan-500/20 rounded-full p-0.5 mt-0.5">
                                        <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                                    </div>
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ENTERPRISE TIER */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 flex flex-col h-full hover:border-white/20 transition-all duration-300 relative"
                    >
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">Enterprise</h3>
                            <div className="flex items-baseline gap-1 mb-2">
                                <span className="text-4xl font-bold text-white tracking-tight">Custom</span>
                            </div>
                            <p className="text-sm text-slate-400 mb-6">
                                For multi-location practices and franchise groups. Custom pricing and features.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:bg-slate-200 transition-all"
                                >
                                    Start Free Trial
                                </button>
                                <button
                                    onClick={onBookDemo}
                                    className="w-full py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white hover:text-black transition-all bg-transparent"
                                >
                                    Contact Sales
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-8 border-t border-white/5 flex-grow">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Everything in Professional, plus:</div>
                            {[
                                "White Label Options",
                                "Multi-location Dashboard",
                                "Dedicated Success Manager",
                                "Custom Integrations",
                                "HIPAA BAA Contract",
                                "SLA Guarantees"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                    <Check className="w-5 h-5 text-slate-500 shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>Compare to average UK receptionist salary: <strong>£24,500/yr</strong> vs. Call Waiting AI <strong>£5,964/yr</strong></span>
                    </p>
                </div>
            </div>
        </section>
    );
}
