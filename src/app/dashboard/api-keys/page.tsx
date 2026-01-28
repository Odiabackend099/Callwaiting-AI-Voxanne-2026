'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface IntegrationStatus {
    // Reserved for future use
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
    const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
    const [status, setStatus] = useState<IntegrationStatus>({});
    const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
        connected: false
    });
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [calendarSuccess, setCalendarSuccess] = useState<string | null>(null);

    // Form states (reserved for future use)

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

            // Extract org_id from user session - try multiple sources
            let orgId: string | undefined;

            if (user) {
                // Try multiple possible locations for org_id (for backward compatibility)
                // 1. app_metadata.org_id (from database trigger - fresh logins)
                orgId = (user as any).app_metadata?.org_id;

                // 2. user_metadata.org_id (fallback - some edge cases)
                if (!orgId) {
                    orgId = (user as any).user_metadata?.org_id;
                }

                // 3. Check raw JWT structure for debugging
                const userAny = user as any;
                console.debug('[Calendar Status] Extracted org_id from user:', {
                    orgId,
                    sources: {
                        app_metadata: userAny.app_metadata,
                        user_metadata: userAny.user_metadata,
                    },
                    user_id: user.id,
                    email: user.email,
                    timestamp: new Date().toISOString()
                });
            }

            if (!orgId) {
                console.warn('[Calendar Status] No org_id found in user session. This might indicate:');
                console.warn('  1. User needs to log out and back in to refresh JWT');
                console.warn('  2. Database trigger failed during signup');
                console.warn('  3. Raw app_metadata was not populated');
                setCalendarStatus({ connected: false });
                setIsLoadingCalendar(false);
                return;
            }

            // Pass org_id in the URL path (backend will handle missing org_id gracefully)
            const statusUrl = `/api/google-oauth/status/${orgId}`;

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

            const checkStatusWithRetry = async (maxAttempts = 4) => {
                let lastStatus: CalendarStatus = { connected: false };
                let lastError: Error | null = null;

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    // Exponential backoff: 2s, 4s, 8s, 16s (allows schema cache to refresh)
                    const delayMs = attempt === 1 ? 2000 : 2000 * Math.pow(2, attempt - 2);

                    console.log(`[OAuth Callback] Waiting ${delayMs}ms before status check attempt ${attempt}/${maxAttempts}`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));

                    console.log(`[OAuth Callback] Checking status (attempt ${attempt}/${maxAttempts})`);

                    try {
                        // Get org_id - try multiple sources
                        let orgId = (user as any)?.app_metadata?.org_id;
                        if (!orgId) {
                            orgId = (user as any)?.user_metadata?.org_id;
                        }

                        if (!orgId) {
                            console.error('[OAuth Callback] Cannot get org_id from user - no org_id in app_metadata or user_metadata');
                            lastError = new Error('Cannot determine organization ID');
                            continue;
                        }

                        // Directly call backend status endpoint with retry
                        // Use explicit backend URL (port 3001) instead of relative path
                        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                        const statusResponse = await fetch(`${backendUrl}/api/google-oauth/status/${orgId}`, {
                            headers: {
                                'Content-Type': 'application/json',
                            }
                        });

                        const statusData = await statusResponse.json();

                        // Log all attempts for debugging
                        console.log(`[OAuth Callback] Status check attempt ${attempt}:`, {
                            httpStatus: statusResponse.status,
                            connected: statusData.connected,
                            email: statusData.email,
                            hasTokens: statusData.hasTokens,
                            isSchemaRefreshing: statusData.isSchemaRefreshing
                        });

                        if (statusResponse.ok) {
                            lastStatus = statusData;

                            // Success: connected with email
                            if (statusData.connected && statusData.email) {
                                console.log('[OAuth Callback] Status confirmed as connected with email!');
                                setCalendarStatus(statusData);
                                return; // Exit early on success
                            }

                            // Schema cache still refreshing - continue retrying
                            if (statusData.isSchemaRefreshing) {
                                console.log('[OAuth Callback] Schema cache still refreshing, retrying...');
                                lastError = new Error('Supabase schema cache refreshing');
                                continue;
                            }

                            // Connected but no email yet - still valid
                            if (statusData.connected) {
                                console.log('[OAuth Callback] Status confirmed as connected!');
                                setCalendarStatus(statusData);
                                return; // Exit on success
                            }
                        } else {
                            lastError = new Error(`Status endpoint returned ${statusResponse.status}`);
                            console.warn(`[OAuth Callback] Status check failed:`, statusData);
                        }
                    } catch (statusError) {
                        lastError = statusError instanceof Error ? statusError : new Error(String(statusError));
                        console.error(`[OAuth Callback] Status check error on attempt ${attempt}:`, lastError);
                    }
                }

                // Update state with final status (will show "not connected" if all retries failed)
                console.warn('[OAuth Callback] All retry attempts exhausted', { lastError, lastStatus });
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${calendarStatus.connected
                                ? 'bg-emerald-500/10'
                                : 'bg-blue-500/10'
                                }`}>
                                <Calendar className={`w-5 h-5 ${calendarStatus.connected
                                    ? 'text-emerald-400'
                                    : 'text-blue-400'
                                    }`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Google Calendar</p>
                                <p className={`text-xs ${calendarStatus.connected
                                    ? 'text-emerald-400'
                                    : 'text-slate-500'
                                    }`}>
                                    {calendarStatus.connected
                                        ? (calendarStatus.email ? `Connected as ${calendarStatus.email}` : 'Connected')
                                        : 'Not Linked'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {calendarStatus.connected && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('Are you sure you want to disconnect Google Calendar?')) return;
                                        setIsConnectingCalendar(true);
                                        try {
                                            await authedBackendFetch('/api/google-oauth/revoke', {
                                                method: 'POST',
                                                body: JSON.stringify({ orgId: (user as any)?.app_metadata?.org_id })
                                            });
                                            await fetchCalendarStatus();
                                        } catch (err) {
                                            console.error(err);
                                            alert('Failed to disconnect');
                                        } finally {
                                            setIsConnectingCalendar(false);
                                        }
                                    }}
                                    disabled={isConnectingCalendar}
                                    className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    Disconnect
                                </button>
                            )}
                            <button
                                onClick={handleConnectCalendar}
                                disabled={isConnectingCalendar || calendarStatus.connected}
                                className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${calendarStatus.connected
                                    ? 'bg-emerald-500/10 text-emerald-400 cursor-default border border-emerald-500/20'
                                    : 'bg-white text-black hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed'
                                    }`}
                            >
                                {isConnectingCalendar ? 'Working...' : calendarStatus.connected ? 'Connected' : 'Link My Google Calendar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
