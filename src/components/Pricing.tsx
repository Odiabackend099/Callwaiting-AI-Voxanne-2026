"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
    {
        name: "Starter",
        price: "£350",
        period: "/month",
        setupFee: "£1,000 setup fee",
        description: "Perfect for solo practitioners or small clinics",
        usage: "400",
        usageLabel: "minutes/month",
        overage: "£0.45/min",
        features: [
            "400 included minutes/month",
            "Overage billing at £0.45/min",
            "Google Calendar integration",
            "Basic analytics dashboard",
            "Email support",
        ],
        cta: "Start Free Trial",
        variant: "outline" as const,
    },
    {
        name: "Professional",
        price: "£550",
        period: "/month",
        setupFee: "£3,000 setup fee",
        description: "For growing practices with moderate to high call volume",
        usage: "1,200",
        usageLabel: "minutes/month",
        overage: "£0.40/min",
        features: [
            "1,200 included minutes/month",
            "Overage billing at £0.40/min",
            "EHR system integration",
            "Advanced analytics",
            "Custom AI training",
            "Priority support",
        ],
        cta: "Start Free Trial",
        variant: "default" as const,
        popular: true,
    },
    {
        name: "Enterprise",
        price: "£800",
        period: "/month",
        setupFee: "£7,000 setup fee",
        description: "For multi-location practices and medical groups",
        usage: "2,000",
        usageLabel: "minutes/month",
        overage: "£0.35/min",
        features: [
            "2,000 included minutes/month",
            "Overage billing at £0.35/min",
            "White-glove onboarding",
            "Dedicated success manager",
            "24/7 phone support",
            "SLA guarantees",
        ],
        cta: "Contact Sales",
        variant: "secondary" as const,
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
                            Choose the plan that fits your practice. Cancel anytime.
                        </p>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <FadeIn key={plan.name} delay={index * 0.1} className={`relative bg-white rounded-3xl p-8 shadow-sm border ${plan.popular ? 'border-surgical-600 ring-1 ring-surgical-600' : 'border-slate-200'}`}>
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-surgical-600 text-white px-4 py-1 rounded-full text-sm font-medium uppercase tracking-wide">
                                    Most Popular
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-deep-obsidian mb-2">{plan.name}</h3>
                            <p className="text-slate-600 mb-4 text-sm">{plan.description}</p>

                            <div className="mb-1">
                                <span className="text-4xl font-bold text-surgical-600">{plan.price}</span>
                                <span className="text-slate-500 ml-1">{plan.period}</span>
                            </div>
                            <p className="text-sm text-slate-400 mb-6">{plan.setupFee}</p>

                            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Included Usage</p>
                                <p className="text-2xl font-bold text-surgical-600">{plan.usage} <span className="text-sm font-normal text-slate-500">{plan.usageLabel}</span></p>
                                <p className="text-xs text-slate-400 mt-1">Overage: {plan.overage}</p>
                            </div>

                            <a
                                href={plan.name === "Enterprise" ? "mailto:sales@voxanne.ai" : "https://calendly.com/callwaitingai/demo"}
                                target={plan.name === "Enterprise" ? undefined : "_blank"}
                                rel={plan.name === "Enterprise" ? undefined : "noopener noreferrer"}
                                className="block w-full"
                            >
                                <Button
                                    variant={plan.variant}
                                    className={`w-full mb-6 ${plan.popular ? 'bg-surgical-600 hover:bg-surgical-700 text-white' : ''}`}
                                >
                                    {plan.cta}
                                </Button>
                            </a>

                            <ul className="space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
