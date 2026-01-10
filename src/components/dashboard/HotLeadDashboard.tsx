import React, { useState, useEffect } from 'react';
import { Phone, Zap, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
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
            const data = await authedBackendFetch<{ leads: Lead[] }>('/api/dashboard/hot-leads');
            setLeads(data.leads || []);
        } catch (err: any) {
            console.error('Failed to fetch hot leads:', err);
            // Don't show error to user immediately, just log it. 
            // If it fails, we show empty state or previous data.
            setError('Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    if (loading && leads.length === 0) {
        return (
            <div className="p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    // If no leads and no error, hide section or show empty state?
    // Let's show empty state if no leads.
    if (!loading && leads.length === 0) {
        return null; // Hide if no hot leads
    }

    return (
        <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200 mb-8">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        🔥 Lead Command Center
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Real-time opportunities from Voxanne AI</p>
                </div>
                <div className="px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold animate-pulse flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live AI Monitoring
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {leads.map((lead) => (
                    <div
                        key={lead.id}
                        className="bg-white rounded-xl border-t-4 border-t-rose-500 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${lead.score > 80 ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                {lead.score > 80 ? "🔥 Hot Lead" : "Inquiry"}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{lead.timeAgo}</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-4 truncate">
                            {lead.name || "Anonymous Caller"}
                        </h3>

                        <div className="space-y-3 flex-1">
                            <div className="flex items-center text-sm text-slate-600">
                                <Zap className="mr-2 h-4 w-4 text-amber-500 shrink-0" />
                                <span className="font-medium text-slate-900 truncate">{lead.serviceType}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-600">
                                <Phone className="mr-2 h-4 w-4 shrink-0" />
                                {lead.phone}
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-xs italic text-slate-500 border border-slate-100 line-clamp-3">
                                "{lead.summary}"
                            </div>
                        </div>

                        <button
                            className="w-full mt-5 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
                            onClick={() => window.location.href = `tel:${lead.phone}`}
                        >
                            Call Back Now <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
