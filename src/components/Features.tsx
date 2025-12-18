"use client";

import { motion } from "framer-motion";
import { PhoneCall, CalendarCheck, Clock, ShieldCheck } from "lucide-react";

const features = [
    {
        icon: Clock,
        title: "24/7 Coverage",
        description: "Captures 40% more leads by handling after-hours BBL and Mommy Makeover inquiries instanly.",
    },
    {
        icon: PhoneCall,
        title: "Procedure Qualification",
        description: "Screens patients for specific procedures (Rhinoplasty, Breast Aug) and quotes approved price ranges.",
    },
    {
        icon: CalendarCheck,
        title: "EMR Integration",
        description: "Syncs directly with Nextech, Mindbody, or DrChrono to book consults without double-entry.",
    },
    {
        icon: ShieldCheck,
        title: "HIPAA Certified",
        description: "Enterprise-grade security ensuring patient data remains private. We sign a BAA with every clinic.",
    },
];

interface FeatureItem {
    icon: React.ElementType;
    title: string;
    description: string;
}

interface FeaturesProps {
    customFeatures?: FeatureItem[];
}

export default function Features({ customFeatures }: FeaturesProps) {
    const displayFeatures = customFeatures || features;

    return (
        <section className="py-24 bg-zinc-900 border-t border-white/5">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="mb-16 text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500 mb-4"
                    >
                        More Than Just Answering.
                    </motion.h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                        CALL WAITING AI LTD is a highly trained intake specialist that converts high-value leads into patients.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {displayFeatures.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group"
                        >
                            <feature.icon className="w-10 h-10 text-slate-200 mb-4 group-hover:scale-110 transition-transform duration-300" />
                            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
