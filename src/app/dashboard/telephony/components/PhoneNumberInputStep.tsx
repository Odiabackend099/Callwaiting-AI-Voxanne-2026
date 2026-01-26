'use client';

import React from 'react';
import { AlertCircle, Phone, Loader2, CheckCircle } from 'lucide-react';
import type { VerifiedNumber } from '../types';

interface PhoneNumberInputStepProps {
  phoneNumber: string;
  friendlyName: string;
  verifiedNumbers: VerifiedNumber[];
  isLoading: boolean;
  error: string | null;
  onPhoneChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onUseExisting: (numberId: string) => void;
}

export function PhoneNumberInputStep({
  phoneNumber,
  friendlyName,
  verifiedNumbers,
  isLoading,
  error,
  onPhoneChange,
  onNameChange,
  onSubmit,
  onUseExisting,
}: PhoneNumberInputStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          Enter Your Phone Number
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          We'll call this number to verify you own it.
        </p>
      </div>

      {/* Warning about existing call forwarding */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-1">
              Disable Existing Call Forwarding First
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              If you currently have call forwarding active on this number, please disable it before proceeding.
              Dial <span className="font-mono font-semibold">##21#</span> (all carriers) or <span className="font-mono font-semibold">*73</span> (Verizon)
              to deactivate any existing forwarding rules.
            </p>
          </div>
        </div>
      </div>

      {/* Use existing verified numbers */}
      {verifiedNumbers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
            Or use a previously verified number:
          </p>
          <div className="space-y-2">
            {verifiedNumbers.filter(n => n.status === 'verified').map(number => (
              <button
                key={number.id}
                onClick={() => onUseExisting(number.id)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              >
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {number.phone_number}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phone number input fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+15551234567"
            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
          />
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
            E.164 format with country code (e.g., +1 for US)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Label (Optional)
          </label>
          <input
            type="text"
            value={friendlyName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="My Mobile"
            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
          />
        </div>
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
        onClick={onSubmit}
        disabled={isLoading || !phoneNumber.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Calling...
          </>
        ) : (
          <>
            <Phone className="w-4 h-4" />
            Verify This Number
          </>
        )}
      </button>
    </div>
  );
}
