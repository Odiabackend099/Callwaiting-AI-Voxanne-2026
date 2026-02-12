"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";

export const ExitIntentModal = () => {
    const { error: showErrorToast } = useToast();
    const [isVisible, setIsVisible] = useState(false);
    const [email, setEmail] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Check if already shown in this session
        const hasShown = localStorage.getItem('exitIntentShown');
        if (hasShown) return;

        let exitIntentTriggered = false;

        const handleMouseLeave = (e: MouseEvent) => {
            // Trigger only when mouse leaves from top (user going to close tab/window)
            if (e.clientY <= 0 && !exitIntentTriggered) {
                exitIntentTriggered = true;
                setIsVisible(true);
                localStorage.setItem('exitIntentShown', 'true');
            }
        };

        // Add delay before activating (prevent triggering on initial page load)
        const timer = setTimeout(() => {
            document.addEventListener('mouseleave', handleMouseLeave);
        }, 3000);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Call the real API endpoint
            const response = await fetch('/api/send-roi-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    missedCallsPerWeek: 10, // Default value, can be customized
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send report');
            }

            setIsLoading(false);
            setIsSubmitted(true);

            // Auto-close after success
            setTimeout(() => {
                setIsVisible(false);
            }, 4000);
        } catch (error) {
            console.error('Error sending ROI report:', error);
            setIsLoading(false);
            showErrorToast('Failed to send report. Please try again or contact support.');
        }
    };

    const handleClose = () => {
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[10000]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-[10001] p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25 }}
                            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden pointer-events-auto relative"
                        >
                            {/* Close Button */}
                            <button
                                onClick={handleClose}
                                className="absolute right-4 top-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {!isSubmitted ? (
                                <div className="p-8">
                                    {/* Icon */}
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6">
                                        <FileText className="w-8 h-8 text-white" />
                                    </div>

                                    {/* Content */}
                                    <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white text-center mb-3">
                                        Wait! Before You Go...
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
                                        Get your <span className="font-bold text-cyan-600 dark:text-cyan-400">Free ROI Report</span> and see exactly how much revenue you&apos;re losing to missed calls.
                                    </p>

                                    {/* Form */}
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="email"
                                                required
                                                placeholder="Enter your email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                                    />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    Send Me The Report
                                                    <FileText className="w-5 h-5" />
                                                </>
                                            )}
                                        </button>
                                    </form>

                                    {/* Trust Signals */}
                                    <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            <span>No spam</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            <span>Instant delivery</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    {/* Success State */}
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", damping: 15 }}
                                        className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6"
                                    >
                                        <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                    </motion.div>

                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                        Check Your Inbox!
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                                        We&apos;ve sent your personalized ROI report to <span className="font-bold text-cyan-600 dark:text-cyan-400">{email}</span>
                                    </p>

                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            💡 <span className="font-semibold">Pro Tip:</span> Check your spam folder if you don&apos;t see it in 2 minutes.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
