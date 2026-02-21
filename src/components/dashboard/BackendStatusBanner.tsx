'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDashboardWebSocket } from '@/contexts/DashboardWebSocketContext';

export function BackendStatusBanner() {
  const { isConnected: wsConnected } = useDashboardWebSocket();
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkBackend = useCallback(async () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

    const tryFetch = async (): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(`${backendUrl}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res.ok;
      } catch {
        clearTimeout(timeoutId);
        return false;
      }
    };

    let ok = await tryFetch();
    if (!ok) {
      // Retry once after 2s before showing banner
      await new Promise((r) => setTimeout(r, 2000));
      ok = await tryFetch();
    }
    setBackendReachable(ok);
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  // If WS reconnects, backend is reachable
  useEffect(() => {
    if (wsConnected) {
      setBackendReachable(true);
    }
  }, [wsConnected]);

  if (backendReachable !== false || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Backend server is not reachable. Some features may be unavailable.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setBackendReachable(null); checkBackend(); }}
          className="text-amber-700 hover:text-amber-900 font-medium underline"
        >
          Retry
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 ml-2 text-lg leading-none"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
