import React from 'react';
import { motion } from 'framer-motion';

type FadeInProps = {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  shouldAnimate?: boolean;
};

export const FadeIn = ({ 
  children, 
  direction = 'up', 
  delay = 0, 
  duration = 0.6,
  shouldAnimate = true
}: FadeInProps) => {
  const offsets = {
    up: 20,
    down: -20,
    left: 20,
    right: -20,
  };

  const variants = {
    hidden: { 
      opacity: 0, 
      y: direction === 'up' || direction === 'down' ? offsets[direction] : 0,
      x: direction === 'left' || direction === 'right' ? offsets[direction] : 0,
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      transition: {
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate={shouldAnimate ? "visible" : "hidden"}
      variants={variants}
    >
      {children}
    </motion.div>
  );
};
