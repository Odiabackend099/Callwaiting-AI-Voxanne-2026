"use client";

import { useScroll, useTransform, motion, MotionValue } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  offset?: number;
  className?: string;
  id?: string;
}

/**
 * ParallaxSection Component
 * Creates a parallax scrolling effect where child elements move at different speeds
 * 
 * @param offset - Speed multiplier (0.5 = half speed, 0.3 = third speed)
 * @param className - Additional CSS classes
 * @param id - Section ID for targeting
 */
export function ParallaxSection({ 
  children, 
  offset = 0.5, 
  className = '',
  id 
}: ParallaxSectionProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  
  // Transform scroll progress to Y translation
  const y = useTransform(scrollYProgress, [0, 1], [0, 100 * offset]);

  return (
    <motion.div 
      ref={ref} 
      style={{ y }}
      className={className}
      id={id}
    >
      {children}
    </motion.div>
  );
}

interface ParallaxBackgroundProps {
  children: ReactNode;
  className?: string;
  speed?: number;
}

/**
 * ParallaxBackground Component
 * Creates a background element that moves slower than foreground
 */
export function ParallaxBackground({ 
  children, 
  className = '',
  speed = 0.5 
}: ParallaxBackgroundProps) {
  return (
    <ParallaxSection offset={speed} className={`absolute inset-0 ${className}`}>
      {children}
    </ParallaxSection>
  );
}

interface FadeInOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * FadeInOnScroll Component
 * Fades in element when it comes into view
 */
export function FadeInOnScroll({ 
  children, 
  className = '',
  delay = 0 
}: FadeInOnScrollProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ 
    target: ref, 
    offset: ["start 0.9", "start 0.1"] 
  });
  
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <motion.div 
      ref={ref}
      style={{ opacity }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface SlideInOnScrollProps {
  children: ReactNode;
  className?: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
}

/**
 * SlideInOnScroll Component
 * Slides in element when it comes into view
 */
export function SlideInOnScroll({ 
  children, 
  className = '',
  direction = 'up',
  delay = 0 
}: SlideInOnScrollProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ 
    target: ref, 
    offset: ["start 0.9", "start 0.1"] 
  });
  
  const getInitialTransform = () => {
    switch(direction) {
      case 'left': return { x: -40, opacity: 0 };
      case 'right': return { x: 40, opacity: 0 };
      case 'down': return { y: 40, opacity: 0 };
      case 'up': return { y: 40, opacity: 0 };
      default: return { y: 40, opacity: 0 };
    }
  };

  const x = direction === 'left' || direction === 'right' 
    ? useTransform(scrollYProgress, [0, 1], [direction === 'left' ? -40 : 40, 0])
    : 0;
  
  const y = direction === 'up' || direction === 'down'
    ? useTransform(scrollYProgress, [0, 1], [direction === 'down' ? 40 : 40, 0])
    : 0;
  
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <motion.div 
      ref={ref}
      style={{ x, y, opacity }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
