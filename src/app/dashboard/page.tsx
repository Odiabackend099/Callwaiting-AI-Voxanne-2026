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

interface ActivityEvent {
    id: string;
    type: 'call_completed' | 'hot_lead_detected' | 'appointment_booked';
    timestamp: string;
    summary: string;
    metadata?: {
        caller_name?: string;
        sentiment?: string;
        sentiment_summary?: string;
        sentiment_urgency?: string;
        duration_seconds?: number;
        lead_name?: string;
        lead_phone?: string;
        service_interest?: string;
        lead_score?: number;
        customer_name?: string;
        scheduled_at?: string;
        contact_phone?: string;
    };
}

const fetcher = (url: string) => authedBackendFetch<any>(url);

export default function CallWaitingAIDashboard() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Use SWR for recent activity
    const { data: recentActivityData, isLoading: swrLoading } = useSWR(
        user ? '/api/analytics/recent-activity' : null,
        fetcher,
        {
            refreshInterval: 10000,
            revalidateOnFocus: false,      // Prevent reload on tab switch
            revalidateOnMount: false,      // Use cache if available
            dedupingInterval: 5000,        // Prevent duplicate requests within 5s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    const isLoading = authLoading || (swrLoading && !recentActivityData);
    const recentEvents: ActivityEvent[] = recentActivityData?.events || [];

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
                    ) : recentEvents.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                <Phone className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-900 dark:text-white font-medium">No recent activity yet</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Waiting for your first call...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                            {recentEvents.map((event) => (
                                <div key={event.id} className="px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            {/* Event Type Icon */}
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                                event.type === 'call_completed' ? 'bg-blue-500/80' :
                                                event.type === 'hot_lead_detected' ? 'bg-red-500/80' :
                                                'bg-green-500/80'
                                            }`}>
                                                {event.type === 'call_completed' ? '📞' :
                                                event.type === 'hot_lead_detected' ? '🔥' :
                                                '📅'}
                                            </div>

                                            {/* Event Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 dark:text-slate-200 truncate">
                                                    {event.summary}
                                                </p>

                                                {/* Event metadata */}
                                                <div className="mt-2 space-y-1">
                                                    {event.type === 'call_completed' && event.metadata && (
                                                        <>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="font-medium">Sentiment:</span> {event.metadata.sentiment || 'Unknown'}
                                                                {event.metadata.sentiment_urgency && ` • ${event.metadata.sentiment_urgency} urgency`}
                                                            </div>
                                                            {event.metadata.sentiment_summary && (
                                                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                                                    {event.metadata.sentiment_summary}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    {event.type === 'hot_lead_detected' && event.metadata && (
                                                        <>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="font-medium">Score:</span> {event.metadata.lead_score}/100
                                                            </div>
                                                            {event.metadata.service_interest && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    <span className="font-medium">Interested in:</span> {event.metadata.service_interest}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {event.type === 'appointment_booked' && event.metadata && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {event.metadata.scheduled_at && (
                                                                <span><span className="font-medium">Scheduled:</span> {new Date(event.metadata.scheduled_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="flex-shrink-0">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                                                {formatTimeAgo(event.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
