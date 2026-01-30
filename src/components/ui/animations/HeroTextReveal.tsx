import React from 'react';
import { motion } from 'framer-motion';

type HeroTextRevealProps = {
  text: string;
  mode?: 'chars' | 'words';
  variant?: 'fadeUp' | 'fadeScale' | 'slideIn';
  stagger?: number;
  delay?: number;
  shouldAnimate?: boolean;
};

export const HeroTextReveal = ({ 
  text, 
  mode = 'words', 
  variant = 'fadeUp', 
  stagger = 0.05, 
  delay = 0,
  shouldAnimate = true
}: HeroTextRevealProps) => {
  const textArray = mode === 'words' ? text.split(' ') : text.split('');

  const variants = {
    fadeUp: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
    fadeScale: {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1 },
    },
    slideIn: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0 },
    },
  }[variant];

  return (
    <div className="overflow-hidden">
      <motion.div 
        initial="hidden"
        animate={shouldAnimate ? "visible" : "hidden"}
        variants={{
          visible: {
            transition: {
              staggerChildren: stagger,
              delayChildren: delay,
            },
          },
        }}
      >
        {textArray.map((word, index) => (
          <motion.span 
            key={index} 
            className="inline-block"
            variants={variants}
          >
            {word}{mode === 'words' ? ' ' : ''}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};
