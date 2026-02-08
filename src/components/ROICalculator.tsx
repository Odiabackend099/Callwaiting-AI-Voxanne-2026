"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, DollarSign, Phone } from "lucide-react";

export const ROICalculator = () => {
    const [missedCallsPerWeek, setMissedCallsPerWeek] = useState(10);

    // Calculations using REAL 2025 industry data
    const missedCallsPerMonth = missedCallsPerWeek * 4;

    // Research-backed figures (December 2025):
    // - Average procedure value: $10,000 (blended avg of surgeries + med spa)
    // - Conversion rate: 30% (realistic for phone inquiries in cosmetic surgery)
    // Sources: ASPS 2025 Statistics, FirstPageSage Conversion Data
    const avgProcedureValue = 10000;
    const conversionRate = 0.30;

    const monthlyRevenueLoss = Math.round(missedCallsPerMonth * avgProcedureValue * conversionRate);
    const yearlyRevenueLoss = monthlyRevenueLoss * 12;

    // With Voxanne AI (98% call answer rate - industry-leading)
    const withVoxanneAIMissed = Math.round(missedCallsPerMonth * 0.02);
    const withVoxanneAIRevenueSaved = Math.round((missedCallsPerMonth - withVoxanneAIMissed) * avgProcedureValue * conversionRate);
    const yearlyRevenueSaved = withVoxanneAIRevenueSaved * 12;

    return (
        <div className="relative py-24 px-6 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            <div className="container mx-auto max-w-5xl relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold mb-6"
                    >
                        <TrendingDown className="w-4 h-4" />
                        Revenue Leak Calculator
                    </motion.div>
                    <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
                        How Much Are You <span className="text-red-400">Losing</span>?
                    </h2>
                    <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                        Every missed call is a missed surgery. Calculate your exact revenue loss below.
                    </p>
                </div>

                {/* Calculator Card */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl">
                    {/* Slider Section */}
                    <div className="mb-12">
                        <label className="block text-white font-bold text-lg mb-6">
                            How many calls do you miss per week?
                        </label>
                        <div className="relative">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={missedCallsPerWeek}
                                onChange={(e) => setMissedCallsPerWeek(Number(e.target.value))}
                                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                style={{
                                    background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${missedCallsPerWeek}%, #334155 ${missedCallsPerWeek}%, #334155 100%)`
                                }}
                            />
                            <div className="flex justify-between mt-3 text-sm text-slate-400">
                                <span>0 calls</span>
                                <span>100 calls</span>
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <motion.div
                                key={missedCallsPerWeek}
                                initial={{ scale: 1.2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-red-500/20 border border-red-500/30"
                            >
                                <Phone className="w-6 h-6 text-red-400" />
                                <span className="text-4xl font-bold text-white">{missedCallsPerWeek}</span>
                                <span className="text-slate-300">missed calls/week</span>
                            </motion.div>
                        </div>
                    </div>

                    {/* Results Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Without Voxanne AI */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-red-500/20"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                                <h3 className="font-bold text-white">Without Voxanne AI</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-slate-400 text-sm mb-1">Monthly Revenue Loss</p>
                                    <motion.p
                                        key={monthlyRevenueLoss}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-3xl font-bold text-red-400"
                                    >
                                        ${monthlyRevenueLoss.toLocaleString()}
                                    </motion.p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-sm mb-1">Yearly Revenue Loss</p>
                                    <motion.p
                                        key={yearlyRevenueLoss}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-2xl font-bold text-red-300"
                                    >
                                        ${yearlyRevenueLoss.toLocaleString()}
                                    </motion.p>
                                </div>
                                <div className="pt-4 border-t border-red-500/20">
                                    <p className="text-xs text-slate-400">
                                        Based on {missedCallsPerMonth} missed calls/month × ${avgProcedureValue.toLocaleString()} avg procedure × {conversionRate * 100}% conversion
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* With Voxanne AI */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-emerald-500/10 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                            <div className="flex items-center gap-2 mb-4 relative z-10">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                <h3 className="font-bold text-white">With Voxanne AI</h3>
                            </div>
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <p className="text-slate-400 text-sm mb-1">Monthly Revenue Saved</p>
                                    <motion.p
                                        key={withVoxanneAIRevenueSaved}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-3xl font-bold text-emerald-400"
                                    >
                                        ${withVoxanneAIRevenueSaved.toLocaleString()}
                                    </motion.p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-sm mb-1">Yearly Revenue Saved</p>
                                    <motion.p
                                        key={withVoxanneAIRevenueSaved * 12}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-2xl font-bold text-emerald-300"
                                    >
                                        ${(withVoxanneAIRevenueSaved * 12).toLocaleString()}
                                    </motion.p>
                                </div>
                                <div className="pt-4 border-t border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                        <DollarSign className="w-4 h-4" />
                                        <span>98% Call Answer Rate</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Only {withVoxanneAIMissed} missed calls/month
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* CTA */}
                    <div className="mt-10 text-center">
                        <p className="text-slate-300 mb-4">
                            Stop losing <span className="text-red-400 font-bold">${monthlyRevenueLoss.toLocaleString()}/month</span>.
                            Start saving with Call Waiting AI.
                        </p>
                        <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-cyan-500/40 hover:scale-105 transition-all shadow-xl">
                            Get Your Free ROI Report
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .slider-thumb::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #ef4444;
                    cursor: pointer;
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
                    transition: all 0.2s;
                }
                .slider-thumb::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.3);
                }
                .slider-thumb::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #ef4444;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
                    transition: all 0.2s;
                }
                .slider-thumb::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.3);
                }
            `}</style>
        </div>
    );
};
