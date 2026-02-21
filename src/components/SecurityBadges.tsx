"use client";

import { motion } from "framer-motion";
import { Shield, Lock, CheckCircle, Award } from "lucide-react";
import Image from "next/image";

const badges = [
    {
        name: "GDPR Compliant",
        type: "image",
        imageSrc: "/badges/gdpr-ready.png",
        icon: Award,
        description: "UK GDPR & EU data protection standards",
        color: "purple"
    },
    {
        name: "SOC 2 Type II",
        type: "icon",
        icon: Lock,
        description: "Enterprise-grade security",
        color: "blue"
    },
    {
        name: "ISO 27001",
        type: "icon",
        icon: CheckCircle,
        description: "Information security certified",
        color: "green"
    },
    {
        name: "HIPAA Compliant",
        type: "image",
        imageSrc: "/badges/hipaa-compliant.jpg",
        icon: Shield,
        description: "Full HIPAA compliance with BAA (US healthcare)",
        color: "cyan"
    }
];

export default function SecurityBadges() {
    return (
        <section className="py-16 bg-slate-950 border-y border-white/5">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-2xl md:text-3xl font-bold text-white mb-4"
                    >
                        Enterprise-Grade Security & Compliance
                    </motion.h3>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-obsidian/50 max-w-2xl mx-auto"
                    >
                        Your patient data is protected by the highest security standards in healthcare technology.
                    </motion.p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                    {badges.map((badge, index) => (
                        <motion.div
                            key={badge.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative"
                        >
                            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:bg-slate-900/80 text-center">
                                {/* Icon or Image */}
                                {badge.type === 'image' && badge.imageSrc ? (
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden bg-white/5 p-2 flex items-center justify-center">
                                        <Image
                                            src={badge.imageSrc}
                                            alt={badge.name}
                                            width={80}
                                            height={80}
                                            className="w-full h-full object-contain"
                                            priority={false}
                                        />
                                    </div>
                                ) : (
                                    <div className={`
                                        w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
                                        ${badge.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                                        ${badge.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : ''}
                                        ${badge.color === 'green' ? 'bg-green-500/20 text-green-400' : ''}
                                        ${badge.color === 'purple' ? 'bg-purple-500/20 text-purple-400' : ''}
                                    `}>
                                        <badge.icon className="w-8 h-8" strokeWidth={1.5} />
                                    </div>
                                )}

                                {/* Badge Name */}
                                <h4 className="text-white font-bold mb-2">{badge.name}</h4>

                                {/* Description */}
                                <p className="text-obsidian/50 text-sm">{badge.description}</p>

                                {/* Verified Badge */}
                                <div className="mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                    <span className="text-green-400 text-xs font-medium">Verified</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Additional Trust Elements */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 text-center"
                >
                    <p className="text-obsidian/60 text-sm mb-4">
                        Trusted by medical practices across the UK and US
                    </p>
                    <div className="flex items-center justify-center gap-2 text-obsidian/50 text-xs">
                        <Lock className="w-4 h-4" />
                        <span>All data encrypted in transit and at rest with AES-256</span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
