/**
 * Booking Deduplicator Service
 *
 * Prevents duplicate bookings when the AI voice model "jitters"
 * and calls the same booking tool multiple times within seconds.
 *
 * Uses in-memory cache with TTL to detect and return cached responses
 * for repeated booking attempts with identical parameters.
 */

import { log } from './logger';

interface CachedBooking {
  result: any;
  timestamp: number;
  expiresAt: number;
}

class BookingDeduplicator {
  private cache: Map<string, CachedBooking> = new Map();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from booking parameters
   *
   * Uniquely identifies a booking attempt. Two requests with identical
   * parameters will generate the same key.
   *
   * @param orgId - Organization ID
   * @param appointmentDate - ISO date (YYYY-MM-DD)
   * @param appointmentTime - Time (HH:MM)
   * @param patientEmail - Patient email
   * @returns Cache key
   */
  private generateCacheKey(
    orgId: string,
    appointmentDate: string,
    appointmentTime: string,
    patientEmail: string
  ): string {
    // Create hash of the booking parameters
    const key = `${orgId}:${appointmentDate}:${appointmentTime}:${patientEmail}`;
    return key;
  }

  /**
   * Check if this booking was recently attempted
   *
   * @param orgId - Organization ID
   * @param appointmentDate - ISO date
   * @param appointmentTime - Time
   * @param patientEmail - Patient email
   * @returns Cached result if found and not expired, null otherwise
   */
  getCachedResult(
    orgId: string,
    appointmentDate: string,
    appointmentTime: string,
    patientEmail: string
  ): any | null {
    const key = this.generateCacheKey(orgId, appointmentDate, appointmentTime, patientEmail);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      log.info('BookingDeduplicator', 'Cache entry expired', { key });
      return null;
    }

    const age = Date.now() - cached.timestamp;
    log.info('BookingDeduplicator', '⚠️ DUPLICATE BOOKING DETECTED', {
      key,
      ageMs: age,
      action: 'RETURNING_CACHED_RESULT'
    });

    return cached.result;
  }

  /**
   * Cache a booking result
   *
   * @param orgId - Organization ID
   * @param appointmentDate - ISO date
   * @param appointmentTime - Time
   * @param patientEmail - Patient email
   * @param result - The booking result to cache
   * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
   */
  cacheResult(
    orgId: string,
    appointmentDate: string,
    appointmentTime: string,
    patientEmail: string,
    result: any,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): void {
    const key = this.generateCacheKey(orgId, appointmentDate, appointmentTime, patientEmail);
    const now = Date.now();

    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + ttlMs
    });

    log.info('BookingDeduplicator', 'Booking result cached', {
      key,
      ttlMs,
      expiresAt: new Date(now + ttlMs).toISOString()
    });
  }

  /**
   * Clear cache (for testing or manual reset)
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    log.info('BookingDeduplicator', 'Cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache stats (for monitoring)
   */
  getStats(): { size: number; entries: Array<{ key: string; expiresIn: number }> } {
    const entries: Array<{ key: string; expiresIn: number }> = [];

    this.cache.forEach((cached, key) => {
      entries.push({
        key,
        expiresIn: Math.max(0, cached.expiresAt - Date.now())
      });
    });

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Auto-cleanup expired entries (call periodically)
   */
  cleanupExpired(): number {
    let removed = 0;
    const now = Date.now();

    this.cache.forEach((cached, key) => {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    });

    if (removed > 0) {
      log.info('BookingDeduplicator', 'Expired entries cleaned up', { removed });
    }

    return removed;
  }
}

// Export singleton instance
export const bookingDeduplicator = new BookingDeduplicator();

// Auto-cleanup expired entries every minute (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    bookingDeduplicator.cleanupExpired();
  }, 60 * 1000);
}
