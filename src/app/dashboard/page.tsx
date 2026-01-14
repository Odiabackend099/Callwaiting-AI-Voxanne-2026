'use client';
export const dynamic = "force-dynamic";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Phone, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import HotLeadDashboard from '@/components/dashboard/HotLeadDashboard';
import ClinicalPulse from '@/components/dashboard/ClinicalPulse';

interface RecentCall {
    id: string;
    phone_number?: string;
    caller_name?: string;
    call_date?: string;
    duration_seconds: number | null;
    status: string;
    call_type?: string;
    to_number?: string;
    started_at?: string;
    metadata?: {
        channel?: 'inbound' | 'outbound';
    } | null;
}

const fetcher = (url: string) => authedBackendFetch<any>(url);

export default function CallWaitingAIDashboard() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Use SWR for recent calls only
    const { data: recentCallsData, isLoading: swrLoading } = useSWR(
        user ? '/api/calls-dashboard/stats' : null,
        fetcher,
        {
            refreshInterval: 10000,
            revalidateOnFocus: false,      // Prevent reload on tab switch
            revalidateOnMount: false,      // Use cache if available
            dedupingInterval: 5000,        // Prevent duplicate requests within 5s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    const isLoading = authLoading || (swrLoading && !recentCallsData);
    // Legacy stats endpoint returned recentCalls inside the object, check structure
    const recentCalls: RecentCall[] = recentCallsData?.recentCalls || [];

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    if (!user && !authLoading) return null;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 pb-32 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400">Welcome back. Here&apos;s your clinical system overview.</p>
            </div>

            {/* Clinical Pulse (Top ROI Metrics) */}
            <ClinicalPulse />

            {/* Hot Lead Dashboard (Actionable Items) */}
            <HotLeadDashboard />

            {/* Recent Calls Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800/60 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Recent Activity</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Real-time call logs</p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/calls')}
                        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                    >
                        View All Activity
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between animate-pulse">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                                            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                                        </div>
                                    </div>
                                    <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : recentCalls.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                <Phone className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-900 dark:text-white font-medium">No calls recorded yet</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Waiting for your first conversation...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                                <tr>
                                    <th className="px-6 py-3 tracking-wider">Caller</th>
                                    <th className="px-6 py-3 tracking-wider">Type</th>
                                    <th className="px-6 py-3 tracking-wider">Duration</th>
                                    <th className="px-6 py-3 tracking-wider text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                                {recentCalls.map((call) => (
                                    <tr key={call.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-200 tracking-tight">
                                                {call.caller_name || call.to_number || call.phone_number || 'Unknown Caller'}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatTimeAgo(call.started_at || call.call_date || '')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {call.metadata?.channel === 'inbound' ? (
                                                    <ArrowDownRight className="w-4 h-4 text-cyan-500" />
                                                ) : (
                                                    <ArrowUpRight className="w-4 h-4 text-purple-500" />
                                                )}
                                                <span className="text-slate-600 dark:text-slate-400 capitalize">
                                                    {call.metadata?.channel || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                                            {formatDuration(call.duration_seconds)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${call.status === 'completed'
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                {call.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
