/**
 * Simple request deduplication cache
 *
 * Prevents duplicate simultaneous API calls to the same endpoint.
 * If the same request is made while one is in flight, returns the same promise.
 *
 * Useful for React components that call the same endpoint in useEffect
 * before debouncing/caching is applied.
 */

type CacheKey = string;
type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const pendingRequests = new Map<CacheKey, PendingRequest<any>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key from endpoint and options
 */
function getCacheKey(endpoint: string, options?: any): CacheKey {
  // For GET requests without body, use just the endpoint
  if (!options || options.method === 'GET' || options.method === undefined) {
    return `GET:${endpoint}`;
  }
  // For other methods, include method in key (POST, PUT, DELETE, etc.)
  return `${options.method || 'POST'}:${endpoint}`;
}

/**
 * Wrap an async function to deduplicate simultaneous requests
 *
 * @param endpoint The endpoint being called
 * @param options Request options (method, body, etc.)
 * @param requestFn The async function to call
 * @returns The result of the request
 */
export async function withRequestDedup<T>(
  endpoint: string,
  options: any,
  requestFn: () => Promise<T>
): Promise<T> {
  const key = getCacheKey(endpoint, options);
  const now = Date.now();

  // Check if there's a pending request for this key
  const pending = pendingRequests.get(key);
  if (pending && now - pending.timestamp < CACHE_TTL_MS) {
    // Request is already in flight, return the same promise
    return pending.promise;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    // Clean up after a short delay to allow for result caching
    setTimeout(() => {
      const cached = pendingRequests.get(key);
      if (cached && cached.promise === promise) {
        pendingRequests.delete(key);
      }
    }, 100);
  });

  // Store pending request
  pendingRequests.set(key, { promise, timestamp: now });

  return promise;
}

/**
 * Clear all pending requests and cached data
 */
export function clearRequestCache(): void {
  pendingRequests.clear();
}

/**
 * Clear cache for a specific endpoint
 */
export function clearRequestCacheForEndpoint(endpoint: string): void {
  // Remove all keys matching this endpoint (regardless of method)
  for (const key of pendingRequests.keys()) {
    if (key.includes(endpoint)) {
      pendingRequests.delete(key);
    }
  }
}
