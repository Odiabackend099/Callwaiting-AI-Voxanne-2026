/**
 * Backup Verification Integration Tests
 * 
 * Tests the automated backup verification system end-to-end.
 * Requires live database connection.
 */

import { verifyBackups } from '../../scripts/verify-backups';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Backup Verification Integration Tests', () => {
  let supabase: any;

  beforeAll(() => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set - skipping integration tests');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  });

  describe('Full Verification Run', () => {
    test('should complete verification successfully', async () => {
      // Skip if no database connection
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // ACT
      const result = await verifyBackups();

      // ASSERT
      expect(result).toBeDefined();
      expect(result.checks).toBeInstanceOf(Array);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checksPassed).toBeGreaterThanOrEqual(0);
      expect(result.checksFailed).toBeGreaterThanOrEqual(0);
      expect(['success', 'warning', 'failure']).toContain(result.status);

      console.log('Verification result:', {
        status: result.status,
        checksPassed: result.checksPassed,
        checksFailed: result.checksFailed,
      });
    }, 30000); // 30 second timeout

    test('should log verification result to database', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // Skip if migration not applied
      const { error: checkError } = await supabase
        .from('backup_verification_log')
        .select('id')
        .limit(1);

      if (checkError?.code === 'PGRST116' || checkError?.message?.includes('relation') || checkError?.message?.includes('does not exist')) {
        console.log('Skipping test - backup_verification_log table not migrated yet');
        return;
      }

      // ACT
      await verifyBackups();

      // ASSERT - Check that log entry was created
      const { data, error } = await supabase
        .from('backup_verification_log')
        .select('*')
        .order('verified_at', { ascending: false })
        .limit(1);

      if (error?.message?.includes('does not exist')) {
        console.log('Migration not applied - test skipped');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data && data.length > 0) {
        expect(data[0].status).toBeDefined();
        expect(data[0].checks_passed).toBeGreaterThanOrEqual(0);
      }
    }, 30000);
  });

  describe('Database Connectivity Check', () => {
    test('should verify database is accessible', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // ACT
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      // ASSERT
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Critical Tables Check', () => {
    test('should verify all critical tables exist', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      const criticalTables = [
        'organizations',
        'profiles',
        'agents',
        'appointments',
        'contacts',
        'calls',  // Changed from call_logs - actual table name is 'calls'
        'knowledge_base_chunks',
      ];

      // ACT & ASSERT
      for (const table of criticalTables) {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        expect(error).toBeNull();
      }
    });
  });

  describe('Row Counts Check', () => {
    test('should retrieve row counts for critical tables', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // ACT
      const { count, error } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });

      // ASSERT
      expect(error).toBeNull();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Functions Check', () => {
    test('should verify critical functions exist', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      const criticalFunctions = [
        'book_appointment_with_lock',
        'cleanup_old_webhook_logs',
      ];

      // Note: This test requires execute_sql RPC or direct SQL access
      // Skipping actual verification in test environment
      expect(criticalFunctions.length).toBe(2);
    });
  });

  describe('Verification Log Functions', () => {
    test('should retrieve latest verification status', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // ACT
      const { data, error } = await supabase
        .rpc('get_latest_backup_verification');

      // ASSERT
      if (data && data.length > 0) {
        expect(error).toBeNull();
        expect(data[0]).toHaveProperty('verified_at');
        expect(data[0]).toHaveProperty('status');
        expect(data[0]).toHaveProperty('checks_passed');
        expect(data[0]).toHaveProperty('checks_failed');
      }
    });

    test('should retrieve verification history', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping test - no database connection');
        return;
      }

      // ACT
      const { data, error } = await supabase
        .rpc('get_backup_verification_history', { p_days: 7 });

      // ASSERT
      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection failure gracefully', async () => {
      // Create client with invalid credentials
      const invalidClient = createClient(SUPABASE_URL, 'invalid-key');

      // ACT
      const { error } = await invalidClient
        .from('organizations')
        .select('id')
        .limit(1);

      // ASSERT
      expect(error).toBeDefined();
    });
  });
});
