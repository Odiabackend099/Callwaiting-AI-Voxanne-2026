"use client";

import { motion } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { brandColors } from "@/lib/brand-colors";

export default function OfflinePage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center px-6"
            style={{ backgroundColor: brandColors.sterileWash }}
        >
            <motion.div
                className="text-center max-w-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* Animated WiFi Off Icon */}
                <motion.div
                    className="flex justify-center mb-8"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{
                        duration: 0.6,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                    }}
                >
                    <div
                        className="relative p-8 rounded-full"
                        style={{
                            background: `radial-gradient(circle, ${brandColors.blueBright}20 0%, transparent 70%)`,
                        }}
                    >
                        <WifiOff
                            size={80}
                            style={{ color: brandColors.blueBright }}
                            strokeWidth={1.5}
                        />
                        {/* Pulsing effect */}
                        <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{
                                border: `2px solid ${brandColors.blueBright}`,
                                opacity: 0.3,
                            }}
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0, 0.3],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    </div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    className="text-4xl font-bold text-obsidian mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    You're Offline
                </motion.h1>

                {/* Description */}
                <motion.p
                    className="text-lg mb-8"
                    style={{ color: brandColors.deepObsidian + 'aa' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    It looks like you've lost your internet connection.
                    Check your network and try again.
                </motion.p>

                {/* Retry Button */}
                <motion.button
                    onClick={() => window.location.reload()}
                    className="px-8 py-4 rounded-lg font-semibold text-white flex items-center gap-3 mx-auto transition-all"
                    style={{
                        backgroundColor: brandColors.blueBright,
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{
                        scale: 1.05,
                        boxShadow: `0 0 20px ${brandColors.blueBright}60`,
                    }}
                    whileTap={{ scale: 0.95 }}
                >
                    <RefreshCw size={20} />
                    Retry Connection
                </motion.button>

                {/* Helpful tips */}
                <motion.div
                    className="mt-12 text-sm"
                    style={{ color: brandColors.deepObsidian + '80' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <p className="mb-2">Try these steps:</p>
                    <ul className="text-left inline-block space-y-1">
                        <li>• Check your WiFi or mobile data connection</li>
                        <li>• Turn airplane mode off if it's on</li>
                        <li>• Restart your router or modem</li>
                        <li>• Contact your internet service provider</li>
                    </ul>
                </motion.div>
            </motion.div>
        </div>
    );
}
