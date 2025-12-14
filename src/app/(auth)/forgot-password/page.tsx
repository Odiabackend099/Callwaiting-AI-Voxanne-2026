'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, ArrowLeft, Loader, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/Logo';

// Branding images for carousel
const BRANDING_IMAGES = [
    '/branding/resource_8Yu5GfUCC29dqKx3x0skXr.png',
    '/branding/resource_8vxcerNBlWE4yxe6z7t4nh.png',
    '/branding/resource_9Fnvkd0qdNf9kUnicIO_4i.png',
    '/branding/resource_9Jl0RXn61UJdSrgTMuDOHn.png',
    '/branding/resource_9ltCVdMUYmv9yVAyBQIkEL.png',
    '/branding/resource_9mC_ELBS7fC2fnV2ZG_Oiy.png',
    '/branding/resource_aQYFm53KqYX5LsYT4nok53.png',
    '/branding/resource_ahUbsyF9X0Y9I4uijZ-O0g.png',
    '/branding/resource_aoavD787FGN3LgBj6ENk1f.png',
    '/branding/resource_b48jIDhedfi7SNQrCI4_tG.png',
    '/branding/resource_bA3PtO8TZ_X01qLbyPx4CV.png',
    '/branding/resource_baoMoNSrueT23LGWB1c_fA.png',
    '/branding/resource_bq982z4VJm6bDMH2oYdk1N.png',
    '/branding/resource_bxSAiNMJ85y4XpeAi2k4or.png',
];

export default function ForgotPasswordPage() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-rotate carousel
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % BRANDING_IMAGES.length);
        }, 4000); // Change image every 4 seconds

        return () => clearInterval(interval);
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const { error: resetError } = await resetPassword(email);

            if (resetError) {
                throw resetError;
            }

            setSubmitted(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send reset email';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-center">
                        <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-6 h-6 text-cyan-400" />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Check your email
                        </h1>

                        <p className="text-slate-300 mb-6">
                            We&apos;ve sent a password reset link to <strong>{email}</strong>
                        </p>

                        <p className="text-sm text-slate-400 mb-8">
                            Click the link in the email to reset your password.
                        </p>

                        <div className="space-y-3">
                            <Link
                                href="/login"
                                className="block bg-white text-black hover:bg-slate-200 font-bold py-3 px-4 rounded-full transition-all"
                            >
                                Back to Login
                            </Link>

                            <p className="text-xs text-slate-400">
                                Didn&apos;t receive the email? Check your spam folder or{' '}
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="text-cyan-400 hover:text-cyan-300"
                                >
                                    try again
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Left Side - Reset Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Ambience */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow [animation-delay:1s]" />
                </div>

                <div className="max-w-md w-full relative z-10">
                    <div className="mb-8">
                        <Link href="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>

                        <div className="mb-4">
                            <Logo size="md" showText={true} href="/" priority={true} />
                        </div>
                        <h1 className="text-4xl font-serif font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Reset Password
                        </h1>
                        <p className="text-slate-400 font-light">
                            Enter your email to receive a reset link
                        </p>
                    </div>

                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <p className="text-red-400 text-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        {error}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Email
                                </label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="doctor@clinic.com"
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-500 font-bold py-3.5 px-4 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Sending Link...
                                    </>
                                ) : (
                                    <>
                                        Send Reset Link
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Side - Animated Branding Showcase */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-purple-900/20 to-blue-900/20 items-center justify-center p-12 relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

                {/* Animated Image Carousel */}
                <div className="relative w-full max-w-2xl aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentImageIndex}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 1, ease: "easeInOut" }}
                            className="absolute inset-0"
                        >
                            <Image
                                src={BRANDING_IMAGES[currentImageIndex]}
                                alt={`CallWaiting AI Branding ${currentImageIndex + 1}`}
                                fill
                                className="object-contain"
                                priority={currentImageIndex === 0}
                            />
                        </motion.div>
                    </AnimatePresence>

                    {/* Carousel Indicators */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                        {BRANDING_IMAGES.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentImageIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentImageIndex
                                    ? 'w-8 bg-white'
                                    : 'w-1.5 bg-white/40 hover:bg-white/60'
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Branding Text Overlay */}
                <div className="absolute bottom-12 left-12 right-12 text-center">
                    <motion.h2
                        key={`title-${currentImageIndex}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="text-3xl font-bold text-white mb-2"
                    >
                        Secure Access
                    </motion.h2>
                    <motion.p
                        key={`subtitle-${currentImageIndex}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                        className="text-slate-300 text-lg"
                    >
                        Recover your account in seconds
                    </motion.p>
                </div>
            </div>
        </div>
    );
}
