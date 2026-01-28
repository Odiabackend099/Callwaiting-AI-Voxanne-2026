"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { Check } from "lucide-react";

const plans = [
    {
        name: "Starter",
        price: "$99",
        period: "/mo",
        description: "Perfect for solo practitioners or small clinics",
        features: [
            "500 calls/month",
            "Google Calendar integration",
            "Basic analytics",
            "Email support",
        ],
        cta: "Start Free Trial",
        variant: "outline" as const,
    },
    {
        name: "Professional",
        price: "$299",
        period: "/mo",
        description: "For growing practices with high call volume",
        features: [
            "2,000 calls/month",
            "EHR integration",
            "Advanced analytics",
            "Custom voice",
            "Priority support",
        ],
        cta: "Start Free Trial",
        variant: "default" as const,
        popular: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For multi-location practices and medical groups",
        features: [
            "Unlimited calls",
            "White-glove onboarding",
            "Dedicated success manager",
            "SLA guarantees",
            "24/7 phone support",
        ],
        cta: "Contact Sales",
        variant: "secondary" as const, // Using secondary for distinct look, or could be outline/default with different styling
    },
];

export default function Pricing() {
    return (
        <section id="pricing" className="py-24 bg-slate-50">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-4xl font-bold text-navy-900 tracking-tight mb-4">
                            Simple, Transparent Pricing
                        </h2>
                        <p className="text-lg text-slate-600">
                            No setup fees. No long-term contracts. Cancel anytime.
                        </p>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <FadeIn key={plan.name} delay={index * 0.1} className={`relative bg-white rounded-3xl p-8 shadow-sm border ${plan.popular ? 'border-surgical-600 ring-1 ring-surgical-600' : 'border-slate-200'}`}>
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-surgical-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                                    Most Popular
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-navy-900 mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-4xl font-bold text-navy-900">{plan.price}</span>
                                <span className="text-slate-500">{plan.period}</span>
                            </div>
                            <p className="text-slate-600 mb-8 h-12">{plan.description}</p>

                            <a 
                                href={plan.name === "Enterprise" ? "mailto:sales@voxanne.ai" : "https://calendly.com/callwaitingai/demo"} 
                                target={plan.name === "Enterprise" ? undefined : "_blank"} 
                                rel={plan.name === "Enterprise" ? undefined : "noopener noreferrer"}
                                className="block w-full"
                            >
                                <Button
                                    variant={plan.variant}
                                    className={`w-full mb-8 ${plan.popular ? 'bg-surgical-600 hover:bg-surgical-700' : ''}`}
                                >
                                    {plan.cta}
                                </Button>
                            </a>

                            <ul className="space-y-4">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                                        <Check className="h-5 w-5 text-surgical-600 shrink-0" />
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
