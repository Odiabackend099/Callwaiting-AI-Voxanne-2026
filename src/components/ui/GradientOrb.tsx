"use client";

import { motion } from "framer-motion";
import { brandColors, useReducedMotion } from "@/lib/animations";

/**
 * Props interface for GradientOrb component
 */
interface GradientOrbProps {
    /** Position of the orb relative to its container */
    position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
    /** Brand color scheme for the gradient orb */
    color: 'blue-bright' | 'blue-medium' | 'blue-light' | 'navy-dark';
    /** Gaussian blur intensity in pixels (default: 120px) */
    blur?: number;
    /** Orb diameter in pixels (default: 400px) */
    size?: number;
    /** Opacity level (0-1, default: 0.3) */
    opacity?: number;
    /** Animation loop duration in seconds (default: 8s) */
    animationDuration?: number;
}

/**
 * Map color prop to brand color hex values
 */
const colorMap: Record<GradientOrbProps['color'], string> = {
    'blue-bright': brandColors.blueBright,  // #0015ff - Primary CTA blue
    'blue-medium': brandColors.blueMedium,  // #4169ff - Secondary accent
    'blue-light': brandColors.blueLight,    // #87ceeb - Subtle highlights
    'navy-dark': brandColors.navyDark,      // #0a0e27 - Dark backgrounds
};

/**
 * Map position prop to absolute positioning styles
 */
const positionMap: Record<GradientOrbProps['position'], React.CSSProperties> = {
    'top-left': {
        top: '-10%',
        left: '-10%',
    },
    'top-right': {
        top: '-10%',
        right: '-10%',
    },
    'center': {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
    },
    'bottom-left': {
        bottom: '-10%',
        left: '-10%',
    },
    'bottom-right': {
        bottom: '-10%',
        right: '-10%',
    },
};

/**
 * GradientOrb Component
 *
 * Animated gradient background orb for parallax effects and visual depth.
 * Uses Framer Motion for GPU-accelerated animations with performance optimization.
 *
 * @example
 * ```tsx
 * <div className="relative overflow-hidden">
 *   <GradientOrb position="top-right" color="blue-bright" />
 *   <GradientOrb position="bottom-left" color="blue-medium" opacity={0.2} />
 *   <div className="relative z-10">Your content here</div>
 * </div>
 * ```
 *
 * Features:
 * - GPU-accelerated animations (transform + opacity)
 * - Responsive sizing (smaller on mobile)
 * - Accessibility support (respects prefers-reduced-motion)
 * - Infinite loop animation with subtle scale + opacity changes
 * - Z-index -1 to keep behind content
 *
 * @param {GradientOrbProps} props - Component props
 * @returns {JSX.Element} Animated gradient orb
 */
export function GradientOrb({
    position,
    color,
    blur = 120,
    size = 400,
    opacity = 0.3,
    animationDuration = 8,
}: GradientOrbProps) {
    const reducedMotion = useReducedMotion();
    const colorValue = colorMap[color];

    /**
     * Animation configuration for infinite loop
     * - Scale: 1 → 1.2 → 1 (subtle breathing effect)
     * - Opacity: base → base * 1.3 → base (subtle pulsing)
     */
    const animationConfig = reducedMotion
        ? {
            // Static fallback for reduced motion
            scale: 1,
            opacity,
        }
        : {
            scale: [1, 1.2, 1],
            opacity: [opacity, opacity * 1.3, opacity],
            transition: {
                duration: animationDuration,
                ease: "easeInOut" as const,
                repeat: Infinity,
                repeatType: "loop" as const,
            },
        };

    return (
        <motion.div
            className="absolute pointer-events-none w-[60%] h-[60%] md:w-[80%] md:h-[80%] lg:w-full lg:h-full"
            style={{
                ...positionMap[position],
                // Responsive sizing: smaller on mobile, full size on desktop
                width: size,
                height: size,
                // Radial gradient with brand color
                background: `radial-gradient(circle, ${colorValue} 0%, transparent 70%)`,
                // Gaussian blur for soft glow effect
                filter: `blur(${blur}px)`,
                // Keep behind content
                zIndex: -1,
                // GPU acceleration hint
                willChange: 'transform, opacity',
            }}
            initial={{ scale: 1, opacity }}
            animate={animationConfig}
            // Accessibility: remove animation if user prefers reduced motion
            aria-hidden="true"
        />
    );
}

/**
 * Type exports for external use
 */
export type { GradientOrbProps };
