'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

/**
 * Logo variant types mapped to Brand folder assets
 */
export type LogoVariant =
  | 'horizontal-light'  // Full lockup with light background (1.png)
  | 'horizontal-dark'   // Full lockup with dark background (2.png)
  | 'icon-blue'         // Icon only - blue version (3.png)
  | 'icon-navy'         // Icon only - navy version (4.png)
  | 'icon-white'        // Icon only - white version (5.png)
  | 'text-only-light'   // Text only - light version (6.png)
  | 'text-only-dark';   // Text only - dark version (7.png)

/**
 * Logo size presets with pixel dimensions
 */
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props for the Logo component
 */
export interface LogoProps {
  /**
   * Brand variant to display
   * ✅ UPDATED: Default changed to approved logo (horizontal-light = Brand/1.png)
   * @default 'horizontal-light'
   */
  variant?: LogoVariant;

  /**
   * Size preset for the logo
   * @default 'md'
   */
  size?: LogoSize;

  /**
   * Optional href for clickable logo (wraps in Next.js Link)
   * @example '/dashboard' or 'https://voxanne.ai'
   */
  href?: string;

  /**
   * Show text alongside icon (only applies to icon-* variants)
   * Horizontal and text-only variants always show text
   * @default true
   */
  showText?: boolean;

  /**
   * Additional CSS classes for custom styling
   */
  className?: string;

  /**
   * Priority loading for above-the-fold logos
   * @default false
   */
  priority?: boolean;

  /**
   * Aria label for accessibility
   * @default 'Voxanne AI'
   */
  ariaLabel?: string;

  /**
   * Disable hover animation
   * @default false
   */
  disableAnimation?: boolean;
}

/**
 * Variant to file path mapping
 */
const VARIANT_MAP: Record<LogoVariant, string> = {
  'horizontal-light': '/Brand/1.png',
  'horizontal-dark': '/Brand/2.png',
  'icon-blue': '/Brand/3.png',
  'icon-navy': '/Brand/4.png',
  'icon-white': '/Brand/5.png',
  'text-only-light': '/Brand/6.png',
  'text-only-dark': '/Brand/7.png',
};

/**
 * Size to pixel dimensions mapping
 * Icon-only: square dimensions
 * Horizontal: wider aspect ratio (2:1)
 * Text-only: wider aspect ratio (3:1)
 */
const SIZE_MAP: Record<LogoSize, { icon: number; horizontal: { width: number; height: number }; textOnly: { width: number; height: number } }> = {
  sm: {
    icon: 24,
    horizontal: { width: 96, height: 24 },
    textOnly: { width: 120, height: 24 }
  },
  md: {
    icon: 32,
    horizontal: { width: 128, height: 32 },
    textOnly: { width: 160, height: 32 }
  },
  lg: {
    icon: 48,
    horizontal: { width: 192, height: 48 },
    textOnly: { width: 240, height: 48 }
  },
  xl: {
    icon: 64,
    horizontal: { width: 256, height: 64 },
    textOnly: { width: 320, height: 64 }
  },
};

/**
 * ✅ CRITICAL FIX: Adaptive spacing for icon + text combinations
 * Scales gap and text size based on icon dimensions for visual balance
 * Ensures professional appearance across all sizes (sm, md, lg, xl)
 */
const SIZE_WITH_SPACING: Record<LogoSize, { gap: string; textSize: string }> = {
  sm: { gap: 'gap-1', textSize: 'text-xs' },      // 4px gap, extra small text
  md: { gap: 'gap-2', textSize: 'text-sm' },      // 8px gap, small text
  lg: { gap: 'gap-2', textSize: 'text-base' },    // 8px gap, normal text
  xl: { gap: 'gap-3', textSize: 'text-lg' }       // 12px gap, large text
};

/**
 * Enhanced Logo component with full brand variant support
 *
 * Features:
 * - 7 brand variants from Brand folder
 * - 4 size presets (sm, md, lg, xl)
 * - Framer Motion hover animation (scale 1.02)
 * - Optional href for clickable logo
 * - Full TypeScript type safety
 * - Accessibility support
 * - Error boundary fallback
 *
 * @example
 * ```tsx
 * // Icon only with hover animation
 * <Logo variant="icon-blue" size="md" />
 *
 * // Horizontal lockup with link
 * <Logo variant="horizontal-dark" size="lg" href="/" />
 *
 * // Text-only for compact spaces
 * <Logo variant="text-only-light" size="sm" />
 * ```
 */
export default function Logo({
  variant = 'horizontal-light', // ✅ UPDATED: Use approved logo (Brand/1.png) by default
  size = 'md',
  href,
  showText = true,
  className = '',
  priority = false,
  ariaLabel = 'Voxanne AI',
  disableAnimation = false,
}: LogoProps) {
  const [imageError, setImageError] = useState(false);

  // Determine variant type for sizing logic
  const isHorizontal = variant.startsWith('horizontal');
  const isTextOnly = variant.startsWith('text-only');
  const isIconOnly = variant.startsWith('icon');

  // Get appropriate dimensions based on variant type
  const getDimensions = () => {
    if (isHorizontal) return SIZE_MAP[size].horizontal;
    if (isTextOnly) return SIZE_MAP[size].textOnly;
    return { width: SIZE_MAP[size].icon, height: SIZE_MAP[size].icon };
  };

  const dimensions = getDimensions();
  const imageSrc = VARIANT_MAP[variant];

  // ✅ CRITICAL FIX: Get adaptive spacing based on logo size
  const { gap, textSize } = SIZE_WITH_SPACING[size];

  // Error fallback: render text-based logo if image fails
  if (imageError) {
    return (
      <div
        className={`flex items-center justify-center font-bold text-deep-obsidian ${className}`}
        style={{ width: dimensions.width, height: dimensions.height }}
        role="img"
        aria-label={ariaLabel}
      >
        <span className={textSize}>VoxanneAI</span>
      </div>
    );
  }

  // Logo image with motion animation
  const logoImage = (
    <motion.div
      className="relative flex items-center justify-center"
      whileHover={disableAnimation ? {} : { scale: 1.02 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <Image
        src={imageSrc}
        alt={ariaLabel}
        width={dimensions.width}
        height={dimensions.height}
        className="object-contain w-auto h-auto"
        priority={priority}
        onError={() => setImageError(true)}
        quality={90}
      />
    </motion.div>
  );

  // ✅ CRITICAL FIX: Wrapper content with adaptive spacing
  const content = (
    <div
      className={`inline-flex items-center ${gap} ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      {logoImage}
      {showText && (isIconOnly || isHorizontal) && (
        <span className={`font-bold ${textSize} text-deep-obsidian whitespace-nowrap`}>
          Voxanne
        </span>
      )}
    </div>
  );

  // Wrap in Link if href provided
  if (href) {
    return (
      <Link
        href={href}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surgical-blue focus-visible:ring-offset-2 rounded-lg transition-all"
        aria-label={`Navigate to ${href}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}
