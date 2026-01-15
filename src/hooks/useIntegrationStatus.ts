/**
 * useIntegrationStatus Hook
 * 
 * Provides secure access to integration configuration status from the backend.
 * This hook queries the backend /api/integrations/status endpoint which is the
 * "Single Source of Truth" for integration state.
 * 
 * Usage:
 * const { vapi, openai, loading, error } = useIntegrationStatus();
 * 
 * if (loading) return <LoadingSpinner />;
 * if (!vapi) return <ErrorMessage text="Vapi not configured on server" />;
 */

import { useState, useEffect, useCallback } from 'react';

export interface IntegrationStatusData {
  integrations: {
    vapi: boolean;
    openai: boolean;
    twilio: boolean;
    supabase: boolean;
    stripe: boolean;
    googleCloud: boolean;
    anthropic: boolean;
    pinecone: boolean;
  };
  timestamp: string;
  cacheAge: number | null;
}

export interface UseIntegrationStatusReturn {
  // Individual integration statuses
  vapi: boolean;
  openai: boolean;
  twilio: boolean;
  supabase: boolean;
  stripe: boolean;
  googleCloud: boolean;
  anthropic: boolean;
  pinecone: boolean;
  
  // Hook state
  loading: boolean;
  error: string | null;
  
  // Full data and refresh
  data: IntegrationStatusData | null;
  refresh: () => Promise<void>;
  
  // Check if a specific integration is available
  isConfigured: (integration: keyof IntegrationStatusData['integrations']) => boolean;
}

/**
 * Hook to fetch and cache integration status from backend
 * 
 * @param autoRefresh - Auto-refresh on page focus (default: true)
 * @param refreshInterval - Interval to auto-refresh (ms, default: 5 minutes)
 */
export function useIntegrationStatus(
  autoRefresh: boolean = true,
  refreshInterval: number = 5 * 60 * 1000 // 5 minutes
): UseIntegrationStatusReturn {
  const [data, setData] = useState<IntegrationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/integrations/status');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch integration status: ${response.status}`);
      }

      const statusData: IntegrationStatusData = await response.json();
      setData(statusData);
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error fetching integration status';
      setError(errorMessage);
      
      // Log error for debugging (but don't expose to user in production)
      console.error('[useIntegrationStatus]', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh on page focus
  useEffect(() => {
    if (!autoRefresh) return;

    const handleFocus = () => {
      fetchStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoRefresh, fetchStatus]);

  // Auto-refresh at interval
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStatus]);

  const isConfigured = useCallback(
    (integration: keyof IntegrationStatusData['integrations']): boolean => {
      return data?.integrations[integration] ?? false;
    },
    [data]
  );

  return {
    // Individual statuses (fallback to false if not loaded)
    vapi: data?.integrations.vapi ?? false,
    openai: data?.integrations.openai ?? false,
    twilio: data?.integrations.twilio ?? false,
    supabase: data?.integrations.supabase ?? false,
    stripe: data?.integrations.stripe ?? false,
    googleCloud: data?.integrations.googleCloud ?? false,
    anthropic: data?.integrations.anthropic ?? false,
    pinecone: data?.integrations.pinecone ?? false,
    
    // State
    loading,
    error,
    data,
    refresh: fetchStatus,
    isConfigured
  };
}

/**
 * Simplified hook to check a single integration
 * 
 * Usage:
 * const isVapiReady = useIntegrationConfigured('vapi');
 */
export function useIntegrationConfigured(
  integration: keyof IntegrationStatusData['integrations']
): { configured: boolean; loading: boolean; error: string | null } {
  const status = useIntegrationStatus();
  
  return {
    configured: status.isConfigured(integration),
    loading: status.loading,
    error: status.error
  };
}
