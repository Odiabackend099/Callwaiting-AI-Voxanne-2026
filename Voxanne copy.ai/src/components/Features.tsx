"use client";
import { Section } from "@/components/Section";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Book, Calendar, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const features = [
    {
        title: "Zero-Latency Neural Voice",
        description: "Experience conversations that feel human, with under 500ms response times. No awkward pauses, just natural flow.",
        icon: Zap,
        className: "md:col-span-2",
    },
    {
        title: "The Fortress Knowledge Base",
        description: "Instant policy retrieval for your clinic. Upload PDFs and the AI knows your pricing, hours, and rules instantly.",
        icon: Book,
        className: "md:col-span-1",
    },
    {
        title: "Atomic Calendar Booking",
        description: "Real-time sync with Google & Outlook. The AI checks availability, locks slots, and sends invites in milliseconds.",
        icon: Calendar,
        className: "md:col-span-1",
    },
    {
        title: "Multi-Tenant Security",
        description: "Bank-grade encryption with RLS (Row Level Security). Your patient data is isolated, encrypted, and HIPAA compliant.",
        icon: ShieldCheck,
        className: "md:col-span-2",
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

export function Features() {
    return (
        <Section className="bg-white">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <div className="overflow-hidden">
                    <motion.h2
                        initial={{ y: "100%" }}
                        whileInView={{ y: "0%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: easeOutExpo }}
                        className="text-3xl md:text-4xl font-bold text-navy-900 mb-4"
                    >
                        Engineered for <span className="text-surgical-600">Clinical Precision</span>
                    </motion.h2>
                </div>
                <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.2 }}
                    className="text-slate-600"
                >
                    Built by Call Waiting AI. Perfected as Voxanne. A complete voice operating system for your modern practice.
                </motion.p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                {features.map((feature, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className={feature.className}
                    >
                        <Card className="h-full border border-slate-100 shadow-sm transition-all duration-300 hover:border-surgical-600 hover:shadow-lg hover:shadow-surgical-600/5 hover:scale-[1.005] group overflow-hidden bg-white">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-2xl bg-surgical-50 flex items-center justify-center text-surgical-600 mb-4 group-hover:bg-surgical-600 group-hover:text-white transition-colors duration-300">
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <CardTitle className="text-xl text-navy-900">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-slate-600 text-base leading-relaxed">
                                    {feature.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </motion.div>
        </Section>
    );
}
