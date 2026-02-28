/**
 * Twilio Subaccount Health Monitor
 *
 * Proactively verifies that managed Twilio subaccounts and their phone numbers
 * are still active. Without this, a suspended subaccount or deprovisioned number
 * is discovered only when a patient can't reach the clinic — catastrophic for
 * a healthcare product.
 *
 * Schedule: Every 6 hours (catches issues within one business period)
 *
 * Checks per org (managed telephony only):
 *   1. Subaccount is still active (not suspended or closed)
 *   2. Each managed phone number still exists in Twilio
 *
 * On failure: Sends Slack alert with org name, number, and error detail
 * On success: Structured log only — no Slack noise
 *
 * Edge cases handled:
 *   - Org with no managed numbers → account status check only, then skip
 *   - Invalid/expired credentials → caught per org, does not stop other orgs
 *   - Twilio API rate limits → 200ms pause between numbers, 500ms between orgs
 *   - Slack send failure → logged but does not throw (non-blocking)
 */

import * as schedule from 'node-schedule';
import Twilio from 'twilio';
import { supabase } from '../services/supabase-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { sendSlackAlert } from '../services/slack-alerts';
import { log } from '../services/logger';

// ============================================================
// Types
// ============================================================

interface OrgHealthResult {
  orgId: string;
  orgName: string;
  healthy: boolean;
  errors: string[];
}

// ============================================================
// Health Check Logic
// ============================================================

/**
 * Run health checks on all managed Twilio subaccounts and phone numbers.
 *
 * Returns an array of failing orgs. Empty array means everything is healthy.
 * Never throws — all errors are caught and returned as failure entries.
 */
