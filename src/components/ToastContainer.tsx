/**
 * ToastContainer Component
 * Displays toast notifications in the bottom-right corner
 * Should be placed once at the root of the app layout
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToToasts, Toast } from '@/hooks/useToast';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastItem = Toast & { displayId: string };

/**
 * Get icon and styling based on toast type
 */
function getToastStyles(type: Toast['type']) {
  switch (type) {
    case 'success':
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-900',
        icon: <CheckCircle className="w-5 h-5 text-green-600" />,
        accent: 'bg-green-600'
      };
    case 'error':
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-900',
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
        accent: 'bg-red-600'
      };
    case 'warning':
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-900',
        icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
        accent: 'bg-yellow-600'
      };
    case 'info':
    default:
      return {
        bgColor: 'bg-surgical-50',
        borderColor: 'border-surgical-200',
        textColor: 'text-surgical-900',
        icon: <Info className="w-5 h-5 text-surgical-600" />,
        accent: 'bg-surgical-600'
      };
  }
}

/**
 * Individual Toast Component
 */
function ToastItem({
  toast,
  onDismiss
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const styles = getToastStyles(toast.type);

  return (
    <motion.div
      key={toast.displayId}
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`w-full max-w-sm ${styles.bgColor} ${styles.borderColor} border rounded-xl shadow-lg p-4 flex gap-3 items-start`}
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${styles.textColor}`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.displayId)}
        className={`flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${styles.accent} rounded`}
        aria-label="Dismiss notification"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-1 ${styles.accent}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

/**
 * ToastContainer Component
 * Manages and displays all active toasts
 *
 * Usage: Place once in your root layout
 * <ToastContainer />
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Subscribe to toast events
    const unsubscribe = subscribeToToasts((toast) => {
      // Check if this is a remove event
      if (toast.id.endsWith('-remove')) {
        const originalId = toast.id.replace('-remove', '');
        setToasts(prev => prev.filter(t => t.displayId !== originalId));
      } else {
        // Add new toast
        setToasts(prev => [
          ...prev,
          { ...toast, displayId: toast.id }
        ]);
      }
    });

    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.displayId !== id));
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.displayId} className="pointer-events-auto">
            <ToastItem
              toast={toast}
              onDismiss={handleDismiss}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
