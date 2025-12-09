'use client';

import { Phone, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface PhoneNumberProps {
  variant?: 'button' | 'display' | 'widget';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const PHONE_NUMBER = '+12526453035';

/**
 * PhoneNumberWidget Component
 * Displays the Roxanne AI phone number with click-to-dial functionality
 *
 * Variants:
 * - 'button': Minimal call button
 * - 'display': Simple text display
 * - 'widget': Full featured card (default)
 */
export function PhoneNumberWidget({
  variant = 'widget',
  size = 'md',
  showLabel = true
}: PhoneNumberProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(PHONE_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDialClick = () => {
    window.location.href = `tel:${PHONE_NUMBER}`;
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleDialClick}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
        aria-label="Call Roxanne AI"
      >
        <Phone size={18} />
        Call Now
      </button>
    );
  }

  if (variant === 'display') {
    return (
      <div className="flex items-center gap-2 text-gray-700">
        <Phone size={20} className="text-blue-600" />
        <span className="font-mono font-semibold text-lg">{PHONE_NUMBER}</span>
      </div>
    );
  }

  // variant === 'widget' (default)
  const widgetSizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const iconSizeClasses = {
    sm: 24,
    md: 24,
    lg: 32
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-lg ${widgetSizeClasses[size]}`}>
      {showLabel && (
        <p className="text-sm font-semibold mb-4 opacity-90">
          Call Us Now - 24/7 AI Assistant
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white bg-opacity-20 p-3 rounded-lg flex-shrink-0">
            <Phone size={iconSizeClasses[size]} className="text-white" />
          </div>

          <div className="flex-1">
            <p className="text-sm opacity-90 mb-1">Phone Number</p>
            <p className={`font-bold font-mono ${textSizeClasses[size]}`}>
              {PHONE_NUMBER}
            </p>
            <p className="text-xs opacity-75 mt-1">
              Instant AI Demo • Speak to Roxanne
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200 flex items-center justify-center"
            title="Copy phone number"
            aria-label="Copy phone number"
          >
            {copied ? (
              <span className="text-sm font-bold">✓</span>
            ) : (
              <Copy size={20} />
            )}
          </button>

          <button
            onClick={handleDialClick}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200 flex items-center justify-center"
            title="Dial now"
            aria-label="Dial phone number"
          >
            <ExternalLink size={20} />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white border-opacity-20">
        <p className="text-xs opacity-75">
          ✨ Powered by Roxanne AI • Deepgram Flux • Groq LLama 3.3-70B
        </p>
      </div>
    </div>
  );
}

/**
 * PhoneNumberBadge Component
 * Compact badge for displaying phone number in headers/navigation
 */
export function PhoneNumberBadge() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(PHONE_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDialClick = () => {
    window.location.href = `tel:${PHONE_NUMBER}`;
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors duration-200">
      <Phone size={14} className="flex-shrink-0" />
      <span className="font-mono">{PHONE_NUMBER}</span>
      <div className="flex gap-1 ml-2 border-l border-blue-300 pl-2">
        <button
          onClick={handleCopy}
          className="hover:text-blue-900 transition-colors"
          title="Copy"
          aria-label="Copy phone number"
        >
          {copied ? '✓' : <Copy size={12} className="inline" />}
        </button>
        <button
          onClick={handleDialClick}
          className="hover:text-blue-900 transition-colors"
          title="Call"
          aria-label="Call now"
        >
          <Phone size={12} className="inline" />
        </button>
      </div>
    </div>
  );
}

/**
 * PhoneNumberButton Component
 * Standalone button for CTAs
 */
export function PhoneNumberButton({
  size = 'md',
  fullWidth = false
}: {
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const handleDialClick = () => {
    window.location.href = `tel:${PHONE_NUMBER}`;
  };

  return (
    <button
      onClick={handleDialClick}
      className={`flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold shadow-md ${
        sizeClasses[size]
      } ${fullWidth ? 'w-full' : ''}`}
      aria-label="Call Roxanne AI"
    >
      <Phone size={20} />
      Call {PHONE_NUMBER}
    </button>
  );
}

/**
 * PhoneNumberLink Component
 * Inline link for displaying phone number
 */
export function PhoneNumberLink() {
  return (
    <a
      href={`tel:${PHONE_NUMBER}`}
      className="text-blue-600 hover:text-blue-800 underline font-mono font-semibold transition-colors duration-200"
      aria-label="Call Roxanne AI"
    >
      {PHONE_NUMBER}
    </a>
  );
}

/**
 * usePhoneNumber Hook
 * Get phone number and utility functions
 */
export function usePhoneNumber() {
  return {
    phoneNumber: PHONE_NUMBER,
    dialUrl: `tel:${PHONE_NUMBER}`,
    displayName: 'Roxanne AI',
    availableTime: '24/7',
    getDisplayText: () => `Call ${PHONE_NUMBER} to speak with Roxanne AI`,
    copyToClipboard: async () => {
      await navigator.clipboard.writeText(PHONE_NUMBER);
    }
  };
}
