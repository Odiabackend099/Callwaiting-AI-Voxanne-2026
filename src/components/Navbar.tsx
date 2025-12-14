"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-black/80 backdrop-blur-md border-b border-white/5 py-4" : "bg-transparent py-6"}`}
            >
                <div className="container mx-auto px-6 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group relative">
                        <div className="relative w-14 h-14 transition-transform duration-300 group-hover:scale-105">
                            <Image
                                src="/callwaiting-ai-logo.png"
                                alt="CallWaiting AI"
                                fill
                                sizes="56px"
                                className="object-contain"
                                priority
                            />
                        </div>
                        <span className="text-3xl font-bold text-white tracking-tight">CallWaiting AI</span>
                    </Link>
                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-8">
                        {["Features", "Pricing", "About", "Contact"].map((item) => (
                            <Link
                                key={item}
                                href={`#${item.toLowerCase()}`}
                                className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-sm font-bold text-white hover:text-cyan-400 transition-colors"
                                >
                                    Login
                                </Link>
                                <a
                                    href="https://calendly.com/callwaitingai/demo"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                                >
                                    Book Demo
                                </a>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden text-white p-2"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </motion.nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        className="fixed inset-0 z-[60] bg-black flex flex-col p-8"
                    >
                        <div className="flex justify-between items-center mb-12">
                            <div className="flex items-center gap-2">
                                <div className="relative w-8 h-8">
                                    <Image
                                        src="/callwaiting-ai-logo.png"
                                        alt="CallWaiting AI"
                                        fill
                                        sizes="32px"
                                        className="object-contain"
                                    />
                                </div>
                                <span className="text-2xl font-serif font-bold text-white">CallWaiting AI</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-500 hover:text-white">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-8 text-2xl font-light text-zinc-300">
                            {["Features", "Pricing", "About", "Contact"].map((item) => (
                                <Link
                                    key={item}
                                    href={`#${item.toLowerCase()}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item}
                                </Link>
                            ))}
                            <div className="h-px bg-white/10 my-4" />
                            {user ? (
                                <>
                                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
                                    <Link href="/dashboard/test-voice" onClick={() => setIsMobileMenuOpen(false)} className="text-cyan-400">Test Voice Agent</Link>
                                </>
                            ) : (
                                <>
                                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                                    <a href="https://calendly.com/callwaitingai/demo" target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)} className="text-cyan-400">Book Demo</a>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
