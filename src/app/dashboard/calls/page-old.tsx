'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, Play, Trash2, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

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

export default function CallsPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [calls, setCalls] = useState<Call[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCalls, setTotalCalls] = useState(0);
    const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const callsPerPage = 20;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const getToken = async () => {
        const response = await fetch('/api/auth/token');
        const data = await response.json();
        return data.token;
    };

    const fetchCalls = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken().catch(() => null);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: callsPerPage.toString(),
                ...(filterStatus && { status: filterStatus }),
                ...(searchQuery && { search: searchQuery })
            });

            const res = await fetch(`${API_BASE_URL}/api/calls-dashboard?${params}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch calls (HTTP ${res.status})`);
            }

            const data = await res.json();
            setCalls(data.calls || []);
            setTotalCalls(data.pagination?.total || 0);
        } catch (err: any) {
            setError(err?.message || 'Failed to load calls');
            console.error('Error fetching calls:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filterStatus, searchQuery]);

    useEffect(() => {
        if (user) {
            fetchCalls();
        }
    }, [user, fetchCalls]);

    const fetchCallDetail = async (callId: string) => {
        try {
            const token = await getToken().catch(() => null);
            const res = await fetch(`${API_BASE_URL}/api/calls-dashboard/${callId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                throw new Error('Failed to fetch call details');
            }

            const data = await res.json();
            setSelectedCall(data);
            setShowDetailModal(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to load call details');
        }
    };

    const deleteCall = async (callId: string) => {
        if (!confirm('Are you sure you want to delete this call?')) return;

        try {
            const token = await getToken().catch(() => null);
            const res = await fetch(`${API_BASE_URL}/api/calls-dashboard/${callId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                throw new Error('Failed to delete call');
            }

            setCalls(calls.filter(c => c.id !== callId));
        } catch (err: any) {
            setError(err?.message || 'Failed to delete call');
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    const getDirectionBadge = (metadata: CallLog['metadata']) => {
        const channel = metadata?.channel || 'outbound';
        const isInbound = channel === 'inbound';

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isInbound
                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'
                }`}>
                {isInbound ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                )}
                {isInbound ? 'Inbound' : 'Outbound'}
            </span>
        );
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
            'completed': { icon: CheckCircle, color: 'emerald', label: 'Completed' },
            'in-progress': { icon: Clock, color: 'amber', label: 'In Progress' },
            'failed': { icon: XCircle, color: 'red', label: 'Failed' },
            'ringing': { icon: AlertCircle, color: 'cyan', label: 'Ringing' }
        };

        const config = statusConfig[status] || statusConfig['in-progress'];
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-${config.color}-50 text-${config.color}-700 border border-${config.color}-200`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
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
            {/* Left Sidebar */}
            <LeftSidebar />

            {/* Main Content */}
            <div className="flex-1 ml-64 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 mb-2">Call Logs</h1>
                                <p className="text-gray-600">View and analyze all call activity</p>
                            </div>
                            <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm font-medium flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
                                    <p className="text-xs text-gray-600 font-medium">Total Calls</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                                    <ArrowDownRight className="w-5 h-5 text-cyan-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {calls.filter(c => c.metadata?.channel === 'inbound').length}
                                    </p>
                                    <p className="text-xs text-gray-600 font-medium">Inbound</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                                    <ArrowUpRight className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {calls.filter(c => c.metadata?.channel === 'outbound').length}
                                    </p>
                                    <p className="text-xs text-gray-600 font-medium">Outbound</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {calls.filter(c => c.status === 'completed').length}
                                    </p>
                                    <p className="text-xs text-gray-600 font-medium">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calls Table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Direction
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Date & Time
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Phone Number
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Duration
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Outcome
                                        </th>
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
                                            <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getDirectionBadge(call.metadata)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        {formatDateTime(call.started_at)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {call.to_number || 'Unknown'}
                                                    </div>
                                                    {call.lead && (
                                                        <div className="text-xs text-gray-500">
                                                            {call.lead.contact_name || call.lead.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                                        <Clock className="w-4 h-4 text-gray-400" />
                                                        {formatDuration(call.duration_seconds)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(call.status)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900 font-medium">
                                                        {call.outcome || '-'}
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
        </div>
    );
}
