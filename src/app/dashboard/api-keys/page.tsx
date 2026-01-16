'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface IntegrationStatus {
    testDestination: string | null;
}

interface CalendarStatus {
    connected: boolean;
    email?: string;
    connectedAt?: string;
}

export default function ApiKeysPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
    const [status, setStatus] = useState<IntegrationStatus>({
        testDestination: null
    });
    const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
        connected: false
    });
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [calendarSuccess, setCalendarSuccess] = useState<string | null>(null);

    // Form states
    const [testDestination, setTestDestination] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchSettings = useCallback(async () => {
        setIsLoadingSettings(true);
        try {
            const data = await authedBackendFetch<any>('/api/founder-console/settings');
            setStatus(data);
            if (data?.testDestination) {
                setTestDestination(data.testDestination);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setIsLoadingSettings(false);
        }
    }, []);

    const fetchCalendarStatus = useCallback(async () => {
        setIsLoadingCalendar(true);
        try {
            // Timeout after 3 seconds to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Calendar status check timed out')), 3000)
            );
            
            // Extract org_id from user session
            // The org_id is stored in app_metadata by the database trigger
            let orgId: string | undefined;

            if (user) {
                // Primary source: app_metadata.org_id (set by auth trigger)
                orgId = (user as any).app_metadata?.org_id;

                console.debug('[Calendar Status] Extracted org_id from user:', {
                    orgId,
                    hasAppMetadata: !!(user as any).app_metadata,
                    appMetadata: (user as any).app_metadata
                });
            }

            // Pass org_id in the URL path (backend will handle missing org_id gracefully)
            const statusUrl = orgId
                ? `/api/google-oauth/status/${orgId}`
                : '/api/google-oauth/status/unknown';

            console.debug('[Calendar Status] Calling status endpoint:', statusUrl);
            
            // Race against timeout
            const fetchPromise = authedBackendFetch<CalendarStatus>(statusUrl);
            const data = (await Promise.race([fetchPromise, timeoutPromise])) as CalendarStatus;
            
            setCalendarStatus(data);
            setCalendarError(null);
        } catch (error) {
            console.error('Error fetching calendar status:', error);
            // Don't set error - just silently fail and show default "not connected" state
            // This prevents blocking the page if calendar check fails
            setCalendarStatus({ connected: false });
        } finally {
            setIsLoadingCalendar(false);
        }
    }, [user]);

    useEffect(() => {
        // Only fetch settings once when component mounts with user
        if (user && !loading) {
            fetchSettings();
            fetchCalendarStatus();
        }
    }, [user?.id, loading, fetchSettings, fetchCalendarStatus]);

    // Check for OAuth callback parameters in URL
    // CRITICAL FIX: Handle all callback parameter variations from unified OAuth flow
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const error = searchParams.get('error');
        const success = searchParams.get('success');
        const email = searchParams.get('email');
        const details = searchParams.get('details');
        const calendarConnected = searchParams.get('calendar');
        const calendarMessage = searchParams.get('message');

        let handled = false;

        // Handle success cases (from google-oauth.ts unified endpoint)
        if (success === 'calendar_connected' || calendarConnected === 'connected') {
            const successMsg = email
                ? `Calendar connected successfully! (${email})`
                : 'Calendar connected successfully!';
            setCalendarSuccess(successMsg);
            setCalendarError(null);
            
            // CRITICAL: Re-fetch calendar status with retry logic
            // Add longer delay and retry logic to ensure credentials are written to database
            console.log('[OAuth Callback] Calendar connected, waiting for database...');

            const checkStatusWithRetry = async (maxAttempts = 3) => {
              let lastStatus: CalendarStatus = { connected: false };

              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const delayMs = attempt === 1 ? 1500 : 2500 * (attempt - 1); // 1.5s, 2.5s, 6.25s

                await new Promise(resolve => setTimeout(resolve, delayMs));

                console.log(`[OAuth Callback] Checking status (attempt ${attempt}/${maxAttempts})`);

                try {
                  // Get org_id
                  const orgId = (user as any)?.app_metadata?.org_id;
                  if (!orgId) {
                    console.error('[OAuth Callback] Cannot get org_id from user');
                    continue;
                  }

                  // Directly call status endpoint with retry
                  const statusResponse = await fetch(`/api/google-oauth/status/${orgId}`, {
                    headers: {
                      'Content-Type': 'application/json',
                    }
                  });

                  if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    lastStatus = statusData;
                    console.log(`[OAuth Callback] Status check attempt ${attempt}:`, {
                      connected: statusData.connected,
                      email: statusData.email,
                      hasTokens: statusData.hasTokens
                    });

                    if (statusData.connected && statusData.email) {
                      console.log('[OAuth Callback] Status confirmed as connected with email!');
                      setCalendarStatus(statusData);
                      break;
                    }
                  }
                } catch (statusError) {
                  console.error(`[OAuth Callback] Status check error on attempt ${attempt}:`, statusError);
                }
              }

              // Update state with final status
              setCalendarStatus(lastStatus);
            };

            checkStatusWithRetry();
            
            handled = true;
        }
        // Handle error from calendar-oauth.ts (backward compatibility)
        else if (calendarConnected === 'error') {
            setCalendarError(calendarMessage || 'Failed to connect calendar. Please try again.');
            setCalendarSuccess(null);
            handled = true;
        }
        // Handle errors from google-oauth.ts (unified endpoint)
        else if (error) {
            const errorMessages: Record<string, string> = {
                'user_denied_consent': 'You denied Google Calendar access. Please try again to grant permission.',
                'oauth_failed': 'OAuth authorization failed. Please try again.',
                'missing_oauth_parameters': 'OAuth parameters are missing. Please restart the process.',
                'oauth_callback_failed': 'Failed to process OAuth callback. Please try again.',
                'oauth_state_invalid': 'OAuth state validation failed. Security check rejected.',
                'oauth_token_exchange_failed': details
                    ? `Failed to exchange authorization code: ${details}`
                    : 'Failed to exchange authorization code. Please try again.',
                'oauth_callback_error': 'An error occurred during OAuth callback. Please try again.',
                'oauth_generation_failed': 'Failed to generate OAuth URL. Please try again.'
            };
            setCalendarError(errorMessages[error] || `OAuth error: ${error}`);
            setCalendarSuccess(null);
            handled = true;
        }

        // Clear URL parameters if we handled a callback
        if (handled) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [fetchCalendarStatus]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: any = {};
            if (testDestination) payload.test_destination_number = testDestination;

            await authedBackendFetch<any>('/api/founder-console/settings', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            // Refresh status
            await fetchSettings();

            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConnectCalendar = async () => {
        setIsConnectingCalendar(true);
        try {
            const response = await fetch('/api/auth/google-calendar/authorize', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            const data = await response.json();

            if (!response.ok || !data?.authUrl) {
                throw new Error(data?.error || 'Failed to generate authorization URL');
            }

            window.location.href = data.authUrl;
        } catch (error) {
            console.error('Error starting Google OAuth:', error);
            alert(error instanceof Error ? error.message : 'Failed to start Google Calendar authorization');
        } finally {
            setIsConnectingCalendar(false);
        }
    };

    if (loading || isLoadingSettings) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Keys & Integrations</h1>
                <p className="text-gray-600 dark:text-slate-400">Manage your Vapi and Twilio credentials securely.</p>
            </div>

            <div className="space-y-8">

                {/* Common Settings */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Testing Defaults</h2>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Default Test Phone Number
                        </label>
                        <input
                            type="tel"
                            value={testDestination}
                            onChange={(e) => setTestDestination(e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                            Used for &quot;Test Live&quot; calls from the dashboard.
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Calendar Integration */}
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Calendar Integration</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Authorize Voxanne to manage your clinic&apos;s schedule.
                    </p>

                    {/* Success Message */}
                    {calendarSuccess && (
                        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                            <p className="text-sm text-emerald-400">{calendarSuccess}</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {calendarError && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400 font-semibold mb-2">Connection Error</p>
                            <p className="text-sm text-red-400 mb-2">{calendarError}</p>

                            {/* Debug info in development */}
                            {process.env.NODE_ENV === 'development' && (
                              <details className="mt-2">
                                <summary className="text-xs text-red-300 cursor-pointer font-medium">Debug Info</summary>
                                <pre className="mt-2 text-xs text-red-300 overflow-auto bg-black/30 p-2 rounded">
                                  {JSON.stringify({
                                    timestamp: new Date().toISOString(),
                                    calendarStatus,
                                    userOrgId: user?.user_metadata?.org_id
                                  }, null, 2)}
                                </pre>
                              </details>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                calendarStatus.connected
                                    ? 'bg-emerald-500/10'
                                    : 'bg-blue-500/10'
                            }`}>
                                <Calendar className={`w-5 h-5 ${
                                    calendarStatus.connected
                                        ? 'text-emerald-400'
                                        : 'text-blue-400'
                                }`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Google Calendar</p>
                                <p className={`text-xs ${
                                    calendarStatus.connected
                                        ? 'text-emerald-400'
                                        : 'text-slate-500'
                                }`}>
                                    {calendarStatus.connected
                                        ? `Linked (${calendarStatus.email || 'Loading...'})`
                                        : 'Not Linked'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleConnectCalendar}
                            disabled={isConnectingCalendar || calendarStatus.connected}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                                calendarStatus.connected
                                    ? 'bg-slate-700 text-slate-400 cursor-default'
                                    : 'bg-white text-black hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed'
                            }`}
                        >
                            {isConnectingCalendar ? 'Connecting...' : calendarStatus.connected ? 'Connected' : 'Link My Google Calendar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
