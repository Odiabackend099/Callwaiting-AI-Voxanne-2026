import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

interface CalendarStatus {
  connected: boolean;
  email?: string;
  expiryDate?: string;
}

export function GoogleCalendarConnect() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<CalendarStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = session?.user?.org_id;

  // Fetch current connection status
  useEffect(() => {
    if (!orgId) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/calendar/status/${orgId}`);
        const data = await response.json();
        setStatus(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching calendar status:', err);
        setError('Failed to load calendar status');
        setLoading(false);
      }
    };

    fetchStatus();
  }, [orgId]);

  const handleConnect = async () => {
    if (!orgId) return;

    try {
      setConnecting(true);
      setError(null);

      // Get OAuth URL from backend
      const response = await fetch(
        `/api/calendar/auth/url?org_id=${encodeURIComponent(orgId)}`
      );
      const data = await response.json();

      if (!data.success || !data.url) {
        throw new Error(data.message || 'Failed to generate OAuth URL');
      }

      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch (err) {
      console.error('Error initiating OAuth:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!orgId) return;

    try {
      setConnecting(true);
      setError(null);

      const response = await fetch(`/api/calendar/disconnect/${orgId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to disconnect');
      }

      setStatus({ connected: false });
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar Integration</CardTitle>
          <CardDescription>Connect your clinic's calendar for automatic booking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar Integration</CardTitle>
        <CardDescription>
          Connect your clinic's Google Calendar so Voxanne can check availability and book
          appointments automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {status.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Calendar Connected</p>
                <p className="text-xs text-green-700 mt-1">{status.email}</p>
                {status.expiryDate && (
                  <p className="text-xs text-green-600 mt-1">
                    Token expires: {new Date(status.expiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900 mb-1">🎯 Status: Active</p>
              <p>Voxanne can now:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                <li>Check calendar availability in real-time</li>
                <li>Book appointments automatically</li>
                <li>Send calendar invites to patients</li>
                <li>Handle rescheduling requests</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect Calendar
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200">
              <p className="font-medium text-amber-900 mb-1">ℹ️ Not Connected</p>
              <p>
                Click the button below to securely connect your Google Calendar. Voxanne will
                automatically book appointments and send calendar invites.
              </p>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting || !orgId}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
                    />
                  </svg>
                  Connect Google Calendar
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              We'll never store your password. You control which calendar Voxanne can access.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
