'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface AmbientOrbsProps {
  className?: string;
  count?: number;
  colors?: string[];
  animated?: boolean;
}

/**
 * AmbientOrbs Component
 *
 * Creates floating gradient orbs for background visual interest.
 * Perfect for hero sections and modern web design.
 *
 * Usage:
 * <AmbientOrbs count={3} colors={['clinical-blue', 'surgical-blue']} />
 */
export function AmbientOrbs({
  className,
  count = 3,
  colors = ['clinical-blue', 'surgical-blue', 'sky-mist'],
  animated = true,
}: AmbientOrbsProps) {
  // Generate orbs with unique properties
  const orbs = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 300 + 100, // 100-400px
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 10 + 15, // 15-25s
    delay: Math.random() * 5,
    color: colors[i % colors.length],
    opacity: Math.random() * 0.3 + 0.1, // 0.1-0.4
  }));

  return (
    <div className={clsx('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className={clsx(
            'absolute rounded-full blur-3xl',
            `bg-${orb.color}`
          )}
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.left}%`,
            top: `${orb.top}%`,
            opacity: orb.opacity,
          }}
          animate={
            animated
              ? {
                  x: [0, Math.random() * 100 - 50, 0],
                  y: [0, Math.random() * 100 - 50, 0],
                }
              : {}
          }
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * GradientOrb Component
 *
 * Single animated gradient orb with customizable properties.
 */
interface GradientOrbProps {
  size?: number;
  color?: string;
  duration?: number;
  delay?: number;
  opacity?: number;
  className?: string;
}

export function GradientOrb({
  size = 200,
  color = 'clinical-blue',
  duration = 20,
  delay = 0,
  opacity = 0.2,
  className,
}: GradientOrbProps) {
  return (
    <motion.div
      className={clsx('absolute rounded-full blur-3xl pointer-events-none', `bg-${color}`, className)}
      style={{
        width: size,
        height: size,
        opacity,
      }}
      animate={{
        x: [0, 30, -20, 10, 0],
        y: [0, -40, 20, -30, 0],
        scale: [1, 1.1, 0.9, 1.05, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * FloatingParticles Component
 *
 * Creates floating animated particles for visual depth.
 */
interface FloatingParticlesProps {
  count?: number;
  className?: string;
}

export function FloatingParticles({ count = 20, className }: FloatingParticlesProps) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 15 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className={clsx('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-surgical-blue"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
          }}
          animate={{
            y: [0, -100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
