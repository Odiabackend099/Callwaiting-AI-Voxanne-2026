'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { supabase } from '@/lib/supabase';
import { Settings, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface VapiAssistant {
  id: string;
  name: string;
  model?: string;
  voice?: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  assistantId?: string;
}

interface SettingsData {
  vapiConfigured: boolean;
  vapiApiKey?: string;
  vapiAssistantId?: string;
  webhookConfigured?: boolean;
  webhookMessage?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [showAssistantDropdown, setShowAssistantDropdown] = useState(false);

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();

        const res = await fetch(`${API_BASE_URL}/api/founder-console/settings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        const data = await res.json();
        setSettings(data);
        
        if (data.vapiApiKey) {
          setApiKey(data.vapiApiKey);
        }
        if (data.vapiAssistantId) {
          setSelectedAssistantId(data.vapiAssistantId);
        }
      } catch (err: any) {
        setError(`Failed to load settings: ${err?.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadSettings();
    }
  }, [user]);

  // Discover assistants and phone numbers from Vapi
  const handleDiscoverResources = async () => {
    try {
      setDiscovering(true);
      setError(null);

      if (!apiKey.trim()) {
        setError('Vapi API key is required');
        setDiscovering(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/vapi/discover/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to discover resources');
      }

      setAssistants(data.assistants || []);
      setPhoneNumbers(data.phoneNumbers || []);

      if (data.assistants && data.assistants.length > 0) {
        setSelectedAssistantId(data.assistants[0].id);
      }
    } catch (err: any) {
      setError(`Discovery failed: ${err?.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  // Configure webhook for selected assistant
  const handleConfigureWebhook = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (!apiKey.trim()) {
        setError('Vapi API key is required');
        setSaving(false);
        return;
      }

      if (!selectedAssistantId) {
        setError('Please select an assistant');
        setSaving(false);
        return;
      }

      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/vapi/discover/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          assistantId: selectedAssistantId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to configure webhook');
      }

      setSuccess(`✅ Webhook configured successfully for ${selectedAssistantId}`);
      
      // Save to database
      const saveRes = await fetch(`${API_BASE_URL}/api/founder-console/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          vapi_api_key: apiKey.trim(),
          vapi_assistant_id: selectedAssistantId
        })
      });

      if (saveRes.ok) {
        const newSettings = await saveRes.json();
        setSettings(newSettings);
      }
    } catch (err: any) {
      setError(`Configuration failed: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <LeftSidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            </div>
            <p className="text-gray-600">Configure your Vapi integration with just your API key</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-gray-600">Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Vapi Configuration Section */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Vapi Integration</h2>

                <div className="space-y-4">
                  {/* Step 1: API Key Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Step 1: Enter Vapi API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-10"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Your private Vapi API key. Never shared or logged.
                    </p>
                  </div>

                  {/* Step 2: Discover Button */}
                  <button
                    onClick={handleDiscoverResources}
                    disabled={discovering || !apiKey.trim()}
                    className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {discovering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Discovering Assistants...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-5 h-5" />
                        Step 2: Discover Assistants
                      </>
                    )}
                  </button>

                  {/* Step 3: Assistant Selector */}
                  {assistants.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Step 3: Select Assistant
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setShowAssistantDropdown(!showAssistantDropdown)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-left flex items-center justify-between hover:border-gray-400"
                        >
                          <span>
                            {selectedAssistantId
                              ? assistants.find(a => a.id === selectedAssistantId)?.name || 'Select Assistant'
                              : 'Select Assistant'}
                          </span>
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {showAssistantDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                            {assistants.map(assistant => (
                              <button
                                key={assistant.id}
                                onClick={() => {
                                  setSelectedAssistantId(assistant.id);
                                  setShowAssistantDropdown(false);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{assistant.name}</div>
                                <div className="text-xs text-gray-500">{assistant.id}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Configure Button */}
                  {assistants.length > 0 && selectedAssistantId && (
                    <button
                      onClick={handleConfigureWebhook}
                      disabled={saving}
                      className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Configuring Webhook...
                        </>
                      ) : (
                        <>
                          <Settings className="w-5 h-5" />
                          Step 4: Configure Webhook & Save
                        </>
                      )}
                    </button>
                  )}

                  {/* Status */}
                  {settings?.vapiConfigured && (
                    <div className="bg-green-50 border border-green-200 rounded p-3 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-900">✅ Vapi Configured</p>
                        <p className="text-xs text-green-800 mt-1">
                          Webhook is active and ready to use
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded p-4 mb-6 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-green-900">Success!</h3>
                    <p className="text-sm text-green-800 mt-1">{success}</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-red-900">Error</h3>
                    <p className="text-sm text-red-800 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* How It Works */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h2>
                
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    <strong className="text-gray-900">Step 1:</strong> Paste your Vapi API key
                  </p>
                  <p>
                    <strong className="text-gray-900">Step 2:</strong> Click "Discover Assistants" to fetch your assistants from Vapi
                  </p>
                  <p>
                    <strong className="text-gray-900">Step 3:</strong> Select the assistant you want to configure
                  </p>
                  <p>
                    <strong className="text-gray-900">Step 4:</strong> Click "Configure Webhook & Save" to automatically set up the Knowledge Base integration
                  </p>
                  <p className="pt-2 border-t border-gray-200">
                    <strong className="text-emerald-700">Result:</strong> Your assistant is now configured to use the Knowledge Base RAG system. No manual webhook setup needed!
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
