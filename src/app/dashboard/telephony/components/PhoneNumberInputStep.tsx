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
        <h2 className="text-lg font-semibold tracking-tight text-obsidian mb-2">
          Enter Your Phone Number
        </h2>
        <p className="text-sm text-obsidian/60">
          We'll call this number to verify you own it.
        </p>
      </div>

      {/* Warning about existing call forwarding */}
      <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-surgical-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-obsidian mb-1">
              Disable Existing Call Forwarding First
            </p>
            <p className="text-xs text-obsidian/60">
              If you currently have call forwarding active on this number, please disable it before proceeding.
              Dial <span className="font-mono font-semibold">##21#</span> (all carriers) or <span className="font-mono font-semibold">*73</span> (Verizon)
              to deactivate any existing forwarding rules.
            </p>
          </div>
        </div>
      </div>

      {/* Use existing verified numbers */}
      {verifiedNumbers.length > 0 && (
        <div className="bg-surgical-50 border border-surgical-200 rounded-xl p-4">
          <p className="text-sm font-medium text-obsidian mb-3">
            Or use a previously verified number:
          </p>
          <div className="space-y-2">
            {verifiedNumbers.filter(n => n.status === 'verified').map(number => (
              <button
                key={number.id}
                onClick={() => onUseExisting(number.id)}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-surgical-200 hover:border-surgical-600 focus:ring-2 focus:ring-surgical-500 focus:outline-none transition-all"
              >
                <span className="font-mono text-sm text-obsidian">
                  {number.phone_number}
                </span>
                <span className="text-xs text-green-700 flex items-center gap-1">
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
          <label className="block text-sm font-medium text-obsidian/70 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+15551234567"
            className="w-full px-4 py-3 text-sm border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-transparent outline-none transition-all font-mono text-obsidian bg-white placeholder-obsidian/40"
          />
          <p className="text-xs text-obsidian/40 mt-2">
            E.164 format with country code (e.g., +1 for US)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-obsidian/70 mb-2">
            Label (Optional)
          </label>
          <input
            type="text"
            value={friendlyName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="My Mobile"
            className="w-full px-4 py-3 text-sm border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-transparent outline-none transition-all text-obsidian bg-white placeholder-obsidian/40"
          />
        </div>
      </div>

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
        disabled={isLoading || !phoneNumber.trim()}
        className="w-full py-3 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-100 disabled:text-obsidian/40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed focus:ring-2 focus:ring-surgical-500 focus:ring-offset-2"
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
