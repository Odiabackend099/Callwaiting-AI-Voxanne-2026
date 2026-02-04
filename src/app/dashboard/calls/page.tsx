'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, Play, Pause, Trash2, X, Volume2, Share2, UserPlus, Mail, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { AudioPlayerModal } from '@/components/AudioPlayerModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTranscript } from '@/hooks/useTranscript';
import { useToast } from '@/hooks/useToast';
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { useDashboardWebSocket } from '@/contexts/DashboardWebSocketContext';
import { useAudioPlayerStore } from '@/store/audioPlayerStore';

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
    const { success, error: showError, info, warning } = useToast();
    const audioPlayerStore = useAudioPlayerStore();
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

    // Audio player modal state
    const [playerModalOpen, setPlayerModalOpen] = useState(false);
    const [selectedCallForPlayer, setSelectedCallForPlayer] = useState<Call | null>(null);

    // Loading states for action buttons
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

    // Use transcript hook for live transcript display
    const { segments: liveTranscript, isConnected: wsConnected } = useTranscript(selectedCall?.id || null);

    // Initialize activeTab from query param if present
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab);

    const callsPerPage = 100; // MVP: Show last 100 calls

    useEffect(() => {
        // Enforce authentication - redirect to login if not authenticated
        // Allow test mode to bypass auth by checking for ?_test=1 parameter
        const isTestMode = searchParams.get('_test') === '1' ||
                          (typeof window !== 'undefined' && window.location.search.includes('_test=1'));

        if (!loading && !user && !isTestMode) {
            router.push('/login');
        }
    }, [user, loading, router, searchParams]);

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
            revalidateOnMount: true,
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
            revalidateOnMount: true,
        }
    );
    const analytics = analyticsData;

    // Update error state from SWR
    useEffect(() => {
        if (callsError) {
            setError(callsError.message || 'Failed to load calls');
        }
    }, [callsError]);

    // Real-time updates via shared WebSocket context
    const { subscribe } = useDashboardWebSocket();
    useEffect(() => {
        const unsub1 = subscribe('call_ended', () => {
            mutateCalls();
            mutateAnalytics();
        });
        const unsub2 = subscribe('call_update', () => {
            mutateCalls();
            mutateAnalytics();
        });
        return () => { unsub1(); unsub2(); };
    }, [subscribe, mutateCalls, mutateAnalytics]);

    // Keyboard shortcuts for power users
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            // Modal-specific shortcuts
            if (showDetailModal && selectedCall) {
                switch (e.key.toLowerCase()) {
                    case 'escape':
                        e.preventDefault();
                        setShowDetailModal(false);
                        break;
                    case 'd':
                        if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            if (selectedCall.recording_status === 'completed') {
                                handleDownloadRecording();
                            }
                        }
                        break;
                    case 's':
                        if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            if (selectedCall.recording_status === 'completed') {
                                handleShareRecording();
                            }
                        }
                        break;
                    case 'e':
                        if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            if (selectedCall.has_transcript) {
                                handleExportTranscript();
                            }
                        }
                        break;
                    case 'm':
                        if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            setShowFollowupModal(true);
                        }
                        break;
                }
            }

            // Follow-up modal shortcuts
            if (showFollowupModal && selectedCall) {
                switch (e.key.toLowerCase()) {
                    case 'escape':
                        e.preventDefault();
                        setShowFollowupModal(false);
                        setFollowupMessage('');
                        break;
                    case 'enter':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleSendFollowup();
                        }
                        break;
                }
            }

            // Confirmation dialog shortcuts
            if (confirmDialog.isOpen) {
                switch (e.key.toLowerCase()) {
                    case 'escape':
                        e.preventDefault();
                        setConfirmDialog({ ...confirmDialog, isOpen: false });
                        break;
                    case 'enter':
                        e.preventDefault();
                        confirmDialog.onConfirm();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDetailModal, showFollowupModal, confirmDialog, selectedCall]);

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

    const handlePlayRecordingFromList = async (call: Call) => {
        // Stop any currently playing audio
        audioPlayerStore.stop();

        // Open modal with call data
        setSelectedCallForPlayer(call);
        setPlayerModalOpen(true);
    };

    const handleDownloadRecordingFromList = async (call: Call) => {
        try {
            setError(null);

            // Fetch signed URL from dedicated endpoint
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${call.id}/recording-url`);

            if (!response.recording_url) {
                setError('No recording available for this call');
                return;
            }

            const link = document.createElement('a');
            link.href = response.recording_url;
            link.download = `call_${call.id}_${formatDateTime(call.call_date)}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            setError('Failed to download recording: ' + (err.message || 'Unknown error'));
        }
    };

    const handleDownloadRecording = async () => {
        if (!selectedCall?.recording_url) {
            warning('No recording available');
            return;
        }

        try {
            setLoadingAction('download');
            const link = document.createElement('a');
            link.href = selectedCall.recording_url;
            link.download = `call_${selectedCall.id}_${formatDateTime(selectedCall.call_date)}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            success('Recording downloaded successfully');
        } catch (err) {
            showError('Failed to download recording');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleShareRecording = async () => {
        if (!selectedCall) return;

        try {
            setLoadingAction('share');
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${selectedCall.id}/share`, {
                method: 'POST'
            });

            const shareUrl = response.share_url;
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
                success('Recording share link copied to clipboard');
            } else {
                info(`Share URL: ${shareUrl}`);
            }
        } catch (err: any) {
            showError(err?.message || 'Failed to generate share link');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAddToCRM = async () => {
        if (!selectedCall?.phone_number) {
            warning('No phone number available');
            return;
        }

        try {
            setLoadingAction('crm');
            const response = await authedBackendFetch<any>('/api/contacts', {
                method: 'POST',
                body: JSON.stringify({
                    contact_name: selectedCall.caller_name || 'Unknown',
                    phone_number: selectedCall.phone_number,
                    source: 'call_recording',
                    source_call_id: selectedCall.id
                })
            });

            success('Contact added to CRM successfully');
            // Optionally redirect to contact profile
            router.push(`/dashboard/leads?id=${response.id}`);
        } catch (err: any) {
            showError(err?.message || 'Failed to add contact to CRM');
        } finally {
            setLoadingAction(null);
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
                body: JSON.stringify({
                    message: followupMessage,
                    method: 'sms' // Default to SMS
                })
            });

            success('Follow-up SMS sent successfully');
            setShowFollowupModal(false);
            setFollowupMessage('');
        } catch (err: any) {
            showError(err?.message || 'Failed to send follow-up');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleExportTranscript = async () => {
        if (!selectedCall) return;

        try {
            setLoadingAction('export');
            const response = await authedBackendFetch<any>(`/api/calls-dashboard/${selectedCall.id}/transcript/export?format=pdf`, {
                method: 'POST'
            });

            const link = document.createElement('a');
            link.href = response.export_url;
            link.download = `transcript_${selectedCall.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            success('Transcript exported successfully');
        } catch (err: any) {
            showError(err?.message || 'Failed to export transcript');
        } finally {
            setLoadingAction(null);
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
                return 'text-surgical-600 bg-surgical-50';
            case 'decisive':
                return 'text-surgical-600 bg-surgical-50';
            case 'anxious':
                return 'text-obsidian/70 bg-surgical-50';
            case 'negative':
            case 'frustrated':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-obsidian/60 bg-surgical-50';
        }
    };

    const getUrgencyBadge = (urgency?: string) => {
        switch (urgency) {
            case 'High':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        High Urgency
                    </span>
                );
            case 'Medium':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-surgical-50 text-obsidian/70 border border-surgical-200">
                        Medium
                    </span>
                );
            default:
                return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-surgical-50 text-surgical-600 border-surgical-200';
            case 'missed': return 'bg-red-50 text-red-700 border-red-200';
            case 'transferred': return 'bg-surgical-50 text-surgical-500 border-surgical-200';
            case 'failed': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-surgical-50 text-obsidian/60 border-surgical-200';
        }
    };

    const getRecordingStatusBadge = (recordingStatus?: string, recordingError?: string) => {
        const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium';

        switch (recordingStatus) {
            case 'processing':
                return (
                    <div className={`${baseClasses} bg-surgical-50 text-surgical-600 border border-surgical-200`} title="Recording is being uploaded...">
                        <div className="w-2 h-2 bg-surgical-600 rounded-full animate-pulse"></div>
                        Processing
                    </div>
                );
            case 'completed':
                return (
                    <div className={`${baseClasses} bg-surgical-50 text-surgical-600 border border-surgical-200`} title="Recording is ready">
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
                    <div className={`${baseClasses} bg-surgical-50 text-obsidian/70 border border-surgical-200`} title="Recording queued for upload">
                        <AlertCircle className="w-3 h-3" />
                        Queued
                    </div>
                );
            default:
                return null;
        }
    };

    const totalPages = Math.ceil(totalCalls / callsPerPage);

    if (!user && !loading) return null;

    return (
        <>
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-obsidian mb-2">Call Recordings</h1>
                            <p className="text-obsidian/60">View and analyze all call activity with transcripts and sentiment analysis</p>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
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

                {/* Call Type Tabs */}
                <div className="mb-6 flex gap-2 border-b border-surgical-200">
                    <button
                        onClick={() => {
                            setActiveTab('inbound');
                            setCurrentPage(1);
                        }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'inbound'
                            ? 'border-surgical-600 text-surgical-600'
                            : 'border-transparent text-obsidian/60 hover:text-obsidian'
                            }`}
                    >
                        Inbound Calls
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('outbound');
                            setCurrentPage(1);
                        }}
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'outbound'
                            ? 'border-surgical-600 text-surgical-600'
                            : 'border-transparent text-obsidian/60 hover:text-obsidian'
                            }`}
                    >
                        Outbound Calls
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
                        className="flex-1 min-w-64 px-4 py-2 border border-surgical-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-surgical-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-surgical-500"
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
                        className="px-4 py-2 border border-surgical-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    >
                        <option value="">All Time</option>
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
                                            className="hover:bg-surgical-50 transition-colors cursor-pointer focus:outline-none focus:bg-surgical-50"
                                            onClick={() => fetchCallDetail(call.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    fetchCallDetail(call.id);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`View details for call from ${call.caller_name}`}
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
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(call.sentiment_label)}`}>
                                                            {call.sentiment_label.charAt(0).toUpperCase() + call.sentiment_label.slice(1)}
                                                            {call.sentiment_score && ` (${(call.sentiment_score * 100).toFixed(0)}%)`}
                                                        </span>
                                                        {getUrgencyBadge(call.sentiment_urgency)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {call.outcome_summary || call.sentiment_summary ? (
                                                    <div className="max-w-xs">
                                                        <p className="text-xs text-obsidian/70 line-clamp-2 leading-relaxed">
                                                            {call.outcome_summary || call.sentiment_summary}
                                                        </p>
                                                        {call.sentiment_urgency && (
                                                            <span className={`text-xs font-medium inline-block mt-1 ${call.sentiment_urgency === 'High' || call.sentiment_urgency === 'high' ? 'text-red-600' :
                                                                call.sentiment_urgency === 'Medium' || call.sentiment_urgency === 'medium' ? 'text-obsidian/70' :
                                                                    'text-surgical-600'
                                                                }`}>
                                                                {call.sentiment_urgency.charAt(0).toUpperCase() + call.sentiment_urgency.slice(1)} urgency
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-obsidian/40">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    {call.has_recording ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePlayRecordingFromList(call);
                                                                }}
                                                                className={`p-2 hover:bg-surgical-50 rounded-lg transition-colors ${
                                                                    audioPlayerStore.currentCallId === call.id ? 'bg-surgical-100 ring-2 ring-surgical-600' : ''
                                                                }`}
                                                                title="Play recording"
                                                                aria-label="Play recording"
                                                            >
                                                                {audioPlayerStore.currentCallId === call.id && audioPlayerStore.isPlaying ? (
                                                                    <Pause className="w-4 h-4 text-surgical-600" />
                                                                ) : (
                                                                    <Play className="w-4 h-4 text-surgical-600" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (call.recording_status === 'completed') {
                                                                        handleDownloadRecordingFromList(call);
                                                                    } else {
                                                                        warning(`Recording is ${call.recording_status}, please wait`);
                                                                    }
                                                                }}
                                                                disabled={call.recording_status !== 'completed'}
                                                                className="p-2 hover:bg-surgical-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                title={call.recording_status === 'completed' ? 'Download recording' : `Recording is ${call.recording_status}`}
                                                                aria-label="Download recording"
                                                            >
                                                                <Download className="w-4 h-4 text-surgical-600" />
                                                            </button>
                                                        </>
                                                    ) : call.recording_status === 'processing' ? (
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-3 h-3 border-2 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                                                            <span className="text-xs text-surgical-600 font-medium">Processing</span>
                                                        </div>
                                                    ) : call.recording_status === 'pending' ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-obsidian/70 font-medium">Queued</span>
                                                        </div>
                                                    ) : call.recording_status === 'failed' ? (
                                                        <div className="flex items-center gap-1">
                                                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                                            <span className="text-xs text-red-600 font-medium cursor-help" title={call.recording_error || 'Recording failed to upload'}>Failed</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-obsidian/40">—</span>
                                                    )}
                                                    {call.phone_number ? (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const message = prompt('Enter follow-up message (max 160 chars):');
                                                                if (!message) return;
                                                                if (message.length > 160) {
                                                                    warning('Message too long (max 160 characters)');
                                                                    return;
                                                                }
                                                                try {
                                                                    setLoadingAction(`sms-${call.id}`);
                                                                    await authedBackendFetch(`/api/calls-dashboard/${call.id}/followup`, {
                                                                        method: 'POST',
                                                                        body: JSON.stringify({ message })
                                                                    });
                                                                    success('Follow-up SMS sent successfully');
                                                                } catch (err: any) {
                                                                    showError(err?.message || 'Failed to send SMS');
                                                                } finally {
                                                                    setLoadingAction(null);
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                                            title="Send follow-up SMS"
                                                            aria-label="Send follow-up SMS message"
                                                        >
                                                            <Mail className="w-4 h-4 text-surgical-600" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                            title="No phone number available for this contact"
                                                            aria-label="Send SMS (no phone number)"
                                                        >
                                                            <Mail className="w-4 h-4 text-obsidian/30" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteCall(call.id);
                                                        }}
                                                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete call"
                                                        aria-label="Delete this call"
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
                                    aria-label="Go to previous page"
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
                                                aria-label={`Go to page ${pageNum}`}
                                                aria-current={currentPage === pageNum ? 'page' : undefined}
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
                                    aria-label="Go to next page"
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
                        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-obsidian">{selectedCall.caller_name}</h2>
                                    <p className="text-sm text-obsidian/60">{selectedCall.phone_number} • {formatDateTime(selectedCall.call_date)}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                    aria-label="Close call details modal"
                                >
                                    <X className="w-6 h-6 text-obsidian/60" />
                                </button>
                            </div>

                            {/* Modal Content */}
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
                                            {selectedCall.sentiment_label || 'N/A'}
                                        </p>
                                        {getUrgencyBadge(selectedCall.sentiment_urgency)}
                                    </div>
                                    <div>
                                        <p className="text-xs text-obsidian/60 font-medium uppercase">Recording</p>
                                        {selectedCall.has_recording ? (
                                            getRecordingStatusBadge(selectedCall.recording_status, selectedCall.recording_error)
                                        ) : (
                                            <span className="text-sm text-obsidian/60">None</span>
                                        )}
                                    </div>
                                </div>

                                {/* Clinical Summary */}
                                {selectedCall.sentiment_summary && (
                                    <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="text-sm font-bold text-obsidian">Clinical Summary</p>
                                        </div>
                                        <p className="text-sm text-obsidian/70 leading-relaxed">
                                            {selectedCall.sentiment_summary}
                                        </p>
                                    </div>
                                )}

                                {/* Transfer Details (if transferred) */}
                                {selectedCall.status === 'transferred' && selectedCall.transfer_to && (
                                    <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Transfer Details</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-obsidian/60">Transferred to:</span>
                                                <span className="text-sm font-medium text-obsidian">{selectedCall.transfer_to}</span>
                                            </div>
                                            {selectedCall.transfer_time && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-obsidian/60">Transfer time:</span>
                                                    <span className="text-sm font-medium text-obsidian">
                                                        {new Date(selectedCall.transfer_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedCall.transfer_reason && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-obsidian/60">Reason:</span>
                                                    <span className="text-sm font-medium text-obsidian capitalize">{selectedCall.transfer_reason}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Recording Player */}
                                {selectedCall.has_recording && selectedCall.recording_status === 'completed' && (
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Recording</p>
                                        <RecordingPlayer
                                            callId={selectedCall.id}
                                            recordingUrl={selectedCall.recording_url}
                                        />
                                    </div>
                                )}

                                {/* Recording Status Messages */}
                                {selectedCall.has_recording && selectedCall.recording_status !== 'completed' && (
                                    <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-2">
                                            {selectedCall.recording_status === 'processing' && 'Recording is being uploaded...'}
                                            {selectedCall.recording_status === 'pending' && 'Recording is queued for upload'}
                                            {selectedCall.recording_status === 'failed' && 'Recording upload failed'}
                                        </p>
                                        {selectedCall.recording_error && (
                                            <p className="text-xs text-obsidian/60">{selectedCall.recording_error}</p>
                                        )}
                                    </div>
                                )}

                                {/* Transcript */}
                                {(liveTranscript.length > 0 || (selectedCall.transcript && selectedCall.transcript.length > 0)) && (
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm font-bold text-obsidian">Transcript</p>
                                            {wsConnected && <span className="text-xs text-surgical-600 font-medium">Live</span>}
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
                                                            ? 'bg-surgical-50 border-surgical-500'
                                                            : 'bg-white border-obsidian/20'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold ${isAgent
                                                                ? 'bg-surgical-100 text-surgical-600'
                                                                : 'bg-surgical-50 text-obsidian/70'
                                                                }`}>
                                                                {isAgent ? 'Voxanne (Agent)' : 'Caller'}
                                                            </span>
                                                            {timestamp && (
                                                                <span className="text-xs text-obsidian/60">
                                                                    {timestamp}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-obsidian break-words leading-relaxed">{segment.text}</p>
                                                        <div className="flex flex-wrap gap-3 mt-2">
                                                            {(segment as any).sentiment && (
                                                                <span className="text-xs text-obsidian/60">
                                                                    Sentiment: {(segment as any).sentiment}
                                                                </span>
                                                            )}
                                                            {(segment as any).confidence && (
                                                                <span className={`text-xs ${((segment as any).confidence as number) >= 0.9
                                                                    ? 'text-surgical-600'
                                                                    : ((segment as any).confidence as number) >= 0.7
                                                                        ? 'text-obsidian/70'
                                                                        : 'text-obsidian/50'
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
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Action Items</p>
                                        <ul className="space-y-2">
                                            {selectedCall.action_items.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-obsidian">
                                                    <span className="text-surgical-600 font-bold">•</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="px-6 py-6 border-t border-surgical-200">
                                <p className="text-sm font-bold text-obsidian mb-4">Actions</p>
                                <div className="flex flex-wrap gap-3">
                                    {/* Download Recording */}
                                    <button
                                        onClick={handleDownloadRecording}
                                        disabled={!selectedCall.has_recording || selectedCall.recording_status !== 'completed'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${selectedCall.has_recording && selectedCall.recording_status === 'completed'
                                                ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                                : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'
                                            }`}
                                        title={!selectedCall.has_recording ? 'No recording available' : selectedCall.recording_status === 'completed' ? 'Download recording' : `Recording is ${selectedCall.recording_status}`}
                                        aria-label="Download recording file"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>

                                    {/* Share Recording */}
                                    <button
                                        onClick={handleShareRecording}
                                        disabled={!selectedCall.has_recording || selectedCall.recording_status !== 'completed'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${selectedCall.has_recording && selectedCall.recording_status === 'completed'
                                                ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                                : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'
                                            }`}
                                        title={!selectedCall.has_recording ? 'No recording available' : selectedCall.recording_status === 'completed' ? 'Share recording' : `Recording is ${selectedCall.recording_status}`}
                                        aria-label="Share recording with others"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Share
                                    </button>

                                    {/* Add to CRM */}
                                    <button
                                        onClick={handleAddToCRM}
                                        className="flex items-center gap-2 px-4 py-2 bg-surgical-50 text-surgical-600 rounded-lg hover:bg-surgical-100 border border-surgical-200 transition-colors text-sm font-medium"
                                        aria-label="Add this caller to CRM"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Add to CRM
                                    </button>

                                    {/* Send Follow-up */}
                                    <button
                                        onClick={() => {
                                            if (!selectedCall.phone_number) {
                                                warning('No phone number available for this contact');
                                                return;
                                            }
                                            setShowFollowupModal(true);
                                        }}
                                        disabled={!selectedCall.phone_number}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${selectedCall.phone_number
                                                ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                                : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'
                                            }`}
                                        title={selectedCall.phone_number ? 'Send follow-up message' : 'No phone number available'}
                                        aria-label="Send follow-up message"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Follow-up
                                    </button>

                                    {/* Export Transcript */}
                                    <button
                                        onClick={handleExportTranscript}
                                        disabled={!selectedCall.has_transcript}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${selectedCall.has_transcript
                                                ? 'bg-surgical-50 text-surgical-600 hover:bg-surgical-100 border border-surgical-200'
                                                : 'bg-surgical-50 text-obsidian/30 cursor-not-allowed opacity-60'
                                            }`}
                                        title={selectedCall.has_transcript ? 'Export transcript to file' : 'No transcript available for this call'}
                                        aria-label="Export transcript to file"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                                    aria-label="Close call details"
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
                        <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl">
                            {/* Modal Header */}
                            <div className="bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-obsidian">Send Follow-up</h2>
                                <button
                                    onClick={() => {
                                        setShowFollowupModal(false);
                                        setFollowupMessage('');
                                    }}
                                    className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                    aria-label="Close follow-up modal"
                                >
                                    <X className="w-6 h-6 text-obsidian/60" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <p className="text-sm font-bold text-obsidian mb-2">Contact</p>
                                    <p className="text-obsidian/70">{selectedCall.caller_name}</p>
                                    <p className="text-sm text-obsidian/60">{selectedCall.phone_number}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-obsidian mb-2">
                                        Follow-up Message
                                    </label>
                                    <textarea
                                        value={followupMessage}
                                        onChange={(e) => setFollowupMessage(e.target.value)}
                                        placeholder="Enter your follow-up message..."
                                        rows={5}
                                        className="w-full px-4 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                                    />
                                </div>

                                <p className="text-xs text-obsidian/60">
                                    The follow-up will be sent via SMS to {selectedCall.phone_number}
                                </p>
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowFollowupModal(false);
                                        setFollowupMessage('');
                                    }}
                                    className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/70 hover:bg-surgical-50 transition-colors"
                                    aria-label="Cancel sending follow-up"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendFollowup}
                                    disabled={loadingAction === 'followup'}
                                    className="px-4 py-2 rounded-lg bg-surgical-600 hover:bg-surgical-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
                                    aria-label="Send follow-up message"
                                >
                                    {loadingAction === 'followup' ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4" />
                                            Send Follow-up
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Audio Player Modal */}
            {playerModalOpen && selectedCallForPlayer && (
                <AudioPlayerModal
                    call={{
                        id: selectedCallForPlayer.id,
                        caller_name: selectedCallForPlayer.caller_name,
                        phone_number: selectedCallForPlayer.phone_number,
                        duration_seconds: selectedCallForPlayer.duration_seconds,
                        created_at: selectedCallForPlayer.call_date
                    }}
                    onClose={() => {
                        setPlayerModalOpen(false);
                        audioPlayerStore.stop();
                    }}
                />
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
