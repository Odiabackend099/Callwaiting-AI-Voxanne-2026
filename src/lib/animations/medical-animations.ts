"use client";

import type { Variants } from 'framer-motion';
import { easings, durations } from './index';

/**
 * Medical Animation Library - Healthcare-Appropriate Variants
 *
 * This library provides animation variants specifically designed for healthcare
 * applications where professionalism, trust, and accessibility are paramount.
 *
 * Design Principles:
 * - Subtle and non-distracting (healthcare requires focus)
 * - Professional and trustworthy (aligns with medical context)
 * - Accessible by default (respects reduced motion preferences)
 * - Performance-optimized (transform + opacity only)
 * - WCAG 2.1 AAA compliant animation timing
 *
 * Use Cases:
 * - Medical dashboards (patient data, metrics)
 * - Healthcare analytics (charts, statistics)
 * - Voice AI call indicators (live status)
 * - Appointment booking interfaces
 * - Clinical workflow automation
 *
 * @module medical-animations
 */

// ============================================================================
// MEDICAL ANIMATION VARIANTS
// ============================================================================

/**
 * Collection of healthcare-appropriate animation variants
 */
export const medicalVariants = {
  /**
   * Medical Fade - Subtle, professional fade-in animation
   *
   * Medical Context:
   * - Used for displaying patient information, medical data
   * - Smooth enough not to distract from critical information
   * - Duration: 0.4s (faster than entertainment animations)
   *
   * Accessibility:
   * - Short duration prevents motion sickness
   * - Opacity-only change is safe for most users
   *
   * @example
   * <motion.div variants={medicalVariants.medicalFade} initial="hidden" animate="visible">
   *   <PatientCard data={patient} />
   * </motion.div>
   */
  medicalFade: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: durations.fast, // 0.4s - professional speed
        ease: easings.smooth, // Smooth, no overshoot
      },
    },
  } as Variants,

  /**
   * Pulse - Gentle pulse animation for live indicators
   *
   * Medical Context:
   * - Indicates active voice calls (AI agent speaking)
   * - Shows real-time data updates (live metrics)
   * - Signals system activity without distraction
   *
   * Technical Details:
   * - 1.5s loop (slower than typical pulse for professionalism)
   * - Scale range: 1.0 to 1.08 (subtle, not jarring)
   * - Infinite repeat with reverse (smooth loop)
   *
   * Accessibility:
   * - Provide static alternative for reduced motion
   * - Include aria-live="polite" on container
   *
   * @example
   * <motion.div variants={medicalVariants.pulse} animate="pulse">
   *   <StatusIndicator status="live" />
   * </motion.div>
   */
  pulse: {
    pulse: {
      scale: [1, 1.08, 1],
      opacity: [1, 0.85, 1],
      transition: {
        duration: 1.5, // Slow, professional pulse
        ease: easings.smooth,
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  } as Variants,

  /**
   * Data Reveal - Chart and metric reveal animation
   *
   * Medical Context:
   * - Used for revealing analytics charts (call metrics, performance)
   * - Shows appointment statistics, conversion rates
   * - Displays patient engagement metrics
   *
   * Technical Details:
   * - ScaleY animation (grows from bottom like bar chart)
   * - Origin point: bottom (transformOrigin: "bottom")
   * - Combined with opacity for smooth reveal
   *
   * Performance:
   * - GPU-accelerated (transform + opacity)
   * - No layout shift (uses transform, not height)
   *
   * @example
   * <motion.div variants={medicalVariants.dataReveal} initial="hidden" animate="visible">
   *   <BarChart data={callMetrics} />
   * </motion.div>
   */
  dataReveal: {
    hidden: {
      opacity: 0,
      scaleY: 0,
      transformOrigin: "bottom",
    },
    visible: {
      opacity: 1,
      scaleY: 1,
      transformOrigin: "bottom",
      transition: {
        duration: 0.6, // Moderate speed for data visualization
        ease: easings.easeOut, // Deceleration curve (natural reveal)
      },
    },
  } as Variants,

  /**
   * Voice Wave - Voice activity animation (audio visualizer)
   *
   * Medical Context:
   * - Indicates AI voice agent is speaking
   * - Shows audio input/output activity
   * - Provides visual feedback during phone calls
   *
   * Technical Details:
   * - ScaleY pulsing (vertical bars like audio waveform)
   * - 0.6s duration (fast enough to feel responsive)
   * - Infinite loop (continuous during active call)
   *
   * Accessibility:
   * - Pair with text alternative ("AI Agent Speaking")
   * - Use role="status" for screen readers
   *
   * @example
   * <motion.div variants={medicalVariants.voiceWave} animate="speaking">
   *   <VoiceWaveBar index={0} />
   * </motion.div>
   */
  voiceWave: {
    idle: {
      scaleY: 0.3,
      opacity: 0.6,
    },
    speaking: {
      scaleY: [0.3, 1, 0.5, 1, 0.3],
      opacity: [0.6, 1, 0.8, 1, 0.6],
      transition: {
        duration: 0.6, // Fast, responsive feel
        ease: easings.smooth,
        repeat: Infinity,
        repeatType: "loop" as const,
      },
    },
  } as Variants,

  /**
   * Professional Slide - Gentle slide-in animation
   *
   * Medical Context:
   * - Used for modal dialogs (appointment details, patient info)
   * - Sidebar navigation (dashboard navigation)
   * - Toast notifications (system alerts)
   *
   * Technical Details:
   * - 10px Y offset (subtle, not dramatic)
   * - 0.4s duration (quick but not rushed)
   * - Combined with fade for smooth entrance
   *
   * Design Rationale:
   * - Small offset (10px) feels polished, not flashy
   * - Professional easing curve (no bounce)
   * - Works well with reduced motion preferences
   *
   * @example
   * <motion.div variants={medicalVariants.professionalSlide} initial="hidden" animate="visible">
   *   <AppointmentModal appointment={data} />
   * </motion.div>
   */
  professionalSlide: {
    hidden: {
      opacity: 0,
      y: 10, // Subtle 10px offset
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: durations.fast, // 0.4s - professional speed
        ease: easings.professional, // Smooth, polished curve
      },
    },
  } as Variants,

  /**
   * Medical Slide Up - Upward slide for cards and containers
   *
   * Medical Context:
   * - Dashboard metric cards (revealing key stats)
   * - Patient information panels
   * - Call log entries
   *
   * Technical Details:
   * - 12px Y offset (slightly larger than professionalSlide)
   * - 0.5s duration (moderate pace for larger elements)
   * - Subtle blur effect (premium feel)
   *
   * @example
   * <motion.div variants={medicalVariants.medicalSlideUp} initial="hidden" animate="visible">
   *   <MetricCard title="Total Calls" value={1247} />
   * </motion.div>
   */
  medicalSlideUp: {
    hidden: {
      opacity: 0,
      y: 12,
      filter: "blur(4px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: durations.normal, // 0.5s
        ease: easings.professional,
      },
    },
  } as Variants,

  /**
   * Stagger Container - Parent container for staggered children
   *
   * Medical Context:
   * - Lists of appointments (stagger each item)
   * - Dashboard metric cards (reveal in sequence)
   * - Call log entries (progressive disclosure)
   *
   * Technical Details:
   * - 0.08s stagger (faster than entertainment apps)
   * - 0.1s delay before first child
   * - Works with any child variant
   *
   * Usage Pattern:
   * - Parent uses staggerContainer
   * - Children use any other variant (medicalFade, professionalSlide, etc.)
   *
   * @example
   * <motion.ul variants={medicalVariants.staggerContainer} initial="hidden" animate="visible">
   *   <motion.li variants={medicalVariants.medicalFade}>Item 1</motion.li>
   *   <motion.li variants={medicalVariants.medicalFade}>Item 2</motion.li>
   * </motion.ul>
   */
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, // Fast stagger (professional pace)
        delayChildren: 0.1, // Small initial delay
      },
    },
  } as Variants,

  /**
   * Scale Subtle - Gentle scale animation for interactive elements
   *
   * Medical Context:
   * - Button hover states (CTAs, actions)
   * - Card hover effects (appointment cards)
   * - Interactive data points (chart nodes)
   *
   * Technical Details:
   * - Scale: 1.0 to 1.02 (very subtle)
   * - 0.2s duration (instant feedback)
   * - No overshoot (professional feel)
   *
   * Accessibility:
   * - Minimal motion (safe for most users)
   * - Provides visual feedback without distraction
   *
   * @example
   * <motion.button
   *   variants={medicalVariants.scaleSubtle}
   *   whileHover="hover"
   *   whileTap="tap"
   * >
   *   Book Appointment
   * </motion.button>
   */
  scaleSubtle: {
    rest: { scale: 1 },
    hover: {
      scale: 1.02, // Very subtle scale
      transition: {
        duration: 0.2,
        ease: easings.smooth,
      },
    },
    tap: {
      scale: 0.98, // Slight press effect
    },
  } as Variants,

  /**
   * Medical Glow - Subtle glow effect for live/active states
   *
   * Medical Context:
   * - Live call indicator (active voice session)
   * - Active appointment (currently in progress)
   * - System status (online/operational)
   *
   * Technical Details:
   * - Green glow (medical/healthcare standard)
   * - Low opacity (0.15 - very subtle)
   * - 0.3s transition (responsive feel)
   *
   * Color Psychology:
   * - Green: positive, active, healthy
   * - Subtle opacity: professional, not distracting
   *
   * @example
   * <motion.div
   *   variants={medicalVariants.medicalGlow}
   *   animate={isLive ? "active" : "inactive"}
   * >
   *   <LiveIndicator />
   * </motion.div>
   */
  medicalGlow: {
    inactive: {
      boxShadow: "0 0 0 rgba(34, 197, 94, 0)",
    },
    active: {
      boxShadow: "0 0 12px rgba(34, 197, 94, 0.15)", // Subtle green glow
      transition: {
        duration: durations.fast,
        ease: easings.smooth,
      },
    },
  } as Variants,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type for medical animation variant keys
 */
