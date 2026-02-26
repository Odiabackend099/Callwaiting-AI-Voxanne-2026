/**
 * Org Auto-Creation Test Suite
 *
 * Tests the critical fix for "Organization Not Found" errors
 * when org creation trigger fails or is slow
 *
 * @see SENIOR_ENGINEER_AUDIT.md for context
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../../services/supabase-client';
import { ensureOrgExists, validateUserOrgExists } from '../../services/ensure-org-exists';
import { randomUUID } from 'crypto';

describe('Org Auto-Creation Service (CRITICAL FIX)', () => {
  let testUserId: string;
  let testOrgId: string;

  beforeAll(async () => {
    testUserId = randomUUID();
    testOrgId = randomUUID();
  });

  it('should auto-create organization if user has no org', async () => {
    // Create a test user with no org
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        org_id: null, // No org assigned
      })
      .select()
      .single();

    if (error) {
      console.log('[Test] Could not create test profile (may already exist):', error);
    }

    // Call ensureOrgExists - should auto-create org
    const result = await ensureOrgExists(testUserId);

    // Verify: org was created
    expect(result.created).toBe(true);
    expect(result.orgId).toBeDefined();
    expect(result.orgId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);

    // Verify: user's profile now has org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', testUserId)
      .single();

    expect(profile?.org_id).toBe(result.orgId);
  });

  it('should return existing organization if it already exists', async () => {
    // Create a test user with an org
    const existingOrgId = randomUUID();

    // First create the org
    await supabase.from('organizations').insert({
      id: existingOrgId,
      name: 'Test Org',
      status: 'active',
    });

    // Create user linked to org
    const userId = randomUUID();
    await supabase.from('profiles').upsert({
      id: userId,
      org_id: existingOrgId,
    });

    // Call ensureOrgExists - should return existing org
    const result = await ensureOrgExists(userId, existingOrgId);

    // Verify: no new org was created
    expect(result.created).toBe(false);
    expect(result.orgId).toBe(existingOrgId);
    expect(result.reason).toContain('exists in database');
  });

  it('should fix inconsistent state (org deleted, profile still references it)', async () => {
    // Create org and user
    const orgId = randomUUID();
    const userId = randomUUID();

    await supabase.from('organizations').insert({
      id: orgId,
      name: 'Temp Org',
      status: 'active',
    });

    await supabase.from('profiles').insert({
      id: userId,
      org_id: orgId,
    });

    // Delete the org (simulate trigger failure)
    await supabase.from('organizations').delete().eq('id', orgId);

    // Call ensureOrgExists - should detect inconsistency and fix it
    const result = await ensureOrgExists(userId, orgId);

    // Verify: new org was created to fix inconsistency
    expect(result.created).toBe(true);
    expect(result.orgId).not.toBe(orgId); // Different org ID
    expect(result.reason).toContain('inconsistency');

    // Verify: user's profile updated with new org
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    expect(profile?.org_id).toBe(result.orgId);
  });

  it('should throw error if userId is missing', async () => {
    await expect(ensureOrgExists('', undefined)).rejects.toThrow('INVALID_USER_ID');
  });

  it('should validate that user and org exist together', async () => {
    const orgId = randomUUID();
    const userId = randomUUID();

    // Create org
    await supabase.from('organizations').insert({
      id: orgId,
      name: 'Validation Test',
      status: 'active',
    });

    // Create user linked to org
    await supabase.from('profiles').insert({
      id: userId,
      org_id: orgId,
    });

    // Should validate successfully
    const isValid = await validateUserOrgExists(userId, orgId);
    expect(isValid).toBe(true);

    // Should fail with different org
    const isInvalid = await validateUserOrgExists(userId, randomUUID());
    expect(isInvalid).toBe(false);

    // Should fail with different user
    const isInvalid2 = await validateUserOrgExists(randomUUID(), orgId);
    expect(isInvalid2).toBe(false);
  });

  afterAll(async () => {
    // Cleanup
    // Note: We don't actually delete because these are test users in a test database
    // In a real test environment, these would be cleaned up by database reset
  });
});

/**
 * SUMMARY:
 *
 * These tests verify that the critical auto-org-creation fix works correctly:
 *
 * 1. ✅ Auto-creates org if user has none
 * 2. ✅ Returns existing org if already present
 * 3. ✅ Fixes inconsistent state (org deleted but profile still references it)
 * 4. ✅ Validates input parameters
 * 5. ✅ Validates user-org relationship
 *
 * This prevents the "Organization Not Found" error from blocking user access
 * when the org creation trigger fails or is delayed.
 */
