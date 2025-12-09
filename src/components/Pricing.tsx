"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function Pricing({ onBookDemo }: { onBookDemo?: () => void }) {
    return (
        <section className="py-24 px-6 bg-black relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black opacity-50" />

            <div className="container mx-auto max-w-7xl relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4 text-white">One Surgery Covers Roxanne for a Year.</h2>
                    <p className="text-xl text-emerald-400 font-bold">Don't let another $15,000 procedure slip through the cracks.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {[
                        {
                            name: "Essentials",
                            setup: "$449",
                            monthly: "$169",
                            desc: "Perfect for solo aestheticians & small salons getting started",
                            roi: "Pays for itself with 1 booking",
                            features: [
                                "Natural human-like voice",
                                "Instant appointment booking",
                                "Answers FAQs 24/7",
                                "Unlimited calls & minutes",
                                "Call transcripts + dashboard",
                                "Email/SMS notifications",
                            ],
                        },
                        {
                            name: "Growth",
                            setup: "$949",
                            monthly: "$289",
                            desc: "The #1 choice for busy clinics that never want to miss a lead",
                            popular: true,
                            features: [
                                "Everything in Essentials, plus:",
                                "Custom voice cloning",
                                "Full CRM integration (Mindbody, etc)",
                                "Intelligent upsell questions",
                                "After-hours voicemail-to-booking",
                                "Detailed analytics",
                                "Priority WhatsApp follow-up",
                            ],
                        },
                        {
                            name: "Premium",
                            setup: "$2,499",
                            monthly: "$449",
                            desc: "White-glove for high-end med-spas & multi-location groups",
                            features: [
                                "Everything in Growth, plus:",
                                "Dedicated success manager",
                                "Multi-location sync",
                                "Custom scripting & personality",
                                "Automated review requests",
                                "Advanced fallback routing",
                                "VIP phone support",
                            ],
                        },
                    ].map((plan, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className={`p-8 rounded-2xl border flex flex-col shadow-lg transition-all duration-300 ${plan.popular
                                ? "bg-zinc-900 border-cyan-500/50 shadow-cyan-900/20"
                                : "bg-zinc-900/50 border-white/10"
                                }`}
                        >
                            {plan.popular && (
                                <div className="self-start px-3 py-1 bg-cyan-500 text-white text-xs font-bold rounded-full uppercase tracking-wide mb-4">
                                    Most Popular
                                </div>
                            )}
                            <h3 className="text-2xl font-bold mb-2 text-white">{plan.name}</h3>
                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">{plan.monthly}</span>
                                    <span className="text-zinc-500">/mo</span>
                                </div>
                                <div className="text-sm font-medium text-zinc-400 mt-2">+ {plan.setup} setup</div>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-3 text-sm text-zinc-300">
                                        <Check className="w-5 h-5 text-cyan-500 shrink-0" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={onBookDemo}
                                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${plan.popular
                                    ? "bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/50"
                                    : "bg-white text-black hover:bg-zinc-200"
                                    }`}
                            >
                                Get Started
                            </button>
                        </motion.div>
                    ))}
                    <div className="mt-16 text-center text-zinc-400 text-sm">
                        <p>All plans include a 30-day money-back guarantee. No questions asked.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
