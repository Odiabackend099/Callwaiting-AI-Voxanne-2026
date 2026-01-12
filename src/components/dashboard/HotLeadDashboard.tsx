import React, { useState, useEffect } from 'react';
import { Phone, Zap, ArrowUpRight, Flame, Sparkles } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface Lead {
    id: string;
    name: string;
    phone: string;
    serviceType: string;
    score: number;
    summary: string;
    timeAgo: string;
}

export default function HotLeadDashboard() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const data = await authedBackendFetch<any>('/api/dashboard/hot-leads');
            setLeads(data.leads || []);
            setError(null);
        } catch (err: any) {
            console.error('Failed to load hot leads', err);
            setError('Failed to load hot leads');
        } finally {
            setLoading(false);
        }
    };

    if (loading && leads.length === 0) {
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

    if (!loading && leads.length === 0) {
        return null; // Hide if no hot leads, cleaner for dashboard
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
                        Lead Command Center
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 ml-10">High-priority opportunities requiring attention</p>
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
                {leads.map((lead) => (
                    <div
                        key={lead.id}
                        className="glass-card hover-glow rounded-xl p-5 flex flex-col group/card border-l-4 border-l-rose-500"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${lead.score > 80
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                }`}>
                                {lead.score > 80 ? "Hot Lead" : "Inquiry"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{lead.timeAgo}</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 truncate tracking-tight group-hover/card:text-rose-500 transition-colors">
                            {lead.name || "Anonymous Caller"}
                        </h3>

                        <div className="space-y-3 flex-1">
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <Zap className="mr-2 h-4 w-4 text-amber-500 shrink-0" />
                                <span className="font-medium truncate">{lead.serviceType}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <Phone className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                {lead.phone}
                            </div>
                            <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg text-xs italic text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 line-clamp-3 relative">
                                <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1.5 -right-1.5" />
                                "{lead.summary}"
                            </div>
                        </div>

                        <button
                            className="w-full mt-5 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-sm font-bold shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                            onClick={() => window.location.href = `tel:${lead.phone}`}
                        >
                            Call Back <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
