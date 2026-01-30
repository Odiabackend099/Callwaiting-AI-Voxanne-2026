'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Hook to detect device capabilities and determine if animations should be enabled
 * Returns true if device can handle animations smoothly (60fps)
 */
export function useOptimizedAnimation() {
  const reducedMotion = useReducedMotion();
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    // Respect user's reduced motion preference
    if (reducedMotion) {
      setShouldAnimate(false);
      return;
    }

    // Check device capabilities
    const checkDeviceCapabilities = () => {
      // 1. Check hardware concurrency (CPU cores)
      const hasMultipleCores = navigator.hardwareConcurrency > 2;

      // 2. Check connection speed (if available)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const hasGoodConnection = !connection || connection.effectiveType !== 'slow-2g';

      // 3. Check device memory (if available)
      const deviceMemory = (navigator as any).deviceMemory;
      const hasSufficientMemory = !deviceMemory || deviceMemory >= 4; // 4GB minimum

      // 4. Check if device is mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 5. Check battery status (if available)
      const checkBatteryStatus = async () => {
        try {
          const battery = await (navigator as any).getBattery?.();
          if (battery) {
            // Disable heavy animations if battery is low and not charging
            const batteryLow = battery.level < 0.2 && !battery.charging;
            return !batteryLow;
          }
          return true;
        } catch {
          return true;
        }
      };

      // Determine if animations should be enabled
      checkBatteryStatus().then((hasSufficientBattery) => {
        const shouldEnable =
          hasMultipleCores &&
          hasGoodConnection &&
          hasSufficientMemory &&
          hasSufficientBattery &&
          (!isMobile || (isMobile && deviceMemory >= 4));

        setShouldAnimate(shouldEnable);
      });
    };

    checkDeviceCapabilities();

    // Re-check on visibility change (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDeviceCapabilities();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reducedMotion]);

  return shouldAnimate;
}

/**
 * Hook to detect if user prefers reduced motion
 * Wrapper around Framer Motion's useReducedMotion for consistency
 */
export function useAccessibleAnimation() {
  const reducedMotion = useReducedMotion();
  return !reducedMotion;
}

/**
 * Hook to get appropriate animation variants based on device capabilities
 * Returns 'full' for capable devices, 'reduced' for limited devices, 'none' for no animation
 */
export function useAnimationLevel() {
  const shouldAnimate = useOptimizedAnimation();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return 'none';
  if (!shouldAnimate) return 'reduced';
  return 'full';
}

/**
 * Hook to measure animation performance
 * Returns current FPS and performance metrics
 */
export function useAnimationPerformance() {
  const [fps, setFps] = useState(60);
  const [isLagging, setIsLagging] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;

      // Update FPS every second
      if (currentTime >= lastTime + 1000) {
        const currentFPS = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setFps(currentFPS);
        setIsLagging(currentFPS < 50); // Flag if FPS drops below 50
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return { fps, isLagging };
}

/**
 * Hook to lazy load animation components
 * Returns a boolean indicating if the component is in viewport
 */
export function useLazyAnimation(ref: React.RefObject<HTMLElement>, threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, stop observing
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, threshold]);

  return isVisible;
}

/**
 * Hook to detect low-end devices
 * Returns true if device is considered low-end
 */
export function isLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Check CPU cores
      const cores = navigator.hardwareConcurrency || 1;

      // Check device memory (if available)
      const memory = (navigator as any).deviceMemory || 4;

      // Check connection speed
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const slowConnection = connection && connection.effectiveType === 'slow-2g';

      // Determine if device is low-end
      const lowEnd = cores <= 2 || memory < 4 || slowConnection;

      setIsLowEnd(lowEnd);
    };

    checkDevice();
  }, []);

  return isLowEnd;
}

/**
 * Hook to get simplified animation variants for low-end devices
 * Returns object with animation variants based on device capability
 */
export function useSimplifiedVariants() {
  const lowEnd = isLowEndDevice();
  const reducedMotion = useReducedMotion();

  // No animation for reduced motion preference
  if (reducedMotion) {
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1 },
    };
  }

  // Simplified animation for low-end devices (opacity only)
  if (lowEnd) {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration: 0.3 },
      },
    };
  }

  // Full animation for capable devices
  return {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
    },
  };
}

/**
 * Hook to enable/disable parallax based on device capabilities
 * Returns true if parallax should be enabled
 */
export function useParallaxEnabled() {
  const shouldAnimate = useOptimizedAnimation();
  const [parallaxEnabled, setParallaxEnabled] = useState(true);

  useEffect(() => {
    // Disable parallax on mobile devices or low-end devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const lowEnd = isLowEndDevice();

    setParallaxEnabled(shouldAnimate && !isMobile && !lowEnd);
  }, [shouldAnimate]);

  return parallaxEnabled;
}

/**
 * Performance monitoring utility
 * Logs animation performance metrics to console (development only)
 */
export function useAnimationMonitor() {
  const { fps, isLagging } = useAnimationPerformance();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Log performance warnings
      if (isLagging) {
        console.warn(`⚠️ Animation Performance Warning: FPS dropped to ${fps}. Consider reducing animation complexity.`);
      }
    }
  }, [fps, isLagging]);

  return { fps, isLagging };
}
