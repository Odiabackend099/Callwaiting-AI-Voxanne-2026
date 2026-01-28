"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BentoCardProps {
    title: string;
    description: string;
    graphic?: ReactNode; // Place for an image, icon, or abstract shape
    className?: string;
    colSpan?: 1 | 2 | 3; // Helper for grid layout
}

export default function BentoCard({
    title,
    description,
    graphic,
    className,
    colSpan = 1,
}: BentoCardProps) {
    return (
        <motion.div
            // 1. The Container Animation (Subtle Lift)
            whileHover="hovered"
            initial="initial"
            variants={{
                initial: { scale: 1, y: 0, borderColor: "rgba(226, 232, 240, 1)" }, // Slate-200
                hovered: { scale: 1, y: -4, borderColor: "rgba(59, 130, 246, 0.4)" }, // Blue-500/40
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}

            // 2. Styling (Light Mode: White bg, shadow-sm -> shadow-md)
            className={cn(
                "relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-slate-200 p-8 cursor-pointer group shadow-sm hover:shadow-md transition-shadow duration-300",
                colSpan === 2 ? "md:col-span-2" : "md:col-span-1",
                colSpan === 3 ? "md:col-span-3" : "",
                className
            )}
        >
            {/* 3. The Graphic Area (Subtle Parallax) */}
            <motion.div
                variants={{
                    initial: { y: 0, opacity: 1 },
                    hovered: { y: -2, opacity: 1 },
                }}
                transition={{ duration: 0.3 }}
                className="h-32 mb-6 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100"
            >
                {graphic || <div className="w-10 h-10 rounded-full bg-slate-100" />}
            </motion.div>

            {/* 4. Text Content */}
            <div className="z-10">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
            </div>

            {/* 5. The "Action Arrow" (Blue) */}
            <motion.div
                variants={{
                    initial: { opacity: 0, x: -10 },
                    hovered: { opacity: 1, x: 0 },
                }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-8 right-8 text-surgical-600"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </motion.div>
        </motion.div>
    );
}
