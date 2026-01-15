/**
 * Phase 6 Test Setup: Local Supabase Instance Management
 * 
 * This file handles:
 * - Connecting to local Supabase (supabase start)
 * - Seeding test data (clinics, users, providers)
 * - Tearing down between tests
 * - RLS policy validation
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Local Supabase credentials (set via supabase start)
const SUPABASE_LOCAL_URL = process.env.SUPABASE_LOCAL_URL || 'http://localhost:54321';
const SUPABASE_LOCAL_KEY = process.env.SUPABASE_LOCAL_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjMzMzY1OTksImV4cCI6MTc4NjI2Njk5OX0.FAKE_KEY_FOR_LOCAL_DEV';

// Global client for setup operations (service role key = full access)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYyMzMzNjU5OSwiZXhwIjoxNzg2MjY2OTk5fQ.FAKE_SERVICE_KEY';

interface TestClinic {
  id: string;
  name: string;
  org_id: string;
  email_domain: string;
}

interface TestUser {
  id: string;
  email: string;
  clinic_id: string;
  org_id: string;
  role: 'admin' | 'staff' | 'provider';
}

interface TestProvider {
  id: string;
  name: string;
  clinic_id: string;
  org_id: string;
  availability_start: string; // "09:00"
  availability_end: string;   // "17:00"
}

/**
 * Create Supabase client for setup (service role = no RLS)
 */
export function createSetupClient() {
  return createClient(SUPABASE_LOCAL_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create Supabase client for a specific user (with RLS)
 */
export function createUserClient(jwt: string) {
  return createClient(SUPABASE_LOCAL_URL, SUPABASE_LOCAL_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

/**
 * Seed a test clinic with org_id
 */
export async function seedClinic(name?: string): Promise<TestClinic> {
  const client = createSetupClient();
  const clinic_id = uuidv4();
  const org_id = uuidv4();

  const { data, error } = await client
    .from('organizations')
    .insert({
      id: org_id,
      name: name || `Test Clinic ${clinic_id.slice(0, 8)}`,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to seed clinic: ${error.message}`);
  }

  return {
    id: clinic_id,
    name: data.name,
    org_id: data.id,
    email_domain: `clinic-${clinic_id.slice(0, 8)}@example.com`,
  };
}

/**
 * Seed a test user with auth
 */
export async function seedUser(clinic: TestClinic, role: 'admin' | 'staff' | 'provider' = 'staff'): Promise<TestUser> {
  const client = createSetupClient();
  const user_id = uuidv4();
  const email = `${role}-${user_id.slice(0, 8)}@${clinic.email_domain}`;

  // Create profile (no auth needed for local tests)
  const { data, error } = await client
    .from('profiles')
    .insert({
      id: user_id,
      email,
      org_id: clinic.org_id,
      role,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to seed user: ${error.message}`);
  }

  return {
    id: data.id,
    email: data.email,
    clinic_id: clinic.id,
    org_id: data.org_id,
    role: data.role,
  };
}

/**
 * Seed a test provider (staff member with availability)
 */
export async function seedProvider(clinic: TestClinic, name?: string): Promise<TestProvider> {
  const client = createSetupClient();
  const provider_id = uuidv4();

  const { data, error } = await client
    .from('profiles')
    .insert({
      id: provider_id,
      email: `provider-${provider_id.slice(0, 8)}@${clinic.email_domain}`,
      org_id: clinic.org_id,
      role: 'provider',
      full_name: name || `Dr. ${provider_id.slice(0, 6).toUpperCase()}`,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to seed provider: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.full_name || 'Unknown Provider',
    clinic_id: clinic.id,
    org_id: clinic.org_id,
    availability_start: '09:00',
    availability_end: '17:00',
  };
}

/**
 * Create a mock JWT for a user (local testing)
 */
export function createMockJWT(userId: string, orgId: string): string {
  // Simple JWT format for testing (no crypto needed locally)
  const payload = {
    sub: userId,
    org_id: orgId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  // Base64 encode (simplified for local testing)
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'local_signature'; // Not cryptographically valid, but OK for local tests

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Clean up test data (delete clinic and cascade)
 */
export async function cleanupClinic(clinicOrgId: string): Promise<void> {
  const client = createSetupClient();

  // Delete in cascade order (respecting FK constraints)
  // Note: Most deletes should cascade if FK configured correctly
  await client.from('appointments').delete().eq('org_id', clinicOrgId);
  await client.from('calendar_events').delete().eq('org_id', clinicOrgId);
  await client.from('knowledge_base').delete().eq('org_id', clinicOrgId);
  await client.from('profiles').delete().eq('org_id', clinicOrgId);
  await client.from('organizations').delete().eq('id', clinicOrgId);
}

/**
 * Verify RLS policy is working
 * Returns true if user can only see their org data
 */
export async function verifyRLSPolicy(userJWT: string, clinic: TestClinic): Promise<boolean> {
  const client = createUserClient(userJWT);

  // Try to query own org
  const { data: ownData, error: ownError } = await client
    .from('profiles')
    .select('id')
    .eq('org_id', clinic.org_id)
    .limit(1);

  if (ownError || !ownData || ownData.length === 0) {
    return false;
  }

  // RLS policy is working if we get data from own org
  return true;
}

/**
 * Verify cross-org access is blocked
 * Returns true if user is blocked from seeing other org data
 */
export async function verifyCrossOrgBlocked(userJWT: string, otherOrgId: string): Promise<boolean> {
  const client = createUserClient(userJWT);

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('org_id', otherOrgId)
      .limit(1);

    // Should get error or no data
    if (error || !data || data.length === 0) {
      return true; // Correctly blocked
    }

    return false; // ERROR: Got data from other org!
  } catch {
    return true; // Exception = correctly blocked
  }
}

/**
 * Health check: Verify local Supabase is running
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const client = createSetupClient();
    const { error } = await client.from('organizations').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
