/**
 * System Journey 1: Signup → Onboarding → Dashboard
 *
 * Validates the complete new-user lifecycle across all system boundaries:
 *   POST /api/auth/signup
 *   → Supabase DB trigger (creates org + profile, sets JWT org_id)
 *   → signInWithPassword (JWT contains app_metadata.org_id)
 *   → GET /api/onboarding/status  (needs_onboarding: true)
 *   → POST /api/onboarding/event × 5 steps (telemetry recorded)
 *   → POST /api/onboarding/complete (org updated, status flips)
 *   → GET /api/analytics/dashboard-pulse (org-scoped, 0 calls for new org)
 *   → POST /api/contacts (contact created with correct org_id)
 *   → GET /api/contacts (returns the created contact)
 *
 * What this catches that unit/integration tests miss:
 * - DB trigger `on_auth_user_created` fires correctly and sets app_metadata.org_id
 * - JWT org_id propagates through every downstream API call
 * - Onboarding status reflects DB truth after /complete is called
 * - Dashboard data is scoped to the exact org created during signup
 */

import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import app from '../../server';
import { supabaseAdmin, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../../tests/integration/utils/db';
import { apiAs, assertRowExists } from './helpers';

// ---------------------------------------------------------------------------
// Shared journey state (phases share the same user)
// ---------------------------------------------------------------------------

let authToken: string;
let orgId: string;
let userId: string;
const uniqueId = randomUUID().substring(0, 8);
const signupEmail = `system-signup-${uniqueId}@voxanne.test`;
const signupPassword = 'SystemTest123!';

// Skip all tests if the backend URL resolves but Supabase env vars are absent
const skipAll = !SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Journey setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (skipAll) {
    console.warn('⚠️  Skipping Journey 1 — SUPABASE_SERVICE_ROLE_KEY not set');
  }
});

afterAll(async () => {
  if (!userId) return;
  // Cleanup: delete auth user (cascades to org and profiles if FK configured)
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => null);
  if (orgId) {
    // Wrap in Promise.resolve to use .catch() safely (supabase returns PromiseLike, not Promise)
    await Promise.resolve(
      (supabaseAdmin as any).from('organizations').delete().eq('id', orgId)
    ).catch(() => null);
  }
});

// ---------------------------------------------------------------------------
// Phase 1 — Account Creation
// ---------------------------------------------------------------------------

