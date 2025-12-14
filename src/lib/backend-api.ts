const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export class BackendAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'BackendAPIError';
  }
}

async function backendFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new BackendAPIError(
        errorData.message || `API Error: ${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BackendAPIError('Request timeout', 408);
    }
    throw error;
  }
}

export const agentAPI = {
  async startWebTest(userId: string) {
    return backendFetch<{
      success: boolean;
      vapiCallId: string;
      trackingId: string;
      userId: string;
      bridgeWebsocketUrl: string;
      requestId: string;
    }>('/api/founder-console/agent/web-test', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async startPhoneTest(phoneNumber: string, userId: string) {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      throw new BackendAPIError(
        'Phone number must be in E.164 format (e.g., +14155552671)',
        400
      );
    }

    return backendFetch<{
      success: boolean;
      callId: string;
      trackingId: string;
      message: string;
    }>('/api/founder-console/test-call', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, userId }),
    });
  },
};

export const callsAPI = {
  async getRecentCalls(userId: string, limit = 10) {
    const response = await backendFetch<{
      calls: Array<{
        id: string;
        caller: string;
        time: string;
        duration: string;
        type: string;
        outcome: string;
        status: string;
        recording: boolean;
      }>;
    }>(`/api/calls/recent?userId=${userId}&limit=${limit}`);
    
    return {
      calls: response?.calls ?? [],
    };
  },

  async getStats(userId: string, period = '7d') {
    return backendFetch<{
      totalCalls: number;
      answeredCalls: number;
      missedCalls: number;
      bookings: number;
      revenue: number;
      avgResponseTime: string;
    }>(`/api/calls/stats?userId=${userId}&period=${period}`);
  },
};

export const healthAPI = {
  async check() {
    return backendFetch<{ status: string; timestamp: string }>('/health');
  },
};
