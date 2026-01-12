/**
 * Integrations Dashboard Page
 *
 * Main page for managing user-provided integrations (Twilio, Google Calendar).
 * VAPI is platform-provided and not user-configurable.
 *
 * Features:
 * - Real-time status display for BYOC providers
 * - Credential configuration forms with inline editing
 * - Test connection functionality
 * - Masked credential display (••••••)
 * - Error handling and status updates
 */

'use client';

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { TwilioCredentialForm } from '@/components/integrations/TwilioCredentialForm';
import { GoogleCalendarOAuthForm } from '@/components/integrations/GoogleCalendarOAuthForm';

type IntegrationState = 'empty' | 'configuring' | 'connected' | 'error';

interface IntegrationStatus {
  connected: boolean;
  lastVerified?: string;
  error?: string;
}

interface IntegrationsStatus {
  vapi: IntegrationStatus;
  twilio: IntegrationStatus;
  googleCalendar: IntegrationStatus;
  resend: IntegrationStatus;
  elevenlabs: IntegrationStatus;
}

interface ConfiguringModal {
  provider: 'vapi' | 'twilio' | 'googleCalendar' | 'resend' | 'elevenlabs' | null;
}

export default function IntegrationsDashboardPage() {
  const [status, setStatus] = useState<IntegrationsStatus>({
    vapi: { connected: false },
    twilio: { connected: false },
    googleCalendar: { connected: false },
    resend: { connected: false },
    elevenlabs: { connected: false },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configuringModal, setConfiguringModal] = useState<ConfiguringModal>({ provider: null });
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Fetch integration status on mount and when modal closes
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/integrations/status');

      if (!response.ok) {
        throw new Error('Failed to fetch integration status');
      }

      const data = await response.json();
      setStatus(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      console.error('Error fetching integration status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    try {
      setTestingConnection(provider);

      const response = await fetch(`/api/integrations/${provider}/verify`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      const data = await response.json();

      // Update status
      setStatus((prev) => ({
        ...prev,
        [provider]: {
          connected: data.data.connected,
          lastVerified: data.data.lastVerified,
          error: data.data.error,
        },
      }));
    } catch (err) {
      console.error(`Error testing ${provider} connection:`, err);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      const response = await fetch(`/api/integrations/${provider}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      // Update status
      setStatus((prev) => ({
        ...prev,
        [provider]: { connected: false },
      }));
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
    }
  };

  const handleConfigureSuccess = (provider: string) => {
    // Close modal and refresh status
    setConfiguringModal({ provider: null });
    fetchStatus();
  };

  const mapStateFromStatus = (providerStatus: IntegrationStatus): IntegrationState => {
    if (configuringModal.provider === 'vapi' || testingConnection === 'vapi') {
      return 'configuring';
    }
    if (providerStatus.error) {
      return 'error';
    }
    if (providerStatus.connected) {
      return 'connected';
    }
    return 'empty';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage your third-party integrations and API credentials
              </p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Twilio */}
          <div>
            <IntegrationCard
              provider="twilio"
              state={mapStateFromStatus(status.twilio)}
              lastVerified={status.twilio.lastVerified}
              error={status.twilio.error}
              onConfigure={() => setConfiguringModal({ provider: 'twilio' })}
              onTest={() => handleTestConnection('twilio')}
              onDisconnect={() => handleDisconnect('twilio')}
              isTestingConnection={testingConnection === 'twilio'}
            />
          </div>

          {/* Google Calendar */}
          <div>
            <IntegrationCard
              provider="googleCalendar"
              state={mapStateFromStatus(status.googleCalendar)}
              lastVerified={status.googleCalendar.lastVerified}
              error={status.googleCalendar.error}
              onConfigure={() => setConfiguringModal({ provider: 'googleCalendar' })}
              onTest={() => handleTestConnection('google_calendar')}
              onDisconnect={() => handleDisconnect('google_calendar')}
              isTestingConnection={testingConnection === 'google_calendar'}
            />
          </div>

          {/* Resend */}
          <div>
            <IntegrationCard
              provider="resend"
              state={mapStateFromStatus(status.resend)}
              lastVerified={status.resend.lastVerified}
              error={status.resend.error}
              onConfigure={() => setConfiguringModal({ provider: 'resend' })}
              onTest={() => handleTestConnection('resend')}
              onDisconnect={() => handleDisconnect('resend')}
              isTestingConnection={testingConnection === 'resend'}
            />
          </div>

          {/* ElevenLabs */}
          <div>
            <IntegrationCard
              provider="elevenlabs"
              state={mapStateFromStatus(status.elevenlabs)}
              lastVerified={status.elevenlabs.lastVerified}
              error={status.elevenlabs.error}
              onConfigure={() => setConfiguringModal({ provider: 'elevenlabs' })}
              onTest={() => handleTestConnection('elevenlabs')}
              onDisconnect={() => handleDisconnect('elevenlabs')}
              isTestingConnection={testingConnection === 'elevenlabs'}
            />
          </div>
        </div>

        {/* Configuration Modals */}
        {configuringModal.provider === 'twilio' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <TwilioCredentialForm
                onSuccess={() => handleConfigureSuccess('twilio')}
                onCancel={() => setConfiguringModal({ provider: null })}
              />
            </div>
          </div>
        )}

        {configuringModal.provider === 'googleCalendar' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <GoogleCalendarOAuthForm
                onSuccess={() => handleConfigureSuccess('googleCalendar')}
                onCancel={() => setConfiguringModal({ provider: null })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
