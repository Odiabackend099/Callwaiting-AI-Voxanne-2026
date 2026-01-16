import React from 'react';
import useSWR from 'swr';
import { Phone, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Activity, PoundSterling } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface DashboardPulse {
    total_calls: number;
    inbound_calls: number;
    outbound_calls: number;
    avg_duration_seconds: number;
    success_rate: number;
    pipeline_value: number;
    hot_leads_count: number;
}



const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
};

export default function ClinicalPulse() {
    const { user } = useAuth();

    // SECURITY FIX: Removed orgId extraction - backend auth middleware extracts from JWT
    const { data: stats, isLoading } = useSWR(
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

    const safeStats = stats || {
        total_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        avg_duration_seconds: 0,
        success_rate: 0,
        pipeline_value: 0,
        hot_leads_count: 0
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Metric Card 1: Pipeline Value (ROI) */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <PoundSterling className="w-24 h-24 text-emerald-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Activity className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pipeline Value</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-24 inline-block" /> : formatCurrency(safeStats.pipeline_value)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {safeStats.hot_leads_count} Hot Leads
                        </span>
                    </div>
                </div>
            </div>

            {/* Metric Card 2: Success Rate */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-24 h-24 text-rose-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Success Rate</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-16 inline-block" /> : `${safeStats.success_rate}%`}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                        <span className="text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                            conversion
                        </span>
                        <span>of inbound calls</span>
                    </div>
                </div>
            </div>

            {/* Metric Card 3: Total Volume */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Phone className="w-24 h-24 text-blue-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Phone className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Volume</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-16 inline-block" /> : safeStats.total_calls}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                        <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {safeStats.total_calls > 0 ? Math.round((safeStats.inbound_calls / safeStats.total_calls) * 100) : 0}% Inbound
                        </span>
                    </div>
                </div>
            </div>


            {/* Metric Card 4: Avg Duration */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Clock className="w-24 h-24 text-amber-500 transform rotate-12 translate-x-4 -translate-y-4" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Duration</span>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                        {isLoading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-8 w-16 inline-block" /> : formatDuration(safeStats.avg_duration_seconds)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                        <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Handle Time
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
