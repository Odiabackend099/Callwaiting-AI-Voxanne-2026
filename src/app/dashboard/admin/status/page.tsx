'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface StatusData {
  status: string;
  user_id: string | null;
  user_email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  session_valid: boolean;
  database_connected: boolean;
  recent_queries: Array<{
    table: string;
    operation: string;
    timestamp: string;
    row_count: number;
  }>;
  timestamp: string;
}

export default function SystemStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-surgical-500 animate-spin" />
          <p className="text-obsidian/60">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg border border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-bold text-red-700">System Error</h1>
          </div>
          <p className="text-obsidian/60">{error || 'Could not load status'}</p>
        </div>
      </div>
    );
  }

  const isHealthy =
    data.session_valid &&
    data.database_connected &&
    data.organization_id &&
    data.user_id;

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-obsidian mb-2 flex items-center gap-3">
            {isHealthy ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-600" />
            )}
            System Status
          </h1>
          <p className="text-obsidian/40">
            Last updated: {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        </div>

        {/* Overall Status */}
        <div
          className={`p-6 rounded-lg border mb-6 ${
            isHealthy
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-obsidian mb-1">
                {isHealthy ? 'System Healthy' : 'System Issues Detected'}
              </h2>
              <p className="text-sm text-obsidian/60">
                {data.status === 'healthy'
                  ? 'All systems operational'
                  : `Status: ${data.status}`}
              </p>
            </div>
            {isHealthy && (
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            )}
          </div>
        </div>

        {/* Session Status */}
        <div className="bg-white border border-surgical-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
            {data.session_valid ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            Session Status: {data.session_valid ? 'ACTIVE' : 'INVALID'}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-xs text-obsidian/40 uppercase tracking-widest mb-1">
                User ID
              </p>
              <p className="text-sm font-mono text-obsidian/70">
                {data.user_id || 'Not available'}
              </p>
            </div>
            <div>
              <p className="text-xs text-obsidian/40 uppercase tracking-widest mb-1">
                Email
              </p>
              <p className="text-sm text-obsidian/70">{data.user_email}</p>
            </div>
          </div>
        </div>

        {/* Organization Status */}
        <div className="bg-white border border-surgical-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
            {data.organization_id ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            Organization Status: {data.organization_id ? 'LINKED' : 'NOT LINKED'}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-xs text-obsidian/40 uppercase tracking-widest mb-1">
                Org ID
              </p>
              <p className="text-sm font-mono text-obsidian/70">
                {data.organization_id || 'Not found'}
              </p>
            </div>
            <div>
              <p className="text-xs text-obsidian/40 uppercase tracking-widest mb-1">
                Org Name
              </p>
              <p className="text-sm text-obsidian/70">
                {data.organization_name || 'Organization name not found'}
              </p>
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-white border border-surgical-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
            {data.database_connected ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            Database Status: {data.database_connected ? 'CONNECTED' : 'DISCONNECTED'}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-xs text-obsidian/40 uppercase tracking-widest mb-1">
                Connection Status
              </p>
              <p className="text-sm text-obsidian/70">
                {data.database_connected
                  ? 'Connected to Supabase'
                  : 'Cannot connect to database'}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Queries */}
        {data.recent_queries && data.recent_queries.length > 0 && (
          <div className="bg-white border border-surgical-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-obsidian mb-4">
              Recent Database Queries
            </h3>
            <div className="space-y-3">
              {data.recent_queries.map((query, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surgical-50 rounded border border-surgical-200">
                  <div>
                    <p className="text-sm font-mono text-obsidian/60">
                      {query.operation} {query.table}
                    </p>
                    <p className="text-xs text-obsidian/40">
                      {new Date(query.timestamp).toLocaleTimeString()} - {query.row_count} row(s)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diagnostic Info */}
        <div className="mt-8 p-4 bg-surgical-50 border border-surgical-200 rounded text-xs text-obsidian/40 font-mono">
          <p className="mb-2">Debug Info:</p>
          <pre className="overflow-x-auto">
            {JSON.stringify(
              {
                session_valid: data.session_valid,
                db_connected: data.database_connected,
                has_org_id: !!data.organization_id,
                has_user_id: !!data.user_id,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
