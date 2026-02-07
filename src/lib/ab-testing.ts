/**
 * Simple cookie-based A/B testing utility.
 * Assigns a variant ('A' or 'B') per test name and persists it in a 30-day cookie.
 */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

/**
 * Get the assigned variant for an A/B test.
 * If no variant is assigned yet, randomly assigns one and persists in a cookie.
 */
export function getVariant(testName: string): 'A' | 'B' {
  if (typeof document === 'undefined') return 'A'; // SSR fallback

  const cookieName = `ab_${testName}`;
  const existing = getCookie(cookieName);
  if (existing === 'A' || existing === 'B') return existing;

  const variant: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
  setCookie(cookieName, variant, 30);
  return variant;
}
