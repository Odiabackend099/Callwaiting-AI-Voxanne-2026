import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

type ParallaxImageProps = {
  src: string;
  alt: string;
  offset?: number;
  className?: string;
  shouldAnimate?: boolean;
};

export const ParallaxImage = ({ 
  src, 
  alt, 
  offset = 30, 
  className = '',
  shouldAnimate = true
}: ParallaxImageProps) => {
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, -offset]);

  return (
    <motion.div 
      ref={ref}
      style={shouldAnimate ? { y } : undefined}
      className={className}
    >
      <img src={src} alt={alt} className="w-full h-auto" />
    </motion.div>
  );
};
