'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { Settings, Loader2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

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

  // Check current Vapi setup status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await authedBackendFetch<any>('/api/vapi/setup/status');
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

      const data = await authedBackendFetch<any>('/api/vapi/setup/configure-webhook', {
        method: 'POST',
        body: JSON.stringify({}),
        timeoutMs: 30000,
        retries: 1,
      });

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
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-surgical-600" />
          <h1 className="text-3xl font-bold text-obsidian">Vapi Webhook Setup</h1>
        </div>
        <p className="text-obsidian/60">Configure your Vapi assistant to use the Knowledge Base RAG system</p>
      </div>

      {/* Status Card */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-surgical-600" />
          <span className="text-obsidian/60">Checking Vapi configuration status...</span>
        </div>
      ) : (
        <>
          {/* Current Status */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-obsidian mb-2">Current Status</h2>
                <div className="flex items-center gap-2">
                  {status?.configured ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium">Webhook Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-700 font-medium">Webhook Not Configured</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {status?.configured && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-obsidian/60 block mb-1">Assistant ID</label>
                  <code className="bg-surgical-50 px-3 py-2 rounded block text-obsidian font-mono">
                    {status.assistantId}
                  </code>
                </div>
                <div>
                  <label className="text-obsidian/60 block mb-1">Assistant Name</label>
                  <p className="text-obsidian">{status.assistantName}</p>
                </div>
                <div>
                  <label className="text-obsidian/60 block mb-1">Webhook URL</label>
                  <div className="flex gap-2">
                    <code className="bg-surgical-50 px-3 py-2 rounded flex-1 text-obsidian font-mono text-xs overflow-auto">
                      {status.webhookUrl}
                    </code>
                    <button
                      onClick={copyWebhookUrl}
                      className="px-3 py-2 bg-surgical-100 hover:bg-surgical-50 rounded transition flex items-center gap-2"
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
                  <label className="text-obsidian/60 block mb-1">System Prompt Updated</label>
                  <p className="text-obsidian">
                    {status.systemPromptUpdated ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            )}

            {!status?.configured && status?.reason && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {status.reason}
              </div>
            )}
          </div>

          {/* Configuration Section */}
          {!status?.configured && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-obsidian mb-4">Configure Webhook</h2>

              <div className="bg-surgical-50 border border-surgical-200 rounded p-4 mb-6">
                <p className="text-sm text-obsidian/70">
                  <strong>What this does:</strong> Configures your Vapi assistant to call the Knowledge Base RAG webhook before generating responses. This enables the AI to use your uploaded documents to answer questions accurately.
                </p>
              </div>

              <button
                onClick={handleConfigureWebhook}
                disabled={configuring}
                className="w-full px-6 py-3 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-100 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
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
                <h3 className="font-medium text-green-700">Success!</h3>
                <p className="text-sm text-green-700 mt-1">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-700">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-obsidian mb-4">How It Works</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-surgical-50 rounded-full flex items-center justify-center text-surgical-600 font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-obsidian">Upload Documents</h3>
                  <p className="text-sm text-obsidian/60 mt-1">Go to Knowledge Base and upload your documents (pricing, services, objections, etc.)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-surgical-50 rounded-full flex items-center justify-center text-surgical-600 font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-obsidian">Auto-Chunk & Embed</h3>
                  <p className="text-sm text-obsidian/60 mt-1">Documents are automatically chunked and embedded into vectors for semantic search</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-surgical-50 rounded-full flex items-center justify-center text-surgical-600 font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-obsidian">Configure Webhook</h3>
                  <p className="text-sm text-obsidian/60 mt-1">Click the button above to configure Vapi to use the RAG webhook</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-surgical-50 rounded-full flex items-center justify-center text-surgical-600 font-semibold">
                  4
                </div>
                <div>
                  <h3 className="font-medium text-obsidian">AI Uses Knowledge Base</h3>
                  <p className="text-sm text-obsidian/60 mt-1">When customers call, Vapi retrieves relevant chunks and uses them to answer questions accurately</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>


  );
}
