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
      <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-700" />
      </div>

      {/* Success message */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-obsidian mb-2">
          AI Forwarding Activated!
        </h2>
        <p className="text-sm text-obsidian/60 max-w-md mx-auto">
          Your phone number is now connected to Voxanne AI. Incoming calls will be handled according to your forwarding mode.
        </p>
      </div>

      {/* What happens next */}
      <div className="bg-green-50 border border-surgical-200 rounded-xl p-6 space-y-4">
        <h3 className="font-medium text-obsidian">What Happens Next:</h3>

        <div className="space-y-3 text-left">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-obsidian">
                Calls are forwarded to Voxanne
              </p>
              <p className="text-xs text-obsidian/60 mt-1">
                All incoming calls to your number will be received by our AI system
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-obsidian">
                AI handles or transfers calls
              </p>
              <p className="text-xs text-obsidian/60 mt-1">
                Based on your forwarding mode and business rules, calls are handled by AI or transferred
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-obsidian">
                View call details in dashboard
              </p>
              <p className="text-xs text-obsidian/60 mt-1">
                All calls are logged and available in your Voxanne dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick tips */}
      <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4">
        <p className="text-sm font-medium text-obsidian mb-2">
          Quick Tips:
        </p>
        <ul className="text-xs text-obsidian/60 space-y-1">
          <li>To disable forwarding, dial the deactivation code from your phone</li>
          <li>Your original number remains active during the AI handoff</li>
          <li>You can add multiple phone numbers for different forwarding rules</li>
        </ul>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-3 bg-surgical-600 hover:bg-surgical-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2"
        >
          Back to Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
