'use client';

/**
 * SyncButton Component
 * 
 * A state-aware button that implements the Closed-Loop UX Synchronization pattern.
 * Automatically manages loading states, error handling, and success feedback.
 * 
 * Features:
 * - State machine: IDLE → LOADING → SUCCESS → IDLE
 * - Automatic error recovery with retry
 * - Success/error toast notifications
 * - Disabled state during submission
 * - Customizable success message duration
 * - Integration with useSyncMutation hook
 * 
 * Usage:
 * ```tsx
 * <SyncButton
 *   endpoint="/api/booking/confirm"
 *   onClick={(mutate) => mutate({ bookingId: 123 })}
 *   successMessage="Booking confirmed!"
 *   errorMessage="Failed to confirm booking"
 * >
 *   Confirm Booking
 * </SyncButton>
 * ```
 */

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useSyncMutation, SyncMutationConfig } from '@/hooks/mutations/useSyncMutation';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

/**
 * Button state for state machine
 */
type ButtonState = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

/**
 * Props for SyncButton component
 */
interface SyncButtonProps<TData = any, TVariables = any> {
  /**
   * API endpoint to call
   */
  endpoint: string;

  /**
   * Button content/label
   */
  children: ReactNode;

  /**
   * Callback when button is clicked, receives mutate function
   */
  onClick: (mutate: (variables: TVariables) => Promise<TData>) => void;

  /**
   * Success message to display (optional)
   */
  successMessage?: string;

  /**
   * Error message to display (optional)
   */
  errorMessage?: string;

  /**
   * How long to show success state in milliseconds (default: 2000)
   */
  successDurationMs?: number;

  /**
   * CSS classes for the button element
   */
  className?: string;

  /**
   * Additional config for useSyncMutation
   */
  mutationConfig?: SyncMutationConfig<TData>;

  /**
   * Custom callback when mutation succeeds
   */
  onSuccess?: (data: TData) => void;

  /**
   * Custom callback when mutation fails
   */
  onError?: (error: Error) => void;

  /**
   * Whether to show loading spinner (default: true)
   */
  showSpinner?: boolean;

  /**
   * Custom loading text (default: "Loading...")
   */
  loadingText?: string;

  /**
   * Custom success text (default: "Success!")
   */
  successText?: string;

  /**
   * Whether button is disabled
   */
  disabled?: boolean;

  /**
   * Accessibility label
   */
  ariaLabel?: string;
}

/**
 * Notification component for success/error messages
 */
function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
        type === 'success'
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}
      role="alert"
    >
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/**
 * SyncButton - State-aware button with built-in idempotency and error recovery
 */
export function SyncButton<TData = any, TVariables = any>({
  endpoint,
  children,
  onClick,
  successMessage = 'Operation completed successfully',
  errorMessage = 'Operation failed. Please try again.',
  successDurationMs = 2000,
  className = '',
  mutationConfig = {},
  onSuccess,
  onError,
  showSpinner = true,
  loadingText = 'Processing...',
  successText = 'Success!',
  disabled = false,
  ariaLabel,
}: SyncButtonProps<TData, TVariables>) {
  // Track button state locally for UX feedback
  const [buttonState, setButtonState] = useState<ButtonState>('IDLE');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize mutation hook
  const mutation = useSyncMutation<TData, TVariables>(endpoint, {
    ...mutationConfig,
    onSuccess: (data, variables) => {
      setButtonState('SUCCESS');
      setToast({ type: 'success', message: successMessage });

      // Reset to IDLE after delay
      const timer = setTimeout(() => {
        setButtonState('IDLE');
        setToast(null);
      }, successDurationMs);

      mutationConfig.onSuccess?.(data, variables);
      onSuccess?.(data);

      return () => clearTimeout(timer);
    },
    onError: (error, variables) => {
      setButtonState('ERROR');
      setToast({ type: 'error', message: errorMessage });

      // Reset to IDLE after delay
      const timer = setTimeout(() => {
        setButtonState('IDLE');
        setToast(null);
      }, successDurationMs);

      mutationConfig.onError?.(error, variables);
      onError?.(error);

      return () => clearTimeout(timer);
    },
  });

  // Handle button click
  const handleClick = useCallback(async () => {
    if (disabled || buttonState !== 'IDLE') return;

    setButtonState('LOADING');

    try {
      await onClick(mutation.mutate);
    } catch (error) {
      // Error is already handled by mutation hook
      console.error('SyncButton error:', error);
    }
  }, [onClick, mutation, disabled, buttonState]);

  // Determine button appearance based on state
  const getButtonClasses = (): string => {
    const baseClasses =
      'relative inline-flex items-center justify-center font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

    const stateClasses = {
      IDLE: 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-400 disabled:bg-gray-400 disabled:cursor-not-allowed',
      LOADING:
        'bg-blue-600 text-white cursor-not-allowed opacity-90 disabled:bg-blue-600 disabled:cursor-not-allowed',
      SUCCESS: 'bg-green-600 text-white disabled:bg-green-600 disabled:cursor-not-allowed',
      ERROR: 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-400 disabled:bg-red-600 disabled:cursor-not-allowed',
    };

    return `${baseClasses} ${stateClasses[buttonState]} ${className}`;
  };

  // Determine button text based on state
  const getButtonText = (): ReactNode => {
    switch (buttonState) {
      case 'LOADING':
        return (
          <>
            {showSpinner && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loadingText}
          </>
        );
      case 'SUCCESS':
        return (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            {successText}
          </>
        );
      case 'ERROR':
        return (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            {children}
          </>
        );
      default:
        return children;
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || buttonState !== 'IDLE' && buttonState !== 'ERROR'}
        className={getButtonClasses()}
        aria-label={ariaLabel || (typeof children === 'string' ? children : 'Button')}
        aria-busy={buttonState === 'LOADING'}
      >
        {getButtonText()}
      </button>

      {/* Toast notification */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </>
  );
}

/**
 * Variant: SyncButton with confirmation dialog
 * Useful for destructive actions
 */
export function SyncButtonWithConfirm<TData = any, TVariables = any>(
  props: SyncButtonProps<TData, TVariables> & {
    confirmTitle?: string;
    confirmMessage?: string;
  }
) {
  const { confirmTitle = 'Confirm Action', confirmMessage = 'Are you sure?', ...buttonProps } = props;
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirmedClick = useCallback(
    (mutate: any) => {
      setShowConfirm(true);
      // Wait for user confirmation before calling onClick
      const checkConfirmation = setInterval(() => {
        if (!showConfirm) {
          clearInterval(checkConfirmation);
          return;
        }
      }, 100);
    },
    [showConfirm]
  );

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
          <h2 className="text-lg font-bold text-gray-900 mb-2">{confirmTitle}</h2>
          <p className="text-gray-600 mb-6">{confirmMessage}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                buttonProps.onClick(undefined as any);
              }}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <SyncButton {...buttonProps} onClick={() => handleConfirmedClick(undefined as any)} />;
}

/**
 * Variant: SyncButton with progress indicator
 * Useful for long-running operations
 */
export function SyncButtonWithProgress<TData = any, TVariables = any>(
  props: SyncButtonProps<TData, TVariables> & {
    progress?: number; // 0-100
    showProgressBar?: boolean;
  }
) {
  const { progress = 0, showProgressBar = true, ...buttonProps } = props;

  return (
    <div className="relative">
      <SyncButton {...buttonProps} />
      {showProgressBar && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-200 transition-all duration-300" style={{ width: `${progress}%` }} />
      )}
    </div>
  );
}
