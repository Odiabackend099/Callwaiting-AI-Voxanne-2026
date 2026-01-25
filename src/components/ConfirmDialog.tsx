/**
 * ConfirmDialog Component
 * Modal confirmation dialog for destructive actions (delete, etc.)
 * Prevents accidental data loss
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean; // Red button for dangerous actions
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * ConfirmDialog Component
 * Modal dialog for confirming destructive or important actions
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [localLoading, setLocalLoading] = useState(false);

  const handleConfirm = async () => {
    setLocalLoading(true);
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-sm w-full">
              {/* Header */}
              <div className="flex items-start gap-3 p-6 border-b border-gray-200 dark:border-slate-700">
                {isDestructive && (
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h2>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {message}
                </p>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-b-lg">
                <button
                  onClick={onCancel}
                  disabled={localLoading || isLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={localLoading || isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                    isDestructive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {localLoading || isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
