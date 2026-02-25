/**
 * Onboarding Cart Abandonment Job
 *
 * Detects users who viewed the payment step but never completed payment,
 * then sends a 3-email sequence to recover them:
 *
 *   Email 1 (>=1hr):   Soft nudge — "Your AI receptionist is almost ready"
 *   Email 2 (>=24hr):  Pain reminder — "How many calls did you miss today?"
 *   Email 3 (>=48hr):  Objection killer — "£10 credit applied to your account"
 *
 * Schedule: Every 15 minutes via setInterval
 */

import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';
import { EmailServiceV2 } from '../services/email-service-v2';
import { addCredits } from '../services/wallet-service';

const logger = createLogger('OnboardingAbandonment');

// Timing thresholds (in milliseconds)
const THRESHOLDS = {
  email1: 1 * 60 * 60 * 1000,       // 1 hour
  email2: 24 * 60 * 60 * 1000,      // 24 hours
  email3: 48 * 60 * 60 * 1000,      // 48 hours
};

const CREDIT_AMOUNT_PENCE = 1000; // £10 credit for email 3

interface AbandonedOrg {
  org_id: string;
  clinic_name: string | null;
  user_email: string;
  payment_viewed_at: string;
}

/**
 * Find orgs that viewed payment but never completed onboarding.
 * Excludes orgs where onboarding_completed_at IS NOT NULL (Fix 9).
 */
async function findAbandonedOrgs(): Promise<AbandonedOrg[]> {
  // Get orgs that have payment_viewed but not payment_success
  const { data: viewedOrgs, error: viewedError } = await supabase
    .from('onboarding_events')
    .select('org_id, created_at')
    .eq('event_name', 'payment_viewed')
    .order('created_at', { ascending: true });

  if (viewedError || !viewedOrgs?.length) return [];

  // Get orgs that completed payment
  const { data: paidOrgs } = await supabase
    .from('onboarding_events')
    .select('org_id')
    .eq('event_name', 'payment_success');

  const paidOrgIds = new Set((paidOrgs || []).map((o: any) => o.org_id));

  // Filter to abandoned orgs only (exclude paid)
  const abandonedOrgEntries = viewedOrgs.filter(
    (o: any) => !paidOrgIds.has(o.org_id)
  );

  if (!abandonedOrgEntries.length) return [];

  // Deduplicate org IDs, keeping earliest payment_viewed timestamp
  const earliestByOrg = new Map<string, string>();
  for (const entry of abandonedOrgEntries) {
    const existing = earliestByOrg.get(entry.org_id);
    if (!existing || entry.created_at < existing) {
      earliestByOrg.set(entry.org_id, entry.created_at);
    }
  }

  const orgIds = [...earliestByOrg.keys()];

  // Batch fetch organizations, excluding those that completed onboarding via skip flow (Fix 9)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, clinic_name')
    .in('id', orgIds)
    .is('onboarding_completed_at', null);

  if (!orgs?.length) return [];

  const activeOrgIds = orgs.map((o: any) => o.id);

  // Batch fetch primary user emails — Fix 5 (eliminates N+1 loop)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('org_id, email')
    .in('org_id', activeOrgIds);

  // Build lookup maps
  const orgMap = new Map((orgs || []).map((o: any) => [o.id, o]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.org_id, p]));

  const results: AbandonedOrg[] = [];

  for (const orgId of activeOrgIds) {
    const org = orgMap.get(orgId);
    const profile = profileMap.get(orgId);

    if (!profile?.email) {
      logger.debug('Skipping org — no email found', { orgId });
      continue;
    }

    results.push({
      org_id: orgId,
      clinic_name: org?.clinic_name || null,
      user_email: profile.email,
      payment_viewed_at: earliestByOrg.get(orgId)!,
    });
  }

  return results;
}

/**
 * Record that an abandonment email was sent.
 * UNIQUE constraint on (org_id, sequence_number) prevents duplicate rows.
 */
async function recordEmailSent(
  orgId: string,
  email: string,
  sequenceNumber: number,
  templateName: string,
  resendEmailId?: string,
  creditApplied: boolean = false
): Promise<void> {
  const { error } = await supabase.from('abandonment_emails').insert({
    org_id: orgId,
    user_email: email,
    sequence_number: sequenceNumber,
    template_name: templateName,
    resend_email_id: resendEmailId || null,
    credit_applied: creditApplied,
  });

  if (error) {
    logger.error('Failed to record abandonment email', {
      orgId,
      sequenceNumber,
      error: error.message,
    });
  }
}

/**
 * Main job: process all abandoned orgs and send appropriate emails.
 */
