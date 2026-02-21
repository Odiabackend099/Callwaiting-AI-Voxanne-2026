'use client';
export const dynamic = "force-dynamic";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Phone, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useDashboardWebSocket } from '@/contexts/DashboardWebSocketContext';
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
        sentiment_label?: string;
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
    const { data: recentActivityData, isLoading: swrLoading, mutate: mutateActivity } = useSWR(
        user ? '/api/analytics/recent-activity' : null,
        fetcher,
        {
            revalidateOnMount: true,
        }
    );

    const isLoading = authLoading || (swrLoading && !recentActivityData);
    const recentEvents: ActivityEvent[] = recentActivityData?.events || [];

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Real-time updates via shared WebSocket context
    const { subscribe } = useDashboardWebSocket();
    useEffect(() => {
        const unsub1 = subscribe('call_ended', () => { mutateActivity(); });
        const unsub2 = subscribe('hot_lead_alert', () => { mutateActivity(); });
        const unsub3 = subscribe('call_update', () => { mutateActivity(); });
        return () => { unsub1(); unsub2(); unsub3(); };
    }, [subscribe, mutateActivity]);

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
        <div className="max-w-7xl mx-auto px-7 py-9 pb-32 space-y-7">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold text-obsidian tracking-tighter mb-2">Dashboard</h1>
                <p className="text-base text-obsidian/70 font-normal">Welcome back. Here&apos;s your clinical system overview.</p>
            </div>

            {/* Clinical Pulse (Top ROI Metrics) */}
            <ClinicalPulse />

            {/* Hot Lead Dashboard (Actionable Items) */}
            <HotLeadDashboard />

            {/* Recent Calls Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="px-7 py-6 border-b border-surgical-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-obsidian tracking-tight">Recent Activity</h3>
                        <p className="text-xs text-obsidian/60">Real-time call logs</p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/calls')}
                        className="text-sm font-semibold text-surgical-600 bg-surgical-50 px-4 py-2.5 rounded-xl border border-surgical-200 shadow-sm hover:shadow-md hover:bg-surgical-100 hover:scale-105 hover:-translate-y-0.5 active:scale-100 focus:outline-none focus:ring-2 focus:ring-surgical-600/30 transition-all duration-200"
                    >
                        View All Activity
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between overflow-hidden relative">
                                    {/* Shimmer overlay */}
                                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-surgical-100 to-surgical-200 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-32 bg-gradient-to-r from-surgical-100 to-surgical-200 rounded animate-pulse" />
                                            <div className="h-3 w-20 bg-gradient-to-r from-surgical-100 to-surgical-200 rounded animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="h-6 w-20 bg-gradient-to-r from-surgical-100 to-surgical-200 rounded-full animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : recentEvents.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-surgical-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-surgical-200">
                                <Phone className="w-8 h-8 text-obsidian/40" />
                            </div>
                            <p className="text-obsidian font-medium">No recent activity yet</p>
                            <p className="text-sm text-obsidian/60 mt-1">Waiting for your first call...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-surgical-200">
                            {recentEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className={`px-6 py-4 hover:bg-surgical-50 transition-colors ${event.type === 'call_completed' ? 'cursor-pointer' : ''}`}
                                    onClick={() => {
                                        if (event.type === 'call_completed') {
                                            const callId = event.id.replace('call_', '');
                                            router.push(`/dashboard/calls?callId=${callId}`);
                                        }
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            {/* Event Type Icon */}
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-surgical-600/10 text-surgical-600 border border-surgical-200 font-bold">
                                                {event.type === 'call_completed' ? '📞' :
                                                    event.type === 'hot_lead_detected' ? '🔥' :
                                                        '📅'}
                                            </div>

                                            {/* Event Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-obsidian truncate">
                                                    {event.summary}
                                                </p>

                                                {/* Event metadata */}
                                                <div className="mt-2 space-y-1">
                                                    {event.type === 'call_completed' && event.metadata && (
                                                        <>
                                                            <div className="text-xs text-obsidian/60">
                                                                <span className="font-medium">Sentiment:</span> {event.metadata.sentiment_label || 'neutral'}
                                                                {event.metadata.sentiment_urgency && event.metadata.sentiment_urgency !== 'low' && ` • ${event.metadata.sentiment_urgency} urgency`}
                                                            </div>
                                                            {event.metadata.sentiment_summary && (
                                                                <p className="text-xs text-obsidian/60 line-clamp-2">
                                                                    {event.metadata.sentiment_summary}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    {event.type === 'hot_lead_detected' && event.metadata && (
                                                        <>
                                                            <div className="text-xs text-obsidian/60">
                                                                <span className="font-medium">Score:</span> {event.metadata.lead_score}/100
                                                            </div>
                                                            {event.metadata.service_interest && (
                                                                <div className="text-xs text-obsidian/60">
                                                                    <span className="font-medium">Interested in:</span> {event.metadata.service_interest}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {event.type === 'appointment_booked' && event.metadata && (
                                                        <div className="text-xs text-obsidian/60">
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
                                            <p className="text-xs text-obsidian/60 text-right whitespace-nowrap">
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
