'use client';

import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { ForwardingConfig } from '../types';

interface ForwardingCodeDisplayStepProps {
  config: ForwardingConfig | null;
  isLoading: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function ForwardingCodeDisplayStep({
  config,
  isLoading,
  error,
  onConfirm,
}: ForwardingCodeDisplayStepProps) {
  const [copiedActivation, setCopiedActivation] = useState(false);
  const [copiedDeactivation, setCopiedDeactivation] = useState(false);

  const copyToClipboard = (text: string, type: 'activation' | 'deactivation') => {
    navigator.clipboard.writeText(text);
    if (type === 'activation') {
      setCopiedActivation(true);
      setTimeout(() => setCopiedActivation(false), 2000);
    } else {
      setCopiedDeactivation(true);
      setTimeout(() => setCopiedDeactivation(false), 2000);
    }
  };

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-slate-400">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          Call Forwarding Code
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Dial this code from your phone to activate forwarding to Voxanne AI.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-slate-400">Carrier:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {config.carrier}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-slate-400">Mode:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {config.forwardingType.replace('_', ' ')}
          </span>
        </div>
        {config.forwardingType === 'safety_net' && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-slate-400">Ring Time:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {config.ringTimeSeconds} seconds
            </span>
          </div>
        )}
      </div>

      {/* Activation code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Activation Code
        </label>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-4">
            <code className="text-lg font-mono font-bold text-gray-900 dark:text-white break-all">
              {config.activationCode}
            </code>
          </div>
          <button
            onClick={() => copyToClipboard(config.activationCode, 'activation')}
            className="px-4 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors flex items-center justify-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {copiedActivation ? (
              <Check className="w-5 h-5" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          Must dial manually - tap-to-dial doesn't support * and # characters
        </p>
      </div>

      {/* Deactivation code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Deactivation Code (to disable forwarding)
        </label>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-4">
            <code className="text-lg font-mono font-bold text-gray-900 dark:text-white break-all">
              {config.deactivationCode}
            </code>
          </div>
          <button
            onClick={() => copyToClipboard(config.deactivationCode, 'deactivation')}
            className="px-4 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors flex items-center justify-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {copiedDeactivation ? (
              <Check className="w-5 h-5" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          How to activate:
        </p>
        <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>Open your phone's dialer app</li>
          <li>Paste or manually enter the activation code</li>
          <li>Press the call button to execute the code</li>
          <li>Wait for a confirmation tone or message from your carrier</li>
        </ol>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Confirming...
          </>
        ) : (
          'I Successfully Dialed the Code'
        )}
      </button>
    </div>
  );
}
