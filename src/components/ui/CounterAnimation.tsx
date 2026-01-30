'use client';

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CounterAnimationProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function CounterAnimation({
  value,
  duration = 1.5,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
}: CounterAnimationProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Create spring animation for smooth counting
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    // Animate to new value
    spring.set(value);

    // Update display value as spring animates
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(latest);
    });

    return () => unsubscribe();
  }, [value, spring]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}{formattedValue}{suffix}
    </motion.span>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'emerald';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  height = 8,
  color = 'blue',
  showLabel = false,
  label = '',
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    emerald: 'bg-emerald-500',
  };

  const colorGlowClasses = {
    blue: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    green: 'shadow-[0_0_10px_rgba(34,197,94,0.5)]',
    red: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    yellow: 'shadow-[0_0_10px_rgba(234,179,8,0.5)]',
    emerald: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {label}
          </span>
          <CounterAnimation
            value={percentage}
            decimals={0}
            suffix="%"
            className="text-xs font-bold text-slate-900 dark:text-white"
          />
        </div>
      )}
      <div
        className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <motion.div
          className={`h-full ${colorClasses[color]} ${colorGlowClasses[color]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 1.5,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        />
      </div>
    </div>
  );
}

interface PulseIndicatorProps {
  active?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function PulseIndicator({
  active = true,
  color = 'emerald',
  size = 'md',
  label,
  className = '',
}: PulseIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    emerald: 'bg-emerald-500',
  };

  const ringColorClasses = {
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    red: 'bg-red-400',
    yellow: 'bg-yellow-400',
    emerald: 'bg-emerald-400',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full`} />
        {active && (
          <motion.div
            className={`absolute inset-0 ${ringColorClasses[color]} rounded-full`}
            animate={{
              scale: [1, 2, 2],
              opacity: [0.75, 0, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        )}
      </div>
      {label && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  trend = 'neutral',
  className = '',
}: MetricCardProps) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  };

  return (
    <motion.div
      className={`glass-panel rounded-xl p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{
        y: -4,
        boxShadow: '0 12px 24px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {title}
        </h3>
        {icon && (
          <motion.div
            className="text-slate-400 dark:text-slate-500"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
      <CounterAnimation
        value={value}
        prefix={prefix}
        suffix={suffix}
        decimals={decimals}
        className="text-3xl font-bold text-slate-900 dark:text-white"
      />
      {change !== undefined && (
        <motion.div
          className={`text-sm font-medium mt-2 flex items-center gap-1 ${trendColors[trend]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {trend === 'up' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend === 'down' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          {change > 0 && '+'}{change.toFixed(1)}%
        </motion.div>
      )}
    </motion.div>
  );
}

interface LoadingSkeletonProps {
  type?: 'text' | 'card' | 'table' | 'metric';
  count?: number;
  className?: string;
}

export function LoadingSkeleton({
  type = 'card',
  count = 1,
  className = '',
}: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
          </div>
        );
      case 'card':
        return (
          <motion.div
            className="glass-panel rounded-xl p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 animate-pulse" />
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4 animate-pulse" />
            </div>
          </motion.div>
        );
      case 'table':
        return (
          <div className="space-y-3">
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        );
      case 'metric':
        return (
          <motion.div
            className="glass-panel rounded-xl p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-3">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-3/4 animate-pulse" />
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}
