'use client';
export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { Settings, Users, Building2 } from 'lucide-react';
import { TeamMembersList } from './components/TeamMembersList';
import { OrgSettings } from './components/OrgSettings';


export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'organization' | 'team'>('general');


  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-emerald-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-600">Configure your account, team, and integrations</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'general'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General Settings
          </div>
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'organization'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Organization
          </div>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'team'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Members
          </div>
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-900 text-sm">
          <p><strong>Note:</strong> Integrations configuration has moved to the <a href="/dashboard/integrations" className="underline font-medium hover:text-blue-700">Integrations</a> page. Please use that page to configure Vapi, Twilio, and other providers.</p>
        </div>
      ) : activeTab === 'organization' ? (
        <OrgSettings />
      ) : (
        <TeamMembersList />
      )}
    </div>


  );
}
