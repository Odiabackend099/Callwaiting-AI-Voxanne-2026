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

    // SECURITY FIX: Removed orgId extraction - backend auth middleware extracts from JWT
    const { data, error, isLoading } = useSWR(
        '/api/analytics/leads',
        (url) => authedBackendFetch<{ leads: ActionableLead[] }>(url),
        {
            refreshInterval: 30000,        // Refresh every 30s (less aggressive than pulse)
            revalidateOnFocus: false,      // Prevent reload on tab switch
            revalidateOnMount: false,      // Use cache if available
            dedupingInterval: 10000,       // Prevent duplicate requests within 10s
            revalidateIfStale: true,       // Only refetch if data is stale
        }
    );

    const leads = data?.leads || [];

    // Auth is handled by server-side middleware, no need to check orgId here
    if (!user) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-red-700">Please log in to view hot leads</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-panel p-6 rounded-2xl mb-8">
                <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <p>Error loading leads: {error.message || 'Unknown error'}</p>
                </div>
            </div>
        );
    }

    if (isLoading && leads.length === 0) {
        return (
            <div className="glass-panel p-6 rounded-2xl mb-8 animate-pulse">
                <div className="h-6 w-48 bg-surgical-100 rounded mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-surgical-50 rounded-xl"></div>
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
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group mb-8 border border-surgical-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-surgical-50 rounded-full text-surgical-600">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-obsidian">All Caught Up</h3>
                        <p className="text-sm text-obsidian/60">No urgent leads requiring attention right now.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group mb-8">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-surgical-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-obsidian flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-surgical-50 text-surgical-600">
                            <Flame className="w-5 h-5" />
                        </span>
                        Clinical Command Center
                    </h2>
                    <p className="text-obsidian/60 text-sm mt-1 ml-10">High-priority opportunities ({criticalLeads.length})</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-surgical-50 border border-surgical-200 text-surgical-600 text-xs font-semibold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surgical-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-surgical-600"></span>
                    </span>
                    Live Monitoring
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {criticalLeads.map((lead) => (
                    <div
                        key={lead.id}
                        className={`glass-card hover-glow rounded-xl p-5 flex flex-col group/card border-l-4 ${lead.lead_temp === 'hot' ? 'border-l-surgical-600' : 'border-l-surgical-500'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${lead.lead_temp === 'hot'
                                ? "bg-surgical-600 text-white"
                                : "bg-surgical-50 text-surgical-600 border border-surgical-200"
                                }`}>
                                {lead.lead_temp} Lead
                            </span>
                            <span className="text-[10px] text-obsidian/40 font-medium uppercase tracking-wider">
                                {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-obsidian mb-1 truncate tracking-tight group-hover/card:text-surgical-600 transition-colors">
                            {lead.contact_name || "Unknown Contact"}
                        </h3>

                        {/* Financial value removed from new interface */}

                        <div className="space-y-3 flex-1">
                            <div className="flex items-center text-sm text-obsidian/60">
                                <Zap className="mr-2 h-4 w-4 text-surgical-500 shrink-0" />
                                <span className="font-medium truncate capitalize">Hot Lead</span>
                            </div>
                            <div className="flex items-center text-sm text-obsidian/60">
                                <Phone className="mr-2 h-4 w-4 shrink-0 text-obsidian/40" />
                                {lead.phone_number}
                            </div>

                            {/* Call Summary */}
                            {lead.last_call_summary && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-obsidian/60 bg-surgical-50 p-2 rounded border border-surgical-200">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span className="line-clamp-2">{lead.last_call_summary}</span>
                                </div>
                            )}
                        </div>

                        <button
                            className="w-full mt-5 flex items-center justify-center gap-2 bg-surgical-600 text-white py-2.5 rounded-lg hover:bg-surgical-700 transition-all text-sm font-bold shadow-lg shadow-surgical-600/20 active:scale-[0.98]"
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