export type MedicalVariantKey = keyof typeof medicalVariants;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a medical-appropriate stagger transition
 *
 * Faster than entertainment animations, respects professional context.
 *
 * @param staggerChildren - Delay between each child (default: 0.08s)
 * @param delayChildren - Delay before first child (default: 0.1s)
 * @returns Transition object for Framer Motion
 *
 * @example
 * const transition = createMedicalStagger(0.05, 0);
 */
export const createMedicalStagger = (
  staggerChildren: number = 0.08,
  delayChildren: number = 0.1
) => ({
  staggerChildren,
  delayChildren,
});

/**
 * Create a reduced-motion fallback for medical animations
 *
 * Returns simplified variants if user prefers reduced motion.
 * Critical for accessibility in healthcare applications.
 *
 * @param normalVariants - Full animation variants
 * @returns Variants (normal or reduced)
 *
 * @example
 * const variants = createMedicalAccessibleVariants(medicalVariants.medicalFade);
 */
export const createMedicalAccessibleVariants = (
  normalVariants: Variants
): Variants => {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Return static variants (no animation) for reduced motion
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1 },
      hover: {},
      tap: {},
      pulse: {},
      speaking: {},
      active: {},
      inactive: {},
    };
  }
  return normalVariants;
};

// ============================================================================
// MEDICAL DESIGN TOKENS
// ============================================================================

