"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { brandColors } from "@/lib/animations";

interface ScrollProgressProps {
    /** Progress bar color (default: brand blue) */
    color?: string;
    /** Progress bar height in pixels (default: 3) */
    height?: number;
    /** Position: 'top' or 'bottom' (default: 'top') */
    position?: 'top' | 'bottom';
    /** Show/hide progress bar (default: true) */
    show?: boolean;
    /** z-index value (default: 50) */
    zIndex?: number;
    /** Enable smooth spring animation (default: true) */
    smooth?: boolean;
}

export default function ScrollProgress({
    color = brandColors.blueBright,
    height = 3,
    position = 'top',
    show = true,
    zIndex = 50,
    smooth = true,
}: ScrollProgressProps) {
    // Track scroll progress (0 to 1)
    const { scrollYProgress } = useScroll();

    // Apply spring physics for smooth animation (optional)
    const scaleX = smooth
        ? useSpring(scrollYProgress, {
              stiffness: 100,
              damping: 30,
              restDelta: 0.001,
          })
        : scrollYProgress;

    if (!show) return null;

    return (
        <motion.div
            className="fixed left-0 right-0 origin-left"
            style={{
                scaleX,
                height: `${height}px`,
                backgroundColor: color,
                top: position === 'top' ? 0 : 'auto',
                bottom: position === 'bottom' ? 0 : 'auto',
                zIndex,
                transformOrigin: '0%',
            }}
            aria-hidden="true"
        />
    );
}

/**
 * Alternative: Circular scroll progress indicator (top-right corner)
 */
export function CircularScrollProgress({
    color = brandColors.blueBright,
    size = 60,
    strokeWidth = 4,
    show = true,
}: {
    color?: string;
    size?: number;
    strokeWidth?: number;
    show?: boolean;
}) {
    const { scrollYProgress } = useScroll();

    // Calculate circle properties
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    if (!show) return null;

    return (
        <div
            className="fixed top-4 right-4 z-50"
            style={{ width: size, height: size }}
            aria-hidden="true"
        >
            {/* Background circle */}
            <svg className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    style={{
                        pathLength: scaleX,
                        strokeDasharray: circumference,
                        strokeDashoffset: 0,
                    }}
                />
            </svg>

            {/* Percentage text (optional) */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
                style={{ color }}
            >
                <motion.span
                    style={{
                        opacity: scaleX,
                    }}
                >
                    <motion.span>
                        {scrollYProgress.get() > 0 &&
                            Math.round(scrollYProgress.get() * 100)}
                    </motion.span>
                    {scrollYProgress.get() > 0 && '%'}
                </motion.span>
            </motion.div>
        </div>
    );
}

/**
 * Section-based scroll progress (shows progress through specific section)
 */
export function SectionScrollProgress({
    targetRef,
    color = brandColors.blueBright,
    height = 3,
    position = 'top',
    show = true,
}: {
    targetRef: React.RefObject<HTMLElement>;
    color?: string;
    height?: number;
    position?: 'top' | 'bottom';
    show?: boolean;
}) {
    // Track scroll progress within specific section
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    });

    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    if (!show) return null;

    return (
        <motion.div
            className="absolute left-0 right-0 origin-left"
            style={{
                scaleX,
                height: `${height}px`,
                backgroundColor: color,
                top: position === 'top' ? 0 : 'auto',
                bottom: position === 'bottom' ? 0 : 'auto',
                transformOrigin: '0%',
            }}
            aria-hidden="true"
        />
    );
}
