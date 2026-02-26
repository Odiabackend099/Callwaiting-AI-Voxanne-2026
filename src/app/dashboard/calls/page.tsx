'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, Play, Pause, Trash2, X, Mail, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useDashboardWebSocket } from '@/contexts/DashboardWebSocketContext';

const fetcher = (url: string) => authedBackendFetch<any>(url);

interface Call {
    id: string;
    phone_number: string;
    caller_name: string;
    call_date: string;
    duration_seconds: number;
    status: 'completed' | 'missed' | 'transferred' | 'failed';
    has_recording: boolean;
    has_transcript: boolean;
    sentiment_score?: number;
    sentiment_label?: string;
    sentiment_summary?: string;
    sentiment_urgency?: string;
    outcome?: string;
    outcome_summary?: string;
    call_type?: 'inbound' | 'outbound';
    recording_status?: 'pending' | 'processing' | 'completed' | 'failed';
    recording_url?: string;
}

interface CallDetail extends Call {
    recording_url?: string;
    transcript: Array<{
        speaker: 'caller' | 'voxanne';
        text: string;
        timestamp: number;
        sentiment: string;
    }>;
    action_items: string[];
    cost_cents?: number;
    appointment_id?: string;
    tools_used?: string[];
}

const CallsPageContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    const { success, error: showError, info, warning } = useToast();

    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDateRange, setFilterDateRange] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);
    const [showFollowupModal, setShowFollowupModal] = useState(false);
    const [followupMessage, setFollowupMessage] = useState('');
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        cancelText: string;
        onConfirm: () => Promise<void> | void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => { }
    });

    // SMS modal state
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [smsCallId, setSmsCallId] = useState<string | null>(null);
    const [smsMessage, setSmsMessage] = useState('');

    // Inbound/Outbound tabs
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab);

    const callsPerPage = 100;

    useEffect(() => {
        const isTestMode = searchParams.get('_test') === '1' ||
                          (typeof window !== 'undefined' && window.location.search.includes('_test=1'));
        if (!loading && !user && !isTestMode) {
            router.push('/login');
        }
    }, [user, loading, router, searchParams]);

    // Escape key to close modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showFollowupModal) {
                    setShowFollowupModal(false);
                    setFollowupMessage('');
                } else if (showDetailModal) {
                    setShowDetailModal(false);
                } else if (confirmDialog.isOpen) {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDetailModal, showFollowupModal, confirmDialog]);

    // Compute date range boundaries for filter
    const getDateRange = () => {
        const now = new Date();
        if (filterDateRange === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return { startDate: start.toISOString() };
        } else if (filterDateRange === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 7);
            return { startDate: start.toISOString() };
        } else if (filterDateRange === 'month') {
            const start = new Date(now);
            start.setMonth(now.getMonth() - 1);
            return { startDate: start.toISOString() };
        }
        return {};
    };
    const dateRange = getDateRange();

    // SWR for Calls List
    const callsQueryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: callsPerPage.toString(),
        call_type: activeTab,
        ...(searchQuery && { search: searchQuery }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
    }).toString();

    const { data: callsData, error: callsError, mutate: mutateCalls, isLoading: isCallsLoading } = useSWR(
        user ? `/api/calls-dashboard?${callsQueryParams}` : null,
        fetcher,
        { revalidateOnMount: true }
    );

    const calls = (callsData?.calls as Call[]) || [];
    const totalCalls = callsData?.pagination?.total || 0;
    const isLoading = isCallsLoading;

    // SWR for Analytics
    const { data: analytics, mutate: mutateAnalytics } = useSWR(
        user ? '/api/calls-dashboard/analytics/summary' : null,
        fetcher,
        { revalidateOnMount: true }
    );

    useEffect(() => {
        if (callsError) setError(callsError.message || 'Failed to load calls');
    }, [callsError]);

    // Real-time updates via WebSocket
    const { subscribe } = useDashboardWebSocket();
    useEffect(() => {
        const unsub1 = subscribe('call_ended', () => { mutateCalls(); mutateAnalytics(); });
        const unsub2 = subscribe('call_update', () => { mutateCalls(); mutateAnalytics(); });
        return () => { unsub1(); unsub2(); };
    }, [subscribe, mutateCalls, mutateAnalytics]);

    // --- Action handlers ---

    const fetchCallDetail = async (callId: string) => {
        try {
            const data = await authedBackendFetch<any>(`/api/calls-dashboard/${callId}`);
            setSelectedCall(data);
            setShowDetailModal(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to load call details');
        }
    };

    // Auto-open call detail when navigated with ?callId= param
    useEffect(() => {
        const callId = searchParams.get('callId');
        if (callId && user) {
            fetchCallDetail(callId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, user]);

    const deleteCall = (callId: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Call',
            message: 'Are you sure you want to delete this call? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await authedBackendFetch(`/api/calls-dashboard/${callId}`, { method: 'DELETE' });
                    mutateCalls();
                    mutateAnalytics();
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    success('Deleted successfully');
                } catch (err: any) {
                    setError(err?.message || 'Failed to delete call');
                }
            }
        });
    };

    const handleSendSms = async () => {
        if (!smsCallId || !smsMessage.trim()) return;
        try {
            setLoadingAction(`sms-${smsCallId}`);
            await authedBackendFetch(`/api/calls-dashboard/${smsCallId}/followup`, {
                method: 'POST',
                body: JSON.stringify({ message: smsMessage })
            });
            success('Follow-up SMS sent');
            setShowSmsModal(false);
            setSmsMessage('');
            setSmsCallId(null);
        } catch (err: any) {
            showError(err?.message || 'Failed to send SMS');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDownloadRecording = async (call: Call | CallDetail) => {
        try {
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${call.id}/recording-url`);
            if (!response.recording_url) {
                showError('No recording available');
                return;
            }
            const link = document.createElement('a');
            link.href = response.recording_url;
            link.download = `call_${call.id}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            success('Recording downloaded');
        } catch (err: any) {
            showError('Failed to download recording');
        }
    };

    const handleSendFollowup = async () => {
        if (!selectedCall || !followupMessage.trim()) {
            warning('Please enter a message');
            return;
        }
        try {
            setLoadingAction('followup');
            await authedBackendFetch(`/api/calls-dashboard/${selectedCall.id}/followup`, {
                method: 'POST',
                body: JSON.stringify({ message: followupMessage, method: 'sms' })
            });
            success('Follow-up SMS sent');
            setShowFollowupModal(false);
            setFollowupMessage('');
        } catch (err: any) {
            showError(err?.message || 'Failed to send follow-up');
        } finally {
            setLoadingAction(null);
        }
    };

    // --- Formatters ---

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getSentimentColor = (label?: string) => {
        const n = label?.toLowerCase() || '';
        if (n === 'positive' || n === 'reassured' || n === 'decisive') return 'text-surgical-600 bg-surgical-50';
        if (n === 'negative' || n === 'frustrated') return 'text-red-600 bg-red-50';
        if (n === 'anxious') return 'text-obsidian/70 bg-surgical-50';
        return 'text-obsidian/60 bg-surgical-50';
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-surgical-50 text-surgical-600 border-surgical-200';
            case 'missed': return 'bg-red-50 text-red-700 border-red-200';
            case 'transferred': return 'bg-surgical-50 text-surgical-500 border-surgical-200';
            case 'failed': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-surgical-50 text-obsidian/60 border-surgical-200';
        }
    };

    const totalPages = Math.ceil(totalCalls / callsPerPage);

    if (!user && !loading) return null;

    return (
        <>
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-obsidian mb-2">Call Recordings</h1>
                    <p className="text-obsidian/60">View and analyze all call activity with transcripts and sentiment analysis</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Analytics Summary */}
                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white border border-surgical-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <p className="text-2xl font-bold text-obsidian">{analytics.total_calls}</p>
                            <p className="text-xs text-obsidian/60 font-medium">Total Calls</p>
                        </div>
                        <div className="bg-white border border-surgical-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <p className="text-2xl font-bold text-surgical-600">{analytics.completed_calls}</p>
                            <p className="text-xs text-obsidian/60 font-medium">Completed</p>
                        </div>
                        <div className="bg-white border border-surgical-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <p className="text-2xl font-bold text-obsidian">{analytics.average_duration}s</p>
                            <p className="text-xs text-obsidian/60 font-medium">Avg Duration</p>
                        </div>
                        <div className="bg-white border border-surgical-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <p className="text-2xl font-bold text-surgical-600">{(analytics.average_sentiment * 100).toFixed(0)}%</p>
                            <p className="text-xs text-obsidian/60 font-medium">Avg Sentiment</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6 flex gap-2 border-b border-surgical-200">
                    <button
                        onClick={() => { setActiveTab('inbound'); setCurrentPage(1); }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'inbound'
                            ? 'border-surgical-600 text-surgical-600'
                            : 'border-transparent text-obsidian/60 hover:text-obsidian'}`}
                    >
                        Inbound Calls
                    </button>
                    <button
                        onClick={() => { setActiveTab('outbound'); setCurrentPage(1); }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'outbound'
                            ? 'border-surgical-600 text-surgical-600'
                            : 'border-transparent text-obsidian/60 hover:text-obsidian'}`}
                    >
                        Outbound Calls
                    </button>
                </div>

                {/* Filters Row */}
                <div className="mb-6 flex flex-wrap items-center gap-4">
                    {/* Search with clear button */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <input
                            type="text"
                            placeholder="Search by caller name or phone..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setCurrentPage(1); } }}
                            className="w-full px-4 py-2 pr-9 border border-surgical-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-surgical-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian/40 hover:text-obsidian transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2 border border-surgical-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="missed">Missed</option>
                        <option value="transferred">Transferred</option>
                        <option value="failed">Failed</option>
                    </select>
                    {/* Date Range Filter */}
                    <select
                        value={filterDateRange}
                        onChange={(e) => { setFilterDateRange(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2 border border-surgical-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>

                {/* Calls Table */}
                <div className="bg-white border border-surgical-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-surgical-50 border-b border-surgical-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Date & Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Caller</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Duration</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Sentiment</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Outcome Summary</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/70 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surgical-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                                                <p className="text-obsidian/60">Loading calls...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : calls.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <p className="text-obsidian/60">No calls found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    calls.map((call) => (
                                        <tr
                                            key={call.id}
                                            className="hover:bg-surgical-50 transition-colors cursor-pointer"
                                            onClick={() => fetchCallDetail(call.id)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-obsidian font-medium">
                                                    <Calendar className="w-4 h-4 text-obsidian/40" />
                                                    {formatDateTime(call.call_date)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-obsidian">{call.caller_name}</div>
                                                <div className="text-xs text-obsidian/60">{call.phone_number}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-obsidian font-medium">
                                                    <Clock className="w-4 h-4 text-obsidian/40" />
                                                    {formatDuration(call.duration_seconds)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(call.status)}`}>
                                                    {call.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                                                    {call.status === 'missed' && <XCircle className="w-3.5 h-3.5" />}
                                                    {call.status === 'transferred' && <AlertCircle className="w-3.5 h-3.5" />}
                                                    {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {call.sentiment_label && (
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(call.sentiment_label)}`}>
                                                        {call.sentiment_label.charAt(0).toUpperCase() + call.sentiment_label.slice(1)}
                                                        {call.sentiment_score && ` (${(call.sentiment_score * 100).toFixed(0)}%)`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {call.outcome_summary ? (
                                                    <p className="text-xs text-obsidian/70 line-clamp-2 leading-relaxed max-w-xs">
                                                        {call.outcome_summary}
                                                    </p>
                                                ) : call.sentiment_summary ? (
                                                    <p className="text-xs text-obsidian/60 line-clamp-2 leading-relaxed max-w-xs italic">
                                                        {call.sentiment_summary}
                                                    </p>
                                                ) : (
                                                    <span className="text-xs text-obsidian/40">&mdash;</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    {/* Play / Download */}
                                                    {call.has_recording ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); fetchCallDetail(call.id); }}
                                                            className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                                            title="Play recording"
                                                        >
                                                            <Play className="w-4 h-4 text-surgical-600" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-obsidian/40 px-2">&mdash;</span>
                                                    )}
                                                    {/* SMS */}
                                                    {call.phone_number ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSmsCallId(call.id);
                                                                setShowSmsModal(true);
                                                            }}
                                                            className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                                            title="Send follow-up SMS"
                                                        >
                                                            <Mail className="w-4 h-4 text-surgical-600" />
                                                        </button>
                                                    ) : (
                                                        <button disabled className="p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed" title="No phone number">
                                                            <Mail className="w-4 h-4 text-obsidian/30" />
                                                        </button>
                                                    )}
                                                    {/* Delete */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteCall(call.id); }}
                                                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete call"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-surgical-200 flex items-center justify-between">
                            <div className="text-sm text-obsidian/70">
                                Showing {(currentPage - 1) * callsPerPage + 1} to {Math.min(currentPage * callsPerPage, totalCalls)} of {totalCalls} calls
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Previous
                                </button>
                                <span className="text-sm text-obsidian/70">Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Call Detail Modal */}
            {showDetailModal && selectedCall && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-obsidian">
                                    {selectedCall.caller_name}
                                    {selectedCall.phone_number && selectedCall.caller_name !== selectedCall.phone_number && (
                                        <span className="text-lg text-obsidian/60 font-normal ml-2">
                                            ({selectedCall.phone_number})
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-obsidian/60">
                                    {selectedCall.call_type === 'outbound' ? '📞 Outbound' : '📲 Inbound'} &bull; {formatDateTime(selectedCall.call_date)}
                                </p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-surgical-50 rounded-lg transition-colors">
                                <X className="w-6 h-6 text-obsidian/60" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Call Metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Duration</p>
                                    <p className="text-lg font-bold text-obsidian">{formatDuration(selectedCall.duration_seconds)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Status</p>
                                    <p className="text-lg font-bold text-obsidian capitalize">{selectedCall.status}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Sentiment</p>
                                    <p className="text-lg font-bold text-obsidian capitalize">
                                        {selectedCall.sentiment_label || 'neutral'}
                                        {selectedCall.sentiment_score !== null && selectedCall.sentiment_score !== undefined && (
                                            <span className="text-sm text-obsidian/60 font-normal ml-1">
                                                ({Math.round(selectedCall.sentiment_score * 100)}%)
                                            </span>
                                        )}
                                    </p>
                                    {selectedCall.sentiment_urgency && selectedCall.sentiment_urgency !== 'low' && (
                                        <p className="text-xs text-obsidian/60 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full ${
                                                selectedCall.sentiment_urgency === 'critical' ? 'bg-red-100 text-red-700' :
                                                selectedCall.sentiment_urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {selectedCall.sentiment_urgency} urgency
                                            </span>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Recording</p>
                                    <p className="text-sm text-obsidian">{selectedCall.has_recording ? 'Available' : 'None'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Cost</p>
                                    <p className="text-lg font-bold text-obsidian">
                                        {selectedCall.cost_cents != null && selectedCall.cost_cents > 0
                                            ? `£${(selectedCall.cost_cents / 100).toFixed(2)}`
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Appointment ID</p>
                                    <p className="text-sm font-bold text-obsidian truncate">{selectedCall.appointment_id || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-obsidian/60 font-medium uppercase">Tools Used</p>
                                    <p className="text-sm text-obsidian">
                                        {selectedCall.tools_used && selectedCall.tools_used.length > 0
                                            ? selectedCall.tools_used.join(', ')
                                            : '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Outcome Summary (Vapi Primary Source) */}
                            {selectedCall.outcome_summary && (
                                <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-2">📋 Outcome Summary</p>
                                    <p className="text-sm text-obsidian/70 leading-relaxed">{selectedCall.outcome_summary}</p>
                                </div>
                            )}

                            {/* Sentiment Analysis (if different from outcome) */}
                            {selectedCall.sentiment_summary && selectedCall.sentiment_summary !== selectedCall.outcome_summary && (
                                <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-2">💭 Sentiment Analysis</p>
                                    <p className="text-sm text-obsidian/70 leading-relaxed">{selectedCall.sentiment_summary}</p>
                                </div>
                            )}

                            {/* Recording Player */}
                            {selectedCall.has_recording && selectedCall.recording_status === 'completed' && (
                                <div className="bg-surgical-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-3">Recording</p>
                                    <RecordingPlayer callId={selectedCall.id} recordingUrl={selectedCall.recording_url} />
                                </div>
                            )}

                            {/* Transcript */}
                            {selectedCall.transcript && selectedCall.transcript.length > 0 && (
                                <div className="bg-surgical-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-4">Transcript</p>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {selectedCall.transcript.map((segment, idx) => {
                                            const isAgent = segment.speaker === 'voxanne';
                                            return (
                                                <div key={idx} className={`rounded-lg p-4 border-l-4 ${isAgent ? 'bg-surgical-50 border-surgical-500' : 'bg-white border-obsidian/20'}`}>
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold mb-2 ${isAgent ? 'bg-surgical-100 text-surgical-600' : 'bg-surgical-50 text-obsidian/70'}`}>
                                                        {isAgent ? 'Voxanne (Agent)' : 'Caller'}
                                                    </span>
                                                    <p className="text-sm text-obsidian break-words leading-relaxed">{segment.text}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Action Items */}
                            {selectedCall.action_items && selectedCall.action_items.length > 0 && (
                                <div className="bg-surgical-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-obsidian mb-3">Action Items</p>
                                    <ul className="space-y-2">
                                        {selectedCall.action_items.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-obsidian">
                                                <span className="text-surgical-600 font-bold">&bull;</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-6 border-t border-surgical-200">
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => handleDownloadRecording(selectedCall)}
                                    disabled={!selectedCall.has_recording || selectedCall.recording_status !== 'completed'}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        selectedCall.has_recording && selectedCall.recording_status === 'completed'
                                            ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                            : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'}`}
                                >
                                    <Download className="w-4 h-4" /> Download
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedCall.phone_number) { warning('No phone number available'); return; }
                                        setShowFollowupModal(true);
                                    }}
                                    disabled={!selectedCall.phone_number}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        selectedCall.phone_number
                                            ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                            : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'}`}
                                >
                                    <Mail className="w-4 h-4" /> Follow-up
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end">
                            <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Follow-up Modal */}
            {showFollowupModal && selectedCall && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl">
                        <div className="border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-obsidian">Send Follow-up</h2>
                            <button onClick={() => { setShowFollowupModal(false); setFollowupMessage(''); }} className="p-2 hover:bg-surgical-50 rounded-lg transition-colors">
                                <X className="w-6 h-6 text-obsidian/60" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm font-bold text-obsidian mb-2">Contact</p>
                                <p className="text-obsidian/70">{selectedCall.caller_name}</p>
                                <p className="text-sm text-obsidian/60">{selectedCall.phone_number}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-obsidian mb-2">Follow-up Message</label>
                                <textarea
                                    value={followupMessage}
                                    onChange={(e) => setFollowupMessage(e.target.value)}
                                    placeholder="Enter your follow-up message..."
                                    rows={5}
                                    className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                                />
                            </div>
                            <p className="text-xs text-obsidian/60">SMS will be sent to {selectedCall.phone_number}</p>
                        </div>
                        <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end gap-3">
                            <button onClick={() => { setShowFollowupModal(false); setFollowupMessage(''); }} className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSendFollowup}
                                disabled={loadingAction === 'followup'}
                                className="px-4 py-2 rounded-lg bg-surgical-600 hover:bg-surgical-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                {loadingAction === 'followup' ? (
                                    <><Loader className="w-4 h-4 animate-spin" /> Sending...</>
                                ) : (
                                    <><Mail className="w-4 h-4" /> Send Follow-up</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SMS Modal */}
            {showSmsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-lg font-semibold text-obsidian mb-4">Send Follow-Up Message</h3>
                        <textarea
                            value={smsMessage}
                            onChange={(e) => setSmsMessage(e.target.value.slice(0, 160))}
                            placeholder="Enter message (max 160 characters)"
                            className="w-full border border-surgical-200 rounded-lg p-3 mb-2 focus:outline-none focus:ring-2 focus:ring-surgical-500"
                            rows={4}
                            autoFocus
                        />
                        <p className="text-sm text-obsidian/60 mb-4">{smsMessage.length}/160 characters</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowSmsModal(false);
                                    setSmsMessage('');
                                    setSmsCallId(null);
                                }}
                                className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendSms}
                                disabled={!smsMessage.trim() || loadingAction?.startsWith('sms')}
                                className="px-4 py-2 rounded-lg bg-surgical-600 hover:bg-surgical-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                            >
                                {loadingAction?.startsWith('sms') ? 'Sending...' : 'Send SMS'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                isDestructive={confirmDialog.title.includes('Delete')}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />
        </>
    );
};

export default function CallsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                    <p className="text-obsidian/60">Loading...</p>
                </div>
            </div>
        }>
            <CallsPageContent />
        </React.Suspense>
    );
}
