'use client';

import React, { useState } from 'react';
import { AlertCircle, Phone, Loader2, RefreshCw } from 'lucide-react';

interface VerificationStepProps {
  isLoading: boolean;
  error: string | null;
  attemptsRemaining?: number;
  onConfirm: () => void;
  onRetry: () => void;
}

export function VerificationStep({
  isLoading,
  error,
  attemptsRemaining,
  onConfirm,
  onRetry,
}: VerificationStepProps) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-surgical-50 rounded-full flex items-center justify-center mb-4">
          <Phone className="w-8 h-8 text-surgical-600 animate-pulse" />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-obsidian mb-2">
          Verification Call in Progress
        </h2>
        <p className="text-sm text-obsidian/60 max-w-md mx-auto">
          You'll receive a call momentarily. Answer it and listen carefully for the 6-digit verification code.
          Enter that code when prompted by the automated voice.
        </p>
      </div>

      {/* Info box */}
      <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4">
        <p className="text-sm font-medium text-obsidian mb-2">
          Waiting for you to complete the phone verification
        </p>
        <p className="text-xs text-obsidian/60">
          Listen for the code on the call and enter it when prompted. Then click "I Entered the Code" below.
        </p>
      </div>

      {/* Instructions toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full text-left px-4 py-3 bg-surgical-50 border border-surgical-200 rounded-lg hover:bg-surgical-50 transition-colors text-sm font-medium text-obsidian"
      >
        {showInstructions ? '▼' : '▶'} Didn't receive a call?
      </button>

      {showInstructions && (
        <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-obsidian/70">Try the following:</p>
          <ul className="text-xs text-obsidian/60 space-y-1 ml-4 list-disc">
            <li>Ensure your phone is not in Do Not Disturb mode</li>
            <li>Check if your phone number is correct</li>
            <li>Wait a few more seconds - Twilio calls can take 30+ seconds</li>
            <li>Try clicking "Retry" below to initiate another call</li>
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Verification Not Yet Complete</p>
            <p className="text-xs">{error}</p>
            {attemptsRemaining !== undefined && (
              <p className="text-xs mt-2">
                Attempts remaining: <span className="font-semibold">{attemptsRemaining}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="flex-1 py-3 bg-surgical-100 hover:bg-surgical-50 disabled:bg-surgical-100 disabled:opacity-50 text-obsidian text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>

        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 py-3 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-100 disabled:text-obsidian/40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirming...
            </>
          ) : (
            'I Entered the Code'
          )}
        </button>
      </div>
    </div>
  );
}
