"use client";

import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'framer-motion';

/**
 * Voxanne AI Animation Library
 *
 * Unified animation system consolidating all animation patterns, easing curves,
 * and spring physics presets. Follows 2025 Webflow design standards with
 * performance optimization and accessibility support.
 */

// ============================================================================
// EASING CURVES
// ============================================================================

/**
 * Collection of cubic-bezier easing curves for various animation styles
 */
export const easings = {
  /** Smooth, polished animation - best for professional UI elements */
  professional: [0.25, 1, 0.5, 1] as const,

  /** Bouncy, playful animation - best for interactive elements */
  antiGravity: [0.16, 1, 0.3, 1] as const,

  /** Material Design standard - balanced and smooth */
  smooth: [0.4, 0.0, 0.2, 1] as const,

  /** Overshoot effect - adds playful bounce */
  bounce: [0.68, -0.55, 0.265, 1.55] as const,

  /** Snappy, responsive feel - best for quick interactions */
  sharp: [0.4, 0.0, 0.6, 1] as const,

  /** Deceleration curve - slows down at the end */
  easeOut: [0.0, 0.0, 0.2, 1] as const,

  /** Acceleration curve - speeds up at the start */
  easeIn: [0.4, 0.0, 1, 1] as const,

  /** Default standard easing */
  standard: [0.4, 0.0, 0.2, 1] as const,
} as const;

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Pre-configured animation variants for common UI patterns
 * All variants respect performance best practices (transform + opacity only)
 */
export const variants = {
  /** Fade in from below with blur effect (signature Voxanne style) */
  fadeInUp: {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: easings.antiGravity }
    }
  },

  /** Fade in with scale (pop-in effect) */
  fadeInScale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: easings.smooth }
    }
  },

  /** Slide in from left */
  slideInLeft: {
    hidden: { opacity: 0, x: -40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.7, ease: easings.professional }
    }
  },

  /** Slide in from right */
  slideInRight: {
    hidden: { opacity: 0, x: 40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.7, ease: easings.professional }
    }
  },

  /** Slide in from top */
  slideInDown: {
    hidden: { opacity: 0, y: -40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: easings.professional }
    }
  },

  /** Container for stagger animations */
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },

  /** Scale on hover (subtle lift) */
  scaleOnHover: {
    rest: { scale: 1 },
    hover: {
      scale: 1.05,
      transition: { duration: 0.3, ease: easings.smooth }
    }
  },

  /** Glow effect on hover using brand colors */
  glowOnHover: {
    rest: { boxShadow: "0 0 0 rgba(0, 21, 255, 0)" },
    hover: {
      boxShadow: "0 0 20px rgba(0, 21, 255, 0.3)",
      transition: { duration: 0.3 }
    }
  },

  /** Scale and glow combined */
  scaleAndGlowOnHover: {
    rest: {
      scale: 1,
      boxShadow: "0 0 0 rgba(0, 21, 255, 0)"
    },
    hover: {
      scale: 1.05,
      boxShadow: "0 0 20px rgba(0, 21, 255, 0.3)",
      transition: { duration: 0.3, ease: easings.smooth }
    }
  },

  /** Tap scale (button press feedback) */
  tapScale: {
    rest: { scale: 1 },
    tap: { scale: 0.95 }
  },
} as const;

// ============================================================================
// SPRING PHYSICS PRESETS
// ============================================================================

/**
 * Spring physics configurations for natural, physics-based animations
 * Use these for interactive elements like buttons, modals, and drag interactions
 */
export const springs = {
  /** Gentle spring - subtle, soft motion */
  gentle: { type: "spring" as const, stiffness: 100, damping: 15 },

  /** Snappy spring - quick, responsive motion */
  snappy: { type: "spring" as const, stiffness: 300, damping: 30 },

  /** Bouncy spring - playful overshoot */
  bouncy: { type: "spring" as const, stiffness: 400, damping: 17 },

  /** Smooth spring - balanced motion */
  smooth: { type: "spring" as const, stiffness: 200, damping: 25 },
} as const;

// ============================================================================
// ANIMATION DURATIONS
// ============================================================================

/**
 * Standard animation durations (in seconds)
 * Keep animations under 0.8s for perceived performance
 */
export const durations = {
  /** Very fast - micro-interactions */
  instant: 0.15,

  /** Fast - hover effects, tooltips */
  fast: 0.3,

  /** Normal - standard UI animations */
  normal: 0.5,

  /** Slow - entrance animations, page transitions */
  slow: 0.8,

  /** Very slow - special effects only */
  verySlow: 1.2,
} as const;

