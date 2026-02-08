"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Check, Wallet, Phone, Zap } from "lucide-react";
import Link from "next/link";

const TOP_UP_OPTIONS = [
    { label: "$25", pence: 1975, minutes: "~35 min" },
    { label: "$50", pence: 3950, minutes: "~71 min" },
    { label: "$100", pence: 7900, minutes: "~142 min" },
    { label: "$250", pence: 19750, minutes: "~357 min" },
    { label: "$600", pence: 47400, minutes: "~857 min" },
];

const FEATURES = [
    "AI voice receptionist — answers 24/7",
    "Appointment booking with calendar sync",
    "SMS confirmations & reminders",
    "Call recording & transcripts",
    "Knowledge base & FAQ answering",
    "Lead scoring & analytics dashboard",
    "Google Calendar integration",
    "HIPAA & GDPR compliant",
    "No setup fees, no contracts",
];

const STEPS = [
    {
        icon: Wallet,
        title: "Top Up",
        description: "Top up from $25",
    },
    {
        icon: Phone,
        title: "AI Handles Calls",
        description: "Your agent answers every call, 24/7",
    },
    {
        icon: Zap,
        title: "Pay Per Use",
        description: "Credits deducted per minute of call time",
    },
];

export default function Pricing() {
    return (
        <section id="pricing" className="py-24 bg-sterile-wash">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-4xl font-bold text-deep-obsidian tracking-tight mb-4">
                            Simple, Transparent Pricing
                        </h2>
                        <p className="text-lg text-slate-600">
                            Pay only for what you use. No subscriptions, no setup fees, no lock-in.
                        </p>
                    </div>
                </FadeIn>

                {/* Central Pricing Card */}
                <FadeIn delay={0.1}>
                    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-surgical-600 ring-1 ring-surgical-600 mb-16">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-deep-obsidian mb-2">Pay As You Go</h3>
                            <p className="text-slate-600 text-sm">
                                Top up your wallet. AI handles calls. Credits deducted per minute.
                            </p>
                        </div>

                        <div className="text-center mb-8">
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-5xl font-bold text-surgical-600">$0.70/min</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-2">Per-second billing. No minimums. No contracts.</p>
                        </div>

                        {/* Top-up pills */}
                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            {TOP_UP_OPTIONS.map((option) => (
                                <span
                                    key={option.pence}
                                    className="px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-600 bg-slate-50"
                                >
                                    {option.label} ({option.minutes})
                                </span>
                            ))}
                            <span className="px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-400 bg-slate-50">
                                Custom
                            </span>
                        </div>

                        <Link href="/start" className="block w-full">
                            <Button className="w-full bg-surgical-600 hover:bg-surgical-700 text-white py-3 text-base">
                                Get Started
                            </Button>
                        </Link>

                        <p className="text-center text-xs text-slate-400 mt-4">
                            Set up auto-recharge to never run out of credits.
                        </p>
                    </div>
                </FadeIn>

                {/* How It Works Steps */}
                <FadeIn delay={0.2}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
                        {STEPS.map((step, index) => {
                            const Icon = step.icon;
                            return (
                                <div key={step.title} className="text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surgical-600/10 mb-4">
                                        <Icon className="w-6 h-6 text-surgical-600" />
                                    </div>
                                    <div className="text-xs font-bold text-surgical-600 uppercase tracking-wide mb-2">
                                        Step {index + 1}
                                    </div>
                                    <h4 className="text-lg font-bold text-deep-obsidian mb-1">{step.title}</h4>
                                    <p className="text-sm text-slate-500">{step.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </FadeIn>

                {/* All Features Included */}
                <FadeIn delay={0.3}>
                    <div className="max-w-3xl mx-auto">
                        <h3 className="text-xl font-bold text-deep-obsidian text-center mb-8">
                            All features included for every customer
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {FEATURES.map((feature) => (
                                <div key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
