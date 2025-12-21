"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Calendar, User, Building2, Phone, ArrowRight, AlertCircle } from "lucide-react";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const BookingModal = ({ isOpen, onClose }: BookingModalProps) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [phoneError, setPhoneError] = useState("");
    const [formState, setFormState] = useState({
        name: "",
        clinicName: "",
        email: "",
        phone: "",
        goal: "more_bookings" // automated_reception, save_money
    });

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const validatePhone = (phone: string): boolean => {
        if (!phone.trim()) {
            setPhoneError("Phone number is required");
            return false;
        }

        if (!isValidPhoneNumber(phone, "US")) {
            // Try to parse to provide better error message
            try {
                parsePhoneNumber(phone, "US");
            } catch {
                setPhoneError("Please enter a valid phone number (e.g., +1 (555) 000-0000)");
                return false;
            }
        }

        setPhoneError("");
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate phone before submitting
        if (!validatePhone(formState.phone)) {
            return;
        }

        setIsLoading(true);

        try {
            // Use environment variable for API URL, with fallback
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://voxanne-backend.onrender.com';

            // For local development, allow localhost
            const isDevelopment = typeof window !== 'undefined' &&
                                  (window.location.hostname === 'localhost' ||
                                   window.location.hostname === '127.0.0.1');
            const finalApiUrl = isDevelopment ? 'http://localhost:3000' : apiUrl;
            const response = await fetch(`${finalApiUrl}/api/book-demo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formState.name,
                    email: formState.email,
                    phone: formState.phone,
                    clinic_name: formState.clinicName,
                    clinic_type: 'cosmetic_surgery', // Default, could be made dynamic
                    notes: `Primary goal: ${formState.goal}`,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to book demo');
            }

            console.log('Demo booked successfully:', data);
            setStep(3); // Success step
        } catch (error) {
            console.error('Error booking demo:', error);
            alert('Failed to book demo. Please try again or contact support.');
        } finally {
            setIsLoading(false);
        }
    };

    const updateForm = (field: string, value: string) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999]"
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="relative p-8 pb-0">
                                <button
                                    onClick={onClose}
                                    aria-label="Close booking modal"
                                    className="absolute right-6 top-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                {step < 3 && (
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-800"}`}></div>
                                        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-800"}`}></div>
                                    </div>
                                )}
                                <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white mb-2">
                                    {step === 1 && "Let's personalize your demo."}
                                    {step === 2 && "Where should we send the details?"}
                                    {step === 3 && "You're all set!"}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400">
                                    {step === 1 && "Tell us a bit about your clinic."}
                                    {step === 2 && "We'll prepare a custom ROI analysis for you."}
                                    {step === 3 && "One of our specialists will be in touch shortly."}
                                </p>
                            </div>

                            {/* Content */}
                            <div className="p-8">
                                {step === 1 && (
                                    <motion.form
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-6"
                                        onSubmit={handleNext}
                                    >
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-cyan-500" /> Clinic Name
                                            </label>
                                            <input
                                                required
                                                autoFocus
                                                type="text"
                                                placeholder="e.g. Elite Aesthetics"
                                                value={formState.clinicName}
                                                onChange={e => updateForm("clinicName", e.target.value)}
                                                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-sm font-bold text-slate-900 dark:text-white">Primary Goal</label>
                                            <div className="grid gap-3">
                                                {[
                                                    { id: "more_bookings", label: "Get More Bookings", icon: Calendar },
                                                    { id: "automated_reception", label: "Automate Reception", icon: Phone },
                                                    { id: "save_money", label: "Reduce Staff Costs", icon: User },
                                                ].map((option) => (
                                                    <div
                                                        key={option.id}
                                                        onClick={() => updateForm("goal", option.id)}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${formState.goal === option.id
                                                            ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/20 shadow-sm"
                                                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                            }`}
                                                    >
                                                        <div className={`p-2 rounded-lg ${formState.goal === option.id ? "bg-cyan-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                            <option.icon className="w-5 h-5" />
                                                        </div>
                                                        <span className={`font-medium ${formState.goal === option.id ? "text-cyan-900 dark:text-cyan-100" : "text-slate-600 dark:text-slate-400"}`}>
                                                            {option.label}
                                                        </span>
                                                        {formState.goal === option.id && <Check className="w-5 h-5 text-cyan-500 ml-auto" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-4"
                                        >
                                            Continue <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </motion.form>
                                )}

                                {step === 2 && (
                                    <motion.form
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-5"
                                        onSubmit={handleSubmit}
                                    >
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-900 dark:text-white">Your Name</label>
                                            <input
                                                required
                                                autoFocus
                                                type="text"
                                                placeholder="Dr. Smith"
                                                value={formState.name}
                                                onChange={e => updateForm("name", e.target.value)}
                                                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-900 dark:text-white">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                placeholder="name@clinic.com"
                                                value={formState.email}
                                                onChange={e => updateForm("email", e.target.value)}
                                                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-900 dark:text-white">Phone Number</label>
                                            <input
                                                required
                                                type="tel"
                                                placeholder="(555) 000-0000"
                                                value={formState.phone}
                                                onChange={e => {
                                                    updateForm("phone", e.target.value);
                                                    if (phoneError) setPhoneError(""); // Clear error on change
                                                }}
                                                onBlur={() => validatePhone(formState.phone)}
                                                className={`w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border transition-all font-medium outline-none focus:ring-2 ${
                                                    phoneError
                                                        ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-transparent"
                                                        : "border-slate-200 dark:border-slate-800 focus:ring-cyan-500 focus:border-transparent"
                                                }`}
                                            />
                                            {phoneError && (
                                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mt-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    <span>{phoneError}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-3 mt-8">
                                            <button
                                                type="button"
                                                onClick={handleBack}
                                                className="px-6 py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        Complete Booking <Check className="w-5 h-5" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </motion.form>
                                )}

                                {step === 3 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-center py-8"
                                    >
                                        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                                            <Check className="w-12 h-12 text-green-600 dark:text-green-400 relative z-10" strokeWidth={3} />
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 mb-8">
                                            <p className="text-slate-600 dark:text-slate-400 mb-1 font-medium">Confirmation sent to:</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{formState.email}</p>
                                        </div>

                                        <button
                                            onClick={onClose}
                                            className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
                                        >
                                            Return to Homepage
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
