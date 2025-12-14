'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, ArrowRight, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function LoginPage() {
    const router = useRouter();
    const { signIn, signInWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-rotate carousel
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % BRANDING_IMAGES.length);
        }, 4000); // Change image every 4 seconds

        return () => clearInterval(interval);
    }, []);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const { user, error: signInError } = await signIn(email, password);

            if (signInError) {
                throw signInError;
            }

            if (user) {
                router.push('/dashboard');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sign in failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            const { error } = await signInWithGoogle();
            if (error) throw error;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Google sign in failed';
            setError(message);
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Left Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Ambience */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow [animation-delay:1s]" />
                </div>

                <div className="max-w-md w-full relative z-10">
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-3 mb-4">
                            <div className="relative w-12 h-12">
                                <Image
                                    src="/callwaiting-ai-logo.png"
                                    alt="CallWaiting AI Logo"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                            <span className="text-3xl font-bold tracking-tight">CallWaiting AI</span>
                        </Link>
                        <h1 className="text-4xl font-serif font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Welcome Back
                        </h1>
                        <p className="text-slate-400 font-light">
                            Sign in to manage your AI receptionist
                        </p>
                    </div>

                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <form onSubmit={handleSignIn} className="space-y-5">
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

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Password
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-slate-500 hover:text-white cursor-pointer transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || googleLoading}
                                className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-500 font-bold py-3.5 px-4 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Accessing Portal...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-black px-2 text-slate-500">Or continue with</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading || googleLoading}
                            className="w-full bg-transparent border border-white/20 text-white hover:bg-white/5 disabled:opacity-50 font-semibold py-3.5 px-4 rounded-full transition-all duration-300 flex items-center justify-center gap-3"
                        >
                            {googleLoading ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                            )}
                            Google
                        </button>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            Not a member yet?{' '}
                            <a href="https://calendly.com/callwaitingai/demo" target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-300 font-semibold transition-colors">
                                Book a Demo
                            </a>
                        </p>
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
                        AI-Powered Reception
                    </motion.h2>
                    <motion.p
                        key={`subtitle-${currentImageIndex}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                        className="text-slate-300 text-lg"
                    >
                        24/7 availability, zero missed opportunities
                    </motion.p>
                </div>
            </div>
        </div>
    );
}
