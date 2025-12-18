"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FadeInOnScroll } from "./ParallaxSection";
import { Mail, Phone, MapPin, Linkedin, Twitter, Facebook } from "lucide-react";

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
            { label: "API Reference", href: "/api" },
            { label: "Support", href: "/support" },
            { label: "Contact", href: "/contact" },
        ],
        Legal: [
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "HIPAA Compliance", href: "/hipaa" },
            { label: "Cookie Policy", href: "/cookies" },
        ],
    };

    return (
        <footer className="relative bg-charcoal text-cream overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-lime rounded-full blur-[80px]" />
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
                            <Link href="/" className="flex items-center gap-2 mb-6 group">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-deep via-cyan to-lime rounded-lg flex items-center justify-center font-display font-bold text-cream text-lg">
                                    C
                                </div>
                                <span className="font-display font-bold text-lg text-cream">
                                    CallWaiting AI
                                </span>
                            </Link>
                            <p className="text-cream/70 mb-6 leading-relaxed">
                                AI-powered receptionist for aesthetic clinics, med spas, and plastic surgery practices.
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-cream/70 hover:text-cream transition-colors">
                                    <Mail className="w-5 h-5" />
                                    <a href="mailto:hello@callwaitingai.com">hello@callwaitingai.com</a>
                                </div>
                                <div className="flex items-center gap-3 text-cream/70 hover:text-cream transition-colors">
                                    <Phone className="w-5 h-5" />
                                    <a href="tel:+1234567890">+1 (234) 567-890</a>
                                </div>
                                <div className="flex items-center gap-3 text-cream/70">
                                    <MapPin className="w-5 h-5" />
                                    <span>San Francisco, CA</span>
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
                                <h3 className="font-bold text-cream mb-4">{category}</h3>
                                <ul className="space-y-3">
                                    {links.map((link) => (
                                        <li key={link.href}>
                                            <Link
                                                href={link.href}
                                                className="text-cream/70 hover:text-cream transition-colors"
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

                {/* Divider */}
                <div className="border-t border-cream/10" />

                {/* Bottom Section */}
                <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <FadeInOnScroll>
                        <motion.p
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                            className="text-cream/60 text-sm"
                        >
                            © {currentYear} CallWaiting AI. All rights reserved. HIPAA Compliant.
                        </motion.p>
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
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-cyan/20 flex items-center justify-center transition-colors"
                            >
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-cyan/20 flex items-center justify-center transition-colors"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-cream/10 hover:bg-cyan/20 flex items-center justify-center transition-colors"
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
