'use client';

import { ReactNode } from 'react';
import { motion, MotionProps } from 'framer-motion';
import clsx from 'clsx';

interface GlassMorphCardProps extends MotionProps {
  children: ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: 'light' | 'medium' | 'dark';
  border?: boolean;
  interactive?: boolean;
}

export function GlassMorphCard({
  children,
  className,
  blur = 'md',
  opacity = 'medium',
  border = true,
  interactive = false,
  ...motionProps
}: GlassMorphCardProps) {
  // Blur mapping
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  };

  // Opacity background mapping
  const opacityClasses = {
    light: 'bg-white/5',
    medium: 'bg-white/10',
    dark: 'bg-white/15',
  };

  const borderClass = border ? 'border border-white/20' : '';
  const interactiveClass = interactive
    ? 'hover:bg-white/15 hover:border-white/30 transition-all duration-300'
    : '';

  return (
    <motion.div
      {...motionProps}
      className={clsx(
        'rounded-2xl',
        'shadow-2xl shadow-surgical-blue/5',
        'backdrop-filter',
        blurClasses[blur],
        opacityClasses[opacity],
        borderClass,
        interactiveClass,
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Export preset variants for common use cases
export const GlassMorphCardVariants = {
  Hero: (props: Omit<GlassMorphCardProps, 'children'>) => ({
    blur: 'xl' as const,
    opacity: 'medium' as const,
    border: true,
    className: 'p-8 md:p-12',
    ...props,
  }),

  Feature: (props: Omit<GlassMorphCardProps, 'children'>) => ({
    blur: 'md' as const,
    opacity: 'light' as const,
    border: true,
    interactive: true,
    className: 'p-6',
    ...props,
  }),

  Minimal: (props: Omit<GlassMorphCardProps, 'children'>) => ({
    blur: 'sm' as const,
    opacity: 'light' as const,
    border: false,
    className: 'p-4',
    ...props,
  }),
};
