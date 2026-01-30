"use client";

import { motion } from "framer-motion";
import { brandColors } from "@/lib/brand-colors";

export default function Loading() {
    return (
        <div
            className="min-h-screen flex items-center justify-center bg-clinical-bg"
            style={{}}
        >
            <div className="text-center">
                {/* Spinning loader */}
                <motion.div
                    className="w-16 h-16 border-4 rounded-full mx-auto mb-4"
                    style={{
                        borderColor: `${brandColors.blueBright}20`,
                        borderTopColor: brandColors.blueBright,
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />

                {/* Loading text */}
                <motion.p
                    className="text-lg font-medium"
                    style={{ color: brandColors.offWhite }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    Loading...
                </motion.p>
            </div>
        </div>
    );
}
