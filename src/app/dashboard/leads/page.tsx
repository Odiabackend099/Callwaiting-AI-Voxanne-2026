'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, MessageCircle, CheckCircle, XCircle, Search, Filter, RotateCw, AlertCircle, MessageSquare, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useDashboardWebSocket } from '@/contexts/DashboardWebSocketContext';
import { useToast } from '@/hooks/useToast';

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
    const [showSMSModal, setShowSMSModal] = useState(false);
    const [smsMessage, setSMSMessage] = useState('');
    const [smsSendingLeadId, setSmsSendingLeadId] = useState<string | null>(null);
    const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
    const [showConfigGuide, setShowConfigGuide] = useState(false);
    const [configGuideType, setConfigGuideType] = useState<'outbound_agent' | 'phone_number' | 'phone_format' | null>(null);
    const { success, error: showError } = useToast();

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
        ...(filterScore && { leadStatus: filterScore }),
        ...(searchQuery && { search: searchQuery })
    }).toString();

    const { data: leadsData, error: leadsError, mutate: mutateLeads, isLoading: isLeadsLoading } = useSWR(
        user ? `/api/contacts?${leadsQueryParams}` : null,
        fetcher,
        {
            revalidateOnMount: true,
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
            revalidateOnMount: true,
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

    // Real-time updates via shared WebSocket context
    const { subscribe } = useDashboardWebSocket();
    useEffect(() => {
        const unsub1 = subscribe('hot_lead_alert', () => {
            mutateLeads();
            mutateStats();
        });
        const unsub2 = subscribe('contact_updated', () => {
            mutateLeads();
            mutateStats();
        });
        return () => { unsub1(); unsub2(); };
    }, [subscribe, mutateLeads, mutateStats]);

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
        setCallingLeadId(leadId);
        try {
            const response = await authedBackendFetch<any>(`/api/contacts/${leadId}/call-back`, {
                method: 'POST'
            });
            success('Call initiated. Connecting now...');
        } catch (err: any) {
            const errorMsg = err?.message || 'Failed to initiate call';

            // Show actionable error guidance based on error type
            if (errorMsg.toLowerCase().includes('outbound agent not configured')) {
                setConfigGuideType('outbound_agent');
                setShowConfigGuide(true);
            } else if (errorMsg.toLowerCase().includes('no phone number available') || errorMsg.toLowerCase().includes('phone number not found')) {
                setConfigGuideType('phone_number');
                setShowConfigGuide(true);
            } else if (errorMsg.toLowerCase().includes('invalid phone format') || errorMsg.toLowerCase().includes('e.164')) {
                setConfigGuideType('phone_format');
                setShowConfigGuide(true);
            } else {
                showError(errorMsg);
                setError(errorMsg);
            }
        } finally {
            setCallingLeadId(null);
        }
    };

    const handleSendSMS = async (leadId: string) => {
        setSmsSendingLeadId(leadId);
        setSMSMessage('');
        setShowSMSModal(true);
    };

    const handleSubmitSMS = async () => {
        if (!smsMessage.trim() || !smsSendingLeadId) return;

        try {
            await authedBackendFetch(`/api/contacts/${smsSendingLeadId}/sms`, {
                method: 'POST',
                body: JSON.stringify({ message: smsMessage })
            });
            success('SMS sent successfully');
            setShowSMSModal(false);
            setSMSMessage('');
            setSmsSendingLeadId(null);
        } catch (err: any) {
            showError(err?.message || 'Failed to send SMS');
            setError(err?.message || 'Failed to send SMS');
        }
    };

    const handleMarkBooked = async (leadId: string) => {
        try {
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'booked' })
            });
            mutateLeads();
            mutateStats();
            success('Lead marked as booked');
        } catch (err: any) {
            showError(err?.message || 'Failed to update lead status');
            setError(err?.message || 'Failed to update lead status');
        }
    };

    const handleMarkLost = async (leadId: string) => {
        try {
            await authedBackendFetch(`/api/contacts/${leadId}`, {
                method: 'PATCH',
                body: JSON.stringify({ lead_status: 'lost' })
            });
            mutateLeads();
            mutateStats();
            success('Lead marked as lost');
        } catch (err: any) {
            showError(err?.message || 'Failed to update lead status');
            setError(err?.message || 'Failed to update lead status');
        }
    };

    const getLeadScoreBadge = (score: number) => {
        if (score >= 80) {
            return { label: 'Hot', icon: '🔥', color: 'bg-white border border-surgical-200 text-obsidian' };
        } else if (score >= 50) {
            return { label: 'Warm', icon: '⭐', color: 'bg-white border border-surgical-200 text-obsidian' };
        } else {
            return { label: 'Cold', icon: '❄️', color: 'bg-white border border-surgical-200 text-obsidian' };
        }
    };

    const getLeadStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-surgical-50 text-surgical-600 border-surgical-200';
            case 'contacted': return 'bg-surgical-50 text-surgical-500 border-surgical-200';
            case 'qualified': return 'bg-surgical-50 text-surgical-600 border-surgical-200';
            case 'booked': return 'bg-surgical-600 text-white border-surgical-600';
            case 'converted': return 'bg-surgical-600 text-white border-surgical-600';
            case 'lost': return 'bg-white text-obsidian/40 border-surgical-200';
            default: return 'bg-white text-obsidian/60 border-surgical-200';
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

    if (!user && !loading) return null;

    const leadScoreBadge = getLeadScoreBadge(0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-obsidian mb-2">Live Leads (Real-Time)</h1>
                <p className="text-obsidian/60">Manage and track all active leads with real-time scoring</p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-obsidian/40" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-surgical-200 rounded-lg text-sm bg-white text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    />
                </div>

                <select
                    value={filterScore}
                    onChange={(e) => {
                        setFilterScore(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-surgical-200 rounded-lg text-sm bg-white text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500"
                >
                    <option value="">All Scores</option>
                    <option value="hot">Hot (80+)</option>
                    <option value="warm">Warm (50-79)</option>
                </select>

                <button
                    onClick={() => {
                        mutateLeads();
                        mutateStats();
                    }}
                    className="p-2 border border-surgical-200 rounded-lg hover:bg-surgical-50 transition-colors"
                    title="Refresh"
                >
                    <RotateCw className="w-4 h-4 text-obsidian/60" />
                </button>
            </div>

            {/* Leads List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="bg-white border border-surgical-200 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                            <p className="text-obsidian/60">Loading leads...</p>
                        </div>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="bg-white border border-surgical-200 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-4">
                            <AlertCircle className="w-12 h-12 text-obsidian/40" />
                            <p className="text-obsidian/60">No leads found</p>
                        </div>
                    </div>
                ) : (
                    leads.map((lead) => {
                        const scoreBadge = getLeadScoreBadge(lead.lead_score);
                        return (
                            <div
                                key={lead.id}
                                className="bg-white border border-surgical-200 rounded-xl p-6 hover:shadow-md transition-all cursor-pointer"
                                onClick={() => fetchLeadDetail(lead.id)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${scoreBadge.color}`}>
                                                {scoreBadge.icon}
                                                {scoreBadge.label} ({lead.lead_score})
                                            </span>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getLeadStatusColor(lead.lead_status || 'new')}`}>
                                                {lead.lead_status ? (lead.lead_status.charAt(0).toUpperCase() + lead.lead_status.slice(1)) : 'New'}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-obsidian">{lead.contact_name}</h3>
                                        <p className="text-sm text-obsidian/60 flex items-center gap-2 mt-1">
                                            <Phone className="w-3 h-3" />
                                            {lead.phone_number}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-obsidian/60 font-medium">Last Contact</p>
                                        <p className="text-sm font-bold text-obsidian">{formatTimeAgo(lead.last_contact_time)}</p>
                                    </div>
                                </div>

                                {/* Services Interested */}
                                {lead.services_interested && lead.services_interested.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {lead.services_interested.slice(0, 3).map((service, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surgical-50 text-obsidian/70"
                                            >
                                                {service}
                                            </span>
                                        ))}
                                        {lead.services_interested.length > 3 && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-obsidian/60">
                                                +{lead.services_interested.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 justify-between items-center pt-4 border-t border-surgical-200">
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCallBack(lead.id);
                                            }}
                                            disabled={callingLeadId === lead.id}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs font-medium ${
                                                callingLeadId === lead.id
                                                    ? 'bg-surgical-100 border border-surgical-200 text-obsidian/50 cursor-not-allowed'
                                                    : 'bg-white border border-surgical-200 text-obsidian hover:bg-surgical-50'
                                            }`}
                                        >
                                            {callingLeadId === lead.id ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-obsidian/30 border-t-surgical-600 rounded-full animate-spin" />
                                                    Calling...
                                                </>
                                            ) : (
                                                <>
                                                    <Phone className="w-3.5 h-3.5" />
                                                    Call Back
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSendSMS(lead.id);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors text-xs font-medium"
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
                                                className="flex items-center gap-1 px-3 py-2 bg-white border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors text-xs font-medium"
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
                                                className="flex items-center gap-1 px-3 py-2 bg-white border border-surgical-200 text-obsidian rounded-lg hover:bg-surgical-50 transition-colors text-xs font-medium"
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
                        <div className="text-sm text-obsidian/70">
                            Showing {(currentPage - 1) * leadsPerPage + 1} to {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads} leads
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
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
                                                ? 'bg-surgical-600 text-white'
                                                : 'border border-surgical-200 text-obsidian/70 hover:bg-surgical-50'
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
                                className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
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
                        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-obsidian">{selectedLead.contact_name}</h2>
                                    <p className="text-sm text-obsidian/60">{selectedLead.phone_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6 text-obsidian/60" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-6">
                                {/* Lead Score and Status */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-obsidian/60 font-medium uppercase mb-2">Lead Score</p>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border ${getLeadScoreBadge(selectedLead.lead_score).color}`}>
                                            {getLeadScoreBadge(selectedLead.lead_score).icon}
                                            {getLeadScoreBadge(selectedLead.lead_score).label} ({selectedLead.lead_score})
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-obsidian/60 font-medium uppercase mb-2">Status</p>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border ${getLeadStatusColor(selectedLead.lead_status || 'new')}`}>
                                            {selectedLead.lead_status ? (selectedLead.lead_status.charAt(0).toUpperCase() + selectedLead.lead_status.slice(1)) : 'New'}
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="bg-surgical-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-3">Contact Information</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-obsidian/40" />
                                            <span className="text-sm text-obsidian">{selectedLead.phone_number}</span>
                                        </div>
                                        {selectedLead.email && (
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-obsidian/40" />
                                                <span className="text-sm text-obsidian">{selectedLead.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Services Interested */}
                                {selectedLead.services_interested && selectedLead.services_interested.length > 0 && (
                                    <div className="bg-white border border-surgical-200 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Services Interested</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedLead.services_interested.map((service, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-obsidian/70 border border-surgical-200"
                                                >
                                                    {service}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Call History */}
                                {selectedLead.call_history && selectedLead.call_history.length > 0 && (
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Call History (Last 5)</p>
                                        <div className="space-y-3">
                                            {selectedLead.call_history.slice(0, 5).map((call) => (
                                                <div key={call.id} className="bg-white rounded-lg p-3 border border-surgical-200">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <p className="text-xs text-obsidian/60 font-medium">
                                                            {new Date(call.call_date).toLocaleString('en-GB', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                        <span className="text-xs text-obsidian/60 font-medium">
                                                            {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                                                        </span>
                                                    </div>
                                                    {call.transcript_preview && (
                                                        <p className="text-xs text-obsidian/70 italic">{call.transcript_preview}...</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Appointment History */}
                                {selectedLead.appointment_history && selectedLead.appointment_history.length > 0 && (
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Appointment History</p>
                                        <div className="space-y-2">
                                            {selectedLead.appointment_history.map((apt) => (
                                                <div key={apt.id} className="flex items-start justify-between text-sm py-2 border-b border-surgical-200 last:border-0">
                                                    <div>
                                                        <p className="font-medium text-obsidian">{apt.service_type}</p>
                                                        <p className="text-xs text-obsidian/60">
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
                                    <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                        <p className="text-sm font-bold text-surgical-600 mb-2">Notes</p>
                                        <p className="text-sm text-obsidian/70">{selectedLead.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleCallBack(selectedLead.id);
                                    }}
                                    disabled={callingLeadId === selectedLead.id}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                        callingLeadId === selectedLead.id
                                            ? 'bg-surgical-300 cursor-not-allowed text-white'
                                            : 'bg-surgical-600 hover:bg-surgical-700 text-white'
                                    }`}
                                >
                                    {callingLeadId === selectedLead.id ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Calling...
                                        </>
                                    ) : (
                                        <>
                                            <Phone className="w-4 h-4" />
                                            Call Now
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SMS Modal */}
            {showSMSModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="border-b border-surgical-200 p-6">
                            <h2 className="text-xl font-bold text-obsidian">Send SMS to Lead</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-obsidian/70 mb-2">
                                    Message
                                </label>
                                <textarea
                                    value={smsMessage}
                                    onChange={(e) => setSMSMessage(e.target.value)}
                                    placeholder="Enter your SMS message..."
                                    className="w-full px-3 py-2 border border-surgical-200 rounded-lg bg-white text-obsidian placeholder-obsidian/40 focus:outline-none focus:ring-2 focus:ring-surgical-500"
                                    rows={4}
                                />
                                <p className="text-xs text-obsidian/60 mt-2">
                                    {smsMessage.length} characters
                                </p>
                            </div>
                        </div>
                        <div className="border-t border-surgical-200 p-6 flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowSMSModal(false);
                                    setSMSMessage('');
                                    setSmsSendingLeadId(null);
                                }}
                                className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitSMS}
                                disabled={!smsMessage.trim()}
                                className="px-4 py-2 bg-surgical-600 hover:bg-surgical-700 disabled:bg-obsidian/30 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Configuration Guide Modal */}
            {showConfigGuide && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-6 h-6 text-amber-600" />
                                <h2 className="text-xl font-bold text-obsidian">Configuration Required</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setShowConfigGuide(false);
                                    setConfigGuideType(null);
                                }}
                                className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-obsidian/60" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {configGuideType === 'outbound_agent' && (
                                <>
                                    <p className="text-obsidian/80 text-sm leading-relaxed">
                                        To make outbound calls, you need to set up an outbound agent first. Follow these steps:
                                    </p>
                                    <div className="bg-surgical-50 rounded-lg p-4 space-y-3">
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Go to Agent Configuration</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Find it in the sidebar navigation</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Click &quot;Outbound&quot; tab</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Configure your outbound calling agent</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Configure agent settings</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Set name, voice, system prompt, and tools</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">4</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Click &quot;Save Agent&quot;</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Wait for confirmation message</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {configGuideType === 'phone_number' && (
                                <>
                                    <p className="text-obsidian/80 text-sm leading-relaxed">
                                        To make outbound calls, you need to import your Twilio phone number:
                                    </p>
                                    <div className="bg-surgical-50 rounded-lg p-4 space-y-3">
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Go to Settings → Telephony</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Navigate to telephony settings</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Click &quot;Import Twilio Number&quot;</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Or &quot;Connect Twilio&quot; if available</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Enter Twilio credentials</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Account SID, Auth Token, and Phone Number from Twilio console</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surgical-600 text-white flex items-center justify-center text-xs font-bold">4</div>
                                            <div>
                                                <p className="text-sm font-semibold text-obsidian">Re-save your outbound agent</p>
                                                <p className="text-xs text-obsidian/60 mt-1">Go back to Agent Configuration and save the outbound agent again</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {configGuideType === 'phone_format' && (
                                <>
                                    <p className="text-obsidian/80 text-sm leading-relaxed">
                                        This contact&apos;s phone number must be in E.164 format for outbound calls to work:
                                    </p>
                                    <div className="bg-surgical-50 rounded-lg p-4 space-y-3">
                                        <div>
                                            <p className="text-sm font-semibold text-obsidian mb-2">Required Format (E.164):</p>
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-green-700">+12125551234</code>
                                            </div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-green-700">+442071234567</code>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-green-700">+2348141995397</code>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-obsidian mb-2">Invalid Formats:</p>
                                            <div className="flex items-center gap-2 mb-1">
                                                <XCircle className="w-4 h-4 text-red-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-red-700">(212) 555-1234</code>
                                            </div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <XCircle className="w-4 h-4 text-red-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-red-700">2125551234</code>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <XCircle className="w-4 h-4 text-red-600" />
                                                <code className="text-xs bg-white px-2 py-1 rounded border border-surgical-200 text-red-700">212-555-1234</code>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-obsidian/60 mt-3">
                                        💡 Tip: Edit the contact&apos;s phone number to add the country code (e.g., +1 for US) at the beginning.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="border-t border-surgical-200 px-6 py-4 flex gap-3 justify-end">
                            {(configGuideType === 'outbound_agent' || configGuideType === 'phone_number') && (
                                <button
                                    onClick={() => {
                                        setShowConfigGuide(false);
                                        setConfigGuideType(null);
                                        router.push('/dashboard/agent-configuration');
                                    }}
                                    className="px-4 py-2 bg-surgical-600 hover:bg-surgical-700 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    Go to Agent Configuration
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowConfigGuide(false);
                                    setConfigGuideType(null);
                                }}
                                className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default function LeadsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                    <p className="text-obsidian/60">Loading...</p>
                </div>
            </div>
        }>
            <LeadsDashboardContent />
        </React.Suspense>
    );
}
