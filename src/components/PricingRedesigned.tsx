"use client";

import { motion } from "framer-motion";
import { FadeInOnScroll, SlideInOnScroll } from "./ParallaxSection";
import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
    {
        name: "Starter",
        price: "$299",
        period: "/month",
        description: "Perfect for small clinics just getting started",
        features: [
            "Up to 500 calls/month",
            "Basic appointment booking",
            "Call recordings",
            "Email support",
            "Analytics dashboard",
        ],
        cta: "Start Free Trial",
        highlighted: false,
    },
    {
        name: "Professional",
        price: "$799",
        period: "/month",
        description: "For growing practices with higher call volume",
        features: [
            "Up to 2,000 calls/month",
            "Advanced appointment booking",
            "Call recordings & transcripts",
            "Priority support",
            "Advanced analytics",
            "Custom AI training",
            "Integration with major EHRs",
        ],
        cta: "Start Free Trial",
        highlighted: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "pricing",
        description: "For large practices with custom needs",
        features: [
            "Unlimited calls",
            "White-label solution",
            "Dedicated account manager",
            "24/7 phone support",
            "Custom integrations",
            "Advanced security features",
            "SLA guarantee",
        ],
        cta: "Contact Sales",
        highlighted: false,
    },
];

export default function PricingRedesigned() {
    return (
        <section id="pricing" className="relative py-20 md:py-32 bg-gradient-to-b from-cream to-sage overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-deep/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-lime/5 rounded-full blur-[100px]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                {/* Section Header */}
                <FadeInOnScroll>
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-h2-desktop md:text-h2-mobile font-display font-bold text-charcoal mb-4">
                                Simple, Transparent Pricing
                            </h2>
                            <p className="text-lg text-charcoal/70 max-w-2xl mx-auto">
                                Choose the plan that fits your practice. All plans include a 14-day free trial.
                            </p>
                        </motion.div>
                    </div>
                </FadeInOnScroll>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan, index) => (
                        <SlideInOnScroll
                            key={index}
                            direction={index === 1 ? "up" : index % 2 === 0 ? "left" : "right"}
                            delay={index * 0.15}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className={`relative rounded-lg overflow-hidden transition-all duration-300 ${
                                    plan.highlighted
                                        ? "md:scale-105 bg-gradient-cream-sage border-2 border-blue-deep shadow-card-hover"
                                        : "bg-cream-light border border-sage-dark hover:shadow-card-hover"
                                }`}
                            >
                                {/* Highlighted Badge */}
                                {plan.highlighted && (
                                    <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-deep to-cyan text-cream px-4 py-1 text-sm font-bold rounded-bl-lg">
                                        MOST POPULAR
                                    </div>
                                )}

                                <div className="p-8">
                                    {/* Plan Name */}
                                    <h3 className="text-2xl font-bold text-charcoal mb-2">
                                        {plan.name}
                                    </h3>
                                    <p className="text-charcoal/60 text-sm mb-6">
                                        {plan.description}
                                    </p>

                                    {/* Price */}
                                    <div className="mb-8">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-bold text-blue-deep">
                                                {plan.price}
                                            </span>
                                            <span className="text-charcoal/60">
                                                {plan.period}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA Button */}
                                    <Link href="/start">
                                        <button
                                            className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all duration-300 ${
                                                plan.highlighted
                                                    ? "bg-blue-deep text-cream hover:bg-blue-deep/90"
                                                    : "bg-sage text-charcoal hover:bg-sage-dark"
                                            }`}
                                        >
                                            Start Free Trial
                                        </button>
                                    </Link>

                                    {/* Features List */}
                                    <div className="space-y-4">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex gap-3">
                                                <Check className="w-5 h-5 text-lime flex-shrink-0 mt-0.5" />
                                                <span className="text-charcoal/80">
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </SlideInOnScroll>
                    ))}
                </div>

                {/* FAQ Link */}
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                        className="text-center mt-16"
                    >
                        <p className="text-charcoal/70">
                            Have questions?{" "}
                            <a href="#faq" className="text-blue-deep font-semibold hover:text-cyan transition-colors">
                                Check our FAQ
                            </a>
                        </p>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
