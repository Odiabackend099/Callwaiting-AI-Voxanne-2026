/**
 * Single source of truth for resolving the externally-reachable backend URL.
 *
 * Used by both webhook URLs (serverUrl for Vapi events) and tool URLs
 * (server.url for tool invocations). Both MUST resolve to the same host
 * or tools will silently fail while webhooks succeed.
 *
 * Resolution order:
 * 1. BACKEND_URL - explicit configuration (highest priority)
 * 2. RENDER_EXTERNAL_URL - auto-set by Render hosting platform
 * 3. BASE_URL - generic fallback
 * 4. 'http://localhost:5002' - development only
 */
export function resolveBackendUrl(): string {
  const url =
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BASE_URL ||
    'http://localhost:5002';

  if (url.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.warn(
      '[BACKEND_URL] Resolving to localhost in production - Vapi tool webhooks will fail. ' +
        'Set BACKEND_URL or RENDER_EXTERNAL_URL environment variable.'
    );
  }

  if (url.includes('ngrok') && process.env.NODE_ENV === 'production') {
    console.warn(
      '[BACKEND_URL] Using ephemeral ngrok URL in production. ' +
        'This will break when the tunnel closes.'
    );
  }

  return url;
}
