'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Save, Loader2, Check, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useIntegration } from '@/hooks/useIntegration';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

export default function InboundConfigPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch Twilio integration config via hook (zero fallback)
    const { status: integrationStatus, config: twilioConfig, refetch: refetchIntegration } = useIntegration('TWILIO');

    const [config, setConfig] = useState({
        accountSid: '',
        authToken: '',
        phoneNumber: '',
    });

    // Check telephony mode for conflict warning
    const [telephonyMode, setTelephonyMode] = useState<string | null>(null);
    const [managedPhone, setManagedPhone] = useState<string | null>(null);
    useEffect(() => {
        authedBackendFetch<{ mode: string; phoneNumber?: string }>('/api/integrations/telephony-mode')
            .then(data => {
                setTelephonyMode(data.mode);
                setManagedPhone(data.phoneNumber || null);
            })
            .catch(() => {});
    }, []);

    const handleSave = async () => {
        setError(null);
        setSuccess(null);

        // Basic validation
        if (!config.accountSid.startsWith('AC')) {
            setError('Account SID must start with "AC"');
            return;
        }
        if (config.authToken.length !== 32) {
            setError('Auth Token must be 32 characters long');
            return;
        }
        if (!/^\+[1-9]\d{1,14}$/.test(config.phoneNumber)) {
            setError('Phone number must be in E.164 format (e.g. +442012345678)');
            return;
        }

        setSaving(true);
        try {
            const data = await authedBackendFetch<any>('/api/inbound/setup', {
                method: 'POST',
                body: JSON.stringify({
                    twilioAccountSid: config.accountSid,
                    twilioAuthToken: config.authToken,
                    twilioPhoneNumber: config.phoneNumber
                }),
                timeoutMs: 30000,
                retries: 1,
            });

            setSuccess('Inbound setup successful! Your agent is now live on this number.');

            // Clear sensitive fields
            setConfig(prev => ({ ...prev, authToken: '', accountSid: '' }));

            // Refetch integration to show new active number
            await refetchIntegration();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTestCall = async () => {
        try {
            const data = await authedBackendFetch<any>('/api/inbound/test', {
                method: 'POST',
                timeoutMs: 30000,
                retries: 1,
            });
            alert(`Test initiated! ${data?.note || ''}`);
        } catch (err) {
            alert('Failed to start test');
        }
    };

    if (integrationStatus === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-surgical-50">
                <Loader2 className="w-8 h-8 animate-spin text-surgical-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Mode conflict warning */}
            {telephonyMode === 'managed' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">Managed number active{managedPhone ? `: ${managedPhone}` : ''}</p>
                        <p className="text-sm text-amber-700 mt-1">You currently have a managed phone number. Saving BYOC credentials will replace it.</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-obsidian">Telephony Configuration</h1>
                    <p className="text-obsidian/60 mt-1">Configure your Twilio number for inbound AI handling</p>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${integrationStatus === 'active' ? 'bg-surgical-50 text-surgical-600' : 'bg-surgical-50 text-obsidian/60'
                    }`}>
                    {integrationStatus === 'active' ? (
                        <><Check className="w-4 h-4" /> Inbound Active</>
                    ) : (
                        <><AlertCircle className="w-4 h-4" /> Not Configured</>
                    )}
                </div>
            </div>

            {/* Prerequisite Alert */}
            {integrationStatus !== 'active' && (
                <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4 text-sm text-obsidian flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Prerequisites
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-1 text-obsidian/60">
                        <li>Create and <strong>save an Inbound Agent</strong> in the Agent Config page.</li>
                    </ul>
                </div>
            )}

            {/* Status Card - Only show if actively configured (no fallback, no placeholders) */}
            {integrationStatus === 'active' && twilioConfig && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-obsidian flex items-center gap-2">
                                <Phone className="w-5 h-5 text-surgical-600" />
                                {twilioConfig.phoneNumber}
                            </h3>
                            <p className="text-sm text-obsidian/60 mt-1">
                                Active Twilio Number
                            </p>
                        </div>
                        <button
                            onClick={handleTestCall}
                            className="px-4 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4" /> Test Call
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Configuration Form */}
            <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Lock className="w-5 h-5 text-obsidian/40" />
                    <h2 className="text-lg font-semibold text-obsidian">Twilio Credentials</h2>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-surgical-50 border border-surgical-200 rounded-lg text-surgical-600 text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {success}
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-obsidian/60 mb-1">
                            Account SID
                        </label>
                        <input
                            type="text"
                            value={config.accountSid}
                            onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none transition-all font-mono text-sm text-obsidian bg-white placeholder-obsidian/40"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-obsidian/60 mb-1">
                            Auth Token
                        </label>
                        <input
                            type="password"
                            value={config.authToken}
                            onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                            placeholder="••••••••••••••••••••••••••••••••"
                            className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none transition-all font-mono text-sm text-obsidian bg-white placeholder-obsidian/40"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-obsidian/60 mb-1">
                            Twilio Phone Number
                        </label>
                        <input
                            type="text"
                            value={config.phoneNumber}
                            onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                            placeholder="+442012345678"
                            className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none transition-all font-mono text-sm text-obsidian bg-white placeholder-obsidian/40"
                        />
                        <p className="text-xs text-obsidian/60 mt-1">Must be E.164 format (e.g. +44...)</p>
                    </div>

                    <div className="pt-4 flex items-center justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Configuring...</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save and Activate Telephony</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
