'use client';

import { useCallback, useEffect, useState } from 'react';

export type IntegrationProvider = 'TWILIO' | 'GOOGLE' | 'VAPI' | 'OUTLOOK';
export type IntegrationStatus = 'loading' | 'unconfigured' | 'active' | 'error';

export interface IntegrationConfig {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface UseIntegrationReturn {
  status: IntegrationStatus;
  config: IntegrationConfig | null;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage integration configuration for a specific provider
 * - Returns null config if unconfigured (NO FALLBACKS)
 * - Implements proper error handling and loading states
 * - Can be used to drive reactive UI rendering
 *
 * @param provider - Integration provider type
 * @returns Integration status, config, and refetch function
 */
export function useIntegration(provider: IntegrationProvider): UseIntegrationReturn {
  const [status, setStatus] = useState<IntegrationStatus>('loading');
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegration = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);

      const response = await fetch(
        `/api/integrations/${provider.toLowerCase()}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Integration not found - mark as unconfigured
          setStatus('unconfigured');
          setConfig(null);
          return;
        }
        throw new Error(`Failed to fetch integration: ${response.statusText}`);
      }

      const data = await response.json();

      // Ensure config is never undefined; if empty, set to null
      if (data?.config && Object.keys(data.config).length > 0) {
        setConfig(data.config);
        setStatus('active');
      } else {
        setConfig(null);
        setStatus('unconfigured');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setStatus('error');
      setConfig(null);
    }
  }, [provider]);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  return {
    status,
    config,
    error,
    refetch: fetchIntegration,
  };
}

/**
 * Helper hook: Check if a specific integration is active
 * @param provider - Integration provider type
 * @returns boolean indicating if integration is active
 */
export function useIntegrationActive(provider: IntegrationProvider): boolean {
  const { status, config } = useIntegration(provider);
  return status === 'active' && config !== null;
}

/**
 * Helper hook: Get integration config or throw error
 * @param provider - Integration provider type
 * @returns Integration config or null if unconfigured
 * @throws Error if integration is in error state
 */
export function useIntegrationConfig(provider: IntegrationProvider): IntegrationConfig | null {
  const { status, config, error } = useIntegration(provider);

  if (error) {
    throw new Error(`Integration fetch failed: ${error}`);
  }

  // Return null for both loading and unconfigured states
  if (status === 'loading' || status === 'unconfigured') {
    return null;
  }

  return config;
}
