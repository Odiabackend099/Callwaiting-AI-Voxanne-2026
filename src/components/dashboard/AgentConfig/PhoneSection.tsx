'use client';

import React from 'react';
import { Phone, ExternalLink } from 'lucide-react';

interface VapiNumber {
  id: string;
  number: string;
}

interface InboundStatus {
  configured: boolean;
  inboundNumber?: string;
}

interface PhoneSectionProps {
  agentType: 'inbound' | 'outbound';
  inboundStatus?: InboundStatus;
  outboundNumberId?: string;
  vapiNumbers?: VapiNumber[];
}

export const PhoneSection: React.FC<PhoneSectionProps> = ({
  agentType,
  inboundStatus,
  outboundNumberId,
  vapiNumbers = [],
}) => {
  // Inbound agent - show assigned inbound number
  if (agentType === 'inbound') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-obsidian mb-0.5 flex items-center gap-2">
              <Phone className="w-4 h-4 text-surgical-600" />
              Phone Number
            </h3>
            <p className="text-sm text-obsidian/70">
              {inboundStatus?.configured && inboundStatus.inboundNumber ? (
                <>
                  <span className="font-mono">{inboundStatus.inboundNumber}</span>{' '}
                  · Active
                </>
              ) : (
                <span className="text-obsidian/40">No number assigned</span>
              )}
            </p>
          </div>
          <a
            href="/dashboard/phone-settings"
            className="text-xs text-surgical-600 hover:text-surgical-700 font-medium flex items-center gap-1 shrink-0 ml-4"
          >
            Manage in Phone Settings
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // Outbound agent - show assigned outbound caller ID
  if (agentType === 'outbound') {
    const outboundNumber = outboundNumberId
      ? vapiNumbers.find((n) => n.id === outboundNumberId)?.number
      : undefined;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-obsidian mb-0.5 flex items-center gap-2">
              <Phone className="w-4 h-4 text-surgical-600" />
              Outbound Caller ID
            </h3>
            <p className="text-sm text-obsidian/70">
              {outboundNumber ? (
                <>
                  <span className="font-mono">{outboundNumber}</span> · Active
                </>
              ) : (
                <span className="text-obsidian/40">No number assigned</span>
              )}
            </p>
          </div>
          <a
            href="/dashboard/phone-settings"
            className="text-xs text-surgical-600 hover:text-surgical-700 font-medium flex items-center gap-1 shrink-0 ml-4"
          >
            Manage in Phone Settings
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return null;
};
