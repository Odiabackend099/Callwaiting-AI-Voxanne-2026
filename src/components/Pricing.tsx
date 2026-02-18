"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Check, Wallet, Phone, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const TIERS = [
    {
        name: "Starter",
        price: "Pay As You Go",
        description: "Perfect for solo practitioners and new clinics.",
        features: [
            "AI Receptionist 24/7",
            "Appointment Booking",
            "Basic Call Analytics",
            "Email & SMS Notifications",
            "Standard Voice Library",
        ],
        cta: "Start for Free",
        highlight: false,
    },
    {
        name: "Growth",
        price: "$100",
        period: "/ month credit",
        description: "For busy clinics that need more power and priority.",
        features: [
            "Everything in Starter",
            "Prioritized Call Handling",
            "Custom Voice Cloning",
            "EHR Integration (Athena, DrChrono)",
            "Advanced Analytics Dashboard",
            "Dedicated Support Manager",
        ],
        cta: "Get Growth",
        highlight: true, // Most popular
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "Full-scale automation for hospitals and networks.",
        features: [
            "Everything in Growth",
            "HIPAA BAA Signed",
            "Custom LLM Fine-Tuning",
            "Multi-Location Management",
            "SSO & Role-Based Access",
            "SLA Guarantees",
        ],
        cta: "Contact Sales",
        highlight: false,
    },
];

export default function Pricing() {
    return (
        <section id="pricing" className="py-32 bg-surgical-50 relative overflow-hidden">
            <div className="section-container relative z-10">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-surgical-200 rounded-full text-xs font-medium text-surgical-700 mb-8 uppercase tracking-widest">
                            <Wallet className="h-3.5 w-3.5" />
                            Transparent Pricing
                        </span>
                        <h2 className="font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-obsidian tracking-tight mb-6">
                            Simple Plans. <span className="font-sans font-semibold text-surgical-600">No Surprises.</span>
                        </h2>
                        <p className="text-lg text-obsidian/50">
                            Start with flexible pay-as-you-go or save with our volume plans. No lock-in contracts.
                        </p>
                    </div>
                </FadeIn>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
                    {TIERS.map((tier, index) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative rounded-2xl p-8 flex flex-col ${tier.highlight
                                    ? "bg-white border-2 border-surgical-600 shadow-lg scale-105 z-10"
                                    : "bg-white border border-surgical-200 transition-shadow duration-500 hover:shadow-md"
                                }`}
                        >
                            {tier.highlight && (
                                <div className="absolute -top-3 inset-x-0 flex justify-center">
                                    <span className="bg-surgical-600 text-white text-xs font-medium px-4 py-1 rounded-full uppercase tracking-widest">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-2xl font-semibold text-obsidian mb-2">{tier.name}</h3>
                                <p className="text-obsidian/50 text-sm h-10">{tier.description}</p>
                            </div>

                            <div className="mb-8">
                                <span className="text-4xl font-sans font-bold text-obsidian">{tier.price}</span>
                                {tier.period && <span className="text-obsidian/40 text-sm ml-1">{tier.period}</span>}
                            </div>

                            <ul className="space-y-4 mb-8 flex-grow">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-obsidian/70 text-sm">
                                        <div className="bg-surgical-50 rounded-full p-1 mt-0.5 shrink-0">
                                            <Check className="h-3 w-3 text-surgical-600" />
                                        </div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Link href="/start" className="block w-full">
                                {tier.highlight ? (
                                    <button className="btn-fill w-full py-4 text-sm font-medium rounded-lg bg-surgical-600 text-white uppercase tracking-wide hover:text-white transition-all duration-500">
                                        {tier.cta}
                                    </button>
                                ) : (
                                    <button className="w-full py-4 text-sm font-medium rounded-lg bg-surgical-50 hover:bg-surgical-100 text-surgical-700 border border-surgical-200 uppercase tracking-wide transition-all duration-500">
                                        {tier.cta}
                                    </button>
                                )}
                            </Link>

                        </motion.div>
                    ))}
                </div>

                {/* Guarantee / Footer */}
                <FadeIn delay={0.4}>
                    <div className="text-center max-w-2xl mx-auto border-t border-surgical-200 pt-12">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-6">
                            <div className="flex items-center gap-2 text-obsidian/50">
                                <ShieldCheck className="h-5 w-5 text-surgical-600" />
                                <span className="font-medium text-sm">30-Day Money Back Guarantee</span>
                            </div>
                            <div className="hidden md:block w-px h-5 bg-surgical-200" />
                            <div className="flex items-center gap-2 text-obsidian/50">
                                <Zap className="h-5 w-5 text-surgical-500" />
                                <span className="font-medium text-sm">Cancel Anytime</span>
                            </div>
                        </div>
                        <p className="text-xs text-obsidian/40">
                            Prices exclude applicable taxes. High volume discounts available for enterprise customers.
                        </p>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
