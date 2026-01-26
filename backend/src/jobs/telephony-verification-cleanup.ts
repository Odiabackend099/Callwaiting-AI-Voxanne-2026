/**
 * Telephony Verification Cleanup Job
 * Runs daily to clean up expired and failed verification records
 *
 * Cleans up:
 * 1. Expired verifications (10+ minutes past expiration)
 * 2. Failed verifications (status='failed', older than 24 hours)
 * 3. Pending verifications older than 24 hours
 *
 * This prevents database bloat and ensures accurate verification metrics.
 */

import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';

const logger = createLogger('TelephonyVerificationCleanup');

interface ExpiredVerification {
  id: string;
  org_id: string;
  phone_number: string;
  status: string;
  verification_code_expires_at: string | null;
  created_at: string;
}

/**
 * Detect expired verifications for cleanup
 * Returns records that are:
 * - Status 'pending' with expired code (>10 min past expiry)
 * - Status 'failed' and older than 24 hours
 * - Status 'expired' and older than 24 hours
 */
async function detectExpiredVerifications(orgId: string): Promise<ExpiredVerification[]> {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Query 1: Pending verifications with expired codes (>10 min grace period)
  const { data: expiredPending, error: error1 } = await supabase
    .from('verified_caller_ids')
    .select('id, org_id, phone_number, status, verification_code_expires_at, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .not('verification_code_expires_at', 'is', null)
    .lt('verification_code_expires_at', tenMinutesAgo);

  if (error1) {
    logger.error('Failed to query expired pending verifications', {
      orgId,
      error: error1.message
    });
  }

  // Query 2: Failed/expired verifications older than 24 hours
  const { data: oldFailed, error: error2 } = await supabase
    .from('verified_caller_ids')
    .select('id, org_id, phone_number, status, verification_code_expires_at, created_at')
    .eq('org_id', orgId)
    .in('status', ['failed', 'expired'])
    .lt('created_at', twentyFourHoursAgo);

  if (error2) {
    logger.error('Failed to query old failed verifications', {
      orgId,
      error: error2.message
    });
  }

  return [...(expiredPending || []), ...(oldFailed || [])];
}

/**
 * Mark expired pending verification as 'expired' status
 */
async function markVerificationExpired(verificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('verified_caller_ids')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('id', verificationId)
    .eq('status', 'pending'); // Only update if still pending

  if (error) {
    logger.error('Failed to mark verification as expired', {
      verificationId,
      error: error.message
    });
    return false;
  }

  return true;
}

/**
 * Delete old failed/expired verification
 * Only deletes if NOT associated with any active forwarding config
 */
async function deleteExpiredVerification(verificationId: string): Promise<boolean> {
  // Check if verification has active forwarding config
  const { data: configs, error: configError } = await supabase
    .from('hybrid_forwarding_configs')
    .select('id')
    .eq('verified_caller_id', verificationId)
    .in('status', ['pending_setup', 'active']);

  if (configError) {
    logger.error('Failed to check forwarding configs', {
      verificationId,
      error: configError.message
    });
    return false;
  }

  // Don't delete if has active configs
  if (configs && configs.length > 0) {
    logger.debug('Skipping deletion - verification has active configs', {
      verificationId,
      configCount: configs.length
    });
    return false;
  }

  // Safe to delete
  const { error } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('id', verificationId);

  if (error) {
    logger.error('Failed to delete expired verification', {
      verificationId,
      error: error.message
    });
    return false;
  }

  return true;
}

/**
 * Main cleanup job
 * Processes per-org for tenant isolation
 */
export async function runTelephonyVerificationCleanup(): Promise<void> {
  const startTime = Date.now();
  logger.info('Starting telephony verification cleanup job');

  try {
    // 1. Get all active organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');

    if (orgError) {
      logger.error('Failed to fetch organizations', { error: orgError.message });
      return;
    }

    if (!orgs || orgs.length === 0) {
      logger.info('No active organizations found');
      return;
    }

    logger.info('Processing organizations', { count: orgs.length });

    // 2. Process each org separately (tenant isolation)
    let totalMarkedExpired = 0;
    let totalDeleted = 0;
    let totalFailed = 0;

    for (const org of orgs) {
      try {
        // Detect expired verifications for this org
        const expired = await detectExpiredVerifications(org.id);

        if (expired.length === 0) {
          continue;
        }

        logger.info('Detected expired verifications', {
          orgId: org.id,
          count: expired.length
        });

        let orgMarkedExpired = 0;
        let orgDeleted = 0;
        let orgFailed = 0;

        for (const verification of expired) {
          try {
            if (verification.status === 'pending') {
              // Mark as expired first
              const marked = await markVerificationExpired(verification.id);
              if (marked) {
                orgMarkedExpired++;
                totalMarkedExpired++;
                logger.debug('Marked verification as expired', {
                  verificationId: verification.id,
                  phoneNumber: verification.phone_number
                });
              }
            } else {
              // Delete failed/expired older than 24h
              const deleted = await deleteExpiredVerification(verification.id);
              if (deleted) {
                orgDeleted++;
                totalDeleted++;
                logger.debug('Deleted expired verification', {
                  verificationId: verification.id,
                  phoneNumber: verification.phone_number,
                  status: verification.status
                });
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error processing expired verification', {
              verificationId: verification.id,
              orgId: org.id,
              error: errorMessage
            });
            orgFailed++;
            totalFailed++;
          }
        }

        if (orgMarkedExpired > 0 || orgDeleted > 0 || orgFailed > 0) {
          logger.info('Org cleanup summary', {
            orgId: org.id,
            markedExpired: orgMarkedExpired,
            deleted: orgDeleted,
            failed: orgFailed
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error processing org', {
          orgId: org.id,
          error: errorMessage
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Verification cleanup completed', {
      markedExpired: totalMarkedExpired,
      deleted: totalDeleted,
      failed: totalFailed,
      orgCount: orgs.length,
      durationMs: duration
    });

    // Alert if too many failures
    if (totalFailed > 10) {
      logger.warn('High failure rate in verification cleanup', {
        failedCount: totalFailed
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Verification cleanup job failed', { error: errorMessage });
  }
}

/**
 * Schedule cleanup job to run daily at 3 AM UTC
 * Runs 1 hour after orphan recording cleanup to stagger load
 */
export function scheduleTelephonyVerificationCleanup(): void {
  // Calculate time until next 3 AM UTC
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setUTCHours(3, 0, 0, 0);

  if (next3AM <= now) {
    next3AM.setUTCDate(next3AM.getUTCDate() + 1);
  }

  const timeUntilNext = next3AM.getTime() - now.getTime();

  logger.info('Scheduling telephony verification cleanup', {
    nextRun: next3AM.toISOString()
  });

  // Schedule first run
  setTimeout(() => {
    runTelephonyVerificationCleanup();
    // Then run daily
    setInterval(() => {
      runTelephonyVerificationCleanup();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilNext);
}
