'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

const CARRIERS = [
  { value: 'att', label: 'AT&T', type: 'GSM' },
  { value: 'tmobile', label: 'T-Mobile', type: 'GSM' },
  { value: 'verizon', label: 'Verizon', type: 'CDMA' },
  { value: 'other_gsm', label: 'Other (GSM)', type: 'GSM' },
];

const FORWARDING_TYPES = [
  {
    value: 'total_ai',
    label: 'Total AI Control',
    description: 'AI answers ALL calls immediately. Your phone won\'t ring.',
  },
  {
    value: 'safety_net',
    label: 'Safety Net (Recommended)',
    description: 'Your phone rings first. AI answers only if you don\'t pick up.',
  },
];

interface CarrierSelectionStepProps {
  carrier: string;
  forwardingType: string;
  ringTimeSeconds: number;
  isLoading: boolean;
  error: string | null;
  onCarrierChange: (value: string) => void;
  onForwardingTypeChange: (value: string) => void;
  onRingTimeChange: (value: number) => void;
  onSubmit: () => void;
}

export function CarrierSelectionStep({
  carrier,
  forwardingType,
  ringTimeSeconds,
  isLoading,
  error,
  onCarrierChange,
  onForwardingTypeChange,
  onRingTimeChange,
  onSubmit,
}: CarrierSelectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-obsidian mb-2">
          Configure Call Forwarding
        </h2>
        <p className="text-sm text-obsidian/60">
          Choose your carrier and forwarding mode to generate the code you'll dial.
        </p>
      </div>

      {/* Forwarding type selection */}
      <div>
        <label className="block text-sm font-medium text-obsidian/70 mb-3">
          Forwarding Type
        </label>
        <div className="space-y-2">
          {FORWARDING_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => onForwardingTypeChange(type.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-surgical-500 ${
                forwardingType === type.value
                  ? 'border-surgical-600 bg-surgical-50'
                  : 'border-surgical-200 hover:border-surgical-600'
              }`}
            >
              <p className="font-medium text-sm text-obsidian">
                {type.label}
              </p>
              <p className="text-xs text-obsidian/60 mt-1">
                {type.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Carrier selection */}
      <div>
        <label className="block text-sm font-medium text-obsidian/70 mb-3">
          Mobile Carrier
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CARRIERS.map(c => (
            <button
              key={c.value}
              onClick={() => onCarrierChange(c.value)}
              className={`p-3 rounded-lg border-2 transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-surgical-500 ${
                carrier === c.value
                  ? 'border-surgical-600 bg-surgical-50 text-surgical-600'
                  : 'border-surgical-200 text-obsidian hover:border-surgical-600'
              }`}
            >
              <div>{c.label}</div>
              <div className="text-xs opacity-75">{c.type}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ring time setting (only for safety net) */}
      {forwardingType === 'safety_net' && (
        <div>
          <label className="block text-sm font-medium text-obsidian/70 mb-3">
            Ring Duration Before AI Answers
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="60"
              value={ringTimeSeconds}
              onChange={(e) => onRingTimeChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-surgical-100 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-obsidian w-12 text-right">
              {ringTimeSeconds}s
            </span>
          </div>
          <p className="text-xs text-obsidian/40 mt-2">
            Recommended: 20-30 seconds (allows time to answer)
          </p>
        </div>
      )}

      {/* Verizon limitation notice */}
      {carrier === 'verizon' && forwardingType === 'safety_net' && (
        <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-surgical-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-obsidian mb-1">
                Verizon Limitation
              </p>
              <p className="text-xs text-obsidian/60">
                Verizon doesn't support custom ring time adjustment. Your phone will use carrier defaults (~30 seconds).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={isLoading || !carrier}
        className="w-full py-3 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-100 disabled:text-obsidian/40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Code...
          </>
        ) : (
          'Generate Activation Code'
        )}
      </button>
    </div>
  );
}
