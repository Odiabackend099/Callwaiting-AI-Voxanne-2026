/**
 * System Test Helpers
 *
 * Shared utilities for system-level journey tests.
 * Wraps supertest with auth, provides DB assertion helpers,
 * and exposes seed helpers for building test fixtures.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import app from '../../server';
import { TestUser } from '../../tests/integration/utils/auth';
import { supabaseAdmin, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../../tests/integration/utils/db';

// ---------------------------------------------------------------------------
// System test user lifecycle helpers
// ---------------------------------------------------------------------------

const SYSTEM_TEST_PASSWORD = 'SystemTest123!';

/**
 * Creates a test user via the public /api/auth/signup endpoint.
 *
 * Unlike setupTestUser() from integration utils, this does NOT pre-create an org.
 * Instead, it lets the on_auth_user_created Postgres trigger create the org,
 * which matches the real user journey and avoids a unique-email constraint conflict.
 *
 * Returns a TestUser-shaped object with id, email, password, orgId, and token.
 */
export async function setupSystemTestUser(): Promise<TestUser> {
  const uniqueId = randomUUID().substring(0, 8);
  const email = `system-${uniqueId}@voxanne.test`;

  // Use the public signup API — trigger creates the org automatically
  const signupRes = await request(app)
    .post('/api/auth/signup')
    .send({
      firstName: 'System',
      lastName: 'Test',
      email,
      password: SYSTEM_TEST_PASSWORD,
    });

  if (signupRes.status !== 201) {
    throw new Error(
      `Signup failed (${signupRes.status}): ${JSON.stringify(signupRes.body)}`
    );
  }

  // Sign in with a temporary client (don't dirty supabaseAdmin session)
  const tempClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await tempClient.auth.signInWithPassword({ email, password: SYSTEM_TEST_PASSWORD });

  if (signInError) throw new Error(`Failed to sign in: ${signInError.message}`);
  if (!signInData.session) throw new Error('No session returned after sign-in');

  const token = signInData.session.access_token;
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
  );

  if (!payload.app_metadata?.org_id) {
    throw new Error(
      `JWT is missing app_metadata.org_id — trigger may not have fired (user: ${email})`
    );
  }

  return {
    id: signInData.user!.id,
    email,
    password: SYSTEM_TEST_PASSWORD,
    orgId: payload.app_metadata.org_id,
    token,
  };
}

/**
 * Cleans up a user created by setupSystemTestUser().
 * Deletes the auth user (cascades to profiles) and the organization.
 */
export async function teardownSystemTestUser(user: TestUser): Promise<void> {
  if (!user) return;
  const safeDelete = (p: any) => Promise.resolve(p).catch(() => null);
  await safeDelete((supabaseAdmin as any).auth.admin.deleteUser(user.id));
  await safeDelete((supabaseAdmin as any).from('organizations').delete().eq('id', user.orgId));
}

// ---------------------------------------------------------------------------
// Authenticated request factory
// ---------------------------------------------------------------------------

/**
 * Returns an object with HTTP methods pre-configured with the user's JWT.
 * Usage:
 *   const api = apiAs(user);
 *   const res = await api.get('/api/contacts');
 */
export function apiAs(user: TestUser) {
  const auth = `Bearer ${user.token}`;
  return {
    get: (path: string) =>
      request(app).get(path).set('Authorization', auth),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Authorization', auth).send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Authorization', auth).send(body ?? {}),
    delete: (path: string) =>
      request(app).delete(path).set('Authorization', auth),
  };
}

// ---------------------------------------------------------------------------
// Database assertion helpers (bypass RLS with service-role client)
// ---------------------------------------------------------------------------

/**
 * Asserts that at least one row exists in `table` matching `where`.
 * Returns the matching rows.
 */
