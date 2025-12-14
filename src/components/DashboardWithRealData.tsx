'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Phone, Calendar, DollarSign, Zap } from 'lucide-react';
import { useWebSocket } from '@/lib/websocket-client';
import { callsAPI } from '@/lib/backend-api';

interface Props {
  userId: string;
}

export default function DashboardWithRealData({ userId }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [stats, setStats] = useState({
    totalCalls: 0,
    answeredCalls: 0,
    missedCalls: 0,
    bookings: 0,
    revenue: 0,
    avgResponseTime: '0s',
  });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userIdRef = useRef(userId);
  const selectedPeriodRef = useRef(selectedPeriod);
  
  useEffect(() => {
    userIdRef.current = userId;
    selectedPeriodRef.current = selectedPeriod;
  }, [userId, selectedPeriod]);

  const { status: wsStatus, latestMessage, isConnected, error: wsError } = useWebSocket({
    userId,
    autoConnect: true,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    async function loadData() {
      try {
        setLoading(true);
        setLoadError(null);

        const loadPromise = Promise.all([
          callsAPI.getStats(userIdRef.current, selectedPeriodRef.current),
          callsAPI.getRecentCalls(userIdRef.current, 10),
        ]);

        timeoutId = setTimeout(() => {
          throw new Error('Data load timeout');
        }, 5000);

        const [statsData, callsData] = await loadPromise;
        clearTimeout(timeoutId);

        setStats(statsData);
        setRecentCalls(callsData.calls);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load data');
        setStats({
          totalCalls: 0,
          answeredCalls: 0,
          missedCalls: 0,
          bookings: 0,
          revenue: 0,
          avgResponseTime: '0s',
        });
        setRecentCalls([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedPeriod]);

  const refreshDataDebounced = useCallback(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const [statsData, callsData] = await Promise.all([
          callsAPI.getStats(userIdRef.current, selectedPeriodRef.current),
          callsAPI.getRecentCalls(userIdRef.current, 10),
        ]);
        
        setStats(statsData);
        setRecentCalls(callsData.calls);
      } catch (error) {
        // Silent fail on refresh
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!latestMessage) return;

    switch (latestMessage.type) {
      case 'call_status':
      case 'call_ended':
        refreshDataDebounced();
        break;
    }
  }, [latestMessage, refreshDataDebounced]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed top-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isConnected ? '🟢 Live' : '🔴 Disconnected'}
        </div>
        {wsError && (
          <div className="mt-1 text-xs text-red-400">{wsError}</div>
        )}
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 text-sm">
          ⚠️ {loadError} - Using cached data
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Practice Overview</h2>
            <p className="text-slate-400">Real-time metrics powered by Vapi</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
            {['24h', '7d', '30d', '90d'].map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {period === '24h' ? 'Today' : period === '7d' ? 'Week' : period === '30d' ? 'Month' : 'Quarter'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold mb-1">{stats.totalCalls}</h3>
            <p className="text-sm text-slate-400">Total Calls</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold mb-1">{stats.bookings}</h3>
            <p className="text-sm text-slate-400">Appointments Booked</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold mb-1">£{(stats.revenue / 1000).toFixed(1)}k</h3>
            <p className="text-sm text-slate-400">Pipeline Revenue</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold mb-1">{stats.avgResponseTime}</h3>
            <p className="text-sm text-slate-400">Avg Response Time</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold mb-6">Recent Calls</h3>
          
          {recentCalls.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No calls yet. Make a test call to see it appear here live!</p>
          ) : (
            <div className="space-y-3">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{call.caller}</h4>
                      <p className="text-xs text-slate-400">{call.time} • {call.duration}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      {call.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
