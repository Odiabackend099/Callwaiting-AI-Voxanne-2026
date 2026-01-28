#!/usr/bin/env ts-node

/**
 * Priority 9: Developer Operations - Automated Test Suite
 * 
 * Tests:
 * 1. Feature Flags Migration Applied
 * 2. Feature Flag Functions Exist
 * 3. Feature Flag Service Works
 * 4. Feature Flag Middleware Works
 * 5. CI/CD Workflows Exist
 * 6. Rollback Documentation Exists
 * 
 * Created: 2026-01-28
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<{ passed: boolean; details: string }>) {
  const startTime = Date.now();
  console.log(`\n🧪 Testing: ${name}...`);
  
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    results.push({
      name,
      passed: result.passed,
      details: result.details,
      duration,
    });
    
    if (result.passed) {
      console.log(`✅ PASS: ${name} (${duration}ms)`);
      console.log(`   ${result.details}`);
    } else {
      console.log(`❌ FAIL: ${name} (${duration}ms)`);
      console.log(`   ${result.details}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    results.push({
      name,
      passed: false,
      details: `Exception: ${errorMessage}`,
      duration,
    });
    
    console.log(`❌ FAIL: ${name} (${duration}ms)`);
    console.log(`   Exception: ${errorMessage}`);
  }
}

// Test 1: Feature Flags Tables Exist
async function testFeatureFlagsTables() {
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['feature_flags', 'org_feature_flags', 'feature_flag_audit_log']);
  
  if (error) {
    return { passed: false, details: `Database query failed: ${error.message}` };
  }
  
  const tableNames = tables?.map(t => t.table_name) || [];
  const expectedTables = ['feature_flags', 'org_feature_flags', 'feature_flag_audit_log'];
  const missingTables = expectedTables.filter(t => !tableNames.includes(t));
  
  if (missingTables.length > 0) {
    return { passed: false, details: `Missing tables: ${missingTables.join(', ')}` };
  }
  
  return { passed: true, details: `All 3 feature flag tables exist` };
}

// Test 2: Feature Flag Functions Exist
async function testFeatureFlagFunctions() {
  // Query for feature flag functions
  const { data: funcs, error: err } = await supabase
    .from('information_schema.routines')
    .select('routine_name')
    .eq('routine_schema', 'public')
    .in('routine_name', ['is_feature_enabled', 'get_org_enabled_features', 'update_feature_flag']);
  
  if (err) {
    return { passed: false, details: `Database query failed: ${err.message}` };
  }
  
  const functionNames = funcs?.map(f => f.routine_name) || [];
  const expectedFunctions = ['is_feature_enabled', 'get_org_enabled_features', 'update_feature_flag'];
  const missingFunctions = expectedFunctions.filter(f => !functionNames.includes(f));
  
  if (missingFunctions.length > 0) {
    return { passed: false, details: `Missing functions: ${missingFunctions.join(', ')}` };
  }
  
  return { passed: true, details: `All 3 feature flag functions exist` };
}

// Test 3: Default Feature Flags Seeded
async function testDefaultFeatureFlags() {
  const { data: flags, error } = await supabase
    .from('feature_flags')
    .select('flag_key, flag_name, enabled_globally');
  
  if (error) {
    return { passed: false, details: `Database query failed: ${error.message}` };
  }
  
  if (!flags || flags.length === 0) {
    return { passed: false, details: 'No feature flags found in database' };
  }
  
  const expectedFlags = [
    'advanced_analytics',
    'outbound_calling',
    'sms_campaigns',
    'ai_voice_cloning',
    'multi_language',
    'appointment_reminders',
    'call_recording',
    'knowledge_base',
    'calendar_integration',
    'lead_scoring'
  ];
  
  const flagKeys = flags.map(f => f.flag_key);
  const missingFlags = expectedFlags.filter(f => !flagKeys.includes(f));
  
  if (missingFlags.length > 0) {
    return { passed: false, details: `Missing default flags: ${missingFlags.join(', ')}` };
  }
  
  return { passed: true, details: `All ${flags.length} default feature flags seeded` };
}

// Test 4: Feature Flag Indexes Exist
async function testFeatureFlagIndexes() {
  const { data: indexes, error } = await supabase
    .from('pg_indexes')
    .select('indexname')
    .eq('schemaname', 'public')
    .like('indexname', '%feature_flag%');
  
  if (error) {
    return { passed: false, details: `Database query failed: ${error.message}` };
  }
  
  const indexNames = indexes?.map(i => i.indexname) || [];
  
  if (indexNames.length < 5) {
    return { passed: false, details: `Only ${indexNames.length} indexes found, expected at least 5` };
  }
  
  return { passed: true, details: `${indexNames.length} feature flag indexes created` };
}

// Test 5: RLS Policies Active
async function testRLSPolicies() {
  const { data: policies, error } = await supabase
    .from('pg_policies')
    .select('policyname, tablename')
    .in('tablename', ['feature_flags', 'org_feature_flags', 'feature_flag_audit_log']);
  
  if (error) {
    return { passed: false, details: `Database query failed: ${error.message}` };
  }
  
  if (!policies || policies.length === 0) {
    return { passed: false, details: 'No RLS policies found for feature flag tables' };
  }
  
  return { passed: true, details: `${policies.length} RLS policies active on feature flag tables` };
}

// Test 6: Feature Flag Service File Exists
async function testFeatureFlagServiceFile() {
  const servicePath = path.join(__dirname, '../services/feature-flags.ts');
  
  if (!fs.existsSync(servicePath)) {
    return { passed: false, details: 'Feature flag service file not found' };
  }
  
  const content = fs.readFileSync(servicePath, 'utf-8');
  
  const requiredMethods = [
    'isEnabled',
    'getOrgEnabledFeatures',
    'enableForOrg',
    'disableForOrg',
    'updateGlobalFlag'
  ];
  
  const missingMethods = requiredMethods.filter(method => !content.includes(method));
  
  if (missingMethods.length > 0) {
    return { passed: false, details: `Missing methods: ${missingMethods.join(', ')}` };
  }
  
  return { passed: true, details: `Feature flag service with ${requiredMethods.length} methods` };
}

// Test 7: Feature Flag Middleware File Exists
async function testFeatureFlagMiddlewareFile() {
  const middlewarePath = path.join(__dirname, '../middleware/feature-flags.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    return { passed: false, details: 'Feature flag middleware file not found' };
  }
  
  const content = fs.readFileSync(middlewarePath, 'utf-8');
  
  const requiredFunctions = [
    'requireFeature',
    'requireAllFeatures',
    'requireAnyFeature',
    'attachEnabledFeatures'
  ];
  
  const missingFunctions = requiredFunctions.filter(fn => !content.includes(fn));
  
  if (missingFunctions.length > 0) {
    return { passed: false, details: `Missing functions: ${missingFunctions.join(', ')}` };
  }
  
  return { passed: true, details: `Feature flag middleware with ${requiredFunctions.length} functions` };
}

// Test 8: CI/CD Workflows Exist
async function testCICDWorkflows() {
  const workflowsDir = path.join(__dirname, '../../../.github/workflows');
  
  if (!fs.existsSync(workflowsDir)) {
    return { passed: false, details: '.github/workflows directory not found' };
  }
  
  const expectedWorkflows = ['ci.yml', 'deploy-staging.yml', 'deploy-production.yml'];
  const existingWorkflows = fs.readdirSync(workflowsDir);
  
  const missingWorkflows = expectedWorkflows.filter(w => !existingWorkflows.includes(w));
  
  if (missingWorkflows.length > 0) {
    return { passed: false, details: `Missing workflows: ${missingWorkflows.join(', ')}` };
  }
  
  return { passed: true, details: `All 3 CI/CD workflows exist` };
}

// Test 9: Rollback Documentation Exists
async function testRollbackDocumentation() {
  const rollbackDocPath = path.join(__dirname, '../../../ROLLBACK_PROCEDURES.md');
  
  if (!fs.existsSync(rollbackDocPath)) {
    return { passed: false, details: 'ROLLBACK_PROCEDURES.md not found' };
  }
  
  const content = fs.readFileSync(rollbackDocPath, 'utf-8');
  
  const requiredSections = [
    'Quick Reference',
    'Application Rollback',
    'Database Rollback',
    'Feature Flag Emergency Disable',
    'Rollback Verification Checklist',
    'Post-Rollback Procedures'
  ];
  
  const missingSections = requiredSections.filter(section => !content.includes(section));
  
  if (missingSections.length > 0) {
    return { passed: false, details: `Missing sections: ${missingSections.join(', ')}` };
  }
  
  const wordCount = content.split(/\s+/).length;
  
  return { passed: true, details: `Rollback documentation complete (${wordCount} words, ${requiredSections.length} sections)` };
}

// Test 10: Planning Documentation Exists
async function testPlanningDocumentation() {
  const planningDocPath = path.join(__dirname, '../../../PRIORITY_9_PLANNING.md');
  
  if (!fs.existsSync(planningDocPath)) {
    return { passed: false, details: 'PRIORITY_9_PLANNING.md not found' };
  }
  
  const content = fs.readFileSync(planningDocPath, 'utf-8');
  
  const requiredPhases = ['Phase 1', 'Phase 2', 'Phase 3'];
  const missingPhases = requiredPhases.filter(phase => !content.includes(phase));
  
  if (missingPhases.length > 0) {
    return { passed: false, details: `Missing phases: ${missingPhases.join(', ')}` };
  }
  
  return { passed: true, details: 'Planning documentation complete with all 3 phases' };
}

// Main test execution
async function runAllTests() {
  console.log('================================================================================');
  console.log('PRIORITY 9: DEVELOPER OPERATIONS - AUTOMATED TEST SUITE');
  console.log('================================================================================');
  console.log(`Started: ${new Date().toISOString()}`);
  
  await runTest('Feature Flags Tables Exist', testFeatureFlagsTables);
  await runTest('Feature Flag Functions Exist', testFeatureFlagFunctions);
  await runTest('Default Feature Flags Seeded', testDefaultFeatureFlags);
  await runTest('Feature Flag Indexes Exist', testFeatureFlagIndexes);
  await runTest('RLS Policies Active', testRLSPolicies);
  await runTest('Feature Flag Service File Exists', testFeatureFlagServiceFile);
  await runTest('Feature Flag Middleware File Exists', testFeatureFlagMiddlewareFile);
  await runTest('CI/CD Workflows Exist', testCICDWorkflows);
  await runTest('Rollback Documentation Exists', testRollbackDocumentation);
  await runTest('Planning Documentation Exists', testPlanningDocumentation);
  
  // Summary
  console.log('\n================================================================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('================================================================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${successRate}%`);
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Total Duration: ${totalDuration}ms`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  console.log('\n================================================================================');
  
  if (failed === 0) {
    console.log('Status: ✅ ALL TESTS PASSED - PRIORITY 9 COMPLETE');
  } else {
    console.log('Status: ❌ SOME TESTS FAILED - REVIEW REQUIRED');
  }
  
  console.log('================================================================================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
