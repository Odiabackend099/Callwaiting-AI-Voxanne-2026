/**
 * Auth Redirect URL Helper
 * 
 * Provides consistent redirect URLs for OAuth and email flows.
 * Uses NEXT_PUBLIC_APP_URL environment variable to ensure correct domain in all environments.
 */

export function getRedirectUrl(path: string = '/auth/callback'): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // In the browser, always use the current origin to avoid www/non-www and port mismatches.
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${normalizedPath}`;
  }

  // Get the app URL from environment (must be set in .env.local and production env vars)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!appUrl) {
    // Server-side fallback
    return `http://localhost:3000${normalizedPath}`;
  }
  
  // Ensure appUrl doesn't have trailing slash
  const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  
  return `${baseUrl}${normalizedPath}`;
}

export function getAuthCallbackUrl(): string {
  return getRedirectUrl('/auth/callback');
}

export function getPasswordResetCallbackUrl(): string {
  return getRedirectUrl('/auth/callback?next=/update-password');
}
