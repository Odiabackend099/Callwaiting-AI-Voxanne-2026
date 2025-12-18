'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, Play, Trash2, X, Volume2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { useTranscript } from '@/hooks/useTranscript';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

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
    call_type?: 'inbound' | 'outbound';
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
    const [calls, setCalls] = useState<Call[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCalls, setTotalCalls] = useState(0);
    const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    const [filterDate, setFilterDate] = useState<string>(''); // 'today', 'week', 'month', or ''
    
    // Use transcript hook for live transcript display
    const { segments: liveTranscript, isConnected: wsConnected } = useTranscript(selectedCall?.id || null);

    // Initialize activeTab from query param if present
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab);

    const callsPerPage = 100; // MVP: Show last 100 calls

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchAnalytics = useCallback(async () => {
        try {
            const data = await authedBackendFetch<any>('/api/calls-dashboard/analytics/summary');
            setAnalytics(data);
        } catch (err) {
            console.error('Error fetching analytics:', err);
        }
    }, []);

    const fetchCalls = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: callsPerPage.toString(),
                call_type: activeTab,
                ...(filterStatus && { status: filterStatus }),
                ...(searchQuery && { search: searchQuery }),
                ...(filterDate && { date_filter: filterDate })
            });

            const data = await authedBackendFetch<any>(`/api/calls-dashboard?${params.toString()}`);
            setCalls(data.calls || []);
            setTotalCalls(data.pagination?.total || 0);
        } catch (err: any) {
            setError(err?.message || 'Failed to load calls');
            console.error('Error fetching calls:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filterStatus, searchQuery, activeTab, filterDate]);

    useEffect(() => {
        if (user) {
            fetchCalls();
            fetchAnalytics();
        }
    }, [user, fetchCalls, fetchAnalytics]);

    // Auto-refresh calls when new calls arrive via WebSocket
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Refresh calls when a new call_ended event arrives
                if (data.type === 'call_ended') {
                    // Refresh the calls list
                    fetchCalls();
                    fetchAnalytics();
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [fetchCalls, fetchAnalytics]);

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

            setCalls(calls.filter(c => c.id !== callId));
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to delete call');
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
        switch (label) {
            case 'positive': return 'text-green-600 bg-green-50';
            case 'negative': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
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

    const totalPages = Math.ceil(totalCalls / callsPerPage);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex h-screen bg-white">
            <LeftSidebar />

            <div className="flex-1 ml-64 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 mb-2">Call Recordings</h1>
                                <p className="text-gray-600">View and analyze all call activity with transcripts and sentiment analysis</p>
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
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <p className="text-2xl font-bold text-gray-900">{analytics.total_calls}</p>
                                <p className="text-xs text-gray-600 font-medium">Total Calls</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <p className="text-2xl font-bold text-green-600">{analytics.completed_calls}</p>
                                <p className="text-xs text-gray-600 font-medium">Completed</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <p className="text-2xl font-bold text-gray-900">{analytics.average_duration}s</p>
                                <p className="text-xs text-gray-600 font-medium">Avg Duration</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <p className="text-2xl font-bold text-blue-600">{(analytics.average_sentiment * 100).toFixed(0)}%</p>
                                <p className="text-xs text-gray-600 font-medium">Avg Sentiment</p>
                            </div>
                        </div>
                    )}

                    {/* Call Type Tabs */}
                    <div className="mb-6 flex gap-2 border-b border-gray-200">
                        <button
                            onClick={() => {
                                setActiveTab('inbound');
                                setCurrentPage(1);
                            }}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'inbound'
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
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
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
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
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date & Time</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Caller</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Duration</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Sentiment</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                                                    <p className="text-gray-600">Loading calls...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : calls.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <p className="text-gray-600">No calls found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        calls.map((call) => (
                                            <tr key={call.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fetchCallDetail(call.id)}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        {formatDateTime(call.call_date)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{call.caller_name}</div>
                                                    <div className="text-xs text-gray-500">{call.phone_number}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                                        <Clock className="w-4 h-4 text-gray-400" />
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
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {call.has_recording && (
                                                            <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Play recording">
                                                                <Volume2 className="w-4 h-4 text-blue-600" />
                                                            </button>
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
            </div>

            {/* Call Detail Modal */}
            {showDetailModal && selectedCall && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedCall.caller_name}</h2>
                                <p className="text-sm text-gray-600">{selectedCall.phone_number} • {formatDateTime(selectedCall.call_date)}</p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Call Metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-gray-600 font-medium uppercase">Duration</p>
                                    <p className="text-lg font-bold text-gray-900">{formatDuration(selectedCall.duration_seconds)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium uppercase">Status</p>
                                    <p className="text-lg font-bold text-gray-900 capitalize">{selectedCall.status}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium uppercase">Sentiment</p>
                                    <p className="text-lg font-bold text-gray-900 capitalize">{selectedCall.sentiment_label || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium uppercase">Recording</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedCall.has_recording ? '✓' : '✗'}</p>
                                </div>
                            </div>

                            {/* Recording Player */}
                            {selectedCall.has_recording && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-gray-900 mb-3">Recording</p>
                                    <RecordingPlayer 
                                        callId={selectedCall.id} 
                                        recordingUrl={selectedCall.recording_url}
                                    />
                                </div>
                            )}

                            {/* Transcript */}
                            {(liveTranscript.length > 0 || (selectedCall.transcript && selectedCall.transcript.length > 0)) && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-bold text-gray-900">Transcript</p>
                                        {wsConnected && <span className="text-xs text-green-600 font-medium">🟢 Live</span>}
                                    </div>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {/* Show live transcript if available, otherwise show saved transcript */}
                                        {(liveTranscript.length > 0 ? liveTranscript : selectedCall.transcript || []).map((segment, idx) => (
                                            <div key={idx} className="bg-white rounded p-3 border border-gray-200">
                                                <div className="flex items-start gap-3">
                                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                                                        segment.speaker === 'customer' || segment.speaker === 'caller'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {segment.speaker === 'customer' || segment.speaker === 'caller' ? 'Caller' : 'Call Waiting AI'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-gray-900 break-words">{segment.text}</p>
                                                        {(segment as any).sentiment && (
                                                            <p className="text-xs text-gray-500 mt-1">Sentiment: {(segment as any).sentiment}</p>
                                                        )}
                                                        {(segment as any).confidence && (
                                                            <p className="text-xs text-gray-500 mt-1">Confidence: {((segment as any).confidence * 100).toFixed(0)}%</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Items */}
                            {selectedCall.action_items && selectedCall.action_items.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm font-bold text-gray-900 mb-3">Action Items</p>
                                    <ul className="space-y-2">
                                        {selectedCall.action_items.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-900">
                                                <span className="text-emerald-600 font-bold">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function CallsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
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
