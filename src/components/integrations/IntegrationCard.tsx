/**
 * IntegrationCard Component
 *
 * Multi-state integration card showing:
 * - Empty state (not configured)
 * - Configuring state (active input)
 * - Connected state (configured and verified)
 * - Error state (connection failed)
 *
 * Supports: Vapi, Twilio, Google Calendar, Resend, ElevenLabs
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Key,
  Phone,
  Calendar,
  Mail,
  Volume2,
} from 'lucide-react';

type IntegrationState = 'empty' | 'configuring' | 'connected' | 'error';
type ProviderType = 'vapi' | 'twilio' | 'googleCalendar' | 'resend' | 'elevenlabs';

export interface IntegrationCardProps {
  provider: ProviderType;
  state: IntegrationState;
  lastVerified?: string;
  error?: string;
  onConfigure: () => void;
  onTest: () => void;
  onDisconnect: () => void;
  isTestingConnection?: boolean;
}

const PROVIDER_INFO: Record<ProviderType, {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'red' | 'cyan' | 'purple' | 'green';
}> = {
  vapi: {
    name: 'Vapi.ai',
    description: 'Voice AI assistants',
    icon: Key,
    color: 'blue',
  },
  twilio: {
    name: 'Twilio',
    description: 'SMS & WhatsApp messaging',
    icon: Phone,
    color: 'red',
  },
  googleCalendar: {
    name: 'Google Calendar',
    description: 'Appointment booking & scheduling',
    icon: Calendar,
    color: 'cyan',
  },
  resend: {
    name: 'Resend',
    description: 'Transactional emails',
    icon: Mail,
    color: 'purple',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Voice synthesis',
    icon: Volume2,
    color: 'green',
  },
};

const COLOR_CLASSES: Record<'blue' | 'red' | 'cyan' | 'purple' | 'green', {
  bg: string;
  text: string;
  border: string;
  button: string;
  buttonHover: string;
  badge: string;
}> = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    buttonHover: 'hover:bg-blue-100',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    button: 'bg-red-600 text-white hover:bg-red-700',
    buttonHover: 'hover:bg-red-100',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  cyan: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
    button: 'bg-cyan-600 text-white hover:bg-cyan-700',
    buttonHover: 'hover:bg-cyan-100',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    button: 'bg-purple-600 text-white hover:bg-purple-700',
    buttonHover: 'hover:bg-purple-100',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    button: 'bg-green-600 text-white hover:bg-green-700',
    buttonHover: 'hover:bg-green-100',
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
};

export function IntegrationCard({
  provider,
  state,
  lastVerified,
  error,
  onConfigure,
  onTest,
  onDisconnect,
  isTestingConnection = false,
}: IntegrationCardProps) {
  const info = PROVIDER_INFO[provider];
  const colors = COLOR_CLASSES[info.color];
  const Icon = info.icon;

  const formatLastVerified = (timestamp?: string): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{info.name}</h3>
            <p className="text-sm text-gray-600">{info.description}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {state === 'connected' && (
            <span className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full border ${colors.badge}`}>
              <CheckCircle className="w-4 h-4" />
              Active
            </span>
          )}
          {state === 'empty' && (
            <span className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              <AlertCircle className="w-4 h-4" />
              Not Configured
            </span>
          )}
          {state === 'error' && (
            <span className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-4 h-4" />
              Error
            </span>
          )}
          {state === 'configuring' && (
            <span className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              Configuring
            </span>
          )}
        </div>
      </div>

      {/* Status Details */}
      {state === 'connected' && lastVerified && (
        <p className="text-xs text-gray-500 mb-4">
          Verified {formatLastVerified(lastVerified)}
        </p>
      )}

      {state === 'error' && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {state === 'empty' && (
          <button
            onClick={onConfigure}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${colors.button}`}
          >
            <Key className="w-4 h-4" />
            Configure
          </button>
        )}

        {state === 'configuring' && (
          <button
            disabled
            className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-gray-200 text-gray-600 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </button>
        )}

        {state === 'connected' && (
          <>
            <button
              onClick={onTest}
              disabled={isTestingConnection}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Test Connection
                </>
              )}
            </button>
            <button
              onClick={onDisconnect}
              className="px-4 py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              Disconnect
            </button>
          </>
        )}

        {state === 'error' && (
          <button
            onClick={onConfigure}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${colors.button}`}
          >
            <Key className="w-4 h-4" />
            Reconfigure
          </button>
        )}
      </div>
    </div>
  );
}

export default IntegrationCard;
