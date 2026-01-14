'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Trash2, CheckCircle, AlertCircle, Calendar, Phone, Users, Zap, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface Notification {
    id: string;
    type: 'hot_lead' | 'appointment_booked' | 'appointment_reminder' | 'missed_call' | 'system_alert' | 'voicemail' | 'lead_update';
    title: string;
    message: string;
    read: boolean;
    related_entity_type?: string; // 'call', 'appointment', 'contact', etc.
    related_entity_id?: string;
    created_at: string;
    action_url?: string;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
}

const NotificationsCenterContent = () => {
    const router = useRouter();
    const { user, loading } = useAuth();

    // State management
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalNotifications, setTotalNotifications] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filterUnread, setFilterUnread] = useState(false);
    const [filterType, setFilterType] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const notificationsPerPage = 50;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: notificationsPerPage.toString(),
                ...(filterUnread && { status: 'unread' }),
                ...(filterType && { type: filterType })
            });

            const data = await authedBackendFetch<any>(`/api/notifications?${params.toString()}`);
            setNotifications(data.notifications || []);
            setTotalNotifications(data.pagination?.total || 0);
            setUnreadCount(data.unread_count || 0);
        } catch (err: any) {
            setError(err?.message || 'Failed to load notifications');
            console.error('Error fetching notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filterUnread, filterType]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);

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
                if (data.type === 'notification' || data.type === 'hot_lead_alert') {
                    fetchNotifications();
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
    }, [fetchNotifications]);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await authedBackendFetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH'
            });
            await fetchNotifications();
        } catch (err: any) {
            setError(err?.message || 'Failed to mark notification as read');
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await authedBackendFetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE'
            });
            await fetchNotifications();
        } catch (err: any) {
            setError(err?.message || 'Failed to delete notification');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await authedBackendFetch('/api/notifications/mark-all-read', {
                method: 'POST'
            });
            await fetchNotifications();
            alert('All notifications marked as read');
        } catch (err: any) {
            setError(err?.message || 'Failed to mark all as read');
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        handleMarkAsRead(notification.id);
        if (notification.action_url) {
            router.push(notification.action_url);
        } else if (notification.related_entity_type === 'call') {
            router.push(`/dashboard/calls?id=${notification.related_entity_id}`);
        } else if (notification.related_entity_type === 'appointment') {
            router.push(`/dashboard/appointments?id=${notification.related_entity_id}`);
        } else if (notification.related_entity_type === 'contact') {
            router.push(`/dashboard/leads?id=${notification.related_entity_id}`);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'hot_lead':
                return <Zap className="w-5 h-5" />;
            case 'appointment_booked':
            case 'appointment_reminder':
            case 'appointment': // Legacy fallback
                return <Calendar className="w-5 h-5" />;
            case 'missed_call':
            case 'voicemail':
            case 'call': // Legacy fallback
                return <Phone className="w-5 h-5" />;
            case 'lead_update':
                return <Users className="w-5 h-5" />;
            case 'system_alert':
            case 'system': // Legacy fallback
                return <AlertCircle className="w-5 h-5" />;
            default:
                return <AlertCircle className="w-5 h-5" />;
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'hot_lead':
                return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400';
            case 'appointment_booked':
            case 'appointment_reminder':
            case 'appointment': // Legacy fallback
                return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400';
            case 'missed_call':
            case 'voicemail':
            case 'call': // Legacy fallback
                return 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-900/50 text-cyan-700 dark:text-cyan-400';
            case 'lead_update':
                return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400';
            default:
                return 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300';
        }
    };

    const formatTimeAgo = (dateString: string) => {
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

    const totalPages = Math.ceil(totalNotifications / notificationsPerPage);

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
        <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-slate-50 mb-2">Notifications</h1>
                        <p className="text-gray-600 dark:text-slate-400">
                            {unreadCount > 0 ? (
                                <span>You have <span className="font-bold text-red-600 dark:text-red-400">{unreadCount}</span> unread notifications</span>
                            ) : (
                                'All notifications read'
                            )}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Mark All as Read
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <button
                    onClick={() => {
                        setFilterUnread(!filterUnread);
                        setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterUnread
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Filter className="w-4 h-4" />
                    Unread Only
                </button>

                <select
                    value={filterType}
                    onChange={(e) => {
                        setFilterType(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">All Types</option>
                    <option value="hot_lead">Hot Leads</option>
                    <option value="appointment">Appointments</option>
                    <option value="call">Calls</option>
                    <option value="lead_update">Lead Updates</option>
                </select>
            </div>

            {/* Notifications List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-gray-600 dark:text-slate-400">Loading notifications...</p>
                        </div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-12">
                        <div className="flex flex-col items-center gap-4">
                            <Bell className="w-12 h-12 text-gray-300 dark:text-slate-700" />
                            <p className="text-gray-600 dark:text-slate-400">No notifications</p>
                            <p className="text-sm text-gray-500 dark:text-slate-500">Your notifications will appear here</p>
                        </div>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`border rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${notification.read
                                ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
                                : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50 ring-1 ring-emerald-200 dark:ring-emerald-900/50'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getNotificationColor(notification.type)}`}>
                                    {getNotificationIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className={`font-bold text-sm ${notification.read
                                                ? 'text-gray-700 dark:text-slate-300'
                                                : 'text-gray-900 dark:text-slate-50'
                                                }`}>
                                                {notification.title}
                                            </h3>
                                            <p className={`text-sm mt-1 ${notification.read
                                                ? 'text-gray-600 dark:text-slate-400'
                                                : 'text-gray-700 dark:text-slate-300'
                                                }`}>
                                                {notification.message}
                                            </p>
                                        </div>

                                        {/* Unread Badge */}
                                        {!notification.read && (
                                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1" />
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                                        <span className={`text-xs font-medium ${notification.read
                                            ? 'text-gray-500 dark:text-slate-500'
                                            : 'text-gray-600 dark:text-slate-400'
                                            }`}>
                                            {formatTimeAgo(notification.created_at)}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNotification(notification.id);
                                            }}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Delete notification"
                                        >
                                            <Trash2 className="w-4 h-4 text-gray-500 dark:text-slate-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-8 px-6 py-4">
                        <div className="text-sm text-gray-700 dark:text-slate-400">
                            Showing {(currentPage - 1) * notificationsPerPage + 1} to {Math.min(currentPage * notificationsPerPage, totalNotifications)} of {totalNotifications} notifications
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
        </div>

    );
};

export default function NotificationsPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-gray-600 dark:text-slate-400">Loading...</p>
                </div>
            </div>
        }>
            <NotificationsCenterContent />
        </React.Suspense>
    );
}
