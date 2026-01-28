#!/usr/bin/env npx ts-node
/**
 * Apply Production Migrations - All 4 Critical Migrations
 * Uses Supabase MCP to apply migrations in sequence
 * 
 * Run: npm run apply-migrations:production
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface MigrationResult {
  name: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  duration: number;
  message: string;
  error?: string;
}

const results: MigrationResult[] = [];

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logMigration(name: string, status: 'SUCCESS' | 'FAILED' | 'SKIPPED', duration: number, message: string, error?: string) {
  const icon = status === 'SUCCESS' ? '✅' : status === 'FAILED' ? '❌' : '⏭️';
  console.log(`${icon} ${name} (${duration}ms) - ${message}`);
  if (error) console.log(`   Error: ${error}`);
  results.push({ name, status, duration, message, error });
}

async function measureTime<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return [result, duration];
}

async function readMigrationFile(filename: string): Promise<string> {
  const possiblePaths = [
    path.join('/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/migrations', filename),
    path.join('/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations', filename)
  ];

  for (const filePath of possiblePaths) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      // Try next path
    }
  }

  throw new Error(`Migration file not found: ${filename}`);
}

async function applyMigration(supabase: any, name: string, filename: string): Promise<void> {
  try {
    log(`\n📋 Applying Migration: ${name}`);
    
    const sql = await readMigrationFile(filename);
    
    const [, duration] = await measureTime(async () => {
      const { error } = await supabase.rpc('exec', { sql });
      if (error) throw error;
      return true;
    });

    logMigration(name, 'SUCCESS', duration, 'Migration applied successfully');
  } catch (error: any) {
    // Check if already exists (idempotent)
    if (error?.message?.includes('already exists') || error?.message?.includes('ALREADY EXISTS')) {
      logMigration(name, 'SKIPPED', 0, 'Already applied (idempotent)');
    } else {
      logMigration(name, 'FAILED', 0, 'Migration failed', error?.message || String(error));
      throw error;
    }
  }
}

async function verifyMigrations(supabase: any): Promise<void> {
  log('\n\n🔍 Verifying Migrations...\n');

  // Verify Priority 6: Performance Indexes
  try {
    const [indexes, duration1] = await measureTime(async () => {
      const { data, error } = await supabase.rpc('get_index_count');
      if (error) throw error;
      return data;
    });
    logMigration('Priority 6: Performance Indexes', 'SUCCESS', duration1, `${indexes} indexes verified`);
  } catch (error: any) {
    logMigration('Priority 6: Performance Indexes', 'FAILED', 0, 'Verification failed', error?.message);
  }

  // Verify Priority 8: Backup Verification Log
  try {
    const [, duration2] = await measureTime(async () => {
      const { data, error } = await supabase
        .from('backup_verification_log')
        .select('id')
        .limit(1);
      if (error) throw error;
      return data;
    });
    logMigration('Priority 8: Backup Verification Log', 'SUCCESS', duration2, 'Table exists and accessible');
  } catch (error: any) {
    logMigration('Priority 8: Backup Verification Log', 'FAILED', 0, 'Verification failed', error?.message);
  }

  // Verify Priority 9: Feature Flags
  try {
    const [flags, duration3] = await measureTime(async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('id')
        .limit(1);
      if (error) throw error;
      return data?.length || 0;
    });
    logMigration('Priority 9: Feature Flags', 'SUCCESS', duration3, `${flags} feature flags found`);
  } catch (error: any) {
    logMigration('Priority 9: Feature Flags', 'FAILED', 0, 'Verification failed', error?.message);
  }

  // Verify Priority 10: Auth Sessions & Audit Log
  try {
    const [sessions, duration4] = await measureTime(async () => {
      const { data, error } = await supabase
        .from('auth_sessions')
        .select('id')
        .limit(1);
      if (error) throw error;
      return data?.length || 0;
    });
    logMigration('Priority 10: Auth Sessions', 'SUCCESS', duration4, 'Table exists and accessible');
  } catch (error: any) {
    logMigration('Priority 10: Auth Sessions', 'FAILED', 0, 'Verification failed', error?.message);
  }

  try {
    const [audit, duration5] = await measureTime(async () => {
      const { data, error } = await supabase
        .from('auth_audit_log')
        .select('id')
        .limit(1);
      if (error) throw error;
      return data?.length || 0;
    });
    logMigration('Priority 10: Auth Audit Log', 'SUCCESS', duration5, 'Table exists and accessible');
  } catch (error: any) {
    logMigration('Priority 10: Auth Audit Log', 'FAILED', 0, 'Verification failed', error?.message);
  }
}

async function runAllMigrations() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Production Migrations - All 4 Critical Migrations       ║');
  console.log('║   Status: Enterprise-Ready Deployment                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Test connection
    log('Testing Supabase connection...');
    const { data, error } = await supabase.from('organizations').select('id').limit(1);
    if (error) throw error;
    log('✅ Supabase connection successful\n');

    // Apply migrations in order
    await applyMigration(supabase, 'Priority 6: Performance Indexes', '20260128_add_performance_indexes.sql');
    await applyMigration(supabase, 'Priority 8: Backup Verification', '20260128_create_backup_verification_log.sql');
    await applyMigration(supabase, 'Priority 9: Feature Flags', '20260128_create_feature_flags.sql');
    await applyMigration(supabase, 'Priority 10: Auth Sessions & Audit', '20260128_create_auth_sessions_and_audit.sql');

    // Verify all migrations
    await verifyMigrations(supabase);

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  Migration Summary                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`✅ Successful: ${successful}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⏭️  Skipped: ${skipped}/${total}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms\n`);

    if (failed === 0) {
      console.log('🚀 Status: ALL MIGRATIONS APPLIED SUCCESSFULLY!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Status: SOME MIGRATIONS FAILED - REVIEW REQUIRED\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

runAllMigrations();