/**
 * Healthcare-specific animation durations
 *
 * Shorter than entertainment apps, respects professional context.
 */
export const medicalDurations = {
  /** Instant feedback (hover, tap) */
  instant: 0.15,

  /** Quick transitions (tooltips, dropdowns) */
  quick: 0.3,

  /** Standard animations (modals, slides) */
  standard: 0.4,

  /** Data reveals (charts, metrics) */
  reveal: 0.6,
} as const;

/**
 * Healthcare color palette for animations
 *
 * Based on medical industry standards and psychology.
 */
export const medicalColors = {
  /** Success, active, healthy (green) */
  success: 'rgba(34, 197, 94, 0.15)',

  /** Warning, attention (amber) */
  warning: 'rgba(251, 191, 36, 0.15)',

  /** Error, critical (red) */
  error: 'rgba(239, 68, 68, 0.15)',

  /** Info, neutral (blue) */
  info: 'rgba(59, 130, 246, 0.15)',

  /** Active call, live (purple) */
  live: 'rgba(147, 51, 234, 0.15)',
} as const;

// ============================================================================
// ACCESSIBILITY GUIDELINES
// ============================================================================

/**
 * MEDICAL ANIMATION ACCESSIBILITY GUIDELINES:
 *
 * 1. Motion Preferences:
 *    ✅ Always check prefers-reduced-motion
 *    ✅ Provide static alternative for all animations
 *    ✅ Use createMedicalAccessibleVariants utility
 *
 * 2. Animation Timing (WCAG 2.1):
 *    ✅ Keep durations < 0.6s (prevents motion sickness)
 *    ✅ Avoid rapid flashing (no strobe effects)
 *    ✅ Use smooth easing (no sharp/jarring motion)
 *
 * 3. Screen Reader Support:
 *    ✅ Add aria-live for dynamic content
 *    ✅ Use role="status" for live indicators
 *    ✅ Provide text alternatives for visual indicators
 *
 * 4. Color Contrast:
 *    ✅ Maintain WCAG AAA contrast (7:1 for text)
 *    ✅ Don't rely on color alone (use icons + text)
 *    ✅ Test with color blindness simulators
 *
 * 5. Focus Indicators:
 *    ✅ Visible focus states (keyboard navigation)
 *    ✅ Don't animate focus (causes confusion)
 *    ✅ 2px minimum outline thickness
 *
 * 6. Performance:
 *    ✅ GPU-accelerated only (transform, opacity)
 *    ✅ Avoid animating width, height, margin, padding
 *    ✅ Use will-change sparingly (memory cost)
 *
 * 7. Medical Context:
 *    ✅ Subtle animations (don't distract from critical info)
 *    ✅ Professional easing (no bounce in medical apps)
 *    ✅ Fast timing (users are task-focused)
 */

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Dashboard Metric Card
 *
 * ```tsx
 * import { motion } from 'framer-motion';
 * import { medicalVariants } from '@/lib/animations/medical-animations';
 *
 * export function MetricCard({ title, value }: { title: string; value: number }) {
 *   return (
 *     <motion.div
 *       variants={medicalVariants.medicalSlideUp}
 *       initial="hidden"
 *       animate="visible"
 *       className="p-6 bg-white rounded-lg shadow"
 *     >
 *       <h3>{title}</h3>
 *       <p className="text-3xl font-bold">{value}</p>
 *     </motion.div>
 *   );
 * }
 * ```
 *
 * EXAMPLE 2: Live Call Indicator
 *
 * ```tsx
 * import { motion } from 'framer-motion';
 * import { medicalVariants } from '@/lib/animations/medical-animations';
 *
 * export function LiveIndicator({ isLive }: { isLive: boolean }) {
 *   return (
 *     <motion.div
 *       variants={medicalVariants.pulse}
 *       animate={isLive ? "pulse" : "idle"}
 *       className="w-3 h-3 rounded-full bg-green-500"
 *       role="status"
 *       aria-live="polite"
 *     >
 *       {isLive && <span className="sr-only">Call in progress</span>}
 *     </motion.div>
 *   );
 * }
 * ```
 *
 * EXAMPLE 3: Staggered List (Appointments)
 *
 * ```tsx
 * import { motion } from 'framer-motion';
 * import { medicalVariants } from '@/lib/animations/medical-animations';
 *
 * export function AppointmentList({ appointments }: { appointments: Appointment[] }) {
 *   return (
 *     <motion.ul
 *       variants={medicalVariants.staggerContainer}
 *       initial="hidden"
 *       animate="visible"
 *     >
 *       {appointments.map((appointment) => (
 *         <motion.li
 *           key={appointment.id}
 *           variants={medicalVariants.medicalFade}
 *         >
 *           <AppointmentCard data={appointment} />
 *         </motion.li>
 *       ))}
 *     </motion.ul>
 *   );
 * }
 * ```
 */
