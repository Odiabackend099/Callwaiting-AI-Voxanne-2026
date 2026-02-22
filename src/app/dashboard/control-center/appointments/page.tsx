'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface Appointment {
  id: string;
  contact_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  service_type: string | null;
  created_at: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateHeading(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return `Today — ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow — ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function statusBadge(status: string): { label: string; icon: string; color: string } {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'scheduled':
      return { label: 'Confirmed', icon: '✅', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'pending':
      return { label: 'Pending', icon: '⏳', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'cancelled':
    case 'canceled':
      return { label: 'Cancelled', icon: '❌', color: 'text-red-700 bg-red-50 border-red-200' };
    case 'completed':
      return { label: 'Completed', icon: '✅', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    case 'no_show':
      return { label: 'No Show', icon: '👻', color: 'text-gray-700 bg-gray-50 border-gray-200' };
    default:
      return { label: status || 'Unknown', icon: '📅', color: 'text-gray-700 bg-gray-50 border-gray-200' };
  }
}

function groupByDate(appointments: Appointment[]): Map<string, Appointment[]> {
  const groups = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const dateKey = new Date(appt.scheduled_at).toDateString();
    const existing = groups.get(dateKey) || [];
    existing.push(appt);
    groups.set(dateKey, existing);
  }
  return groups;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const result = await authedBackendFetch<{ appointments: Appointment[] }>('/api/dashboard-mvp');
      setAppointments(result.appointments || []);
      setError(null);
    } catch (err: any) {
      setError('Could not load appointments. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-gray-700 font-medium">No upcoming appointments</p>
        <p className="text-sm text-gray-500 mt-1">
          When your AI agent books appointments, they will appear here automatically.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(appointments);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([dateKey, dayAppointments]) => (
        <div key={dateKey}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {formatDateHeading(dayAppointments[0].scheduled_at)}
          </h3>
          <div className="space-y-2">
            {dayAppointments.map((appt) => {
              const badge = statusBadge(appt.status);

              return (
                <div
                  key={appt.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Time block */}
                    <div className="flex-shrink-0 w-16 text-center">
                      <p className="text-lg font-bold text-gray-900">{formatTime(appt.scheduled_at)}</p>
                      <p className="text-xs text-gray-400">{appt.duration_minutes} min</p>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {appt.service_type && (
                          <p className="text-sm font-semibold text-gray-900">{appt.service_type}</p>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>
                      {appt.notes && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{appt.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
