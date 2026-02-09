/**
 * P0-5: Daily Vapi Call Reconciliation
 *
 * CRITICAL DISCOVERY: Vapi webhooks are NOT 100% reliable (95-98% based on community reports)
 * - Missing end-of-call-report webhooks (intermittent)
 * - No webhooks for failed/busy/no-answer calls
 * - Race conditions under high load
 *
 * REVENUE IMPACT:
 * - 1,000 calls/month × 3% missed webhooks × $0.30/call = $9/month lost
 * - Annual: $108 (breaks even after 4 hours of dev work)
 * - At 10,000 calls/month: $1,080/year lost
 *
 * SOLUTION:
 * - Daily API reconciliation to catch missing 2-5% of calls
 * - Compare Vapi API (source of truth) with database
 * - Insert missing calls with `reconciled: true` flag
 * - Deduct wallet credits for recovered calls
 * - Alert if >5% missing (indicates webhook reliability issue)
 */

import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';

const logger = createLogger('VapiReconciliation');

interface VapiCall {
  id: string;
  orgId: string;
  assistantId: string;
  phoneNumberId: string;
  customer: {
    number: string;
  };
  duration?: number;
  status: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  costBreakdown?: {
    total: number;
    // ... other cost fields
  };
}

interface ReconciliationResult {
  totalChecked: number;
  missingFound: number;
  recovered: number;
  webhookReliability: number;
  errors: string[];
}

/**
 * Fetch all calls from Vapi API for a given time range
 * Uses pagination to handle >100 calls
 */
