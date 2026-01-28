"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AG_EASE, AG_DURATION } from "@/lib/animation";

// Utility for cleaner tailwind classes
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FadeInProps {
    children: React.ReactNode;
    className?: string;
    delay?: number; // Delay in seconds (e.g., 0.1, 0.2)
    blur?: boolean; // Toggle the blur effect (expensive look)
    yOffset?: number; // How far down it starts
}

export default function FadeIn({
    children,
    className,
    delay = 0,
    blur = true,
    yOffset = 24, // Starts 24px down
}: FadeInProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    return (
        <motion.div
            ref={ref}
            initial={{
                opacity: 0,
                y: yOffset,
                filter: blur ? "blur(4px)" : "none" // Less blur for clarity
            }}
            animate={isInView ? {
                opacity: 1,
                y: 0,
                filter: "blur(0px)"
            } : {}}
            transition={{
                duration: AG_DURATION,
                ease: AG_EASE,
                delay: delay,
            }}
            className={cn("w-full", className)}
        >
            {children}
        </motion.div>
    );
}
