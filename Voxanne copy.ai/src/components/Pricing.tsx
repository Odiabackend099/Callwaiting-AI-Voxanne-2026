"use client";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const plans = [
    {
        name: "Starter",
        price: "£99",
        period: "/month",
        description: "Perfect for solo practitioners and small clinics.",
        features: ["300 AI Minutes", "Standard Voice Selection", "Email Support", "Basic Calendar Sync"],
        cta: "Start Trial",
        popular: false
    },
    {
        name: "Professional",
        price: "£299",
        period: "/month",
        description: "For growing clinics that need full automation.",
        features: ["1,000 AI Minutes", "RAG Knowledge Base", "Priority Phone Support", "Advanced Analytics", "Zero-Latency Mode"],
        cta: "Get Started",
        popular: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "Tailored solutions for hospital networks.",
        features: ["Unlimited Minutes", "Custom Voice Cloning", "Dedicated Account Manager", "SLA Guarantees", "On-Premise Deployment"],
        cta: "Contact Sales",
        popular: false
    }
];

const easeOutExpo: [number, number, number, number] = [0.19, 1, 0.22, 1];

const container = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: easeOutExpo }
    }
};

export function Pricing() {
    return (
        <Section className="bg-white">
            <div className="text-center mb-16">
                <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: easeOutExpo }}
                    className="text-3xl font-bold text-navy-900"
                >
                    Simple, Transparent Pricing
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1, ease: easeOutExpo }}
                    className="text-slate-600 mt-4"
                >
                    No hidden fees. Scale as your clinic grows.
                </motion.p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4"
            >
                {plans.map((plan) => (
                    <motion.div
                        key={plan.name}
                        variants={item}
                        className={cn(
                            "relative p-8 rounded-2xl transition-all duration-300 flex flex-col group",
                            plan.popular
                                ? "bg-white border-2 border-surgical-600 shadow-xl z-10 hover:shadow-2xl hover:scale-[1.01]"
                                : "bg-white border border-slate-100 shadow-sm hover:border-surgical-400 hover:shadow-lg hover:scale-[1.005]"
                        )}
                    >
                        {plan.popular && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surgical-600 text-white text-xs font-bold uppercase tracking-wide px-4 py-1 rounded-full shadow-md">
                                Most Popular
                            </div>
                        )}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-navy-900">{plan.name}</h3>
                            <div className="mt-4 flex items-baseline text-navy-900">
                                <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                                <span className="text-slate-500 ml-1 text-sm font-medium">{plan.period}</span>
                            </div>
                            <p className="mt-4 text-slate-500 text-sm leading-relaxed">{plan.description}</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-surgical-600 shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <Button
                            className={cn(
                                "w-full rounded-pill h-12 font-semibold shadow-none transition-all active:scale-95 duration-200",
                                plan.popular
                                    ? "bg-surgical-600 hover:bg-surgical-700 text-white shadow-lg shadow-surgical-500/20"
                                    : "bg-slate-50 hover:bg-slate-100 text-navy-900"
                            )}
                        >
                            {plan.cta}
                        </Button>
                    </motion.div>
                ))}
            </motion.div>
        </Section>
    );
}
