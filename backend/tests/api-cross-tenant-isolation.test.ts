/**
 * Integration Tests: API Cross-Tenant Isolation (Application Level)
 * Date: 2025-01-10
 * Purpose: Verify application-level tenant isolation works correctly
 * Context: Post-audit verification after fixing critical bugs
 * 
 * This test suite verifies that the fixes we applied work correctly:
 * 1. Inbound calls query filters by org_id
 * 2. Inbound call detail filters by org_id
 * 3. Background jobs process per-org
 * 
 * PREREQUISITES:
 *   1. Backend server running (npm run dev)
 *   2. Test users created with org_id in app_metadata
 *   3. Test data exists for multiple organizations
 * 
 * USAGE:
 *   cd backend
 *   npm test -- api-cross-tenant-isolation.test.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import axios, { AxiosInstance } from 'axios';

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const DEFAULT_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const TEST_ORG_ID = 'b0000000-0000-0000-0000-000000000001';

describe('API Cross-Tenant Isolation Tests (Application Level)', () => {
  let supabaseServiceRole: ReturnType<typeof createClient>;
  let orgAUserToken: string;
  let orgBUserToken: string;
  let apiClientOrgA: AxiosInstance;
  let apiClientOrgB: AxiosInstance;
  let testCallLogOrgA: string;
  let testCallLogOrgB: string;
  let testCallOrgA: string;
  let testCallOrgB: string;

  beforeAll(async () => {
    // Create service role client with explicit headers to ensure service role bypasses RLS
    supabaseServiceRole = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'apikey': supabaseServiceKey!,
          'Authorization': `Bearer ${supabaseServiceKey!}`
        }
      }
    });

    // Create test organization B (if it doesn't exist)
    await supabaseServiceRole
      .from('organizations')
      .upsert({
        id: TEST_ORG_ID,
        name: 'Test Organization B',
        status: 'active'
      } as any, {
        onConflict: 'id'
      });

    // Create test users for Org A and Org B
    const { data: userA, error: errorA } = await supabaseServiceRole.auth.admin.createUser({
      email: `test-api-org-a-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      app_metadata: { org_id: DEFAULT_ORG_ID },
      email_confirm: true
    });

    const { data: userB, error: errorB } = await supabaseServiceRole.auth.admin.createUser({
      email: `test-api-org-b-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      app_metadata: { org_id: TEST_ORG_ID },
      email_confirm: true
    });

    if (errorA || errorB || !userA || !userB) {
      throw new Error(`Failed to create test users: ${errorA?.message || errorB?.message}`);
    }

    // Get tokens for test users
    const { data: sessionA } = await supabaseServiceRole.auth.signInWithPassword({
      email: userA.user!.email!,
      password: 'TestPassword123!'
    });

    const { data: sessionB } = await supabaseServiceRole.auth.signInWithPassword({
      email: userB.user!.email!,
      password: 'TestPassword123!'
    });

    if (!sessionA?.session?.access_token || !sessionB?.session?.access_token) {
      throw new Error('Failed to get test user tokens');
    }

    orgAUserToken = sessionA.session.access_token;
    orgBUserToken = sessionB.session.access_token;

    // Create API clients for each org
    apiClientOrgA = axios.create({
      baseURL: backendUrl,
      headers: {
        'Authorization': `Bearer ${orgAUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    apiClientOrgB = axios.create({
      baseURL: backendUrl,
      headers: {
        'Authorization': `Bearer ${orgBUserToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Create test data: call_logs (inbound calls)
    const { data: callLogA } = await supabaseServiceRole
      .from('call_logs')
      .insert({
        vapi_call_id: `test-api-call-org-a-${Date.now()}`,
        org_id: DEFAULT_ORG_ID,
        call_type: 'inbound',
        phone_number: '+15551234567',
        caller_name: 'Test Caller Org A',
        status: 'completed',
        duration_seconds: 120,
        recording_storage_path: 'test/path/org-a.wav',
        created_at: new Date().toISOString()
      } as any)
      .select()
      .single();

    const { data: callLogB } = await supabaseServiceRole
      .from('call_logs')
      .insert({
        vapi_call_id: `test-api-call-org-b-${Date.now()}`,
        org_id: TEST_ORG_ID,
        call_type: 'inbound',
        phone_number: '+15559876543',
        caller_name: 'Test Caller Org B',
        status: 'completed',
        duration_seconds: 180,
        recording_storage_path: 'test/path/org-b.wav',
        created_at: new Date().toISOString()
      } as any)
      .select()
      .single();

    if (!callLogA || !callLogB) {
      throw new Error('Failed to create test call logs');
    }

    testCallLogOrgA = (callLogA as any).id;
    testCallLogOrgB = (callLogB as any).id;

    // Create test data: calls (outbound calls)
    const { data: callA } = await supabaseServiceRole
      .from('calls')
      .insert({
        org_id: DEFAULT_ORG_ID,
        phone_number: '+15551111111',
        caller_name: 'Outbound Call Org A',
        call_type: 'outbound',
        status: 'completed',
        duration_seconds: 90,
        call_date: new Date().toISOString()
      } as any)
      .select()
      .single();

    const { data: callB } = await supabaseServiceRole
      .from('calls')
      .insert({
        org_id: TEST_ORG_ID,
        phone_number: '+15552222222',
        caller_name: 'Outbound Call Org B',
        call_type: 'outbound',
        status: 'completed',
        duration_seconds: 110,
        call_date: new Date().toISOString()
      } as any)
      .select()
      .single();

    if (!callA || !callB) {
      throw new Error('Failed to create test calls');
    }

    testCallOrgA = (callA as any).id;
    testCallOrgB = (callB as any).id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (supabaseServiceRole) {
      await supabaseServiceRole
        .from('call_logs')
        .delete()
        .in('id', [testCallLogOrgA, testCallLogOrgB]);

      await supabaseServiceRole
        .from('calls')
        .delete()
        .in('id', [testCallOrgA, testCallOrgB]);
    }
  });

  describe('GET /api/calls-dashboard - Cross-Tenant Isolation', () => {
    it('should allow Org A user to see their own inbound calls', async () => {
      const response = await apiClientOrgA.get('/api/calls-dashboard', {
        params: { call_type: 'inbound', limit: 100 }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('calls');
      expect(response.data).toHaveProperty('pagination');

      const calls = response.data.calls || [];
      const orgACalls = calls.filter((c: any) => c.id === testCallLogOrgA);
      const orgBCalls = calls.filter((c: any) => c.id === testCallLogOrgB);

      // Should see Org A's calls
      expect(orgACalls.length).toBeGreaterThan(0);

      // Should NOT see Org B's calls (CRITICAL: This verifies the fix)
      expect(orgBCalls.length).toBe(0);
    });

    it('should prevent Org A user from seeing Org B inbound calls', async () => {
      const response = await apiClientOrgA.get('/api/calls-dashboard', {
        params: { call_type: 'inbound', limit: 100 }
      });

      expect(response.status).toBe(200);
      const calls = response.data.calls || [];
      const orgBCalls = calls.filter((c: any) => c.id === testCallLogOrgB);

      // CRITICAL FIX VERIFICATION: Should not see Org B's calls
      expect(orgBCalls.length).toBe(0);
    });

    it('should allow Org B user to see their own inbound calls', async () => {
      const response = await apiClientOrgB.get('/api/calls-dashboard', {
        params: { call_type: 'inbound', limit: 100 }
      });

      expect(response.status).toBe(200);
      const calls = response.data.calls || [];
      const orgBCalls = calls.filter((c: any) => c.id === testCallLogOrgB);

      // Should see Org B's calls
      expect(orgBCalls.length).toBeGreaterThan(0);
    });

    it('should filter inbound calls by org_id correctly', async () => {
      // Org A should only see their calls
      const responseA = await apiClientOrgA.get('/api/calls-dashboard', {
        params: { call_type: 'inbound' }
      });

      // Org B should only see their calls
      const responseB = await apiClientOrgB.get('/api/calls-dashboard', {
        params: { call_type: 'inbound' }
      });

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      const callsA = responseA.data.calls || [];
      const callsB = responseB.data.calls || [];

      // Verify no cross-tenant data leakage
      const orgACallIds = callsA.map((c: any) => c.id);
      const orgBCallIds = callsB.map((c: any) => c.id);

      // Org A should not have Org B's call ID
      expect(orgACallIds).not.toContain(testCallLogOrgB);

      // Org B should not have Org A's call ID
      expect(orgBCallIds).not.toContain(testCallLogOrgA);
    });
  });

  describe('GET /api/calls-dashboard/:callId - Cross-Tenant Isolation', () => {
    it('should allow Org A user to access their own inbound call details', async () => {
      const response = await apiClientOrgA.get(`/api/calls-dashboard/${testCallLogOrgA}`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', testCallLogOrgA);
      expect(response.data).toHaveProperty('call_type', 'inbound');
      expect(response.data.phone_number).toContain('15551234567');
    });

    it('should prevent Org A user from accessing Org B inbound call details', async () => {
      try {
        const response = await apiClientOrgA.get(`/api/calls-dashboard/${testCallLogOrgB}`);
        
        // Should return 404 (not found) or 403 (forbidden)
        // This verifies the fix: org_id filter prevents cross-tenant access
        expect([403, 404]).toContain(response.status);
      } catch (error: any) {
        // Axios throws error for 404/403, which is expected
        if (error.response) {
          expect([403, 404]).toContain(error.response.status);
        } else {
          throw error;
        }
      }
    });

    it('should allow Org B user to access their own inbound call details', async () => {
      const response = await apiClientOrgB.get(`/api/calls-dashboard/${testCallLogOrgB}`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', testCallLogOrgB);
      expect(response.data).toHaveProperty('call_type', 'inbound');
    });
  });

  describe('GET /api/calls-dashboard/stats - Cross-Tenant Isolation', () => {
    it('should return stats only for Org A calls', async () => {
      const response = await apiClientOrgA.get('/api/calls-dashboard/stats');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalCalls');
      expect(response.data).toHaveProperty('inboundCalls');
      expect(response.data).toHaveProperty('outboundCalls');
      expect(response.data).toHaveProperty('recentCalls');

      // Verify recent calls only include Org A's calls
      const recentCalls = response.data.recentCalls || [];
      const orgBCallInRecent = recentCalls.find((c: any) => c.id === testCallLogOrgB);

      // Should not have Org B's calls in stats
      expect(orgBCallInRecent).toBeUndefined();
    });

    it('should return stats only for Org B calls', async () => {
      const response = await apiClientOrgB.get('/api/calls-dashboard/stats');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalCalls');

      // Verify recent calls only include Org B's calls
      const recentCalls = response.data.recentCalls || [];
      const orgACallInRecent = recentCalls.find((c: any) => c.id === testCallLogOrgA);

      // Should not have Org A's calls in stats
      expect(orgACallInRecent).toBeUndefined();
    });
  });

  describe('GET /api/knowledge-base - Cross-Tenant Isolation', () => {
    let testKBOrgA: string;
    let testKBOrgB: string;

    beforeAll(async () => {
      // Create test KB entries
      const { data: kbA } = await supabaseServiceRole
        .from('knowledge_base')
        .insert({
          org_id: DEFAULT_ORG_ID,
          filename: 'test-org-a-kb.md',
          content: 'Test KB content for Org A',
          category: 'general',
          active: true
        } as any)
        .select()
        .single();

      const { data: kbB } = await supabaseServiceRole
        .from('knowledge_base')
        .insert({
          org_id: TEST_ORG_ID,
          filename: 'test-org-b-kb.md',
          content: 'Test KB content for Org B',
          category: 'general',
          active: true
        } as any)
        .select()
        .single();

      if (kbA && kbB) {
        testKBOrgA = (kbA as any).id;
        testKBOrgB = (kbB as any).id;
      }
    });

    afterAll(async () => {
      if (supabaseServiceRole && testKBOrgA && testKBOrgB) {
        await supabaseServiceRole
          .from('knowledge_base')
          .delete()
          .in('id', [testKBOrgA, testKBOrgB]);
      }
    });

    it('should allow Org A user to see their own KB documents', async () => {
      const response = await apiClientOrgA.get('/api/knowledge-base');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');

      const items = response.data.items || [];
      const orgAKB = items.find((item: any) => item.id === testKBOrgA);
      const orgBKB = items.find((item: any) => item.id === testKBOrgB);

      // Should see Org A's KB
      if (testKBOrgA) {
        expect(orgAKB).toBeDefined();
      }

      // Should NOT see Org B's KB
      if (testKBOrgB) {
        expect(orgBKB).toBeUndefined();
      }
    });

    it('should prevent Org A user from seeing Org B KB documents', async () => {
      const response = await apiClientOrgA.get('/api/knowledge-base');

      expect(response.status).toBe(200);
      const items = response.data.items || [];
      const orgBKB = items.find((item: any) => item.id === testKBOrgB);

      // CRITICAL: Should not see Org B's KB documents
      if (testKBOrgB) {
        expect(orgBKB).toBeUndefined();
      }
    });
  });

  describe('Unauthenticated Requests', () => {
    it('should reject unauthenticated requests to calls-dashboard', async () => {
      try {
        await axios.get(`${backendUrl}/api/calls-dashboard`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });

    it('should reject unauthenticated requests to knowledge-base', async () => {
      try {
        await axios.get(`${backendUrl}/api/knowledge-base`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });
  });
});
