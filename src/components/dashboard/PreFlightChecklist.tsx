import React, { useState } from 'react';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    Play,
    RotateCw
} from 'lucide-react';

interface VerificationResult {
    step: 'twilio' | 'vapi' | 'calendar' | 'system';
    success: boolean;
    message: string;
    details?: any;
    timestamp: string;
}

interface PreFlightStatus {
    orgId: string;
    overallHealth: 'healthy' | 'degraded' | 'critical';
    checks: VerificationResult[];
}

export default function PreFlightChecklist() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<PreFlightStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runVerification = async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/verification/pre-flight`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`, // Assuming simple token auth for now
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to run verification');
            }

            const data = await response.json();
            setStatus(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (success: boolean) => {
        if (success) return <CheckCircle className="h-6 w-6 text-green-500" />;
        return <XCircle className="h-6 w-6 text-red-500" />;
    };

    const getOverallStatusColor = (health: string) => {
        switch (health) {
            case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
            case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50 border-b border-gray-200">
                <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        System Pre-Flight Checklist
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Verify all critical integrations before going live.
                    </p>
                </div>
                <button
                    onClick={runVerification}
                    disabled={loading}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                >
                    {loading ? (
                        <>
                            <RotateCw className="animate-spin -ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Verifying...
                        </>
                    ) : (
                        <>
                            <Play className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Run Checks
                        </>
                    )}
                </button>
            </div>

            <div className="px-4 py-5 sm:p-6 bg-white">
                {error && (
                    <div className="rounded-md bg-red-50 p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Verification Error</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!status && !loading && !error && (
                    <div className="text-center py-12 text-gray-500">
                        <p>Click "Run Checks" to verify system health.</p>
                    </div>
                )}

                {status && (
                    <div className="space-y-6">
                        {/* Overall Health Banner */}
                        <div className={`p-4 rounded-md border ${getOverallStatusColor(status.overallHealth)} flex items-center`}>
                            <div className="flex-shrink-0 mr-3">
                                {status.overallHealth === 'healthy' ? (
                                    <CheckCircle className="h-8 w-8" />
                                ) : (
                                    <AlertCircle className="h-8 w-8" />
                                )}
                            </div>
                            <div>
                                <h4 className="text-lg font-bold uppercase tracking-wide">
                                    System Status: {status.overallHealth}
                                </h4>
                                <p className="text-sm opacity-90">
                                    {status.overallHealth === 'healthy'
                                        ? 'All systems operational. Ready for flight.'
                                        : 'Issues detected. Please resolve before going live.'}
                                </p>
                            </div>
                        </div>

                        {/* Detailed Checks Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {status.checks.map((check) => (
                                <div
                                    key={check.step}
                                    className={`relative rounded-lg border p-5 shadow-sm flex flex-col justify-between ${check.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${check.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {check.step}
                                        </span>
                                        {getStatusIcon(check.success)}
                                    </div>

                                    <div>
                                        <h4 className="text-base font-semibold text-gray-900 capitalize mb-1">
                                            {check.step} Integration
                                        </h4>
                                        <p className={`text-sm ${check.success ? 'text-green-700' : 'text-red-700'}`}>
                                            {check.message}
                                        </p>
                                    </div>

                                    {/* Technical Details (if any) */}
                                    {check.details && (
                                        <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                                            <dl className="space-y-1">
                                                {Object.entries(check.details).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between text-xs">
                                                        <dt className="text-gray-500 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                                                        <dd className="text-gray-900 font-mono truncate max-w-[120px]" title={String(value)}>
                                                            {String(value)}
                                                        </dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
