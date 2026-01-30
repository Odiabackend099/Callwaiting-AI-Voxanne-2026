/**
 * Framer Motion Animation Presets
 *
 * Reusable animation variants for consistency across the application.
 * All animations follow the 3-step principle: plan, create, verify.
 */

// ============================================================================
// Fade Animations
// ============================================================================

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, x: -30, transition: { duration: 0.3 } },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, x: 30, transition: { duration: 0.3 } },
};

// ============================================================================
// Scale Animations
// ============================================================================

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'backOut' },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.3 } },
};

export const scaleInUp = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'backOut' },
  },
  exit: { opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.3 } },
};

// ============================================================================
// Slide Animations
// ============================================================================

export const slideInFromLeft = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, x: -100, transition: { duration: 0.3 } },
};

export const slideInFromRight = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, x: 100, transition: { duration: 0.3 } },
};

export const slideInFromTop = {
  hidden: { opacity: 0, y: -100 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: -100, transition: { duration: 0.3 } },
};

export const slideInFromBottom = {
  hidden: { opacity: 0, y: 100 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: 100, transition: { duration: 0.3 } },
};

// ============================================================================
// Container Animations (Stagger Effects)
// ============================================================================

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const staggerItemFadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export const staggerItemScale = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'backOut' },
  },
};

// ============================================================================
// Hover Animations
// ============================================================================

export const hoverLift = {
  hover: {
    y: -8,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    transition: { duration: 0.2 },
  },
};

export const hoverGrow = {
  hover: {
    scale: 1.05,
    transition: { duration: 0.2 },
  },
};

export const hoverRotate = {
  hover: {
    rotate: 5,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// Tap/Click Animations
// ============================================================================

export const tapScale = {
  tap: { scale: 0.95 },
};

export const tapRotate = {
  tap: { rotate: -2, scale: 0.98 },
};

// ============================================================================
// Loading Animations
// ============================================================================

export const spin = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulse = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const shimmer = {
  animate: {
    backgroundPosition: ['200% 0%', '-200% 0%'],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================================================
// Complex Animations
// ============================================================================

export const bounceIn = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      bounce: 0.5,
      duration: 0.8,
    },
  },
};

export const elasticIn = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 10,
      duration: 0.6,
    },
  },
};

// ============================================================================
// Text Animations
// ============================================================================

export const letterAnimation = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const wordAnimation = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
};

export const textReveal = {
  hidden: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
  visible: {
    opacity: 1,
    clipPath: 'inset(0 0% 0 0)',
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

// ============================================================================
// Glass Morphism Animations
// ============================================================================

export const glassAppear = {
  hidden: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
  },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(12px)',
    transition: { duration: 0.6 },
  },
};

export const glassPulse = {
  animate: {
    boxShadow: [
      '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
      '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
      '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// Page Transitions
// ============================================================================

export const pageEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
};

export const pageExit = {
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a stagger delay for array items
 */
export const getStaggerDelay = (index: number, staggerAmount: number = 0.1) => ({
  delay: index * staggerAmount,
});

/**
 * Combines multiple animation variants
 */
export const combineAnimations = (variants: Record<string, any>[]) => {
  return variants.reduce((acc, variant) => ({ ...acc, ...variant }), {});
};

// ============================================================================
// Easing Functions
// ============================================================================

export const easings = {
  easeOut: 'easeOut',
  easeIn: 'easeIn',
  easeInOut: 'easeInOut',
  circOut: 'circOut',
  circIn: 'circIn',
  circInOut: 'circInOut',
  backOut: 'backOut',
  backIn: 'backIn',
  backInOut: 'backInOut',
};

// ============================================================================
// Motion Utilities
// ============================================================================

/**
 * Hook to check if user prefers reduced motion
 * Used to disable animations for accessibility
 */
export const useReducedMotion = (): boolean => {
  // In Next.js/React, this would typically check:
  // window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // But for server-side safety, we default to false
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