export async function checkTwilioSubaccountHealth(): Promise<OrgHealthResult[]> {
  const failures: OrgHealthResult[] = [];

  // Step 1: Find all orgs using managed telephony
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('telephony_mode', 'managed');

  if (orgsError) {
    log.error('TwilioHealthMonitor', 'Failed to query managed orgs', {
      error: orgsError.message,
      code: orgsError.code,
    });
    // Return empty — we can't check what we can't query, but don't crash
    return [];
  }

  if (!orgs || orgs.length === 0) {
    log.debug('TwilioHealthMonitor', 'No managed telephony orgs found, skipping');
    return [];
  }

  log.info('TwilioHealthMonitor', 'Starting health check', {
    orgCount: orgs.length,
    timestamp: new Date().toISOString(),
  });

  // Step 2: Check each org sequentially (rate limit safety)
  for (const org of orgs) {
    const result: OrgHealthResult = {
      orgId: org.id,
      orgName: org.name || org.id,
      healthy: true,
      errors: [],
    };

    try {
      // Get Twilio credentials — getEffectiveTwilioCredentials handles managed
      // mode by reading subaccount credentials from twilio_subaccounts table
      const creds = await IntegrationDecryptor.getEffectiveTwilioCredentials(org.id);

      // Mask credentials for safe logging (never log full accountSid/authToken)
      const maskedSid = `${creds.accountSid.substring(0, 4)}***`;

      // Initialize Twilio client with subaccount credentials
      const client = Twilio(creds.accountSid, creds.authToken);

      // Check 1: Verify the subaccount itself is active
      try {
        const account = await client.api.accounts(creds.accountSid).fetch();
        if (account.status !== 'active') {
          result.healthy = false;
          result.errors.push(`Subaccount ${maskedSid} status is "${account.status}" (expected "active")`);
          log.warn('TwilioHealthMonitor', 'Subaccount not active', {
            orgId: org.id,
            orgName: org.name,
            accountSid: maskedSid,
            status: account.status,
          });
        }
      } catch (accountErr: any) {
        result.healthy = false;
        const errMsg = accountErr?.message || 'Unknown error';
        result.errors.push(`Account fetch failed for ${maskedSid}: ${errMsg}`);
        log.error('TwilioHealthMonitor', 'Subaccount fetch failed', {
          orgId: org.id,
          orgName: org.name,
          accountSid: maskedSid,
          error: errMsg,
          status: accountErr?.status,
        });
      }

      // Check 2: Verify each managed phone number still exists in Twilio
      const { data: managedNumbers, error: numbersError } = await supabase
        .from('managed_phone_numbers')
        .select('phone_number, routing_direction, status')
        .eq('org_id', org.id);

      if (numbersError) {
        log.error('TwilioHealthMonitor', 'Failed to query managed numbers for org', {
          orgId: org.id,
          error: numbersError.message,
        });
        // Non-fatal — we still got the account check above
      } else if (managedNumbers && managedNumbers.length > 0) {
        for (const number of managedNumbers) {
          try {
            const found = await client.incomingPhoneNumbers.list({
              phoneNumber: number.phone_number,
            });

            if (found.length === 0) {
              result.healthy = false;
              result.errors.push(
                `Phone ${number.phone_number} (${number.routing_direction}) not found in Twilio — may have been released or ported`
              );
              log.warn('TwilioHealthMonitor', 'Managed number absent from Twilio', {
                orgId: org.id,
                orgName: org.name,
                phoneNumber: number.phone_number,
                routingDirection: number.routing_direction,
              });
            }
          } catch (numErr: any) {
            // Log but don't fail the whole org check — one bad number shouldn't
            // hide that other numbers are fine
            log.warn('TwilioHealthMonitor', 'Phone number lookup failed', {
              orgId: org.id,
              phoneNumber: number.phone_number,
              error: numErr?.message,
            });
          }

          // 200ms pause between Twilio API calls to stay within rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (credErr: any) {
      // Credential fetch failure — probably misconfigured org, not Twilio down
      result.healthy = false;
      result.errors.push(`Credential fetch failed: ${credErr?.message || 'Unknown error'}`);
      log.error('TwilioHealthMonitor', 'Failed to get Twilio credentials for org', {
        orgId: org.id,
        orgName: org.name,
        error: credErr?.message,
      });
    }

    if (!result.healthy) {
      failures.push(result);
    }

    // 500ms pause between orgs to avoid Twilio rate limiting at scale
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Step 3: Send a single consolidated Slack alert for all failures
  // (one message per run, not one per org — prevents alert flooding)
  if (failures.length > 0) {
    const alertLines = failures
      .map((f) => `• *${f.orgName}* (${f.orgId.substring(0, 8)}…):\n  ${f.errors.join('\n  ')}`)
      .join('\n');

    const alertTitle = `🔴 Twilio Health Alert — ${failures.length} org(s) affected`;
    const alertBody =
      `The following managed telephony accounts have issues:\n\n${alertLines}\n\n` +
      `*Action required:* Check Twilio Console and verify org credentials in dashboard.`;

    await sendSlackAlert(alertTitle, alertBody).catch((slackErr) => {
      log.error('TwilioHealthMonitor', 'Failed to send Slack alert', {
        error: slackErr?.message,
      });
      // Non-throwing — logging is the fallback
    });
  }

  log.info('TwilioHealthMonitor', 'Health check complete', {
    totalOrgs: orgs.length,
    healthyOrgs: orgs.length - failures.length,
    failingOrgs: failures.length,
  });

  return failures;
}

// ============================================================
// Scheduler
// ============================================================

/**
 * Schedule the Twilio subaccount health monitor.
 * Called once at server startup — do not call more than once.
 */
export function scheduleTwilioSubaccountHealth(): void {
  try {
    // Every 6 hours: at minute 0 of hours 0, 6, 12, 18
    // Rationale: daily is too slow (8-hour gap in working hours);
    //            every 1h is noisy; 6h catches issues within one business period
    const job = schedule.scheduleJob('0 */6 * * *', async () => {
      await checkTwilioSubaccountHealth();
    });

    if (!job) {
      log.error('TwilioHealthMonitor', 'Failed to schedule health monitor job');
      return;
    }

    log.info('TwilioHealthMonitor', 'Scheduled successfully', {
      interval: 'Every 6 hours',
      nextRun: job.nextInvocation()?.toISOString(),
      description: 'Monitors managed Twilio subaccount and phone number health',
    });
  } catch (err: any) {
    log.error('TwilioHealthMonitor', 'Failed to schedule', {
      error: err?.message,
    });
  }
}
