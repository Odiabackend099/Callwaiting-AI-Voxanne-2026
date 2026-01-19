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
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Telephony Configuration</h1>
                    <p className="text-gray-700 dark:text-slate-400 mt-1">Configure your Twilio number for inbound AI handling</p>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${integrationStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
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
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300 flex flex-col gap-2">
                    <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Prerequisites
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-1 text-blue-700 dark:text-blue-400">
                        <li>Create and <strong>save an Inbound Agent</strong> in the Agent Config page.</li>
                    </ul>
                </div>
            )}

            {/* Status Card - Only show if actively configured (no fallback, no placeholders) */}
            {integrationStatus === 'active' && twilioConfig && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                {twilioConfig.phoneNumber}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                Active Twilio Number
                            </p>
                        </div>
                        <button
                            onClick={handleTestCall}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4" /> Test Call
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Configuration Form */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Twilio Credentials</h2>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {success}
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Account SID
                        </label>
                        <input
                            type="text"
                            value={config.accountSid}
                            onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Auth Token
                        </label>
                        <input
                            type="password"
                            value={config.authToken}
                            onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                            placeholder="••••••••••••••••••••••••••••••••"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Twilio Phone Number
                        </label>
                        <input
                            type="text"
                            value={config.phoneNumber}
                            onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                            placeholder="+442012345678"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Must be E.164 format (e.g. +44...)</p>
                    </div>

                    <div className="pt-4 flex items-center justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
