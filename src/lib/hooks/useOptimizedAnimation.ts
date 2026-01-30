'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function useOptimizedAnimation() {
  const reducedMotion = useReducedMotion();
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Check device capabilities
    const isHighPerformance = window.navigator.hardwareConcurrency > 2;
    const isGoodConnection = navigator.connection?.effectiveType !== 'slow-2g';

    // Only animate if device can handle it
    setShouldAnimate(
      !reducedMotion &&
      isHighPerformance &&
      isGoodConnection
    );
  }, [reducedMotion]);

  return shouldAnimate;
}
