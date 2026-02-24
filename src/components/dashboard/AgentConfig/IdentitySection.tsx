'use client';

import React from 'react';
import { Bot } from 'lucide-react';

interface IdentitySectionProps {
  name: string;
  agentType: 'inbound' | 'outbound';
  onNameChange: (name: string) => void;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  name,
  agentType,
  onNameChange,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6">
      <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
        <Bot className="w-5 h-5 text-surgical-600" />
        Agent Identity
      </h3>
      <div>
        <label className="block text-sm font-medium text-obsidian/60 mb-2">
          Agent Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value.slice(0, 100))}
          placeholder={
            agentType === 'inbound' ? 'Inbound Agent' : 'Outbound Agent'
          }
          className="w-full px-4 py-2.5 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 bg-white text-obsidian outline-none transition-colors"
          maxLength={100}
        />
        <p className="mt-2 text-xs text-obsidian/60">
          Give your agent a memorable name (e.g., "Receptionist Robin", "Sales
          Sarah")
        </p>
      </div>
    </div>
  );
};
