'use client';

import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface ConfirmationStepProps {
  onClose?: () => void;
}

export function ConfirmationStep({ onClose }: ConfirmationStepProps) {
  return (
    <div className="space-y-6 text-center py-8">
      {/* Success icon */}
      <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Success message */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          Hybrid Telephony Activated!
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 max-w-md mx-auto">
          Your phone number is now connected to Voxanne AI. Incoming calls will be handled according to your forwarding mode.
        </p>
      </div>

      {/* What happens next */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 space-y-4">
        <h3 className="font-medium text-emerald-900 dark:text-emerald-300">What Happens Next:</h3>

        <div className="space-y-3 text-left">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                Calls are forwarded to Voxanne
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                All incoming calls to your number will be received by our AI system
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                AI handles or transfers calls
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Based on your forwarding mode and business rules, calls are handled by AI or transferred
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                View call details in dashboard
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                All calls are logged and available in your Voxanne dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          💡 Quick Tips:
        </p>
        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <li>• To disable forwarding, dial the deactivation code from your phone</li>
          <li>• Your original number remains active during the AI handoff</li>
          <li>• You can add multiple phone numbers for different forwarding rules</li>
        </ul>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          Back to Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
