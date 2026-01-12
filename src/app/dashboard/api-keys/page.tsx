'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">API Keys & Integrations</h1>
                <p className="text-gray-600">Manage your Vapi and Twilio credentials securely.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-blue-900 text-sm">
                <p><strong>Note:</strong> All integrations configuration has moved to the <a href="/dashboard/integrations" className="underline font-medium hover:text-blue-700">Integrations</a> page. Please use that page to configure Vapi, Twilio, and other providers.</p>
            </div>

            <div className="space-y-8">

                {/* Common Settings */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Testing Defaults</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Test Phone Number
                        </label>
                        <input
                            type="tel"
                            value={testDestination}
                            onChange={(e) => setTestDestination(e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                            Used for &quot;Test Live&quot; calls from the dashboard.
                        </p>
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
