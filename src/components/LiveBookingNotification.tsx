"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const NOTIFICATIONS = [
    { text: "Dr. Evans (Miami) just booked a demo", time: "2 min ago" },
    { text: "Lumiere MedSpa joined Roxanne", time: "Just now" },
    { text: "New appointment booked for Skin+ NYC", time: "1 min ago" },
    { text: "Dr. Sarah requested a callback", time: "5 min ago" },
    { text: "Beverly Hills Plastic Surgery is live", time: "1 hour ago" },
];

export const LiveBookingNotification = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Initial delay
        const initialTimer = setTimeout(() => setIsVisible(true), 8000);

        const cycleTimer = setInterval(() => {
            setIsVisible(false); // Hide current
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % NOTIFICATIONS.length);
                setIsVisible(true); // Show next
            }, 1000);
        }, 15000); // Show every 15s

        return () => {
            clearTimeout(initialTimer);
            clearInterval(cycleTimer);
        };
    }, []);

    const notification = NOTIFICATIONS[currentIndex];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, x: -20 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="fixed bottom-6 left-6 z-40 max-w-sm"
                >
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 pr-6">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-400/20">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {notification.text}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                {notification.time}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