export async function processAbandonmentEmails(): Promise<void> {
  try {
    const abandonedOrgs = await findAbandonedOrgs();

    if (!abandonedOrgs.length) {
      return; // Nothing to process — keep logs quiet
    }

    logger.info('Processing abandonment emails', {
      candidateCount: abandonedOrgs.length,
    });

    const now = Date.now();
    const orgIds = abandonedOrgs.map((o) => o.org_id);

    // Batch fetch all sent emails for candidate orgs — Fix 5 (eliminates per-org N+1)
    const { data: allSentEmails } = await supabase
      .from('abandonment_emails')
      .select('org_id, sequence_number')
      .in('org_id', orgIds);

    const sentEmailsMap = new Map<string, Set<number>>();
    for (const row of (allSentEmails || [])) {
      if (!sentEmailsMap.has(row.org_id)) {
        sentEmailsMap.set(row.org_id, new Set());
      }
      sentEmailsMap.get(row.org_id)!.add(row.sequence_number);
    }

    for (const org of abandonedOrgs) {
      const elapsedMs = now - new Date(org.payment_viewed_at).getTime();
      const sentEmails = sentEmailsMap.get(org.org_id) ?? new Set<number>();

      // Email 3: >=48hr, objection killer with £10 credit
      if (elapsedMs >= THRESHOLDS.email3 && !sentEmails.has(3)) {
        try {
          // CRITICAL FIX (Fix 1): Record FIRST to prevent double credit on retry.
          // The UNIQUE(org_id, sequence_number) constraint ensures only one insert succeeds.
          // Subsequent runs will see sentEmails.has(3) === true and skip,
          // regardless of whether the credit or email send subsequently fails.
          await recordEmailSent(
            org.org_id,
            org.user_email,
            3,
            'abandonment_objection_killer',
            undefined,
            false
          );

          // Apply the £10 credit after securing the idempotency record
          const creditResult = await addCredits(
            org.org_id,
            CREDIT_AMOUNT_PENCE,
            'bonus',
            undefined,
            undefined,
            'Onboarding abandonment: £10 welcome credit',
            'system:abandonment-job'
          );

          const result = await EmailServiceV2.sendAbandonmentObjectionKiller(
            org.user_email,
            org.clinic_name || 'your clinic'
          );

          logger.info('Sent abandonment email 3 (objection killer)', {
            orgId: org.org_id,
            creditApplied: creditResult.success,
            emailId: result.id,
          });
        } catch (err: any) {
          logger.error('Failed to send abandonment email 3', {
            orgId: org.org_id,
            error: err.message,
          });
        }
      }
      // Email 2: >=24hr, pain reminder.
      // Note: else-if is intentional — an org at 48hr that never received email 2
      // goes directly to email 3 on this run (don't flood with back-filled emails).
      else if (elapsedMs >= THRESHOLDS.email2 && !sentEmails.has(2)) {
        try {
          const result = await EmailServiceV2.sendAbandonmentPainReminder(
            org.user_email,
            org.clinic_name || 'your clinic'
          );

          await recordEmailSent(
            org.org_id,
            org.user_email,
            2,
            'abandonment_pain_reminder',
            result.id
          );

          logger.info('Sent abandonment email 2 (pain reminder)', {
            orgId: org.org_id,
          });
        } catch (err: any) {
          logger.error('Failed to send abandonment email 2', {
            orgId: org.org_id,
            error: err.message,
          });
        }
      }
      // Email 1: >=1hr, soft nudge
      else if (elapsedMs >= THRESHOLDS.email1 && !sentEmails.has(1)) {
        try {
          const result = await EmailServiceV2.sendAbandonmentSoftNudge(
            org.user_email,
            org.clinic_name || 'your clinic'
          );

          await recordEmailSent(
            org.org_id,
            org.user_email,
            1,
            'abandonment_soft_nudge',
            result.id
          );

          logger.info('Sent abandonment email 1 (soft nudge)', {
            orgId: org.org_id,
          });
        } catch (err: any) {
          logger.error('Failed to send abandonment email 1', {
            orgId: org.org_id,
            error: err.message,
          });
        }
      }
    }
  } catch (err: any) {
    logger.error('Abandonment job failed', { error: err.message });
  }
}

/**
 * Schedule the abandonment job to run every 15 minutes
 */
export function scheduleAbandonmentEmails(): void {
  logger.info('Scheduling onboarding abandonment job (every 15 minutes)');

  // Run immediately on startup
  processAbandonmentEmails();

  // Then every 15 minutes
  setInterval(() => {
    processAbandonmentEmails();
  }, 15 * 60 * 1000);
}

export default {
  processAbandonmentEmails,
  scheduleAbandonmentEmails,
};
