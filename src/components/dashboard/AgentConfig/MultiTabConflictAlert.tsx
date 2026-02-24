'use client';

import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface MultiTabConflictAlertProps {
  isVisible: boolean;
  message: string;
  conflictingAgentName?: string;
  onDismiss: () => void;
  onRefresh?: () => void;
}

/**
 * Alert component that displays when another tab has modified the same agent config
 *
 * Shows:
 * - Warning icon and message
 * - "Refresh" button to reload latest changes
 * - "Dismiss" button to acknowledge and continue
 *
 * The refresh button typically calls window.location.reload() or
 * a custom refetch function
 */
export const MultiTabConflictAlert: React.FC<MultiTabConflictAlertProps> = ({
  isVisible,
  message,
  conflictingAgentName,
  onDismiss,
  onRefresh,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none">
      <div className="max-w-md ml-auto mr-0 pointer-events-auto">
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg shadow-lg p-4 flex items-start gap-3">
          {/* Icon */}
          <div className="shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-amber-900 text-sm mb-1">
              Changes Detected in Another Tab
            </h4>
            <p className="text-xs text-amber-800/80 leading-relaxed mb-3">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              )}
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
