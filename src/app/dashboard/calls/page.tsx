'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, Play, Trash2, X, Volume2, Share2, UserPlus, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { useTranscript } from '@/hooks/useTranscript';
import useSWR, { useSWRConfig } from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

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
    call_type?: 'inbound' | 'outbound';
    recording_status?: 'pending' | 'processing' | 'completed' | 'failed';
    recording_error?: string;
    transfer_to?: string;
    transfer_time?: string;
    transfer_reason?: string;
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
}

const CallsPageContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    // ... rest of state and logic unchanged
    // const [calls, setCalls] = useState<Call[]>([]); // Removed in favor of SWR
    // const [isLoading, setIsLoading] = useState(true); // Removed in favor of SWR
    // const [totalCalls, setTotalCalls] = useState(0); // Removed in favor of SWR
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    // const [analytics, setAnalytics] = useState<any>(null); // Removed in favor of SWR
    const [filterDate, setFilterDate] = useState<string>(''); // 'today', 'week', 'month', or ''
    const [showFollowupModal, setShowFollowupModal] = useState(false);
    const [followupMessage, setFollowupMessage] = useState('');

    // Use transcript hook for live transcript display
    const { segments: liveTranscript, isConnected: wsConnected } = useTranscript(selectedCall?.id || null);

    // Initialize activeTab from query param if present
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab);

    const callsPerPage = 100; // MVP: Show last 100 calls

    useEffect(() => {
        // Temporarily bypass auth for testing - remove in production
        if (!loading && !user) {
            // Allow access without auth for demo purposes
            // router.push('/login');
        }
    }, [user, loading, router]);

    // SWR for Calls List
    const callsQueryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: callsPerPage.toString(),
        call_type: activeTab,
        ...(filterStatus && { status: filterStatus }),
        ...(searchQuery && { search: searchQuery }),
        ...(filterDate && { date_filter: filterDate })
    }).toString();

    const { data: callsData, error: callsError, mutate: mutateCalls, isLoading: isCallsLoading } = useSWR(
        user ? `/api/calls-dashboard?${callsQueryParams}` : null,
        fetcher,
        {
            keepPreviousData: true,
            refreshInterval: 0, // Disable polling, rely on WebSocket
            revalidateOnFocus: false, // Prevent unnecessary reloads
        }
    );

    const calls = (callsData?.calls as Call[]) || [];
    const totalCalls = callsData?.pagination?.total || 0;
    const isLoading = isCallsLoading;

    // SWR for Analytics
    const { data: analyticsData, mutate: mutateAnalytics } = useSWR(
        user ? '/api/calls-dashboard/analytics/summary' : null,
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );
    const analytics = analyticsData;

    // Update error state from SWR
    useEffect(() => {
        if (callsError) {
            setError(callsError.message || 'Failed to load calls');
        }
    }, [callsError]);

    // Auto-refresh calls when new calls arrive via WebSocket
    useEffect(() => {
        // Connect to WebSocket on backend (port 3001)
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
                    // Refresh calls when a new call_ended event arrives
                    if (data.type === 'call_ended' || data.type === 'call_update') {
                        // Refresh the calls list and analytics
                        mutateCalls();
                        mutateAnalytics();
                    }
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (err) {
            console.error('Failed to connect to WebSocket:', err);
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [mutateCalls, mutateAnalytics]);

    const fetchCallDetail = async (callId: string) => {
        try {
            const data = await authedBackendFetch<any>(`/api/calls-dashboard/${callId}`);
            setSelectedCall(data);
            setShowDetailModal(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to load call details');
        }
    };

    const deleteCall = async (callId: string) => {
        if (!confirm('Are you sure you want to delete this call?')) return;

        try {
            await authedBackendFetch(`/api/calls-dashboard/${callId}`, {
                method: 'DELETE',
            });

            // Optimistic update or simple revalidation
            mutateCalls(
                (currentData: any) => ({
                    ...currentData,
                    calls: currentData.calls.filter((c: Call) => c.id !== callId),
                    pagination: {
                        ...currentData.pagination,
                        total: currentData.pagination.total - 1
                    }
                }),
                false // set to false to not revalidate immediately
            );

            // Trigger actual revalidation as well to be safe
            mutateCalls();
            mutateAnalytics();

            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to delete call');
        }
    };

    const handleDownloadRecording = async () => {
        if (!selectedCall?.recording_url) {
            alert('No recording available');
            return;
        }

        try {
            const link = document.createElement('a');
            link.href = selectedCall.recording_url;
            link.download = `call_${selectedCall.id}_${formatDateTime(selectedCall.call_date)}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert('Failed to download recording');
        }
    };

    const handleShareRecording = async () => {
        if (!selectedCall) return;

        try {
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${selectedCall.id}/share`, {
                method: 'POST'
            });

            const shareUrl = response.share_url;
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
                alert('Recording share link copied to clipboard');
            } else {
                alert(`Share URL: ${shareUrl}`);
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to generate share link');
        }
    };

    const handleAddToCRM = async () => {
        if (!selectedCall?.phone_number) {
            alert('No phone number available');
            return;
        }

        try {
            const response = await authedBackendFetch<any>('/api/contacts', {
                method: 'POST',
                body: JSON.stringify({
                    contact_name: selectedCall.caller_name || 'Unknown',
                    phone_number: selectedCall.phone_number,
                    source: 'call_recording',
                    source_call_id: selectedCall.id
                })
            });

            alert('Contact added to CRM successfully');
            // Optionally redirect to contact profile
            router.push(`/dashboard/leads?id=${response.id}`);
        } catch (err: any) {
            alert(err?.message || 'Failed to add contact to CRM');
        }
    };

    const handleSendFollowup = async () => {
        if (!selectedCall || !followupMessage.trim()) {
            alert('Please enter a message');
            return;
        }

        try {
            await authedBackendFetch(`/api/calls-dashboard/${selectedCall.id}/followup`, {
                method: 'POST',
                body: JSON.stringify({
                    message: followupMessage,
                    method: 'sms' // Default to SMS
                })
            });

            alert('Follow-up sent successfully');
            setShowFollowupModal(false);
            setFollowupMessage('');
        } catch (err: any) {
            alert(err?.message || 'Failed to send follow-up');
        }
    };

    const handleExportTranscript = async () => {
        if (!selectedCall) return;

        try {
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${selectedCall.id}/transcript/export?format=pdf`, {
                method: 'POST'
            });

            const link = document.createElement('a');
            link.href = response.export_url;
            link.download = `transcript_${selectedCall.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            alert(err?.message || 'Failed to export transcript');
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSentimentColor = (label?: string) => {
        const normalized = label?.toLowerCase() || '';
        switch (normalized) {
            case 'positive':
            case 'reassured':
                return 'text-green-600 bg-green-50';
            case 'decisive':
                return 'text-blue-600 bg-blue-50';
            case 'anxious':
                return 'text-orange-600 bg-orange-50';
            case 'negative':
            case 'frustrated':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };

    const getUrgencyBadge = (urgency?: string) => {
        switch (urgency) {
            case 'High':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                        🔥 High Urgency
                    </span>
                );
            case 'Medium':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                        ⚡ Medium
                    </span>
                );
            default:
                return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-50 text-green-700 border-green-200';
            case 'missed': return 'bg-red-50 text-red-700 border-red-200';
            case 'transferred': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'failed': return 'bg-orange-50 text-orange-700 border-orange-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const getRecordingStatusBadge = (recordingStatus?: string, recordingError?: string) => {
        const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium';

        switch (recordingStatus) {
            case 'processing':
                return (
                    <div className={`${baseClasses} bg-blue-50 text-blue-700 border border-blue-200`} title="Recording is being uploaded...">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        Processing
                    </div>
                );
            case 'completed':
                return (
                    <div className={`${baseClasses} bg-green-50 text-green-700 border border-green-200`} title="Recording is ready">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                    </div>
                );
            case 'failed':
                return (
                    <div className={`${baseClasses} bg-red-50 text-red-700 border border-red-200`} title={recordingError || 'Recording upload failed'}>
                        <XCircle className="w-3 h-3" />
                        Failed
                    </div>
                );
            case 'pending':
                return (
                    <div className={`${baseClasses} bg-yellow-50 text-yellow-700 border border-yellow-200`} title="Recording queued for upload">
                        <AlertCircle className="w-3 h-3" />
                        Queued
                    </div>
                );
            default:
                return null;
        }
    };

    const totalPages = Math.ceil(totalCalls / callsPerPage);

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

    return (
        <>
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-slate-50 mb-2">Call Recordings</h1>
                            <p className="text-gray-600 dark:text-slate-400">View and analyze all call activity with transcripts and sentiment analysis</p>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Analytics Summary */}
                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow">
                            <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{analytics.total_calls}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Total Calls</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.completed_calls}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Completed</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow">
                            <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{analytics.average_duration}s</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Avg Duration</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(analytics.average_sentiment * 100).toFixed(0)}%</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 font-medium">Avg Sentiment</p>
                        </div>
                    </div>
                )}

                {/* Call Type Tabs */}
                <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-slate-800">
                    <button
                        onClick={() => {
                            setActiveTab('inbound');
                            setCurrentPage(1);
                        }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'inbound'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                    >
                        📥 Inbound Calls
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('outbound');
                            setCurrentPage(1);
                        }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'outbound'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                    >
                        📤 Outbound Calls
                    </button>
                </div>

                {/* Filters */}
                <div className="mb-6 flex gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Search by caller name or phone..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="missed">Missed</option>
                        <option value="transferred">Transferred</option>
                        <option value="failed">Failed</option>
                    </select>
                    <select
                        value={filterDate}
                        onChange={(e) => {
                            setFilterDate(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>

                {/* Calls Table */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Date & Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Caller</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Duration</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Sentiment</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-slate-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                                                <p className="text-gray-600 dark:text-slate-400">Loading calls...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : calls.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <p className="text-gray-600 dark:text-slate-400">No calls found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    calls.map((call) => (
                                        <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => fetchCallDetail(call.id)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-slate-200 font-medium">
                                                    <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                                    {formatDateTime(call.call_date)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-slate-200">{call.caller_name}</div>
                                                <div className="text-xs text-gray-500 dark:text-slate-400">{call.phone_number}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-slate-200 font-medium">
                                                    <Clock className="w-4 h-4 text-gray-400 dark:text-slate-500" />
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
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(call.sentiment_label)}`}>
                                                            {call.sentiment_label.charAt(0).toUpperCase() + call.sentiment_label.slice(1)}
                                                            {call.sentiment_score && ` (${(call.sentiment_score * 100).toFixed(0)}%)`}
                                                        </span>
                                                        {getUrgencyBadge(call.sentiment_urgency)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {call.has_recording ? (
                                                        <>
                                                            {getRecordingStatusBadge(call.recording_status, call.recording_error)}
                                                            {call.recording_status === 'completed' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        fetchCallDetail(call.id);
                                                                    }}
                                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Play recording"
                                                                >
                                                                    <Volume2 className="w-4 h-4 text-blue-600" />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">No recording</span>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteCall(call.id);
                                                        }}
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
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                                Showing {(currentPage - 1) * callsPerPage + 1} to {Math.min(currentPage * callsPerPage, totalCalls)} of {totalCalls} calls
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
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
                                                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Call Detail Modal */}
            {
                showDetailModal && selectedCall && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl dark:shadow-2xl">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-50">{selectedCall.caller_name}</h2>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedCall.phone_number} • {formatDateTime(selectedCall.call_date)}</p>
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
                                {/* Call Metadata */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase">Duration</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-slate-50">{formatDuration(selectedCall.duration_seconds)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase">Status</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-slate-50 capitalize">{selectedCall.status}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase">Sentiment</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-slate-50 capitalize">
                                            {selectedCall.sentiment_label || 'N/A'}
                                        </p>
                                        {getUrgencyBadge(selectedCall.sentiment_urgency)}
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase">Recording</p>
                                        {selectedCall.has_recording ? (
                                            getRecordingStatusBadge(selectedCall.recording_status, selectedCall.recording_error)
                                        ) : (
                                            <span className="text-sm text-gray-500 dark:text-slate-500">None</span>
                                        )}
                                    </div>
                                </div>

                                {/* Clinical Summary */}
                                {selectedCall.sentiment_summary && (
                                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🩺</span>
                                            <p className="text-sm font-bold text-purple-900 dark:text-purple-400">Clinical Summary</p>
                                        </div>
                                        <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                                            {selectedCall.sentiment_summary}
                                        </p>
                                    </div>
                                )}

                                {/* Transfer Details (if transferred) */}
                                {selectedCall.status === 'transferred' && selectedCall.transfer_to && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-3">Transfer Details</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600 dark:text-slate-400">Transferred to:</span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-slate-50">{selectedCall.transfer_to}</span>
                                            </div>
                                            {selectedCall.transfer_time && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600 dark:text-slate-400">Transfer time:</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-slate-50">
                                                        {new Date(selectedCall.transfer_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedCall.transfer_reason && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600 dark:text-slate-400">Reason:</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-slate-50 capitalize">{selectedCall.transfer_reason}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Recording Player */}
                                {selectedCall.has_recording && selectedCall.recording_status === 'completed' && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Recording</p>
                                        <RecordingPlayer
                                            callId={selectedCall.id}
                                            recordingUrl={selectedCall.recording_url}
                                        />
                                    </div>
                                )}

                                {/* Recording Status Messages */}
                                {selectedCall.has_recording && selectedCall.recording_status !== 'completed' && (
                                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-2">
                                            {selectedCall.recording_status === 'processing' && '⏳ Recording is being uploaded...'}
                                            {selectedCall.recording_status === 'pending' && '📋 Recording is queued for upload'}
                                            {selectedCall.recording_status === 'failed' && '❌ Recording upload failed'}
                                        </p>
                                        {selectedCall.recording_error && (
                                            <p className="text-xs text-blue-700 dark:text-blue-300">{selectedCall.recording_error}</p>
                                        )}
                                    </div>
                                )}

                                {/* Transcript */}
                                {(liveTranscript.length > 0 || (selectedCall.transcript && selectedCall.transcript.length > 0)) && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm font-bold text-gray-900 dark:text-slate-50">Transcript</p>
                                            {wsConnected && <span className="text-xs text-green-600 dark:text-green-400 font-medium">🟢 Live</span>}
                                        </div>
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {/* Show live transcript if available, otherwise show saved transcript */}
                                            {(liveTranscript.length > 0 ? liveTranscript : selectedCall.transcript || []).map((segment, idx) => {
                                                const isAgent = segment.speaker === 'agent' || segment.speaker === 'voxanne';
                                                const isCaller = segment.speaker === 'customer' || segment.speaker === 'caller';
                                                const timestamp = segment.timestamp ? new Date(segment.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`rounded-lg p-4 border-l-4 ${isAgent
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400'
                                                            : 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold ${isAgent
                                                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                                                : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                                                }`}>
                                                                {isAgent ? '🤖' : '👤'}
                                                                {isAgent ? 'Voxanne (Agent)' : 'Caller'}
                                                            </span>
                                                            {timestamp && (
                                                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                                                    {timestamp}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-900 dark:text-slate-200 break-words leading-relaxed">{segment.text}</p>
                                                        <div className="flex flex-wrap gap-3 mt-2">
                                                            {(segment as any).sentiment && (
                                                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                                                    📊 Sentiment: {(segment as any).sentiment}
                                                                </span>
                                                            )}
                                                            {(segment as any).confidence && (
                                                                <span className={`text-xs ${((segment as any).confidence as number) >= 0.9
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : ((segment as any).confidence as number) >= 0.7
                                                                        ? 'text-yellow-600 dark:text-yellow-400'
                                                                        : 'text-orange-600 dark:text-orange-400'
                                                                    }`}>
                                                                    Confidence: {(((segment as any).confidence as number) * 100).toFixed(0)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Action Items */}
                                {selectedCall.action_items && selectedCall.action_items.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-3">Action Items</p>
                                        <ul className="space-y-2">
                                            {selectedCall.action_items.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-900 dark:text-slate-200">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            {selectedCall.has_recording && selectedCall.recording_status === 'completed' && (
                                <div className="px-6 py-6 border-t border-gray-200 dark:border-slate-800">
                                    <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-4">Recording Actions</p>
                                    <div className="flex flex-wrap gap-3">
                                        {/* Download Recording */}
                                        <button
                                            onClick={handleDownloadRecording}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors text-sm font-medium"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </button>

                                        {/* Share Recording */}
                                        <button
                                            onClick={handleShareRecording}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition-colors text-sm font-medium"
                                        >
                                            <Share2 className="w-4 h-4" />
                                            Share
                                        </button>

                                        {/* Add to CRM */}
                                        <button
                                            onClick={handleAddToCRM}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors text-sm font-medium"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Add to CRM
                                        </button>

                                        {/* Send Follow-up */}
                                        <button
                                            onClick={() => setShowFollowupModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors text-sm font-medium"
                                        >
                                            <Mail className="w-4 h-4" />
                                            Follow-up
                                        </button>

                                        {/* Export Transcript */}
                                        <button
                                            onClick={handleExportTranscript}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                                        >
                                            <Download className="w-4 h-4" />
                                            Export
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
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

            {/* Follow-up Modal */}
            {
                showFollowupModal && selectedCall && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-xl dark:shadow-2xl">
                            {/* Modal Header */}
                            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-50">Send Follow-up</h2>
                                <button
                                    onClick={() => {
                                        setShowFollowupModal(false);
                                        setFollowupMessage('');
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-600 dark:text-slate-400" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-slate-50 mb-2">Contact</p>
                                    <p className="text-gray-700 dark:text-slate-300">{selectedCall.caller_name}</p>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedCall.phone_number}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-900 dark:text-slate-50 mb-2">
                                        Follow-up Message
                                    </label>
                                    <textarea
                                        value={followupMessage}
                                        onChange={(e) => setFollowupMessage(e.target.value)}
                                        placeholder="Enter your follow-up message..."
                                        rows={5}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <p className="text-xs text-gray-600 dark:text-slate-400">
                                    The follow-up will be sent via SMS to {selectedCall.phone_number}
                                </p>
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowFollowupModal(false);
                                        setFollowupMessage('');
                                    }}
                                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendFollowup}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Mail className="w-4 h-4" />
                                    Send Follow-up
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default function CallsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <CallsPageContent />
        </React.Suspense>
    );
}
