'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, CheckCircle, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Left Side - Demo Booking CTA */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Ambience */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow [animation-delay:1s]" />
                </div>

                <div className="max-w-md w-full relative z-10">
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-3 mb-6">
                            <div className="relative w-12 h-12">
                                <Image
                                    src="/callwaiting-ai-logo.png"
                                    alt="CallWaiting AI Logo"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-3xl font-bold tracking-tight">CallWaiting AI</span>
                        </Link>
                        <h1 className="text-4xl font-serif font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Book Your Demo
                        </h1>
                        <p className="text-slate-400 font-light">
                            See how CallWaiting AI transforms your practice
                        </p>
                    </div>

                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl space-y-6">
                        {/* Benefits List */}
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">Never Miss a Call</p>
                                    <p className="text-sm text-slate-400">AI answers 24/7, even after hours</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Users className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">Qualify Every Lead</p>
                                    <p className="text-sm text-slate-400">Intelligent screening and booking</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Zap className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">Instant Setup</p>
                                    <p className="text-sm text-slate-400">Live in minutes, not weeks</p>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <a
                            href="https://calendly.com/callwaitingai/demo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-white text-black hover:bg-slate-200 font-bold py-3.5 px-4 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 mt-6"
                        >
                            <Calendar className="w-5 h-5" />
                            Schedule Demo Now
                        </a>

                        <p className="text-xs text-slate-500 text-center">
                            15-minute personalized walkthrough • No credit card required
                        </p>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <Link href="/login" className="text-white hover:text-purple-300 font-semibold transition-colors">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Value Proposition */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-purple-900/20 to-blue-900/20 items-center justify-center p-12 relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="relative z-10 max-w-lg text-center"
                >
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Transform Your Practice
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Join hundreds of clinics that never miss a call or lose a lead again.
                    </p>

                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                        >
                            <p className="text-sm text-slate-300">
                                <span className="text-2xl font-bold text-cyan-400">98%</span> of calls answered
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                        >
                            <p className="text-sm text-slate-300">
                                <span className="text-2xl font-bold text-cyan-400">24/7</span> availability
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6, duration: 0.6 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                        >
                            <p className="text-sm text-slate-300">
                                <span className="text-2xl font-bold text-cyan-400">0.5s</span> response time
                            </p>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
