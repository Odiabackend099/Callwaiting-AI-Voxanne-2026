/**
 * UAT Data Helpers
 *
 * Seed and query test data using Supabase service-role key.
 * Pattern borrowed from backend/src/__tests__/system/helpers.ts.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.UAT_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.UAT_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEMO_ORG_ID = process.env.UAT_DEMO_ORG_ID || '46cf2995-2bee-44e3-838b-24151486fe4e';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Returns the demo org ID for data seeding.
 */
export function getDemoOrgId(): string {
  return DEMO_ORG_ID;
}

/**
 * Checks if Supabase is available for data helpers.
 */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

/**
 * Seed a test contact into the demo org.
 * Returns the contact id.
 */
export async function seedContact(
  orgId: string = DEMO_ORG_ID,
  overrides: Record<string, any> = {}
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured for UAT data helpers');

  const uuid = Math.random().toString(36).substring(2, 10);
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      org_id: orgId,
      first_name: `UAT-${uuid}`,
      last_name: 'TestContact',
      phone: `+1555${uuid.padEnd(7, '0').substring(0, 7)}`,
      email: `uat-${uuid}@test.voxanne.ai`,
      lead_status: 'new',
      lead_score: 50,
      ...overrides,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to seed contact: ${error.message}`);
  return data.id;
}

/**
 * Seed a test call record into the demo org.
 * Returns the call id.
 */
export async function seedCall(
  orgId: string = DEMO_ORG_ID,
  overrides: Record<string, any> = {}
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured for UAT data helpers');

  const uuid = Math.random().toString(36).substring(2, 10);
  const { data, error } = await supabase
    .from('calls')
    .insert({
      org_id: orgId,
      vapi_call_id: `uat-call-${uuid}`,
      status: 'completed',
      call_direction: 'inbound',
      duration_seconds: 120,
      from_number: `+1555${uuid.padEnd(7, '0').substring(0, 7)}`,
      to_number: '+15550000001',
      caller_name: `UAT Caller ${uuid}`,
      created_at: new Date().toISOString(),
      ...overrides,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to seed call: ${error.message}`);
  return data.id;
}

/**
 * Clean up UAT-seeded data (contacts, calls) by prefix.
 */
export async function cleanupUatData(orgId: string = DEMO_ORG_ID): Promise<void> {
  if (!supabase) return;

  // Delete UAT contacts
  await supabase.from('contacts').delete().eq('org_id', orgId).like('first_name', 'UAT-%');
  // Delete UAT calls
  await supabase.from('calls').delete().eq('org_id', orgId).like('vapi_call_id', 'uat-call-%');
}

/**
 * Get the current wallet balance for an org (in pence).
 */
export async function getWalletBalancePence(orgId: string = DEMO_ORG_ID): Promise<number> {
  if (!supabase) throw new Error('Supabase not configured for UAT data helpers');

  const { data, error } = await supabase
    .from('organizations')
    .select('wallet_balance_pence')
    .eq('id', orgId)
    .single();

  if (error) throw new Error(`Failed to get wallet balance: ${error.message}`);
  return data?.wallet_balance_pence ?? 0;
}