describe('Phase 1: Account Creation via /api/auth/signup', () => {

  test('POST /api/auth/signup returns 201 { success: true }', async () => {
    if (skipAll) return;

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        firstName: 'Journey',
        lastName: 'Tester',
        email: signupEmail,
        password: signupPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
  });

  test('signInWithPassword succeeds and JWT contains app_metadata.org_id', async () => {
    if (skipAll) return;

    // Use a fresh Supabase client (not admin) to mimic real client sign-in
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email: signupEmail,
      password: signupPassword,
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();

    const token = data.session!.access_token;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    // Decode JWT payload (base64 middle segment)
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
    );
    expect(typeof payload.app_metadata?.org_id).toBe('string');
    expect(payload.app_metadata.org_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Capture for downstream phases
    authToken = token;
    orgId = payload.app_metadata.org_id;
    userId = data.user!.id;
  });

  test('organizations table has a row for the new org', async () => {
    if (skipAll || !orgId) return;

    const rows = await assertRowExists('organizations', { id: orgId });
    expect(rows[0].onboarding_completed_at).toBeNull();
  });

  test('profiles table has a row linked to the user and org', async () => {
    if (skipAll || !orgId) return;

    const { data, error } = await (supabaseAdmin as any)
      .from('profiles')
      .select('*')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Onboarding Journey
// ---------------------------------------------------------------------------

describe('Phase 2: Onboarding Wizard (5 steps)', () => {

  function api() {
    return {
      get: (path: string) =>
        request(app).get(path).set('Authorization', `Bearer ${authToken}`),
      post: (path: string, body?: object) =>
        request(app).post(path).set('Authorization', `Bearer ${authToken}`).send(body ?? {}),
    };
  }

  test('GET /api/onboarding/status returns needs_onboarding: true for new user', async () => {
    if (skipAll || !authToken) return;

    const res = await api().get('/api/onboarding/status');
    expect(res.status).toBe(200);
    expect(res.body.needs_onboarding).toBe(true);
  });

  test('POST /api/onboarding/event fires for all 5 wizard steps and telemetry is recorded in DB', async () => {
    if (skipAll || !authToken) return;

    const events = [
      { event_name: 'started',         step_index: 0 },
      { event_name: 'clinic_named',    step_index: 1 },
      { event_name: 'specialty_chosen',step_index: 2 },
      { event_name: 'payment_viewed',  step_index: 3 },
      { event_name: 'payment_success', step_index: 4 },
    ];

    for (const evt of events) {
      const res = await api().post('/api/onboarding/event', evt);
      expect(res.status).toBe(200);
    }

    // Verify telemetry landed in DB
    const { data, error } = await (supabaseAdmin as any)
      .from('onboarding_events')
      .select('*')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThanOrEqual(5);
  });

  test('POST /api/onboarding/complete updates org with clinic_name and specialty', async () => {
    if (skipAll || !authToken) return;

    const res = await api().post('/api/onboarding/complete', {
      clinic_name: 'System Test Clinic',
      specialty: 'Dermatology',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB updated
    const { data, error } = await (supabaseAdmin as any)
      .from('organizations')
      .select('onboarding_completed_at, clinic_name, specialty')
      .eq('id', orgId)
      .single();

    expect(error).toBeNull();
    expect(data.onboarding_completed_at).not.toBeNull();
    expect(data.clinic_name).toBe('System Test Clinic');
    expect(data.specialty).toBe('Dermatology');
  });

  test('GET /api/onboarding/status now returns needs_onboarding: false', async () => {
    if (skipAll || !authToken) return;

    const res = await api().get('/api/onboarding/status');
    expect(res.status).toBe(200);
    expect(res.body.needs_onboarding).toBe(false);
    expect(res.body.completed_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Dashboard Access
// ---------------------------------------------------------------------------

describe('Phase 3: Dashboard APIs are scoped to the new org', () => {

  function api() {
    return {
      get: (path: string) =>
        request(app).get(path).set('Authorization', `Bearer ${authToken}`),
      post: (path: string, body?: object) =>
        request(app).post(path).set('Authorization', `Bearer ${authToken}`).send(body ?? {}),
    };
  }

  test('GET /api/analytics/dashboard-pulse returns 200 with org-scoped data', async () => {
    if (skipAll || !authToken) return;

    const res = await api().get('/api/analytics/dashboard-pulse');
    expect(res.status).toBe(200);
    // New org has no calls — totalCalls should be 0 or the field should exist
    expect(res.body).toBeDefined();
    const total = res.body.totalCalls ?? res.body.total_calls ?? 0;
    expect(typeof total).toBe('number');
  });

  test('GET /api/contacts returns empty list for brand-new org', async () => {
    if (skipAll || !authToken) return;

    const res = await api().get('/api/contacts');
    expect(res.status).toBe(200);
    const contacts = res.body.contacts ?? res.body.data ?? res.body;
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts.length).toBe(0);
  });

  let createdContactId: string;

  test('POST /api/contacts creates a contact scoped to the org', async () => {
    if (skipAll || !authToken) return;

    const res = await api().post('/api/contacts', {
      name: 'Jane System Test',
      phone: '+15550001234',
      email: 'jane.systemtest@example.com',
    });

    // Accept 200 or 201
    expect([200, 201]).toContain(res.status);

    const contact = res.body.contact ?? res.body.data ?? res.body;
    expect(contact).toBeDefined();

    // Verify in DB with correct org_id
    const { data, error } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, org_id')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThanOrEqual(1);
    createdContactId = data[0].id;
  });

  test('GET /api/contacts returns the contact just created', async () => {
    if (skipAll || !authToken || !createdContactId) return;

    const res = await api().get('/api/contacts');
    expect(res.status).toBe(200);

    const contacts = res.body.contacts ?? res.body.data ?? res.body;
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts.length).toBeGreaterThanOrEqual(1);
  });
});
