/**
 * useToast Hook
 * Centralized toast notification system for the application
 * Replaces alert() with non-blocking, user-friendly notifications
 */

import { useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds (0 = permanent until dismissed)
}

// Global toast state (simplified approach)
let toastListeners: ((toast: Toast) => void)[] = [];
let toastCounter = 0;

/**
 * Subscribe to toast events
 */
export function subscribeToToasts(callback: (toast: Toast) => void): () => void {
  toastListeners.push(callback);

  // Return unsubscribe function
  return () => {
    toastListeners = toastListeners.filter(listener => listener !== callback);
  };
}

/**
 * Emit a toast notification
 */
function emitToast(toast: Toast) {
  toastListeners.forEach(listener => listener(toast));
}

/**
 * useToast Hook
 * Returns toast notification functions
 *
 * @example
 * const { success, error, info, warning } = useToast();
 * success('Operation completed');
 * error('Something went wrong', 5000);
 */
export function useToast() {
  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = `toast-${toastCounter++}`;
      const toast: Toast = {
        id,
        message,
        type,
        duration: duration === 0 ? 0 : duration || 3000
      };

      emitToast(toast);

      // Auto-remove after duration (if duration > 0)
      if (duration > 0) {
        setTimeout(() => {
          emitToast({ ...toast, id: `${id}-remove` });
        }, duration);
      }

      return id;
    },
    []
  );

  return {
    success: (message: string, duration?: number) =>
      showToast(message, 'success', duration ?? 3000),
    error: (message: string, duration?: number) =>
      showToast(message, 'error', duration ?? 4000),
    info: (message: string, duration?: number) =>
      showToast(message, 'info', duration ?? 3000),
    warning: (message: string, duration?: number) =>
      showToast(message, 'warning', duration ?? 3000),
    custom: (message: string, type: ToastType, duration?: number) =>
      showToast(message, type, duration ?? 3000)
  };
}
