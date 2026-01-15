/**
 * PHASE 6 TEST SETUP
 * 
 * Provides utilities for seeding test data and managing test clinic contexts
 */

import { supabase } from '../../services/supabase-client';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

/**
 * Create a mock JWT for testing
 */
export function createMockJWT(orgId: string): string {
  const payload = {
    sub: `user-${uuidv4()}`,
    org_id: orgId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  // Use a fake secret for testing - in real scenarios this would use actual signing
  return jwt.sign(payload, 'test-secret-key', { algorithm: 'HS256' });
}

/**
 * Seed a test clinic
 */
export async function seedClinic(clinicName?: string) {
  const clinicId = uuidv4();
  const clinicNameToUse = clinicName || `Test Clinic ${clinicId.substring(0, 8)}`;

  return {
    org_id: clinicId,
    name: clinicNameToUse,
  };
}

/**
 * Seed a test user
 */
export async function seedUser(orgId: string, role: string = 'admin') {
  const userId = uuidv4();
  const userEmail = `test-${userId.substring(0, 8)}@example.com`;

  return {
    user_id: userId,
    email: userEmail,
    role,
  };
}

/**
 * Seed a test provider
 */
export async function seedProvider(orgId: string, providerName?: string) {
  const providerId = uuidv4();
  const nameToUse = providerName || `Dr. Test ${providerId.substring(0, 8)}`;

  return {
    provider_id: providerId,
    name: nameToUse,
    email: `provider-${providerId.substring(0, 8)}@clinic.com`,
  };
}

/**
 * Cleanup test clinic and all related data
 */
export async function cleanupClinic(orgId: string) {
  try {
    // Delete appointments
    await supabase
      .from('appointments')
      .delete()
      .eq('org_id', orgId);

    // Delete profiles
    await supabase
      .from('profiles')
      .delete()
      .eq('org_id', orgId);

    // Delete organization
    await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    console.log(`Cleaned up clinic: ${orgId}`);
  } catch (error) {
    console.error(`Error cleaning up clinic ${orgId}:`, error);
  }
}

/**
 * Create a Supabase client for a specific clinic context
 */
export function createSetupClient(jwtToken?: string) {
  return {
    createAppointment: async (appointmentData: any) => {
      return supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();
    },
    getAppointments: async (orgId: string) => {
      return supabase
        .from('appointments')
        .select('*')
        .eq('org_id', orgId);
    },
    deleteAppointment: async (appointmentId: string) => {
      return supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
    },
  };
}

/**
 * Create a user-scoped client (simulates a clinic user making requests)
 */
export function createUserClient(jwtToken: string) {
  return {
    token: jwtToken,
    getAuthHeader: () => ({
      Authorization: `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    }),
  };
}

/**
 * Test helper: Wait for async operations
 */
export async function waitFor(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
