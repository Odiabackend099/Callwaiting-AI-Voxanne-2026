"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Wallet, Zap, ArrowRight, ShieldCheck, Sparkles, Star } from "lucide-react";
import Link from 'next/link';

const TIERS = [
    {
        name: "Starter",
        badge: null,
        price: "Pay As You Go",
        priceNote: "No monthly fee",
        description: "Perfect for solo practitioners and new clinics.",
        features: [
            "AI Receptionist 24/7",
            "Appointment Booking",
            "Basic Call Analytics",
            "Email & SMS Notifications",
            "Standard Voice Library",
        ],
        cta: "Start for Free",
        href: "/start",
        variant: "ghost" as const,
        gradientTop: "from-surgical-300/20 to-transparent",
    },
    {
        name: "Growth",
        badge: { text: "Most Popular", icon: Star },
        price: "$100",
        priceNote: "/ month credit",
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
        href: "/start",
        variant: "primary" as const,
        gradientTop: "from-white/20 to-transparent",
    },
    {
        name: "Enterprise",
        badge: null,
        price: "Custom",
        priceNote: "Tailored to your network",
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
        href: "/start",
        variant: "ghost" as const,
        gradientTop: "from-surgical-300/20 to-transparent",
    },
];

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const featureVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.05, duration: 0.4 },
    }),
};

function PricingCard({ tier }: { tier: typeof TIERS[0] }) {
    const isPrimary = tier.variant === "primary";
    const BadgeIcon = tier.badge?.icon;

    return (
        <motion.div
            variants={cardVariants}
            whileHover={!isPrimary ? { y: -6, boxShadow: "0 24px 60px rgba(29,78,216,0.10)" } : {}}
            className={`relative flex flex-col rounded-3xl overflow-hidden transition-all duration-400 ${isPrimary
                ? "bg-surgical-600 text-white shadow-2xl shadow-surgical-600/30 scale-105 z-10"
                : "bg-white border border-surgical-100 shadow-sm"
                }`}
        >
            {/* Top gradient shimmer */}
            <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${tier.gradientTop} pointer-events-none`} />

            {/* Popular badge */}
            {tier.badge && BadgeIcon && (
                <div className="flex justify-center pt-5 relative z-10">
                    <motion.div
                        animate={{ scale: [1, 1.04, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[11px] font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest"
                    >
                        <BadgeIcon className="w-3 h-3 fill-current" />
                        {tier.badge.text}
                    </motion.div>
                </div>
            )}

            <div className={`p-8 flex flex-col flex-1 relative z-10 ${tier.badge ? "pt-4" : "pt-8"}`}>
                {/* Name + desc */}
                <div className="mb-6">
                    <h3 className={`text-2xl font-semibold mb-1.5 ${isPrimary ? "text-white" : "text-obsidian"}`}>
                        {tier.name}
                    </h3>
                    <p className={`text-sm leading-relaxed ${isPrimary ? "text-white/65" : "text-obsidian/50"}`}>
                        {tier.description}
                    </p>
                </div>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-current/10">
                    <div className={`text-4xl font-black tracking-tight ${isPrimary ? "text-white" : "text-obsidian"}`}>
                        {tier.price}
                    </div>
                    <p className={`text-sm mt-1 ${isPrimary ? "text-white/55" : "text-obsidian/40"}`}>
                        {tier.priceNote}
                    </p>
                </div>

                {/* Feature list */}
                <ul className="space-y-3.5 flex-1 mb-8">
                    {tier.features.map((feature, i) => (
                        <motion.li
                            key={feature}
                            custom={i}
                            variants={featureVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="flex items-start gap-3"
                        >
                            <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${isPrimary ? "bg-white/20" : "bg-surgical-50"
                                }`}>
                                <Check className={`w-3 h-3 ${isPrimary ? "text-white" : "text-surgical-600"}`} />
                            </div>
                            <span className={`text-sm ${isPrimary ? "text-white/80" : "text-obsidian/65"}`}>
                                {feature}
                            </span>
                        </motion.li>
                    ))}
                </ul>

                {/* CTA Button */}
                <Link href={tier.href} className="block">
                    {isPrimary ? (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="relative w-full py-4 rounded-2xl bg-white text-surgical-700 font-semibold text-sm uppercase tracking-wide overflow-hidden group"
                        >
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-surgical-100/60 to-transparent skew-x-[-20deg]" />
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {tier.cta}
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </span>
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ borderColor: '#1D4ED8', color: '#1D4ED8' }}
                            whileTap={{ scale: 0.97 }}
                            className="relative w-full py-4 rounded-2xl border border-surgical-200 text-surgical-700 font-semibold text-sm uppercase tracking-wide overflow-hidden group transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            {/* fill sweep on hover */}
                            <span className="absolute inset-0 bg-surgical-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out rounded-2xl" />
                            <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                                {tier.cta}
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </span>
                        </motion.button>
                    )}
                </Link>
            </div>
        </motion.div>
    );
}

export default function Pricing() {
    const [isAnnual, setIsAnnual] = useState(false);

    return (
        <section id="pricing" className="py-32 bg-surgical-50 relative overflow-hidden">
            {/* Subtle ambient blobs */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-5 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #1D4ED8, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] opacity-5 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #3B82F6, transparent 70%)' }} />

            <div className="section-container relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-surgical-200 rounded-full text-xs font-medium text-surgical-700 mb-8 uppercase tracking-widest">
                        <Wallet className="h-3.5 w-3.5" />
                        Transparent Pricing
                    </span>
                    <h2 className="font-sans font-bold text-4xl md:text-5xl lg:text-6xl text-obsidian tracking-tight mb-6">
                        Simple Plans.{" "}
                        <span className="font-sans font-semibold text-surgical-600">No Surprises.</span>
                    </h2>
                    <p className="text-lg text-obsidian/50 mb-10">
                        Start with flexible pay-as-you-go or save with our volume plans. No lock-in contracts.
                    </p>

                    {/* Annual/Monthly toggle */}
                    <div className="inline-flex items-center gap-3 bg-white border border-surgical-200 rounded-full p-1.5 shadow-sm">
                        <button
                            onClick={() => setIsAnnual(false)}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${!isAnnual ? "bg-surgical-600 text-white shadow-md" : "text-obsidian/50 hover:text-obsidian"}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsAnnual(true)}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 ${isAnnual ? "bg-surgical-600 text-white shadow-md" : "text-obsidian/50 hover:text-obsidian"}`}
                        >
                            Annual
                            <AnimatePresence>
                                {isAnnual && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        className="text-[10px] bg-white/20 rounded-full px-1.5 py-0.5 font-bold"
                                    >
                                        20% off
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </button>
                    </div>
                </motion.div>

                {/* Cards */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20 items-center"
                >
                    {TIERS.map((tier) => (
                        <PricingCard key={tier.name} tier={tier} />
                    ))}
                </motion.div>

                {/* Footer trust badges */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="text-center max-w-2xl mx-auto border-t border-surgical-200 pt-12"
                >
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
                        <div className="hidden md:block w-px h-5 bg-surgical-200" />
                        <div className="flex items-center gap-2 text-obsidian/50">
                            <Sparkles className="h-5 w-5 text-surgical-400" />
                            <span className="font-medium text-sm">No Setup Fees</span>
                        </div>
                    </div>
                    <p className="text-xs text-obsidian/35">
                        Prices exclude applicable taxes. High volume discounts available for enterprise customers.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
