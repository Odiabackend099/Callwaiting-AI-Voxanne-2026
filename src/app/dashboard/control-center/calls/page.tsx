'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface CallItem {
  id: string;
  vapiCallId: string;
  phone: string;
  callerName: string | null;
  direction: string;
  status: string;
  durationSeconds: number;
  costCents: number;
  outcome: string | null;
  outcomeSummary: string | null;
  sentiment: string;
  transcript: string | null;
  recordingUrl: string | null;
  isTestCall: boolean;
  createdAt: string;
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
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
}

function statusBadge(status: string): { icon: string; color: string; bg: string } {
  switch (status) {
    case 'Answered': return { icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    case 'Missed': return { icon: '❌', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
    case 'Voicemail': return { icon: '📱', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    case 'In Progress': return { icon: '⏳', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    case 'Queued': return { icon: '📤', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    default: return { icon: '📞', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
  }
}

type FilterType = 'All' | 'Answered' | 'Missed' | 'Outbound';

export default function CallsPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const result = await authedBackendFetch<{ calls: CallItem[] }>('/api/dashboard-mvp');
      setCalls(result.calls || []);
      setError(null);
    } catch (err: any) {
      setError('Could not load calls. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredCalls = calls.filter((call) => {
    if (filter === 'All') return true;
    if (filter === 'Answered') return call.status === 'Answered';
    if (filter === 'Missed') return call.status === 'Missed';
    if (filter === 'Outbound') return call.direction === 'outbound';
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-60 bg-gray-100 rounded animate-pulse" />
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Answered', 'Missed', 'Outbound'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Call List */}
      {filteredCalls.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="text-4xl mb-3">📞</div>
          <p className="text-gray-700 font-medium">
            {filter === 'All' ? 'No calls yet' : `No ${filter.toLowerCase()} calls`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'All'
              ? 'Your AI agent will log calls here automatically.'
              : 'Try a different filter to see more calls.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCalls.map((call) => {
            const badge = statusBadge(call.status);
            const isExpanded = expandedId === call.id;

            return (
              <div
                key={call.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : call.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-lg mt-0.5">{badge.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">
                            {call.callerName || formatPhone(call.phone)}
                          </p>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${badge.bg} ${badge.color}`}>
                            {call.status}
                          </span>
                          {call.direction === 'outbound' && (
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-700">
                              Outbound
                            </span>
                          )}
                          {call.isTestCall && (
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 border-gray-200 text-gray-500">
                              Test
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDuration(call.durationSeconds)}
                          {call.costCents > 0 && ` · ${formatCost(call.costCents)}`}
                          {call.callerName && ` · ${formatPhone(call.phone)}`}
                        </p>
                        {call.outcome && (
                          <p className="text-xs text-gray-600 mt-1">{call.outcome}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(call.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded transcript */}
                {isExpanded && call.transcript && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Transcript</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {call.transcript.length > 500
                          ? call.transcript.slice(0, 500) + '...'
                          : call.transcript}
                      </p>
                    </div>
                    {call.outcomeSummary && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mt-2">
                        <p className="text-xs font-medium text-blue-600 mb-1 uppercase tracking-wider">Summary</p>
                        <p className="text-sm text-blue-800">{call.outcomeSummary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