// ============================================================================
// ACCESSIBILITY - REDUCED MOTION
// ============================================================================

/**
 * Check if user prefers reduced motion (accessibility)
 * @returns boolean - true if reduced motion is preferred
 */
export const getReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * React hook for prefers-reduced-motion media query
 * Updates when user preference changes
 *
 * @example
 * const reducedMotion = useReducedMotion();
 * const variants = reducedMotion ? { hidden: {}, visible: {} } : normalVariants;
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(listener);
      return () => mediaQuery.removeListener(listener);
    }
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a stagger transition with custom timing
 *
 * @param staggerChildren - Delay between each child (in seconds)
 * @param delayChildren - Delay before first child (in seconds)
 * @returns Transition object for Framer Motion
 */
export const createStaggerTransition = (
  staggerChildren: number = 0.1,
  delayChildren: number = 0.2
): Transition => ({
  staggerChildren,
  delayChildren,
});

/**
 * Create a fade-in transition with custom duration and easing
 *
 * @param duration - Animation duration (in seconds)
 * @param ease - Easing curve (from easings collection)
 * @param delay - Delay before animation starts (in seconds)
 * @returns Transition object
 */
export const createFadeTransition = (
  duration: number = 0.8,
  ease: readonly number[] = easings.antiGravity,
  delay: number = 0
): Transition => ({
  duration,
  ease: ease as any,
  delay,
});

/**
 * Create variants that respect reduced motion preference
 * Returns simplified variants (no animation) if user prefers reduced motion
 *
 * @param normalVariants - Standard animation variants
 * @returns Variants (normal or reduced)
 */
export const createAccessibleVariants = (
  normalVariants: Variants
): Variants => {
  if (getReducedMotion()) {
    // Return static variants (no animation)
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1 },
    };
  }
  return normalVariants;
};

// ============================================================================
// BRAND COLORS (from 9.png)
// ============================================================================

/**
 * Voxanne AI brand colors for consistent glow effects and gradients
 */
export const brandColors = {
  navyDark: '#0a0e27',      // Primary dark backgrounds
  blueBright: '#0015ff',    // CTAs, primary actions
  blueMedium: '#4169ff',    // Secondary accents
  blueLight: '#87ceeb',     // Highlights, hover states
  blueSubtle: '#d6e9f5',    // Subtle backgrounds
  offWhite: '#f5f5f5',      // Light backgrounds
} as const;

/**
 * Create glow effect with brand colors
 *
 * @param color - Color key from brandColors
 * @param intensity - Glow intensity (0-1)
 * @returns CSS box-shadow string
 */
export const createBrandGlow = (
  color: keyof typeof brandColors = 'blueBright',
  intensity: number = 0.3
): string => {
  const colorValue = brandColors[color];
  // Convert hex to rgba for alpha channel
  const r = parseInt(colorValue.slice(1, 3), 16);
  const g = parseInt(colorValue.slice(3, 5), 16);
  const b = parseInt(colorValue.slice(5, 7), 16);

  return `0 0 20px rgba(${r}, ${g}, ${b}, ${intensity})`;
};

// ============================================================================
// PERFORMANCE TIPS (Comments for developers)
// ============================================================================

/**
 * PERFORMANCE BEST PRACTICES:
 *
 * 1. GPU-Accelerated Properties:
 *    ✅ Use: transform, opacity, filter
 *    ❌ Avoid: width, height, top, left, margin, padding
 *
 * 2. Will-Change:
 *    - Use sparingly (only for frequently animated elements)
 *    - Remove after animation completes
 *    - Example: will-change: transform
 *
 * 3. Animation Duration:
 *    - Keep under 0.8s for perceived performance
 *    - Use 0.3s for micro-interactions
 *    - Use 0.5-0.8s for page transitions
 *
 * 4. Reduced Motion:
 *    - Always check useReducedMotion() hook
 *    - Provide static fallback for accessibility
 *
 * 5. Layout Animations:
 *    - Use Framer Motion's layout prop for automatic FLIP animations
 *    - Prevents layout shift (CLS) issues
 *
 * 6. Scroll Animations:
 *    - Use useInView with once: true to prevent re-triggering
 *    - Use margin for early trigger (better UX)
 *
 * 7. Exit Animations:
 *    - Always wrap with AnimatePresence
 *    - Prevents abrupt unmounting
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EasingKey = keyof typeof easings;
export type VariantKey = keyof typeof variants;
export type SpringKey = keyof typeof springs;
export type DurationKey = keyof typeof durations;
export type BrandColorKey = keyof typeof brandColors;
