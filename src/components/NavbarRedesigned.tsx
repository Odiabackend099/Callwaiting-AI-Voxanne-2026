"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo"; // ✅ ADDED: Use centralized Logo component

export default function NavbarRedesigned() {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navItems = [
        { label: "Features", href: "#features" },
        { label: "How It Works", href: "#how-it-works" },
        { label: "Pricing", href: "#pricing" },
        { label: "Demo", href: "/demo-workflow" },
        { label: "Resources", href: "/resources" },
    ];

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
                    ? "bg-sterile-wash/95 backdrop-blur-md shadow-subtle border-b border-clinical-blue"
                    : "bg-transparent"
                }`}
        >
            <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                {/* ✅ UPDATED: Use icon-only logo variant (Netflix-style) - Brand/3.png */}
                <Logo
                    variant="icon-blue"
                    size="xl"
                    href="/"
                    priority
                    showText={true}
                    className="transition-opacity hover:opacity-80"
                />

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-sm font-medium transition-colors hover:text-surgical-blue ${isScrolled ? "text-deep-obsidian/70" : "text-deep-obsidian/70"
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* Desktop CTA */}
                <div className="hidden md:flex items-center gap-4">
                    <Link
                        href="/login"
                        className="text-sm font-medium text-deep-obsidian/70 hover:text-deep-obsidian transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link href="/start" className="inline-block">
                        <button
                            className="px-6 py-2 bg-surgical-blue text-pure-white font-semibold rounded-lg hover:bg-surgical-blue/90 transition-all duration-300 hover:shadow-card-hover"
                        >
                            Book Demo
                        </button>
                    </Link>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden p-3 hover:bg-sky-mist/80 focus-visible:ring-2 focus-visible:ring-surgical-blue rounded-lg transition-colors min-h-12 min-w-12"
                    aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={isOpen}
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-deep-obsidian" />
                    ) : (
                        <Menu className="w-6 h-6 text-deep-obsidian" />
                    )}
                </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="md:hidden bg-sterile-wash border-b border-clinical-blue"
                    >
                        <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="text-sm font-medium text-deep-obsidian/70 hover:text-surgical-blue transition-colors py-2"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <div className="flex flex-col gap-3 pt-4 border-t border-clinical-blue">
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-deep-obsidian/70 hover:text-deep-obsidian transition-colors py-2"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <Link href="/start" className="block w-full" onClick={() => setIsOpen(false)}>
                                    <button
                                        className="px-6 py-2 bg-surgical-blue text-pure-white font-semibold rounded-lg hover:bg-surgical-blue/90 transition-all duration-300 w-full"
                                    >
                                        Book Demo
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
