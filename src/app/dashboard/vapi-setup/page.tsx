'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { Settings, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface VapiSetupStatus {
  configured: boolean;
  assistantId?: string;
  assistantName?: string;
  webhookUrl?: string;
  systemPromptUpdated?: boolean;
  reason?: string;
}

export default function VapiSetupPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<VapiSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  // Check current Vapi setup status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();

        const res = await fetch(`${API_BASE_URL}/api/vapi/setup/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        const data = await res.json();
        setStatus(data);
      } catch (err: any) {
        setError(`Failed to check status: ${err?.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkStatus();
    }
  }, [user]);

  // Configure Vapi webhook
  const handleConfigureWebhook = async () => {
    try {
      setConfiguring(true);
      setError(null);
      setSuccess(null);

      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/vapi/setup/configure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to configure webhook');
      }

      setSuccess('Vapi webhook configured successfully!');
      setStatus({
        configured: true,
        assistantId: data.assistant?.id,
        assistantName: data.assistant?.name,
        webhookUrl: data.assistant?.webhookUrl,
        systemPromptUpdated: true
      });
    } catch (err: any) {
      setError(`Configuration failed: ${err?.message}`);
    } finally {
      setConfiguring(false);
    }
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = () => {
    if (status?.webhookUrl) {
      navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <LeftSidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Vapi Webhook Setup</h1>
            </div>
            <p className="text-gray-600">Configure your Vapi assistant to use the Knowledge Base RAG system</p>
          </div>

          {/* Status Card */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-gray-600">Checking Vapi configuration status...</span>
            </div>
          ) : (
            <>
              {/* Current Status */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Status</h2>
                    <div className="flex items-center gap-2">
                      {status?.configured ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-green-700 font-medium">Webhook Configured</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          <span className="text-amber-700 font-medium">Webhook Not Configured</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {status?.configured && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="text-gray-600 block mb-1">Assistant ID</label>
                      <code className="bg-gray-100 px-3 py-2 rounded block text-gray-900 font-mono">
                        {status.assistantId}
                      </code>
                    </div>
                    <div>
                      <label className="text-gray-600 block mb-1">Assistant Name</label>
                      <p className="text-gray-900">{status.assistantName}</p>
                    </div>
                    <div>
                      <label className="text-gray-600 block mb-1">Webhook URL</label>
                      <div className="flex gap-2">
                        <code className="bg-gray-100 px-3 py-2 rounded flex-1 text-gray-900 font-mono text-xs overflow-auto">
                          {status.webhookUrl}
                        </code>
                        <button
                          onClick={copyWebhookUrl}
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded transition flex items-center gap-2"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span className="text-sm">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span className="text-sm">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-600 block mb-1">System Prompt Updated</label>
                      <p className="text-gray-900">
                        {status.systemPromptUpdated ? '✅ Yes' : '❌ No'}
                      </p>
                    </div>
                  </div>
                )}

                {!status?.configured && status?.reason && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                    {status.reason}
                  </div>
                )}
              </div>

              {/* Configuration Section */}
              {!status?.configured && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Configure Webhook</h2>

                  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                    <p className="text-sm text-blue-900">
                      <strong>What this does:</strong> Configures your Vapi assistant to call the Knowledge Base RAG webhook before generating responses. This enables the AI to use your uploaded documents to answer questions accurately.
                    </p>
                  </div>

                  <button
                    onClick={handleConfigureWebhook}
                    disabled={configuring}
                    className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {configuring ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Configuring...
                      </>
                    ) : (
                      <>
                        <Settings className="w-5 h-5" />
                        Configure Vapi Webhook
                      </>
                    )}
                  </button>
                </div>
              )}

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

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Upload Documents</h3>
                      <p className="text-sm text-gray-600 mt-1">Go to Knowledge Base and upload your documents (pricing, services, objections, etc.)</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Auto-Chunk & Embed</h3>
                      <p className="text-sm text-gray-600 mt-1">Documents are automatically chunked and embedded into vectors for semantic search</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Configure Webhook</h3>
                      <p className="text-sm text-gray-600 mt-1">Click the button above to configure Vapi to use the RAG webhook</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                      4
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">AI Uses Knowledge Base</h3>
                      <p className="text-sm text-gray-600 mt-1">When customers call, Vapi retrieves relevant chunks and uses them to answer questions accurately</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