async function fetchVapiCalls(startDate: Date, endDate: Date): Promise<VapiCall[]> {
  const allCalls: VapiCall[] = [];
  let page = 1;
  const limit = 100; // Vapi API max

  while (true) {
    try {
      const url = new URL('https://api.vapi.ai/call');
      url.searchParams.set('createdAtGe', startDate.toISOString());
      url.searchParams.set('createdAtLe', endDate.toISOString());
      url.searchParams.set('limit', limit.toString());

      // Pagination (if Vapi supports it - adjust based on actual API)
      if (page > 1) {
        url.searchParams.set('page', page.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`Vapi API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();

      // Handle both array response and paginated response
      const calls = Array.isArray(data) ? data : (data.data || []);

      if (calls.length === 0) {
        break; // No more results
      }

      allCalls.push(...calls);

      // If we got less than limit, we've reached the end
      if (calls.length < limit) {
        break;
      }

      page++;
    } catch (error) {
      logger.error('Error fetching Vapi calls', {
        page,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  return allCalls;
}

/**
 * Deduct wallet credits for a recovered call
 */
async function deductWalletCredits(orgId: string, amount: number, vapiCallId: string) {
  try {
    // Convert dollar amount to pence (1 cent = 1 penny)
    const amountPence = Math.round(amount * 100);

    // Call wallet deduction RPC
    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_org_id: orgId,
      p_amount_pence: amountPence,
      p_vapi_call_id: vapiCallId,
      p_cost_breakdown: { total: amount }
    });

    if (error) {
      logger.error('Failed to deduct wallet credits', {
        orgId,
        vapiCallId,
        amount,
        error: error.message
      });
      return false;
    }

    if (data && !data.success) {
      logger.warn('Wallet deduction unsuccessful', {
        orgId,
        vapiCallId,
        amount,
        reason: data.error
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Exception deducting wallet credits', {
      orgId,
      vapiCallId,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Send Slack alert if webhook reliability drops below threshold
 */
async function sendSlackAlert(title: string, details: Record<string, any>) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    logger.warn('Slack webhook URL not configured, skipping alert');
    return;
  }

  try {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${title}*`
            }
          },
          {
            type: 'section',
            fields: Object.entries(details).map(([key, value]) => ({
              type: 'mrkdwn',
              text: `*${key}:*\n${value}`
            }))
          }
        ]
      })
    });
  } catch (error) {
    logger.error('Failed to send Slack alert', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Main reconciliation function
 * Compares Vapi API calls with database calls, recovers missing ones
 */
export async function reconcileVapiCalls(): Promise<ReconciliationResult> {
  const startTime = Date.now();

  // Reconcile last 48 hours (catches any missed webhooks)
  const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const now = new Date();

  logger.info('Starting Vapi call reconciliation', {
    startDate: cutoffDate.toISOString(),
    endDate: now.toISOString()
  });

  const result: ReconciliationResult = {
    totalChecked: 0,
    missingFound: 0,
    recovered: 0,
    webhookReliability: 100,
    errors: []
  };

  try {
    // Step 1: Fetch all calls from Vapi API
    const apiCalls = await fetchVapiCalls(cutoffDate, now);
    result.totalChecked = apiCalls.length;

    logger.info('Fetched calls from Vapi API', {
      count: apiCalls.length,
      timeRange: `${cutoffDate.toISOString()} to ${now.toISOString()}`
    });

    if (apiCalls.length === 0) {
      logger.info('No calls to reconcile (empty time range)');
      return result;
    }

    // Step 2: Get all calls from database in same time range
    const { data: dbCalls, error: dbError } = await supabase
      .from('calls')
      .select('vapi_call_id, cost_breakdown, org_id, reconciled')
      .gte('created_at', cutoffDate.toISOString())
      .lte('created_at', now.toISOString());

    if (dbError) {
      throw new Error(`Failed to fetch database calls: ${dbError.message}`);
    }

    const dbCallIds = new Set((dbCalls || []).map(c => c.vapi_call_id));

    logger.info('Fetched calls from database', {
      count: dbCalls?.length || 0,
      alreadyReconciled: (dbCalls || []).filter(c => c.reconciled).length
    });

    // Step 3: Find missing calls (webhook never arrived)
    const missingCalls = apiCalls.filter(c => !dbCallIds.has(c.id));
    result.missingFound = missingCalls.length;

    if (missingCalls.length === 0) {
      logger.info('No missing calls found - webhook reliability is 100%');
      result.webhookReliability = 100;
      return result;
    }

    // Calculate webhook reliability percentage
    result.webhookReliability = ((apiCalls.length - missingCalls.length) / apiCalls.length) * 100;

    logger.warn('Vapi reconciliation found missing calls', {
      totalApiCalls: apiCalls.length,
      totalDbCalls: dbCalls?.length || 0,
      missingCount: missingCalls.length,
      webhookReliability: `${result.webhookReliability.toFixed(2)}%`
    });

    // Step 4: Insert missing calls and deduct credits
    for (const call of missingCalls) {
      try {
        // Determine call direction
        const callDirection = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

        // Insert call record with reconciled flag
        const { error: insertError } = await supabase.from('calls').insert({
          org_id: call.orgId,
          vapi_call_id: call.id,
          vapi_assistant_id: call.assistantId,
          phone_number: call.customer?.number,
          call_direction: callDirection,
          status: call.status,
          duration_seconds: call.duration || 0,
          cost_breakdown: call.costBreakdown || { total: 0 },
          created_at: call.createdAt,
          updated_at: call.updatedAt,
          ended_at: call.endedAt,
          reconciled: true // Flag as recovered via reconciliation
        }).select().single();

        if (insertError) {
          logger.error('Failed to insert reconciled call', {
            vapiCallId: call.id,
            orgId: call.orgId,
            error: insertError.message
          });
          result.errors.push(`Insert failed for ${call.id}: ${insertError.message}`);
          continue;
        }

        // Deduct wallet credits
        const cost = call.costBreakdown?.total || 0;
        if (cost > 0) {
          const deducted = await deductWalletCredits(call.orgId, cost, call.id);

          if (deducted) {
            result.recovered++;
            logger.info('Reconciled call and deducted credits', {
              vapiCallId: call.id,
              orgId: call.orgId,
              cost,
              duration: call.duration
            });
          } else {
            result.errors.push(`Deduction failed for ${call.id} (call inserted but not billed)`);
          }
        } else {
          // No cost to deduct (e.g., failed call)
          result.recovered++;
          logger.info('Reconciled zero-cost call', {
            vapiCallId: call.id,
            orgId: call.orgId,
            status: call.status
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Error reconciling individual call', {
          vapiCallId: call.id,
          error: errorMsg
        });
        result.errors.push(`Error reconciling ${call.id}: ${errorMsg}`);
      }
    }

    // Step 5: Alert if webhook reliability is below 95%
    if (result.webhookReliability < 95) {
      await sendSlackAlert('🚨 VAPI WEBHOOK RELIABILITY ISSUE', {
        'Missing Calls': missingCalls.length,
        'Total Calls': apiCalls.length,
        'Webhook Reliability': `${result.webhookReliability.toFixed(2)}%`,
        'Recovered': result.recovered,
        'Message': 'Vapi webhook reliability below 95% - investigate immediately'
      });
    } else if (missingCalls.length > 0) {
      // Informational alert for recovered calls (not critical)
      await sendSlackAlert('✅ Vapi Reconciliation: Calls Recovered', {
        'Recovered Calls': result.recovered,
        'Total Calls': apiCalls.length,
        'Webhook Reliability': `${result.webhookReliability.toFixed(2)}%`,
        'Revenue Protected': `$${((result.recovered * 0.30).toFixed(2))}` // Estimate
      });
    }

    const duration = Date.now() - startTime;
    logger.info('Vapi reconciliation complete', {
      ...result,
      durationMs: duration
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Vapi reconciliation failed', {
      error: errorMsg,
      durationMs: Date.now() - startTime
    });

    result.errors.push(`Reconciliation failed: ${errorMsg}`);

    // Send critical alert on reconciliation failure
    await sendSlackAlert('🚨 CRITICAL: Vapi Reconciliation Job Failed', {
      'Error': errorMsg,
      'Time Range': `${cutoffDate.toISOString()} to ${now.toISOString()}`,
      'Impact': 'Calls may be missing from billing system'
    });

    throw error;
  }
}

/**
 * Export for testing
 */
export const _internal = {
  fetchVapiCalls,
  deductWalletCredits,
  sendSlackAlert
};
