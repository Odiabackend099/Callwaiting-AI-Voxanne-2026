"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { FadeInOnScroll } from "./ParallaxSection";
import { Mail, Phone, MapPin, Linkedin, Twitter, Facebook, Lock } from "lucide-react";
import Logo from "./Logo";

export default function FooterRedesigned() {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        Product: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Security", href: "/security" },
        ],
        Company: [
            { label: "About", href: "/about" },
            { label: "Blog", href: "/blog" },
            { label: "Case Studies", href: "/case-studies" },
            { label: "Careers", href: "/careers" },
        ],
        Resources: [
            { label: "Documentation", href: "/docs" },
            { label: "API Reference", href: "/api-reference" },
            { label: "Support", href: "/support" },
            { label: "Contact", href: "/contact" },
        ],
        Legal: [
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "HIPAA Compliance", href: "/hipaa-compliance" },
            { label: "Cookie Policy", href: "/cookie-policy" },
        ],
    };

    return (
        <footer className="relative bg-deep-obsidian text-pure-white overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-clinical-blue rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-mist rounded-full blur-[80px]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                {/* Main Footer Content */}
                <div className="py-16 md:py-20 grid md:grid-cols-5 gap-12">
                    {/* Brand Section */}
                    <FadeInOnScroll>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <div className="mb-6">
                                <Logo
                                    variant="icon-white"
                                    size="lg"
                                    href="/"
                                    priority={false}
                                    showText={true}
                                />
                            </div>
                            <p className="text-pure-white/70 mb-6 leading-relaxed">
                                AI-powered receptionist for aesthetic clinics, med spas, and plastic surgery practices.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-pure-white/70 hover:text-pure-white transition-colors">
                                    <Mail className="w-5 h-5" />
                                    <a href="mailto:support@voxanne.ai">support@voxanne.ai</a>
                                </div>
                                <div className="flex items-center gap-3 text-pure-white/70 hover:text-pure-white transition-colors">
                                    <Phone className="w-5 h-5" />
                                    <a href="tel:+1234567890">+1 (234) 567-890</a>
                                </div>
                                <div className="flex items-start gap-3 text-pure-white/70">
                                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm leading-relaxed">
                                        <div className="font-medium text-pure-white/80 mb-1">Global Headquarters</div>
                                        <div>Collage House, 2nd Floor</div>
                                        <div>17 King Edward Road</div>
                                        <div>Ruislip, London HA4 7AE</div>
                                        <div>United Kingdom</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </FadeInOnScroll>

                    {/* Link Sections */}
                    {Object.entries(footerLinks).map(([category, links], index) => (
                        <FadeInOnScroll key={category} delay={index * 0.1}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                viewport={{ once: true }}
                            >
                                <h3 className="font-bold text-pure-white mb-4">{category}</h3>
                                <ul className="space-y-3">
                                    {links.map((link) => (
                                        <li key={link.href}>
                                            <Link
                                                href={link.href}
                                                className="text-pure-white/70 hover:text-pure-white transition-colors"
                                            >
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </FadeInOnScroll>
                    ))}
                </div>

                {/* Compliance Badges Strip */}
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="py-12 border-t border-cream/10"
                    >
                        <div className="flex items-center justify-center gap-8 flex-wrap">
                            <div className="flex flex-col items-center">
                                <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                    <Image
                                        src="/badges/hipaa-compliant.jpg"
                                        alt="HIPAA Compliant - Full compliance with Business Associate Agreement"
                                        width={120}
                                        height={60}
                                        className="w-28 h-14 md:w-32 md:h-16 object-contain opacity-100 hover:opacity-90 transition-opacity"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                    <Image
                                        src="/badges/gdpr-ready.png"
                                        alt="GDPR Ready - EU data protection standards compliance"
                                        width={120}
                                        height={60}
                                        className="w-28 h-14 md:w-32 md:h-16 object-contain opacity-100 hover:opacity-90 transition-opacity"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 hover:border-white/30 transition-colors backdrop-blur-sm">
                                <Lock className="w-4 h-4 text-pure-white/80" />
                                <span className="text-xs text-pure-white/80 font-medium">SOC 2 Type II</span>
                            </div>
                        </div>
                    </motion.div>
                </FadeInOnScroll>

                {/* Divider */}
                <div className="border-t border-cream/10" />

                {/* Bottom Section */}
                <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <FadeInOnScroll>
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                            className="text-pure-white/60 text-sm space-y-2"
                        >
                            <p>{currentYear} Voxanne AI. All rights reserved. HIPAA Compliant.</p>
                            <div className="flex items-center gap-2 text-sm text-pure-white/70">
                                <span>A product of</span>
                                <a href="https://www.callwaitingai.dev/" target="_blank" rel="noopener noreferrer" className="font-medium text-surgical-blue hover:text-surgical-blue/80 transition-colors underline">
                                    Call Waiting AI
                                </a>
                            </div>
                        </motion.div>
                    </FadeInOnScroll>

                    {/* Social Links */}
                    <FadeInOnScroll>
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="flex gap-4"
                        >
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-clinical-blue/20 flex items-center justify-center transition-colors"
                            >
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-clinical-blue/20 flex items-center justify-center transition-colors"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-clinical-blue/20 flex items-center justify-center transition-colors"
                            >
                                <Facebook className="w-5 h-5" />
                            </a>
                        </motion.div>
                    </FadeInOnScroll>
                </div>
            </div>
        </footer>
    );
}
