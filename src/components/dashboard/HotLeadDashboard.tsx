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
            <div className="bg-white rounded-xl shadow-md p-6 border border-[#AACCFF]">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-[#0A0E27]" />
                    <p className="text-[#0A0E27] font-medium">Please log in to view hot leads</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-2xl mb-8 border border-[#0A0E27]/20 shadow-md">
                <div className="flex items-center gap-2 text-[#0A0E27]">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">Error loading leads: {error.message || 'Unknown error'}</p>
                </div>
            </div>
        );
    }

    if (isLoading && leads.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl mb-8 animate-pulse border border-[#AACCFF] shadow-md">
                <div className="h-6 w-48 bg-[#AACCFF]/30 rounded mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-[#AACCFF]/20 rounded-xl"></div>
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
            <div className="bg-white p-6 rounded-2xl relative overflow-hidden group mb-8 border border-[#AACCFF] shadow-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#AACCFF]/20 rounded-full text-[#3366FF]">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[#0A0E27]">All Caught Up</h3>
                        <p className="text-sm text-[#0A0E27]/60">No urgent leads requiring attention right now.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl relative overflow-hidden group mb-8 border border-[#AACCFF] shadow-lg shadow-[#3366FF]/5">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0000FF]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                    <h2 className="text-2xl font-semibold text-[#0A0E27] flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-[#0000FF]/10 text-[#0000FF]">
                            <Flame className="w-6 h-6" />
                        </span>
                        Clinical Command Center
                    </h2>
                    <p className="text-[#0A0E27]/60 text-sm mt-2 ml-12">High-priority opportunities ({criticalLeads.length})</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-[#0000FF]/10 border border-[#0000FF]/20 text-[#0000FF] text-xs font-semibold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3366FF] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0000FF]"></span>
                    </span>
                    Live Monitoring
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {criticalLeads.map((lead) => (
                    <div
                        key={lead.id}
                        className={`bg-white rounded-xl p-6 flex flex-col group/card border-l-4 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ${lead.lead_temp === 'hot'
                            ? 'border-l-[#0000FF] shadow-[#0000FF]/5 hover:shadow-[#0000FF]/10'
                            : 'border-l-[#3366FF] shadow-[#3366FF]/5 hover:shadow-[#3366FF]/10'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm ${lead.lead_temp === 'hot'
                                ? "bg-[#0000FF] text-white shadow-[#0000FF]/20"
                                : "bg-[#3366FF]/10 text-[#3366FF] border border-[#3366FF]/30"
                                }`}>
                                🔥 {lead.lead_temp}
                            </span>
                            <span className="text-[10px] text-[#0A0E27]/40 font-medium uppercase tracking-wider">
                                {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <h3 className="text-lg font-semibold text-[#0A0E27] mb-1 truncate group-hover/card:text-[#0000FF] transition-colors">
                            {lead.contact_name || "Unknown Contact"}
                        </h3>

                        <div className="space-y-3 flex-1">
                            <div className="flex items-center text-sm text-[#0A0E27]/60 font-medium">
                                <Zap className="mr-2 h-4 w-4 text-[#0000FF] shrink-0" />
                                <span className="truncate capitalize">{lead.lead_temp} Lead</span>
                            </div>
                            <div className="flex items-center text-sm text-[#0A0E27]/60 font-medium">
                                <Phone className="mr-2 h-4 w-4 shrink-0 text-[#0A0E27]/40" />
                                {lead.phone_number}
                            </div>

                            {/* Call Summary */}
                            {lead.last_call_summary && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-[#0A0E27]/70 bg-[#AACCFF]/10 p-2.5 rounded-lg border border-[#AACCFF]/30">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#3366FF]" />
                                    <span className="line-clamp-2 leading-relaxed">{lead.last_call_summary}</span>
                                </div>
                            )}
                        </div>

                        <button
                            className="w-full mt-6 flex items-center justify-center gap-2 bg-[#0000FF] text-white py-2.5 rounded-lg hover:scale-105 active:scale-100 transition-all text-sm font-medium shadow-lg shadow-[#0000FF]/20 hover:shadow-xl hover:shadow-[#0000FF]/30 focus:outline-none focus:ring-2 focus:ring-[#0000FF]/50 focus:ring-offset-2"
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
