import React from 'react';
import useSWR from 'swr';
import { Phone, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface DashboardPulse {
    total_calls: number;
    inbound_calls: number;
    outbound_calls: number;
    avg_duration_seconds: number;
}



const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function ClinicalPulse() {
    const { user } = useAuth();

    // SECURITY FIX: Removed orgId extraction - backend auth middleware extracts from JWT
    const { data: stats, isLoading, error, mutate } = useSWR(
        '/api/analytics/dashboard-pulse',
        (url) => authedBackendFetch<DashboardPulse>(url),
        {
            refreshInterval: 10000,
            revalidateOnFocus: false,      // Prevent reload on tab switch
            revalidateOnMount: true,       // Always fetch on mount
            dedupingInterval: 5000,        // Prevent duplicate requests within 5s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    // Error state display
    if (error) {
        return (
            <div className="bg-white rounded-2xl p-6 mb-4 border border-obsidian/20 shadow-md">
                <div className="flex items-center gap-2 text-obsidian mb-4">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-semibold">Error loading dashboard stats: {error.message || 'Unknown error'}</p>
                </div>
                <button
                    onClick={() => mutate()}
                    className="px-4 py-2.5 text-white font-medium bg-surgical-600 hover:scale-105 active:scale-100 rounded-xl transition-all shadow-lg shadow-surgical-600/20 hover:shadow-xl hover:shadow-surgical-600/30 focus:outline-none focus:ring-2 focus:ring-surgical-600/50 focus:ring-offset-2"
                >
                    Retry
                </button>
            </div>
        );
    }

    const safeStats = stats || {
        total_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        avg_duration_seconds: 0,
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Metric Card 1: Total Volume */}
            <div className="bg-white rounded-2xl p-6 relative overflow-hidden group border border-surgical-200 shadow-md shadow-surgical-500/5 hover:shadow-lg hover:shadow-surgical-500/10 hover:-translate-y-0.5 transition-all duration-200">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
                    <Phone className="w-24 h-24 text-surgical-600 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-lg bg-surgical-600/10 text-surgical-600">
                            <Phone className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/60">Total Volume</span>
                    </div>
                    <h3 className="text-4xl font-bold text-obsidian tracking-tight mb-2">
                        {isLoading ? <span className="animate-pulse bg-surgical-200/30 rounded h-10 w-20 inline-block" /> : safeStats.total_calls}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-obsidian/60 mt-3">
                        <span className="text-surgical-600 bg-surgical-600/10 px-2 py-1 rounded-full font-semibold border border-surgical-600/20">
                            {safeStats.total_calls > 0 ? Math.round((safeStats.inbound_calls / safeStats.total_calls) * 100) : 0}% Inbound
                        </span>
                    </div>
                </div>
            </div>


            {/* Metric Card 2: Avg Duration */}
            <div className="bg-white rounded-2xl p-6 relative overflow-hidden group border border-surgical-200 shadow-md shadow-surgical-500/5 hover:shadow-lg hover:shadow-surgical-500/10 hover:-translate-y-0.5 transition-all duration-200">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
                    <Clock className="w-24 h-24 text-surgical-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 rounded-lg bg-surgical-500/10 text-surgical-500">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/60">Avg Duration</span>
                    </div>
                    <h3 className="text-4xl font-bold text-obsidian tracking-tight mb-2">
                        {isLoading ? <span className="animate-pulse bg-surgical-200/30 rounded h-10 w-20 inline-block" /> : formatDuration(safeStats.avg_duration_seconds)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-obsidian/60 mt-3">
                        <span className="text-surgical-500 bg-surgical-500/10 px-2 py-1 rounded-full font-semibold border border-surgical-500/20">
                            Handle Time
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
