import React, { useState, useEffect } from 'react';
import { Phone, Zap, ArrowUpRight, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';

interface ActionableLead {
    id: string;
    contact_name: string;
    phone_number: string;
    lead_temp: 'hot' | 'warm' | 'cold';
    created_at: string;
    last_call_summary?: string;
    sentiment?: {
        score: number;
        label: string;
        summary?: string;
    }
}

export default function HotLeadDashboard() {
    const { user } = useAuth();
    const orgId = (user?.app_metadata?.org_id || user?.user_metadata?.org_id) as string;

    const { data, error, isLoading } = useSWR(
        orgId ? ['/api/analytics/leads', orgId] : null,
        ([url, id]) => authedBackendFetch<{ leads: ActionableLead[] }>(url, {
            headers: { 'x-org-id': id }
        }),
        {
            refreshInterval: 30000,        // Refresh every 30s (less aggressive than pulse)
            revalidateOnFocus: false,      // Prevent reload on tab switch
            revalidateOnMount: false,      // Use cache if available
            dedupingInterval: 10000,       // Prevent duplicate requests within 10s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    const leads = data?.leads || [];

    if (!orgId) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                <p className="text-red-600 dark:text-red-400">{error?.message || 'Failed to load hot leads'}. Please log in to view hot leads</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-panel p-6 rounded-2xl mb-8">
                <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                    <p>Error loading leads: {error.message || 'Unknown error'}</p>
                </div>
            </div>
        );
    }

    if (isLoading && leads.length === 0) {
        return (
            <div className="glass-panel p-6 rounded-2xl mb-8 animate-pulse">
                <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    // Filter for Hot/Warm leads only
    const criticalLeads = leads.filter(l => l.lead_temp === 'hot' || l.lead_temp === 'warm');

    if (!isLoading && criticalLeads.length === 0) {
        // If no critical leads, show a "All Systems Go" state or nothing
        return (
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group mb-8 border border-emerald-500/20">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">All Caught Up</h3>
                        <p className="text-sm text-slate-500">No urgent leads requiring attention right now.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group mb-8">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                            <Flame className="w-5 h-5 fill-rose-500/20" />
                        </span>
                        Clinical Command Center
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 ml-10">High-priority opportunities ({criticalLeads.length})</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live Monitoring
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {criticalLeads.map((lead) => (
                    <div
                        key={lead.id}
                        className={`glass-card hover-glow rounded-xl p-5 flex flex-col group/card border-l-4 ${lead.lead_temp === 'hot' ? 'border-l-rose-500' : 'border-l-amber-500'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${lead.lead_temp === 'hot'
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}>
                                {lead.lead_temp} Lead
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate tracking-tight group-hover/card:text-rose-500 transition-colors">
                            {lead.contact_name || "Unknown Contact"}
                        </h3>

                        {/* Financial value removed from new interface */}

                        <div className="space-y-3 flex-1">
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <Zap className="mr-2 h-4 w-4 text-amber-500 shrink-0" />
                                <span className="font-medium truncate capitalize">{lead.procedure_intent?.replace(/_/g, ' ') || 'General Inquiry'}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <Phone className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                {lead.phone_number}
                            </div>

                            {/* Recommended Action Badge */}
                            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/5 p-2 rounded border border-rose-500/10">
                                <AlertCircle className="w-3 h-3" />
                                Action: {lead.recommended_action}
                            </div>
                        </div>

                        <button
                            className="w-full mt-5 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-sm font-bold shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                            onClick={() => window.location.href = `tel:${lead.phone_number}`}
                        >
                            Call Back Now <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
