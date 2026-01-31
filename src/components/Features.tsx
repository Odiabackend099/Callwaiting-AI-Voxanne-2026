"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Calendar, BarChart3, Zap, Shield, Check } from "lucide-react";
import { motion } from "framer-motion";

const features = [
    {
        title: "Automated Scheduling",
        description: "Syncs directly with Google Calendar, Outlook, and major EHRs to book appointments in real-time without double-booking.",
        icon: Calendar,
        colSpan: "lg:col-span-2",
        bg: "bg-white",
        delay: 0,
    },
    {
        title: "Patient Insights",
        description: "Analyze call sentiment and urgency to prioritize critical cases.",
        icon: BarChart3,
        colSpan: "lg:col-span-1",
        bg: "bg-slate-50",
        delay: 0.1,
    },
    {
        title: "24/7 Triage",
        description: "Never miss a call. Handle after-hours inquiries with clinical precision.",
        icon: Zap,
        colSpan: "lg:col-span-1",
        bg: "bg-slate-50",
        delay: 0.2,
    },
    {
        title: "Enterprise Security",
        description: "SOC2 Type II, UK GDPR and HIPAA compliant. Your patient data is encrypted at rest and in transit.",
        icon: Shield,
        colSpan: "lg:col-span-2",
        bg: "bg-white",
        delay: 0.3,
        badges: ["UK GDPR Compliant", "HIPAA Compliant", "SOC2 Type II"],
    },
];

export default function Features() {
    return (
        <section id="features" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-4xl font-bold text-navy-900 tracking-tight mb-4">
                            Everything your front desk does. <br />
                            <span className="text-surgical-600">Just faster.</span>
                        </h2>
                        <p className="text-lg text-slate-600">
                            Voxanne handles the repetitive tasks so your staff can focus on patient care.
                        </p>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <FadeIn
                            key={feature.title}
                            delay={feature.delay}
                            className={`${feature.colSpan} group relative overflow-hidden rounded-3xl border border-slate-100 p-8 shadow-sm hover:shadow-md transition-shadow duration-300 ${feature.bg}`}
                        >
                            <div className="h-12 w-12 rounded-2xl bg-surgical-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <feature.icon className="h-6 w-6 text-surgical-600" />
                            </div>

                            <h3 className="text-xl font-bold text-navy-900 mb-3">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed mb-6">{feature.description}</p>

                            {feature.badges && (
                                <div className="flex gap-3">
                                    {feature.badges.map((badge) => (
                                        <span key={badge} className="inline-flex items-center gap-1.5 text-xs font-medium text-surgical-700 bg-surgical-50 px-2.5 py-1 rounded-full">
                                            <Shield className="h-3 w-3" />
                                            {badge}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
