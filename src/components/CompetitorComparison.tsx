"use client";

import { motion } from "framer-motion";
import { Check, X, Zap } from "lucide-react";

interface ComparisonRow {
    feature: string;
    voxanne: boolean | string;
    generic: boolean | string;
    highlight?: boolean;
}

const comparisonData: ComparisonRow[] = [
    { feature: "Medical-Specific Training", voxanne: true, generic: false, highlight: true },
    { feature: "UK GDPR & HIPAA Compliance", voxanne: true, generic: "Varies", highlight: true },
    { feature: "Calendar Integration", voxanne: true, generic: false, highlight: true },
    { feature: "Procedure Knowledge (BBL, Rhinoplasty, etc.)", voxanne: "500+ procedures", generic: "Basic only" },
    { feature: "UK + US Support", voxanne: true, generic: "US only" },
    { feature: "British English Voice", voxanne: true, generic: false, highlight: true },
    { feature: "Emergency Escalation Protocol", voxanne: true, generic: "Basic" },
    { feature: "Price Objection Handling", voxanne: "Trained", generic: "Generic" },
    { feature: "After-Hours Triage", voxanne: true, generic: false },
    { feature: "Instagram/WhatsApp Integration", voxanne: true, generic: false },
    { feature: "Setup Time", voxanne: "48 hours", generic: "1-2 weeks" },
    { feature: "Monthly Cost", voxanne: "From £299", generic: "From £500" },
    { feature: "Contract Length", voxanne: "Month-to-month", generic: "12 months" },
    { feature: "Money-Back Guarantee", voxanne: "30 days", generic: "None" }
];

export default function CompetitorComparison() {
    return (
        <section className="py-24 bg-gradient-to-b from-slate-950 to-black relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6"
                    >
                        <Zap className="w-4 h-4" />
                        <span>Why Voxanne AI Wins</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        Voxanne AI vs. Generic AI Receptionists
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 max-w-2xl mx-auto text-lg"
                    >
                        Built specifically for medical aesthetics. Not a one-size-fits-all chatbot.
                    </motion.p>
                </div>

                {/* Comparison Table */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="max-w-5xl mx-auto"
                >
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-white/10 overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-3 gap-4 p-6 bg-slate-900/80 border-b border-white/10">
                            <div className="text-slate-400 font-medium">Feature</div>
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm">
                                    <Check className="w-4 h-4" />
                                    Voxanne AI
                                </div>
                            </div>
                            <div className="text-center text-slate-400 font-medium">Generic AI</div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-white/5">
                            {comparisonData.map((row, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`grid grid-cols-3 gap-4 p-6 transition-colors ${row.highlight
                                            ? 'bg-cyan-500/5 hover:bg-cyan-500/10'
                                            : 'hover:bg-slate-800/30'
                                        }`}
                                >
                                    {/* Feature Name */}
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium ${row.highlight ? 'text-cyan-400' : 'text-white'}`}>
                                            {row.feature}
                                        </span>
                                        {row.highlight && (
                                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                                                KEY
                                            </span>
                                        )}
                                    </div>

                                    {/* Voxanne AI Column */}
                                    <div className="flex items-center justify-center">
                                        {typeof row.voxanne === 'boolean' ? (
                                            row.voxanne ? (
                                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-green-400" strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                                    <X className="w-5 h-5 text-red-400" strokeWidth={3} />
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-green-400 font-semibold text-sm">{row.voxanne}</span>
                                        )}
                                    </div>

                                    {/* Generic AI Column */}
                                    <div className="flex items-center justify-center">
                                        {typeof row.generic === 'boolean' ? (
                                            row.generic ? (
                                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-green-400" strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                                    <X className="w-5 h-5 text-red-400" strokeWidth={3} />
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-slate-400 font-medium text-sm">{row.generic}</span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Footer CTA */}
                        <div className="p-8 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-t border-white/10 text-center">
                            <p className="text-white font-semibold mb-4">
                                Ready to see the difference?
                            </p>
                            <button className="px-8 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                                Book a Demo Call
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Bottom Note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center text-slate-500 text-sm mt-8"
                >
                    * Comparison based on leading AI receptionist platforms as of December 2025
                </motion.p>
            </div>
        </section>
    );
}
