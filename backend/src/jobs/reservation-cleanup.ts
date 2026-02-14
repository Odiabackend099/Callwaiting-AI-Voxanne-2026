/**
 * Credit Reservation Cleanup Job
 *
 * Periodically cleans up expired credit reservations to prevent credit leaks.
 * If a call fails before the end-of-call webhook fires (network issues, VAPI outage),
 * reserved credits would remain locked indefinitely without this cleanup.
 *
 * Schedule: Runs every 10 minutes
 * Impact: Marks expired reservations, releases credits back to wallet
 *
 * Risk Mitigation:
 * - Prevents permanent credit loss when webhooks fail
 * - Releases credits from abandoned calls (30 min timeout)
 * - Non-blocking: errors are logged but don't crash the app
 */

import * as schedule from 'node-schedule';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

/**
 * Trigger the reservation cleanup RPC function
 * Marks all expired credit_reservations as 'expired'
 */
export async function cleanupExpiredReservations(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_reservations');

    if (error) {
      log.error('ReservationCleanup', 'RPC call failed', {
        error: error.message,
        code: error.code
      });
      return 0;
    }

    const count = (data as number) || 0;

    if (count > 0) {
      log.warn('ReservationCleanup', 'Expired reservations cleaned up', {
        expiredCount: count,
        timestamp: new Date().toISOString()
      });
    } else {
      log.debug('ReservationCleanup', 'No expired reservations found');
    }

    return count;
  } catch (err: any) {
    log.error('ReservationCleanup', 'Unexpected error', {
      error: err?.message,
      stack: err?.stack
    });
    return 0;
  }
}

/**
 * Schedule the reservation cleanup job
 * Called once at server startup
 */
export function scheduleReservationCleanup(): void {
  try {
    // Run every 10 minutes: "*/10 * * * *"
    // This means: 00, 10, 20, 30, 40, 50 minutes of every hour
    const job = schedule.scheduleJob('*/10 * * * *', async () => {
      await cleanupExpiredReservations();
    });

    if (!job) {
      log.error('ReservationCleanup', 'Failed to schedule cleanup job');
      return;
    }

    log.info('ReservationCleanup', 'Scheduled successfully', {
      interval: 'Every 10 minutes',
      nextRun: job.nextInvocation()?.toISOString(),
      description: 'Will clean up expired credit reservations'
    });
  } catch (err: any) {
    log.error('ReservationCleanup', 'Failed to schedule', {
      error: err?.message
    });
  }
}
