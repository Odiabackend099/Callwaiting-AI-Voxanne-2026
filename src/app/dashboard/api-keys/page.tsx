'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Save, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface IntegrationStatus {
    vapiConfigured: boolean;
    twilioConfigured: boolean;
    testDestination: string | null;
    lastVerified: string | null;
}

export default function ApiKeysPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<IntegrationStatus>({
        vapiConfigured: false,
        twilioConfigured: false,
        testDestination: null,
        lastVerified: null
    });

    // Form states
    const [vapiApiKey, setVapiApiKey] = useState('');
    const [twilioAccountSid, setTwilioAccountSid] = useState('');
    const [twilioAuthToken, setTwilioAuthToken] = useState('');
    const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
    const [testDestination, setTestDestination] = useState('');

    // Visibility toggles
    const [showVapiKey, setShowVapiKey] = useState(false);
    const [showTwilioToken, setShowTwilioToken] = useState(false);
    const [showTwilioSid, setShowTwilioSid] = useState(false);

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

    // Need Supabase client for auth token - imported from lib/supabase
    // const { supabase } = useAuth(); // Removed invalid destructuring

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = {};

            // Only send fields that have values (to update them)
            if (vapiApiKey) payload.vapi_api_key = vapiApiKey;
            if (twilioAccountSid) payload.twilio_account_sid = twilioAccountSid;
            if (twilioAuthToken) payload.twilio_auth_token = twilioAuthToken;
            if (twilioPhoneNumber) payload.twilio_from_number = twilioPhoneNumber;
            if (testDestination) payload.test_destination_number = testDestination;

            await authedBackendFetch<any>('/api/founder-console/settings', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            // Clear sensitive inputs after save
            setVapiApiKey('');
            setTwilioAccountSid('');
            setTwilioAuthToken('');

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
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex h-screen bg-white">
            <LeftSidebar />

            <div className="flex-1 ml-64 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">API Keys & Integrations</h1>
                        <p className="text-gray-600">Manage your Vapi and Twilio credentials securely.</p>
                    </div>

                    <div className="space-y-8">
                        {/* Vapi Configuration */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Key className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Vapi Configuration</h2>
                                        <p className="text-sm text-gray-700">Configure your Vapi.ai credentials</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${status.vapiConfigured
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                    }`}>
                                    {status.vapiConfigured ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Active
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-4 h-4" />
                                            Not Configured
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Private API Key
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showVapiKey ? "text" : "password"}
                                            value={vapiApiKey}
                                            onChange={(e) => setVapiApiKey(e.target.value)}
                                            placeholder={status.vapiConfigured ? "•••••••••••••••• (Stored securely)" : "Enter your Vapi Private Key"}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-12"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowVapiKey(!showVapiKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showVapiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Leave blank to keep existing key. Providing a new key will overwrite the current one.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Twilio Configuration */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Twilio Configuration</h2>
                                        <p className="text-sm text-gray-700">Configure your Twilio phone setup</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${status.twilioConfigured
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                    }`}>
                                    {status.twilioConfigured ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Active
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-4 h-4" />
                                            Not Configured
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Account SID
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showTwilioSid ? "text" : "password"}
                                            value={twilioAccountSid}
                                            onChange={(e) => setTwilioAccountSid(e.target.value)}
                                            placeholder={status.twilioConfigured ? "•••••••••••••••• (Stored securely)" : "AC..."}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all pr-12"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowTwilioSid(!showTwilioSid)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showTwilioSid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Auth Token
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showTwilioToken ? "text" : "password"}
                                            value={twilioAuthToken}
                                            onChange={(e) => setTwilioAuthToken(e.target.value)}
                                            placeholder={status.twilioConfigured ? "•••••••••••••••• (Stored securely)" : "Enter Auth Token"}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all pr-12"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowTwilioToken(!showTwilioToken)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Twilio Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={twilioPhoneNumber}
                                        onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                                        placeholder="+1234567890"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                    />
                                    <p className="text-xs text-gray-600 mt-1">
                                        Must be in E.164 format (e.g., +15551234567)
                                    </p>
                                </div>
                            </div>
                        </div>

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
            </div>
        </div>
    );
}
