'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, MessageCircle, CheckCircle, XCircle, Search, Filter, RotateCw, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import useSWR, { useSWRConfig } from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const fetcher = (url: string) => authedBackendFetch<any>(url);

interface Lead {
    id: string;
    contact_name: string;
    phone_number: string;
    email?: string;
    services_interested: string[];
    lead_score: number;
    lead_status: 'new' | 'contacted' | 'qualified' | 'booked' | 'converted' | 'lost';
    last_contact_time?: string;
    created_at: string;
    notes?: string;
}

interface LeadDetail extends Lead {
    call_history: Array<{
        id: string;
        call_date: string;
        duration_seconds: number;
        transcript_preview?: string;
    }>;
    appointment_history: Array<{
        id: string;
        scheduled_time: string;
        status: string;
        service_type: string;
    }>;
}

interface LeadStats {
    total_leads: number;
    hot_leads: number;
    warm_leads: number;
    cold_leads: number;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
}

const LeadsDashboardContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();

    // State management
    // State management
    // Removed useState for leads, stats, isLoading, totalLeads in favor of SWR
    // const [leads, setLeads] = useState<Lead[]>([]);
    // const [stats, setStats] = useState<LeadStats>(...);
    // const [isLoading, setIsLoading] = useState(true);
    // const [totalLeads, setTotalLeads] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    // const [totalLeads, setTotalLeads] = useState(0);
    const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterScore, setFilterScore] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const leadsPerPage = 20;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // SWR for Leads List
    const leadsQueryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: leadsPerPage.toString(),
        ...(filterStatus && { leadStatus: filterStatus }),
        ...(filterScore && { leadScore: filterScore }),
        ...(searchQuery && { search: searchQuery })
    }).toString();

    const { data: leadsData, error: leadsError, mutate: mutateLeads, isLoading: isLeadsLoading } = useSWR(
        user ? `/api/contacts?${leadsQueryParams}` : null,
        fetcher,
        {
            keepPreviousData: true,
            refreshInterval: 0,
            revalidateOnFocus: false,
        }
    );

    const leads = (leadsData?.contacts as Lead[]) || [];
    const totalLeads = leadsData?.pagination?.total || 0;
    const isLoading = isLeadsLoading;

    // Deep-linking: Auto-open lead modal when ?id=<leadId> in URL
    useEffect(() => {
        const leadId = searchParams.get('id');
        if (leadId && leads.length > 0 && !showDetailModal) {
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                setSelectedLead(lead as LeadDetail);
                setShowDetailModal(true);
            }
        }
    }, [searchParams, leads, showDetailModal]);

    // SWR for Lead Stats
    const { data: statsData, mutate: mutateStats } = useSWR(
        user ? '/api/contacts/stats' : null,
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );

    const stats = statsData || {
        total_leads: 0,
        hot_leads: 0,
        warm_leads: 0,
        cold_leads: 0
    };

    // Update error state from SWR
    useEffect(() => {
        if (leadsError) {
            setError(leadsError.message || 'Failed to load leads');
        }
    }, [leadsError]);

    // WebSocket real-time updates
    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

        let ws: WebSocket | null = null;

        try {
            ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'hot_lead_alert' || data.type === 'contact_updated') {
                        mutateLeads();
                        mutateStats();
                    }
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (err) {
            console.error('WebSocket connection error:', err);
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [mutateLeads, mutateStats]);

    const fetchLeadDetail = async (leadId: string) => {
        try {
            const data = await authedBackendFetch<any>(`/api/contacts/${leadId}`);
            setSelectedLead(data);
            setShowDetailModal(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to load lead details');
        }
    };

    const handleCallBack = async (leadId: string) => {
        try {
            const response = await authedBackendFetch<any>(`/api/contacts/${leadId}/initiate-call`, {
                method: 'POST'
            });
            alert('Call initiated. Connecting now...');
        } catch (err: any) {
            setError(err?.message || 'Failed to initiate call');
        }
    };

    const handleSendSMS = async (leadId: string) => {
        const message = prompt('Enter SMS message:');
        if (!message) return;

        try {
            await authedBackendFetch(`/api/contacts/${leadId}/sms`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            alert('SMS sent successfully');
        } catch (err: any) {
            setError(err?.message || 'Failed to send SMS');
        }
    };

    const handleMarkBooked = async (leadId: string) => {
        try {
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'booked' })
            });
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'booked' })
            });
            mutateLeads();
            mutateStats();
            alert('Lead marked as booked');
        } catch (err: any) {
            setError(err?.message || 'Failed to update lead status');
        }
    };

    const handleMarkLost = async (leadId: string) => {
        try {
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'lost' })
            });
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'lost' })
            });
            mutateLeads();
            mutateStats();
            alert('Lead marked as lost');
        } catch (err: any) {
            setError(err?.message || 'Failed to update lead status');
        }
    };

    const getLeadScoreBadge = (score: number) => {
        if (score >= 80) {
            return { label: 'Hot', icon: '🔥', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50' };
        } else if (score >= 50) {
            return { label: 'Warm', icon: '⭐', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50' };
        } else {
            return { label: 'Cold', icon: '❄️', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50' };
        }
    };

    const getLeadStatusColor = (status: string) => {
        switch (status) {
            case 'new':
                return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50';
            case 'contacted':
                return 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50';
            case 'qualified':
                return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50';
            case 'booked':
                return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
            case 'converted':
                return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50';
            case 'lost':
                return 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-700';
            default:
                return 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-700';
        }
    };

    const formatTimeAgo = (dateString?: string) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const totalPages = Math.ceil(totalLeads / leadsPerPage);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600 dark:text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const leadScoreBadge = getLeadScoreBadge(0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-slate-50 mb-2">Live Leads (Real-Time)</h1>
                <p className="text-gray-600 dark:text-slate-400">Manage and track all active leads with real-time scoring</p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Summary Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{stats.total_leads}</p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Total Leads</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">🔥 {stats.hot_leads}</p>
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">Hot Leads</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">⭐ {stats.warm_leads}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Warm Leads</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">❄️ {stats.cold_leads}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Cold Leads</p>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="booked">Booked</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                </select>

                <select
                    value={filterScore}
                    onChange={(e) => {
                        setFilterScore(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">All Scores</option>
                    <option value="hot">Hot (80+)</option>
                    <option value="warm">Warm (50-79)</option>
                    <option value="cold">Cold (&lt;50)</option>
                </select>

                <button
                    onClick={() => {
                        mutateLeads();
                        mutateStats();
                    }}
                    className="p-2 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    title="Refresh"
                >
                    <RotateCw className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                </button>
            </div>

            {/* Leads List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-gray-600 dark:text-slate-400">Loading leads...</p>
                        </div>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-4">
                            <AlertCircle className="w-12 h-12 text-gray-300 dark:text-slate-700" />
                            <p className="text-gray-600 dark:text-slate-400">No leads found</p>
                        </div>
                    </div>
                ) : (
                    leads.map((lead) => {
                        const scoreBadge = getLeadScoreBadge(lead.lead_score);
                        return (
                            <div
                                key={lead.id}
                                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 hover:shadow-md dark:hover:shadow-lg transition-all cursor-pointer"
                                onClick={() => fetchLeadDetail(lead.id)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${scoreBadge.color}`}>
                                                {scoreBadge.icon}
                                                {scoreBadge.label} ({lead.lead_score})
                                            </span>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getLeadStatusColor(lead.lead_status)}`}>
                                                {lead.lead_status.charAt(0).toUpperCase() + lead.lead_status.slice(1)}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-50">{lead.contact_name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mt-1">
                                            <Phone className="w-3 h-3" />
                                            {lead.phone_number}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Last Contact</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50">{formatTimeAgo(lead.last_contact_time)}</p>
                                    </div>
                                </div>

                                {/* Services Interested */}
                                {lead.services_interested && lead.services_interested.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {lead.services_interested.slice(0, 3).map((service, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                                            >
                                                {service}
                                            </span>
                                        ))}
                                        {lead.services_interested.length > 3 && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-slate-400">
                                                +{lead.services_interested.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-800">
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCallBack(lead.id);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors text-xs font-medium"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                            Call Back
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSendSMS(lead.id);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition-colors text-xs font-medium"
                                        >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                            SMS
                                        </button>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {lead.lead_status !== 'booked' && lead.lead_status !== 'converted' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkBooked(lead.id);
                                                }}
                                                className="flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-xs font-medium"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Book
                                            </button>
                                        )}
                                        {lead.lead_status !== 'lost' && lead.lead_status !== 'converted' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkLost(lead.id);
                                                }}
                                                className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs font-medium"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                                Lost
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-8 px-6 py-4">
                        <div className="text-sm text-gray-700 dark:text-slate-400">
                            Showing {(currentPage - 1) * leadsPerPage + 1} to {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads} leads
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                                ? 'bg-emerald-600 text-white'
                                                : 'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>


            {/* Lead Detail Modal */}
            {
                showDetailModal && selectedLead && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl dark:shadow-2xl">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-50">{selectedLead.contact_name}</h2>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedLead.phone_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-600 dark:text-slate-400" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-6">
                                {/* Lead Score and Status */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase mb-2">Lead Score</p>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border ${getLeadScoreBadge(selectedLead.lead_score).color}`}>
                                            {getLeadScoreBadge(selectedLead.lead_score).icon}
                                            {getLeadScoreBadge(selectedLead.lead_score).label} ({selectedLead.lead_score})
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase mb-2">Status</p>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border ${getLeadStatusColor(selectedLead.lead_status)}`}>
                                            {selectedLead.lead_status.charAt(0).toUpperCase() + selectedLead.lead_status.slice(1)}
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                    <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Contact Information</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                            <span className="text-sm text-gray-900 dark:text-slate-200">{selectedLead.phone_number}</span>
                                        </div>
                                        {selectedLead.email && (
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                                <span className="text-sm text-gray-900 dark:text-slate-200">{selectedLead.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Services Interested */}
                                {selectedLead.services_interested && selectedLead.services_interested.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Services Interested</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedLead.services_interested.map((service, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700"
                                                >
                                                    {service}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Call History */}
                                {selectedLead.call_history && selectedLead.call_history.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Call History (Last 5)</p>
                                        <div className="space-y-3">
                                            {selectedLead.call_history.slice(0, 5).map((call) => (
                                                <div key={call.id} className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">
                                                            {new Date(call.call_date).toLocaleString('en-GB', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                        <span className="text-xs text-gray-600 dark:text-slate-400 font-medium">
                                                            {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                                                        </span>
                                                    </div>
                                                    {call.transcript_preview && (
                                                        <p className="text-xs text-gray-700 dark:text-slate-300 italic">{call.transcript_preview}...</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Appointment History */}
                                {selectedLead.appointment_history && selectedLead.appointment_history.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Appointment History</p>
                                        <div className="space-y-2">
                                            {selectedLead.appointment_history.map((apt) => (
                                                <div key={apt.id} className="flex items-start justify-between text-sm py-2 border-b border-gray-200 dark:border-slate-700 last:border-0">
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-slate-200">{apt.service_type}</p>
                                                        <p className="text-xs text-gray-600 dark:text-slate-400">
                                                            {new Date(apt.scheduled_time).toLocaleString('en-GB')}
                                                        </p>
                                                    </div>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${getLeadStatusColor(apt.status)}`}>
                                                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {selectedLead.notes && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-2">Notes</p>
                                        <p className="text-sm text-blue-800 dark:text-blue-300">{selectedLead.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleCallBack(selectedLead.id);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Phone className="w-4 h-4" />
                                    Call Now
                                </button>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default function LeadsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600 dark:text-slate-400">Loading...</p>
                </div>
            </div>
        }>
            <LeadsDashboardContent />
        </React.Suspense>
    );
}
