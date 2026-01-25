/**
 * AccessibleButton Component
 * Button wrapper with built-in accessibility features:
 * - aria-label for icon-only buttons
 * - Proper semantic HTML
 * - Keyboard support (Enter, Space)
 * - Focus management
 * - Disabled state handling
 */

'use client';

import React, { ReactNode } from 'react';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  ariaLabel?: string;
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

/**
 * AccessibleButton Component
 * Provides semantic HTML button with accessibility features
 */
export const AccessibleButton = React.forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    children,
    ariaLabel,
    isLoading = false,
    loadingText,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    disabled = false,
    ...props
  }, ref) => {
    // Determine base classes based on variant
    const variantClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
      ghost: 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-sm',
      md: 'px-4 py-2 text-sm font-medium',
      lg: 'px-6 py-3 text-base font-medium'
    };

    const baseClass = `
      inline-flex items-center justify-center gap-2
      rounded-lg transition-colors
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      ${className}
    `;

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        aria-busy={isLoading}
        className={baseClass}
        {...props}
      >
        {isLoading && loadingText ? (
          <>
            <span className="inline-block animate-spin">⏳</span>
            {loadingText}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
