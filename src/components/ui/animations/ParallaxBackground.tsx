import React, { ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

type ParallaxBackgroundProps = {
  children: ReactNode;
  speed?: number;
  className?: string;
};

export const ParallaxBackground = ({ children, speed = 0.5, className = '' }: ParallaxBackgroundProps) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1], [0, -1 * speed * 100]);

  return (
    <motion.div 
      style={{ y }} 
      className={`absolute inset-0 ${className}`}
    >
      {children}
    </motion.div>
  );
};
