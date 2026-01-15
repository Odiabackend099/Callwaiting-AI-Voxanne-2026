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

export default function ApiKeysPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
    const [status, setStatus] = useState<IntegrationStatus>({
        testDestination: null
    });

    // Form states
    const [testDestination, setTestDestination] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchSettings = useCallback(async () => {
        try {
            const data = await authedBackendFetch<any>('/api/founder-console/settings');
            setStatus(data);
            if (data?.testDestination) {
                setTestDestination(data.testDestination);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user, fetchSettings]);

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

    if (loading || isLoading) {
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
                    <div>
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
                </div>

                {/* Calendar Integration */}
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Calendar Integration</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Authorize Voxanne to manage your clinic&apos;s schedule.
                    </p>

                    <div className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                                <Calendar className="text-blue-400 w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Google Calendar</p>
                                <p className="text-xs text-slate-500">Not Linked</p>
                            </div>
                        </div>
                        <button
                            onClick={handleConnectCalendar}
                            disabled={isConnectingCalendar}
                            className="px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isConnectingCalendar ? 'Connecting...' : 'Link My Google Calendar'}
                        </button>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
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
        </div>
    );
}
