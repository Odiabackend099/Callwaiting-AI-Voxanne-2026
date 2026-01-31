'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Phone, AlertCircle, Edit2, X, ChevronLeft, ChevronRight, Search, Filter, MessageCircle, RotateCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface Appointment {
    id: string;
    contact_name: string;
    phone_number: string;
    service_type: string;
    scheduled_time: string;
    duration_minutes: number;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    notes?: string;
    location?: string;
    is_virtual?: boolean;
    created_at: string;
}

interface AppointmentDetail extends Appointment {
    transcript?: string;
    recording_url?: string;
    outcome_notes?: string;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
}

const AppointmentsDashboardContent = () => {
    const router = useRouter();
    const { user, loading } = useAuth();

    // State management
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalAppointments, setTotalAppointments] = useState(0);
    const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterDate, setFilterDate] = useState<string>(''); // 'week', 'month', ''
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const appointmentsPerPage = 20;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchAppointments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: appointmentsPerPage.toString(),
                ...(filterStatus && { status: filterStatus }),
                ...(filterDate && { dateRange: filterDate }),
                ...(searchQuery && { search: searchQuery })
            });

            const data = await authedBackendFetch<any>(`/api/appointments?${params.toString()}`);
            setAppointments(data.appointments || []);
            setTotalAppointments(data.pagination?.total || 0);
        } catch (err: any) {
            setError(err?.message || 'Failed to load appointments');
            console.error('Error fetching appointments:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filterStatus, filterDate, searchQuery]);

    useEffect(() => {
        if (user) {
            fetchAppointments();
        }
    }, [user, fetchAppointments]);

    // WebSocket real-time updates
    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'appointment_created' || data.type === 'appointment_updated') {
                    fetchAppointments();
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [fetchAppointments]);

    const fetchAppointmentDetail = async (appointmentId: string) => {
        try {
            const data = await authedBackendFetch<any>(`/api/appointments/${appointmentId}`);
            setSelectedAppointment(data);
            setShowDetailModal(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to load appointment details');
        }
    };

    const handleSendReminder = async () => {
        if (!selectedAppointment) return;
        try {
            await authedBackendFetch(`/api/appointments/${selectedAppointment.id}/send-reminder`, {
                method: 'POST'
            });
            setError(null);
            alert('Reminder SMS sent successfully');
        } catch (err: any) {
            setError(err?.message || 'Failed to send reminder');
        }
    };

    const handleReschedule = async () => {
        const newTime = prompt('Enter new appointment time (YYYY-MM-DD HH:MM):');
        if (!newTime || !selectedAppointment) return;

        try {
            await authedBackendFetch(`/api/appointments/${selectedAppointment.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ scheduled_time: newTime })
            });
            setShowDetailModal(false);
            await fetchAppointments();
            alert('Appointment rescheduled successfully');
        } catch (err: any) {
            setError(err?.message || 'Failed to reschedule appointment');
        }
    };

    const handleCancelAppointment = async () => {
        if (!selectedAppointment || !confirm('Are you sure you want to cancel this appointment?')) return;

        try {
            await authedBackendFetch(`/api/appointments/${selectedAppointment.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'cancelled' })
            });
            setShowDetailModal(false);
            await fetchAppointments();
            alert('Appointment cancelled');
        } catch (err: any) {
            setError(err?.message || 'Failed to cancel appointment');
        }
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

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-surgical-50 text-surgical-600 border-surgical-200';
            case 'confirmed':
                return 'bg-green-50 text-green-700 border-green-200';
            case 'completed':
                return 'bg-surgical-50 text-obsidian/60 border-surgical-200';
            case 'cancelled':
                return 'bg-red-50 text-red-700 border-red-200';
            default:
                return 'bg-surgical-50 text-obsidian/60 border-surgical-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return '';
            case 'confirmed':
                return '';
            case 'completed':
                return '';
            case 'cancelled':
                return '';
            default:
                return '';
        }
    };

    const totalPages = Math.ceil(totalAppointments / appointmentsPerPage);

    if (loading) {
        return (
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                    <p className="text-obsidian/60">Loading...</p>
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
                    <h1 className="text-4xl font-bold text-obsidian mb-2">Appointments</h1>
                    <p className="text-obsidian/60">Manage and track all scheduled appointments</p>
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
                            placeholder="Search by contact name or phone..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-surgical-200 rounded-lg text-sm bg-white text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500"
                        />
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-surgical-200 rounded-lg text-sm bg-white text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                        value={filterDate}
                        onChange={(e) => {
                            setFilterDate(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-surgical-200 rounded-lg text-sm bg-white text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    >
                        <option value="">All Time</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>

                    <button
                        onClick={() => fetchAppointments()}
                        className="p-2 border border-surgical-200 rounded-lg hover:bg-surgical-50 transition-colors"
                        title="Refresh"
                    >
                        <RotateCw className="w-4 h-4 text-obsidian/60" />
                    </button>
                </div>

                {/* Appointments List */}
                <div className="bg-white border border-surgical-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-surgical-50 border-b border-surgical-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Date & Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Service</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Duration</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-obsidian/60 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surgical-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                                                <p className="text-obsidian/60">Loading appointments...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : appointments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Calendar className="w-12 h-12 text-obsidian/40 mx-auto mb-4" />
                                            <p className="text-obsidian/60">No appointments scheduled</p>
                                        </td>
                                    </tr>
                                ) : (
                                    appointments.map((apt) => (
                                        <tr
                                            key={apt.id}
                                            className="hover:bg-surgical-50 transition-colors cursor-pointer"
                                            onClick={() => fetchAppointmentDetail(apt.id)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-obsidian font-medium">
                                                    <Calendar className="w-4 h-4 text-obsidian/40" />
                                                    {formatDateTime(apt.scheduled_time)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-obsidian">{apt.service_type}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-obsidian">{apt.contact_name}</div>
                                                <div className="text-xs text-obsidian/60 flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    {apt.phone_number}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-obsidian font-medium">
                                                    <Clock className="w-4 h-4 text-obsidian/40" />
                                                    {apt.duration_minutes} min
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeColor(apt.status)}`}>
                                                    {getStatusIcon(apt.status)}
                                                    {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fetchAppointmentDetail(apt.id);
                                                    }}
                                                    className="p-2 hover:bg-surgical-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4 text-surgical-600" />
                                                </button>
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
                            <div className="text-sm text-obsidian/60">
                                Showing {(currentPage - 1) * appointmentsPerPage + 1} to {Math.min(currentPage * appointmentsPerPage, totalAppointments)} of {totalAppointments} appointments
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/60 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
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
                                                    : 'border border-surgical-200 text-obsidian/60 hover:bg-surgical-50'
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
                                    className="px-3 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/60 hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>



                {/* Appointment Detail Modal */}
                {
                    showDetailModal && selectedAppointment && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                                {/* Modal Header */}
                                <div className="sticky top-0 bg-white border-b border-surgical-200 px-6 py-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-obsidian">{selectedAppointment.contact_name}</h2>
                                        <p className="text-sm text-obsidian/60">{selectedAppointment.service_type}</p>
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
                                    {/* Appointment Details */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-obsidian/60 font-medium uppercase mb-1">Scheduled Time</p>
                                            <p className="text-lg font-bold text-obsidian">{formatDateTime(selectedAppointment.scheduled_time)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-obsidian/60 font-medium uppercase mb-1">Duration</p>
                                            <p className="text-lg font-bold text-obsidian">{selectedAppointment.duration_minutes} minutes</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-obsidian/60 font-medium uppercase mb-1">Status</p>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${getStatusBadgeColor(selectedAppointment.status)}`}>
                                                {getStatusIcon(selectedAppointment.status)}
                                                {selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-obsidian/60 font-medium uppercase mb-1">Type</p>
                                            <p className="text-sm font-medium text-obsidian">{selectedAppointment.is_virtual ? 'Virtual' : 'In-Person'}</p>
                                        </div>
                                    </div>

                                    {/* Contact Information */}
                                    <div className="bg-surgical-50 rounded-lg p-4">
                                        <p className="text-sm font-bold text-obsidian mb-3">Contact Information</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-obsidian/40" />
                                                <span className="text-sm text-obsidian">{selectedAppointment.phone_number}</span>
                                            </div>
                                            {selectedAppointment.location && (
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 text-obsidian/40 mt-0.5" />
                                                    <span className="text-sm text-obsidian">{selectedAppointment.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {selectedAppointment.notes && (
                                        <div className="bg-surgical-50 rounded-lg p-4">
                                            <p className="text-sm font-bold text-obsidian mb-2">Notes</p>
                                            <p className="text-sm text-obsidian">{selectedAppointment.notes}</p>
                                        </div>
                                    )}

                                    {/* Outcome (if completed) */}
                                    {selectedAppointment.status === 'completed' && selectedAppointment.outcome_notes && (
                                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                            <p className="text-sm font-bold text-green-700 mb-2">Appointment Outcome</p>
                                            <p className="text-sm text-green-700">{selectedAppointment.outcome_notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="border-t border-surgical-200 px-6 py-4 flex items-center justify-end gap-3">
                                    {selectedAppointment.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={handleReschedule}
                                                className="flex items-center gap-2 px-4 py-2 bg-surgical-50 text-surgical-600 rounded-lg hover:bg-surgical-100 transition-colors text-sm font-medium"
                                            >
                                                <RotateCw className="w-4 h-4" />
                                                Reschedule
                                            </button>
                                            <button
                                                onClick={handleSendReminder}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                Send Reminder
                                            </button>
                                        </>
                                    )}
                                    {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                                        <button
                                            onClick={handleCancelAppointment}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                        >
                                            <X className="w-4 h-4" />
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="px-4 py-2 rounded-lg border border-surgical-200 text-sm font-medium text-obsidian/60 hover:bg-surgical-50 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                        </div>
                    )
                }
            </div>
        </>
    )
}



export default function AppointmentsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                    <p className="text-obsidian/60">Loading...</p>
                </div>
            </div>
        }>
            <AppointmentsDashboardContent />
        </React.Suspense>
    );
}
