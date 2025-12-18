"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavbarRedesignedProps {
    onBookDemo?: () => void;
}

export default function NavbarRedesigned({ onBookDemo }: NavbarRedesignedProps) {
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
        { label: "Resources", href: "/resources" },
    ];

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 ${
                isScrolled
                    ? "bg-cream/95 backdrop-blur-md shadow-subtle border-b border-sage-dark"
                    : "bg-transparent"
            }`}
        >
            <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-deep via-cyan to-lime rounded-lg flex items-center justify-center font-display font-bold text-cream text-lg group-hover:shadow-card-hover transition-shadow">
                        C
                    </div>
                    <span className={`font-display font-bold text-lg transition-colors ${
                        isScrolled ? "text-charcoal" : "text-charcoal"
                    }`}>
                        CallWaiting AI
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-sm font-medium transition-colors hover:text-blue-deep ${
                                isScrolled ? "text-charcoal/70" : "text-charcoal/70"
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
                        className="text-sm font-medium text-charcoal/70 hover:text-charcoal transition-colors"
                    >
                        Sign In
                    </Link>
                    <button
                        onClick={onBookDemo}
                        className="px-6 py-2 bg-blue-deep text-cream font-semibold rounded-lg hover:bg-blue-deep/90 transition-all duration-300 hover:shadow-card-hover"
                    >
                        Book Demo
                    </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden p-2 hover:bg-sage rounded-lg transition-colors"
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-charcoal" />
                    ) : (
                        <Menu className="w-6 h-6 text-charcoal" />
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
                        className="md:hidden bg-cream border-b border-sage-dark"
                    >
                        <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="text-sm font-medium text-charcoal/70 hover:text-blue-deep transition-colors py-2"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <div className="flex flex-col gap-3 pt-4 border-t border-sage-dark">
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-charcoal/70 hover:text-charcoal transition-colors py-2"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <button
                                    onClick={() => {
                                        onBookDemo?.();
                                        setIsOpen(false);
                                    }}
                                    className="px-6 py-2 bg-blue-deep text-cream font-semibold rounded-lg hover:bg-blue-deep/90 transition-all duration-300 w-full"
                                >
                                    Book Demo
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