export async function assertRowExists(
  table: string,
  where: Record<string, any>
): Promise<any[]> {
  let query = (supabaseAdmin as any).from(table).select('*');
  for (const [key, val] of Object.entries(where)) {
    query = query.eq(key, val);
  }
  const { data, error } = await query;
  if (error) throw new Error(`DB query failed on ${table}: ${error.message}`);
  expect(data).toBeDefined();
  expect(data.length).toBeGreaterThan(0);
  return data;
}

/**
 * Asserts that exactly `count` rows exist in `table` matching `where`.
 */
export async function assertRowCount(
  table: string,
  where: Record<string, any>,
  count: number
): Promise<void> {
  let query = (supabaseAdmin as any).from(table).select('*');
  for (const [key, val] of Object.entries(where)) {
    query = query.eq(key, val);
  }
  const { data, error } = await query;
  if (error) throw new Error(`DB query failed on ${table}: ${error.message}`);
  expect(data?.length ?? 0).toBe(count);
}

/**
 * Fetches the first matching row from `table` and asserts a column value.
 */
export async function assertColumnEquals(
  table: string,
  where: Record<string, any>,
  column: string,
  expected: any
): Promise<void> {
  const rows = await assertRowExists(table, where);
  expect(rows[0][column]).toBe(expected);
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Inserts a wallet credit for the org (simulates a Stripe payment webhook).
 * Returns the transaction id.
 */
export async function seedWalletCredit(
  orgId: string,
  amountPence: number,
  description = 'System test credit'
): Promise<string> {
  // Use the add_wallet_credits RPC which atomically updates
  // organizations.wallet_balance_pence AND inserts a credit_transactions row
  // with the required balance_before/after snapshot.
  const { data, error } = await (supabaseAdmin as any).rpc('add_wallet_credits', {
    p_org_id: orgId,
    p_amount_pence: amountPence,
    p_type: 'topup',
    p_description: description,
    p_created_by: 'system-test',
  });

  if (error) throw new Error(`Failed to seed wallet credit: ${error.message}`);
  if (data && !data.success) throw new Error(`add_wallet_credits RPC error: ${data.error}`);
  return data?.transaction_id ?? '';
}

/**
 * Inserts a fake call record for the org (used for testing dashboard APIs).
 * Returns the call id.
 */
export async function seedCall(
  orgId: string,
  overrides: Record<string, any> = {}
): Promise<string> {
  const { data, error } = await (supabaseAdmin as any)
    .from('calls')
    .insert({
      org_id: orgId,
      vapi_call_id: `system-test-call-${randomUUID()}`,
      status: 'completed',
      call_direction: 'inbound',
      duration_seconds: 120,
      from_number: '+15559990000',
      to_number: '+15550000001',
      caller_name: 'System Test Caller',
      created_at: new Date().toISOString(),
      ...overrides,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to seed call: ${error.message}`);
  return data.id;
}

/**
 * Builds a minimal Vapi end-of-call-report webhook payload.
 * The org is resolved via call.metadata.org_id (fallback mechanism).
 */
export function buildVapiEndOfCallPayload(
  orgId: string,
  callId: string,
  overrides: Record<string, any> = {}
): object {
  return {
    message: {
      type: 'end-of-call-report',
      endedReason: 'customer-ended-call',
      call: {
        id: callId,
        assistantId: null,
        customer: { number: '+15559990001' },
        duration: 95,
        metadata: { org_id: orgId },
        ...overrides.call,
      },
      artifact: {
        transcript: 'Patient: I would like to book an appointment. Agent: Sure, I can help with that.',
        messages: [],
        ...overrides.artifact,
      },
      analysis: {
        summary: 'Patient called to book an appointment.',
        successEvaluation: 'true',
        ...overrides.analysis,
      },
      ...overrides.message,
    },
  };
}

/**
 * Generates a unique phone number string safe for test contacts.
 */
export function uniquePhone(): string {
  const digits = randomUUID().replace(/-/g, '').substring(0, 10);
  return `+1${digits}`;
}
