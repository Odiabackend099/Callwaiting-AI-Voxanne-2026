'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Save, Loader2, Check, AlertCircle, RefreshCw, Download, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

export default function InboundConfigPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uiStatus, setUiStatus] = useState<string>('unknown');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [config, setConfig] = useState({
        accountSid: '',
        authToken: '',
        phoneNumber: '',
        inboundNumber: '', // The active number
        vapiPhoneNumberId: '',
        activatedAt: ''
    });

    useEffect(() => {
        fetchStatus();
    }, [user]);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await authedBackendFetch<any>('/api/inbound/status');

            setUiStatus(data?.configured ? 'active' : 'not_configured');
            if (data?.configured) {
                setConfig(prev => ({
                    ...prev,
                    inboundNumber: data.inboundNumber,
                    vapiPhoneNumberId: data.vapiPhoneNumberId,
                    activatedAt: data.activatedAt
                }));
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch status';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

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
            setUiStatus('active');
            setConfig(prev => ({
                ...prev,
                inboundNumber: data.inboundNumber,
                vapiPhoneNumberId: data.vapiPhoneNumberId,
                activatedAt: new Date().toISOString()
            }));

            // Clear sensitive fields
            setConfig(prev => ({ ...prev, authToken: '', accountSid: '' }));

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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <LeftSidebar />

            <main className="flex-1 md:ml-64 pt-16 md:pt-0 p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Inbound Configuration</h1>
                            <p className="text-gray-700 mt-1">Configure your Twilio number for inbound AI handling</p>
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${uiStatus === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {uiStatus === 'active' ? (
                                <><Check className="w-4 h-4" /> Inbound Active</>
                            ) : (
                                <><AlertCircle className="w-4 h-4" /> Not Configured</>
                            )}
                        </div>
                    </div>

                    {/* Prerequisite Alert */}
                    {uiStatus !== 'active' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex flex-col gap-2">
                            <div className="flex items-center gap-2 font-medium">
                                <AlertCircle className="w-4 h-4" />
                                Prerequisites
                            </div>
                            <ul className="list-disc list-inside space-y-1 ml-1 text-blue-700">
                                <li>Configure your <strong>Vapi API Key</strong> in integration settings.</li>
                                <li>Create and <strong>save an Inbound Agent</strong> in the Agent Config page.</li>
                            </ul>
                        </div>
                    )}

                    {/* Status Card */}
                    {uiStatus === 'active' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-emerald-600" />
                                        {config.inboundNumber}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Active since {new Date(config.activatedAt).toLocaleDateString()}
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Lock className="w-5 h-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900">Twilio Credentials</h2>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                {success}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Account SID
                                </label>
                                <input
                                    type="text"
                                    value={config.accountSid}
                                    onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Auth Token
                                </label>
                                <input
                                    type="password"
                                    value={config.authToken}
                                    onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                                    placeholder="••••••••••••••••••••••••••••••••"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Twilio Phone Number
                                </label>
                                <input
                                    type="text"
                                    value={config.phoneNumber}
                                    onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                                    placeholder="+442012345678"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm text-gray-900 bg-white placeholder-gray-400"
                                />
                                <p className="text-xs text-gray-600 mt-1">Must be E.164 format (e.g. +44...)</p>
                            </div>

                            <div className="pt-4 flex items-center justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Configuring...</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> Save & Activate Inbound</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Preview (Mock for now) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 opacity-60 pointer-events-none">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Inbound Analytics (Coming Soon)</h2>
                            <button className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                                <Download className="w-4 h-4" /> Export Report
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Total Calls (7d)</p>
                                <p className="text-2xl font-bold text-gray-900">--</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Avg Duration</p>
                                <p className="text-2xl font-bold text-gray-900">--</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Demo Bookings</p>
                                <p className="text-2xl font-bold text-gray-900">--</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
