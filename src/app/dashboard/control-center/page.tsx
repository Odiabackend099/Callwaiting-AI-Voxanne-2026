'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface DashboardData {
  stats: {
    totalCalls: number;
    answeredCalls: number;
    answerRate: number;
    totalAppointments: number;
    totalCost: string;
    totalCostCents: number;
  };
  calls: CallItem[];
  appointments: any[];
}

interface CallItem {
  id: string;
  phone: string;
  callerName: string | null;
  direction: string;
  status: string;
  durationSeconds: number;
  costCents: number;
  outcome: string | null;
  outcomeSummary: string | null;
  sentiment: string;
  createdAt: string;
  isTestCall: boolean;
}

function formatPhone(raw: string | null): string {
  if (!raw) return 'Unknown';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0 sec';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'Answered': return '✅';
    case 'Missed': return '❌';
    case 'Voicemail': return '📱';
    case 'In Progress': return '⏳';
    case 'Queued': return '📤';
    default: return '📞';
  }
}

export default function ControlCenterOverview() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const result = await authedBackendFetch<DashboardData>('/api/dashboard-mvp');
      setData(result);
      setError(null);
    } catch (err: any) {
      setError('Could not load your data. Check your internet and try again.');
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
      <div className="space-y-6">
        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mb-3" />
              <div className="h-9 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Skeleton activity list */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
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

  const stats = data?.stats;
  const recentCalls = (data?.calls || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📞" value={stats?.totalCalls ?? 0} label="Calls" sublabel="This Week" />
        <StatCard icon="✅" value={`${stats?.answerRate ?? 0}%`} label="Answered" sublabel="Rate" color="green" />
        <StatCard icon="📅" value={stats?.totalAppointments ?? 0} label="Booked" sublabel="This Week" color="blue" />
        <StatCard icon="💰" value={`$${stats?.totalCost ?? '0.00'}`} label="AI Cost" sublabel="This Week" color="amber" />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          <button
            onClick={() => router.push('/dashboard/control-center/calls')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View All
          </button>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-4xl mb-3">📞</div>
            <p className="text-gray-700 font-medium">No calls yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Your AI agent will log calls here automatically. No action needed — calls will show up as they happen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentCalls.map((call) => (
              <div key={call.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-lg mt-0.5">{statusIcon(call.status)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {call.callerName || formatPhone(call.phone)}
                        {call.direction === 'outbound' && (
                          <span className="ml-2 text-xs font-normal text-gray-400">Outbound</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {call.status} · {formatDuration(call.durationSeconds)}
                        {call.costCents > 0 && ` · ${formatCost(call.costCents)}`}
                      </p>
                      {call.outcome && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{call.outcome}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(call.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => router.push('/dashboard/control-center/calls')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          📞 All Calls
        </button>
        <button
          onClick={() => router.push('/dashboard/control-center/appointments')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          📅 Appointments
        </button>
        <button
          onClick={() => router.push('/dashboard/leads')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          👥 View Leads
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, sublabel, color = 'default' }: {
  icon: string;
  value: number | string;
  label: string;
  sublabel: string;
  color?: 'default' | 'green' | 'blue' | 'amber';
}) {
  const colorStyles = {
    default: 'bg-white',
    green: 'bg-white',
    blue: 'bg-white',
    amber: 'bg-white',
  };
  const valueColors = {
    default: 'text-gray-900',
    green: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
  };

  return (
    <div className={`${colorStyles[color]} rounded-xl border border-gray-200 p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${valueColors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}
