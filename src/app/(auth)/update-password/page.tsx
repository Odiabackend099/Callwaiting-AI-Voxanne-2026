'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, ArrowRight, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
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

export default function UpdatePasswordPage() {
    const router = useRouter();
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-rotate carousel
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % BRANDING_IMAGES.length);
        }, 4000); // Change image every 4 seconds

        return () => clearInterval(interval);
    }, []);

    // Password validation function
    const validatePassword = (pwd: string): string | null => {
        if (!pwd) return null;

        if (pwd.length < 12) {
            return 'Password must be at least 12 characters';
        }
        if (!/[A-Z]/.test(pwd)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(pwd)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(pwd)) {
            return 'Password must contain at least one number';
        }
        if (!/[^A-Za-z0-9]/.test(pwd)) {
            return 'Password must contain at least one special character (!@#$%^&*)';
        }
        return null;
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        setPasswordError(validatePassword(value));
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!password || !confirmPassword) {
                throw new Error('Please fill in all fields');
            }

            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            const passwordValidationError = validatePassword(password);
            if (passwordValidationError) {
                throw new Error(passwordValidationError);
            }

            const { error: updateError } = await updatePassword(password);

            if (updateError) {
                throw updateError;
            }

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Update failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Left Side - Search Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Ambience */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow [animation-delay:1s]" />
                </div>

                <div className="max-w-md w-full relative z-10">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Logo size="lg" showText={false} href="/" priority={true} />
                        </div>
                        <h1 className="text-4xl font-serif font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            New Password
                        </h1>
                        <p className="text-slate-400 font-light">
                            Secure your account with a new password
                        </p>
                    </div>

                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    New Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        placeholder="Min. 12 characters"
                                        required
                                        className={`w-full pl-10 pr-4 py-3 bg-black/40 border rounded-xl text-white placeholder-slate-600 focus:outline-none transition-all ${passwordError
                                            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                            : 'border-white/10 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50'
                                            }`}
                                    />
                                </div>
                                {passwordError && (
                                    <p className="text-red-400 text-xs mt-2 pl-1">{passwordError}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Confirm Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Min. 12 characters"
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-500 font-bold py-3.5 px-4 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 mt-4"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        Update Password
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
