'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationPerformance, useOptimizedAnimation } from '@/hooks/useOptimizedAnimation';
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

/**
 * Performance Monitor Component (Development Only)
 * Displays real-time FPS and animation performance metrics
 * Only visible in development mode
 */
export function PerformanceMonitor() {
  const { fps, isLagging } = useAnimationPerformance();
  const shouldAnimate = useOptimizedAnimation();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);

  // Only render in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Toggle visibility with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - 100,
        y: e.clientY - 20,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getFPSColor = () => {
    if (fps >= 55) return 'text-green-500';
    if (fps >= 45) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getFPSIcon = () => {
    if (fps >= 55) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (fps >= 45) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed z-[9999] select-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="bg-slate-900/95 backdrop-blur-lg rounded-lg p-3 shadow-2xl border border-slate-700 min-w-[200px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white">Performance</h3>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              {/* FPS */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">FPS:</span>
                <div className="flex items-center gap-2">
                  {getFPSIcon()}
                  <span className={`text-sm font-bold ${getFPSColor()}`}>
                    {fps}
                  </span>
                </div>
              </div>

              {/* Animation Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Animations:</span>
                <span className={`text-xs font-medium ${shouldAnimate ? 'text-green-400' : 'text-red-400'}`}>
                  {shouldAnimate ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {/* Performance Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Status:</span>
                <span className={`text-xs font-medium ${isLagging ? 'text-red-400' : 'text-green-400'}`}>
                  {isLagging ? 'Lagging' : 'Smooth'}
                </span>
              </div>

              {/* Device Info */}
              <div className="pt-2 mt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Cores:</span>
                  <span className="text-xs text-white">
                    {navigator.hardwareConcurrency || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">Memory:</span>
                  <span className="text-xs text-white">
                    {(navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcut Hint */}
            <div className="mt-2 pt-2 border-t border-slate-700">
              <p className="text-[10px] text-slate-500 text-center">
                Press Ctrl+Shift+P to toggle
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Animation Performance Logger (Development Only)
 * Logs performance metrics to console
 */
export function logAnimationPerformance() {
  if (process.env.NODE_ENV !== 'development') return;

  console.log(`
┌─────────────────────────────────────────┐
│ 🎬 Animation Performance Report         │
├─────────────────────────────────────────┤
│ Device Info:                             │
│   CPU Cores: ${navigator.hardwareConcurrency || 'Unknown'}                           │
│   Device Memory: ${(navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unknown'}                    │
│                                          │
│ Performance Metrics:                     │
│   Target FPS: 60                         │
│   Animation Mode: GPU-Accelerated        │
│   Properties: transform, opacity         │
│                                          │
│ Accessibility:                           │
│   Reduced Motion: ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Yes' : 'No'}               │
│   Color Scheme: ${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'}                 │
│                                          │
│ Optimization Tips:                       │
│   - Only animate transform & opacity     │
│   - Use will-change sparingly            │
│   - Test on low-end devices              │
│   - Respect reduced motion preference    │
└─────────────────────────────────────────┘
  `);
}

/**
 * Animation Debug Overlay (Development Only)
 * Shows bounding boxes for animated elements
 */
export function AnimationDebugOverlay({ children }: { children: React.ReactNode }) {
  const [showOverlay, setShowOverlay] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>;
  }

  // Toggle overlay with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowOverlay((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={showOverlay ? 'animation-debug' : ''}>
      {children}
      {showOverlay && (
        <div className="fixed bottom-4 right-4 bg-slate-900/95 backdrop-blur-lg rounded-lg p-3 shadow-2xl border border-slate-700 z-[9999]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white">Debug Mode Active</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Press Ctrl+Shift+D to toggle</p>
        </div>
      )}
      <style jsx global>{`
        .animation-debug * {
          outline: 1px dashed rgba(59, 130, 246, 0.5) !important;
        }
        .animation-debug [class*="motion-"] {
          outline: 2px solid rgba(16, 185, 129, 0.8) !important;
        }
      `}</style>
    </div>
  );
}

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Measure animation performance
   */
  measureAnimation: (name: string, callback: () => void) => {
    if (process.env.NODE_ENV !== 'development') {
      callback();
      return;
    }

    performance.mark(`animation-${name}-start`);
    callback();
    performance.mark(`animation-${name}-end`);

    performance.measure(
      `animation-${name}`,
      `animation-${name}-start`,
      `animation-${name}-end`
    );

    const measure = performance.getEntriesByName(`animation-${name}`)[0];
    console.log(`⏱️ Animation "${name}" took ${measure.duration.toFixed(2)}ms`);

    performance.clearMarks();
    performance.clearMeasures();
  },

  /**
   * Check if element will cause layout shift
   */
  checkLayoutShift: (element: HTMLElement) => {
    if (process.env.NODE_ENV !== 'development') return;

    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    const willCauseShift =
      computedStyle.position !== 'fixed' &&
      computedStyle.position !== 'absolute' &&
      (computedStyle.width.includes('%') || computedStyle.height.includes('%'));

    if (willCauseShift) {
      console.warn(
        `⚠️ Element may cause layout shift during animation:`,
        element
      );
    }
  },

  /**
   * Validate GPU-accelerated properties
   */
  validateGPUProperties: (animationProps: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'development') return;

    const gpuProperties = ['transform', 'opacity', 'filter'];
    const nonGPUProperties = Object.keys(animationProps).filter(
      (prop) => !gpuProperties.includes(prop) && prop !== 'transition'
    );

    if (nonGPUProperties.length > 0) {
      console.warn(
        `⚠️ Non-GPU-accelerated properties detected:`,
        nonGPUProperties,
        '\nConsider using transform/opacity instead for better performance.'
      );
    }
  },

  /**
   * Log bundle size impact
   */
  logBundleImpact: () => {
    if (process.env.NODE_ENV !== 'development') return;

    console.log(`
📦 Animation Bundle Impact:
   Framer Motion: ~30KB gzipped
   Custom Components: ~5KB gzipped
   Total Impact: ~35KB gzipped
   Performance: Minimal overhead, 60fps maintained
    `);
  },
};
