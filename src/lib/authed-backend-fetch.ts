import { supabase } from '@/lib/supabase';

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Hard rule: when running the frontend on localhost, always hit the local backend.
  // This prevents mixed local UI + remote backend state (web-voice sessions are in-memory).
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }

  if (!configured) {
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    if (isProduction) {
      throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured in production');
    }
    return 'http://localhost:3001';
  }
  return configured;
}

/**
 * Options for authedBackendFetch
 * @property headers Custom headers to merge with auth headers
 * @property timeoutMs Request timeout in milliseconds (default: 30000)
 * @property retries Number of retry attempts for network/5xx errors (default: 3)
 * @property requireAuth Whether to require authentication (default: true)
 */
type AuthedBackendFetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  requireAuth?: boolean;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRequestId(): string {
  // Good enough for correlation (not a security token)
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function jitterMs(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * 250);
}

/**
 * Parse Retry-After header (in seconds) to milliseconds
 * @param headerValue Retry-After header value
 * @returns Milliseconds to wait, or null if invalid
 */
function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const s = Number(headerValue);
  if (!Number.isFinite(s)) return null;
  return Math.max(0, s * 1000);
}

async function safeReadBody(res: Response): Promise<{ json: any | null; text: string | null }>{
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => null);
    return { json, text: null };
  }
  const text = await res.text().catch(() => null);
  return { json: null, text };
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Perform a fetch request to the backend with authentication.
 * 
 * @param endpoint The endpoint to fetch, relative to the backend base URL.
 * @param options Options for the fetch request.
 * @returns The response data, or null if the response was 204 No Content.
 * @throws An error if the request failed, with the response status and body.
 */
export async function authedBackendFetch<T>(
  endpoint: string,
  options: AuthedBackendFetchOptions = {}
): Promise<T> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    requireAuth = true,
    ...requestInit
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const RETRY_DELAYS_MS = [250, 500, 1000];
  const requestId = makeRequestId();

  const token = await getAccessToken();
  if (requireAuth && !token) {
    throw new Error('Not authenticated');
  }

  let lastErr: unknown = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const bodyIsFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;
      const shouldSetJsonContentType = !!requestInit.body && !bodyIsFormData;

      // Build headers once per request (not per retry)
      const finalHeaders = {
        ...(shouldSetJsonContentType ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
        'x-request-id': requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
        headers: finalHeaders,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const isRetryable = res.status >= 500 || res.status === 429;

        const { json, text } = await safeReadBody(res);
        const message =
          json?.error || json?.message || text || `Request failed (HTTP ${res.status})`;

        const err = new Error(message);
        (err as any).status = res.status;
        (err as any).response = json ?? text;
        (err as any).requestId = requestId;

        if (attempt < retries - 1 && isRetryable) {
          const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res.headers.get('retry-after')) : null;
          const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
          const delayMs = Math.max(baseDelay, retryAfterMs ?? 0);
          await sleep(jitterMs(delayMs));
          lastErr = err;
          continue;
        }

        throw err;
      }

      if (res.status === 204) {
        return null as T;
      }

      const { json, text } = await safeReadBody(res);
      return (json ?? (text as any)) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;

      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetwork = err instanceof TypeError;

      if (attempt < retries - 1 && (isAbort || isNetwork)) {
        const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        await sleep(jitterMs(baseDelay));
        continue;
      }

      throw err;
    }
  }

  throw lastErr;
}
