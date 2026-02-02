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
            revalidateOnMount: false,      // Use cache if available
            dedupingInterval: 5000,        // Prevent duplicate requests within 5s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    // Error state display
    if (error) {
        return (
            <div className="glass-card rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 text-red-700 mb-4">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">Error loading dashboard stats: {error.message || 'Unknown error'}</p>
                </div>
                <button
                    onClick={() => mutate()}
                    className="px-4 py-2 text-surgical-600 hover:text-surgical-700 font-medium bg-surgical-50 hover:bg-surgical-100 rounded-lg transition-colors"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Metric Card 1: Total Volume */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Phone className="w-24 h-24 text-surgical-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-surgical-50 text-surgical-600">
                            <Phone className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/60">Total Volume</span>
                    </div>
                    <h3 className="text-3xl font-bold text-obsidian tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-surgical-100 rounded h-8 w-16 inline-block" /> : safeStats.total_calls}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-obsidian/60 mt-2">
                        <span className="text-surgical-600 bg-surgical-50 px-1.5 py-0.5 rounded">
                            {safeStats.total_calls > 0 ? Math.round((safeStats.inbound_calls / safeStats.total_calls) * 100) : 0}% Inbound
                        </span>
                    </div>
                </div>
            </div>


            {/* Metric Card 4: Avg Duration */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Clock className="w-24 h-24 text-surgical-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-surgical-50 text-surgical-600">
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-obsidian/60">Avg Duration</span>
                    </div>
                    <h3 className="text-3xl font-bold text-obsidian tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-surgical-100 rounded h-8 w-16 inline-block" /> : formatDuration(safeStats.avg_duration_seconds)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-obsidian/60 mt-2">
                        <span className="text-surgical-600 bg-surgical-50 px-1.5 py-0.5 rounded">
                            Handle Time
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
