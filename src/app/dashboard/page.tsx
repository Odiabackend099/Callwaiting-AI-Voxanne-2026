'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

// LeftSidebar removed (now in layout)
import HotLeadDashboard from '@/components/dashboard/HotLeadDashboard';

// Removed local LeftSidebar definition


interface DashboardStats {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    completedCalls: number;
    callsToday: number;
    avgDuration: number;
}

interface RecentCall {
    id: string;
    phone_number?: string;
    caller_name?: string;
    call_date?: string;
    duration_seconds: number | null;
    status: string;
    call_type?: string;
    // Legacy fields for backwards compatibility
    vapi_call_id?: string;
    to_number?: string;
    started_at?: string;
    metadata?: {
        channel?: 'inbound' | 'outbound';
    } | null;
}

export default function CallWaitingAIDashboard() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        completedCalls: 0,
        callsToday: 0,
        avgDuration: 0
    });
    const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // Fetch dashboard stats from backend API (replaces direct Supabase query)
            const data = await authedBackendFetch<{
                totalCalls: number;
                inboundCalls: number;
                outboundCalls: number;
                completedCalls: number;
                callsToday: number;
                avgDuration: number;
                recentCalls: RecentCall[];
            }>('/api/calls-dashboard/stats');

            // Set stats from backend response
            setStats({
                totalCalls: data.totalCalls,
                inboundCalls: data.inboundCalls,
                outboundCalls: data.outboundCalls,
                completedCalls: data.completedCalls,
                callsToday: data.callsToday,
                avgDuration: data.avgDuration
            });

            // Set recent calls from backend response
            setRecentCalls(data.recentCalls || []);

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            setError(error?.message || 'Failed to load dashboard data');
        } finally {
            setIsLoading(false);
        }
    };

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

    // 1. Show loading while checking authentication status
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-700">Verifying session...</p>
                </div>
            </div>
        );
    }

    // 2. If not authenticated, return null (router.push will redirect)
    if (!user) return null;

    // 3. If authenticated but fetching data, show dashboard loader
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-700">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 pb-32">
            {/* Header */}
            <div className="mb-12">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
                <p className="text-gray-700">Welcome back! Here&apos;s your system overview.</p>
            </div>

            {/* Hot Lead Dashboard - Visible immediately on login */}
            <HotLeadDashboard />

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {/* Total Calls */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Phone className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Total
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCalls}</h3>
                    <p className="text-sm text-gray-700 font-medium mb-4">Total Calls</p>
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-gray-600">Today: {stats.callsToday}</span>
                            <span className="text-emerald-600">{stats.completedCalls} completed</span>
                        </div>
                    </div>
                </div>

                {/* Inbound Calls */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                            <ArrowDownRight className="w-6 h-6 text-cyan-600" />
                        </div>
                        <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
                            Inbound
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.inboundCalls}</h3>
                    <p className="text-sm text-gray-700 font-medium mb-4">Inbound Calls</p>
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-gray-600">Incoming</span>
                            <span className="text-cyan-600">{Math.round((stats.inboundCalls / Math.max(stats.totalCalls, 1)) * 100)}%</span>
                        </div>
                    </div>
                </div>

                {/* Outbound Calls */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                            <ArrowUpRight className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                            Outbound
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.outboundCalls}</h3>
                    <p className="text-sm text-gray-700 font-medium mb-4">Outbound Calls</p>
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-gray-600">Outgoing</span>
                            <span className="text-purple-600">{Math.round((stats.outboundCalls / Math.max(stats.totalCalls, 1)) * 100)}%</span>
                        </div>
                    </div>
                </div>

                {/* Average Duration */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                            Avg
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{formatDuration(stats.avgDuration)}</h3>
                    <p className="text-sm text-gray-700 font-medium mb-4">Avg Call Duration</p>
                    <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-gray-600">Per call</span>
                            <span className="text-amber-600">Completed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Calls */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">Recent Calls</h3>
                        <p className="text-sm text-gray-700">Latest call activity</p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/calls')}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm font-medium"
                    >
                        View All
                    </button>
                </div>

                <div className="space-y-4">
                    {recentCalls.length === 0 ? (
                        <div className="text-center py-12">
                            <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-700">No calls yet</p>
                            <p className="text-sm text-gray-600 mt-2">Calls will appear here once you start receiving them</p>
                        </div>
                    ) : (
                        recentCalls.map((call) => (
                            <div
                                key={call.id}
                                className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${call.metadata?.channel === 'inbound'
                                            ? 'bg-cyan-50'
                                            : 'bg-purple-50'
                                            }`}>
                                            {call.metadata?.channel === 'inbound' ? (
                                                <ArrowDownRight className="w-6 h-6 text-cyan-600" />
                                            ) : (
                                                <ArrowUpRight className="w-6 h-6 text-purple-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{call.to_number || call.phone_number || 'Unknown'}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                                <Clock className="w-3 h-3" />
                                                {formatTimeAgo(call.started_at || call.call_date || '')} • {formatDuration(call.duration_seconds)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${call.metadata?.channel === 'inbound'
                                            ? 'bg-cyan-50 text-cyan-700'
                                            : 'bg-purple-50 text-purple-700'
                                            }`}>
                                            {call.metadata?.channel === 'inbound' ? 'Inbound' : 'Outbound'}
                                        </span>
                                        {call.status === 'completed' && (
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

    );
}
