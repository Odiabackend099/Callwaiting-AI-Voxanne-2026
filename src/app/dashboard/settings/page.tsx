'use client';
export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { Settings, Users, Building2 } from 'lucide-react';
import { TeamMembersList } from './components/TeamMembersList';
import { OrgSettings } from './components/OrgSettings';
import PreFlightChecklist from '@/components/dashboard/PreFlightChecklist';


export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'organization' | 'team'>('general');


  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-surgical-600" />
          <h1 className="text-3xl font-bold text-obsidian">Settings</h1>
        </div>
        <p className="text-obsidian/60">Configure your account, team, and integrations</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-4 border-b border-surgical-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'general'
            ? 'border-surgical-600 text-surgical-600'
            : 'border-transparent text-obsidian/60 hover:text-obsidian'
            }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General Settings
          </div>
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'organization'
            ? 'border-surgical-600 text-surgical-600'
            : 'border-transparent text-obsidian/60 hover:text-obsidian'
            }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Organization
          </div>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'team'
            ? 'border-surgical-600 text-surgical-600'
            : 'border-transparent text-obsidian/60 hover:text-obsidian'
            }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Members
          </div>
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="space-y-6">
          <PreFlightChecklist />

          <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4 text-obsidian text-sm">
            <p><strong>Note:</strong> Integrations configuration has moved to the <a href="/dashboard/integrations" className="underline font-medium hover:text-surgical-600">Integrations</a> page. Please use that page to configure Vapi, Twilio, and other providers.</p>
          </div>
        </div>
      ) : activeTab === 'organization' ? (
        <OrgSettings />
      ) : (
        <TeamMembersList />
      )}
    </div>


  );
}
