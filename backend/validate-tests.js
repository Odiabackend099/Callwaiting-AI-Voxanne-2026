#!/usr/bin/env node

/**
 * Lightweight Validation Script
 * 
 * Verifies stress test files exist and have correct structure
 * WITHOUT actually running Jest (which exhausts memory)
 * 
 * Usage: npm run validate:tests
 */

const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'src/__tests__/stress');
const requiredTestFiles = [
  'cross-channel-booking.stress.test.ts',
  'atomic-collision.stress.test.ts',
  'pii-redaction-audit.stress.test.ts',
  'clinic-isolation.stress.test.ts',
  'kb-accuracy.stress.test.ts',
];

console.log('📋 Validating Stress Test Suite Structure...\n');

let allValid = true;
let totalTests = 0;

requiredTestFiles.forEach((filename) => {
  const filePath = path.join(testDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ MISSING: ${filename}`);
    allValid = false;
    return;
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Count describe blocks (test suites)
  const describeMatches = content.match(/describe\(/g) || [];
  const suites = describeMatches.length;
  
  // Count it blocks (individual tests)
  const itMatches = content.match(/it\(/g) || [];
  const tests = itMatches.length;
  
  // Check for import of mock-pool
  const hasMockPool = content.includes('from \'../utils/mock-pool\'');
  const hasGetOrCreate = content.includes('getOrCreateSupabaseClient');
  const hasClearAllMocks = content.includes('clearAllMocks');
  
  // Check file size
  const bytes = Buffer.byteLength(content, 'utf8');
  const lines = content.split('\n').length;
  
  totalTests += tests;
  
  const status = hasMockPool && hasGetOrCreate && hasClearAllMocks ? '✅' : '⚠️';
  
  console.log(`${status} ${filename}`);
  console.log(`   Suites: ${suites} | Tests: ${tests} | Lines: ${lines} | Size: ${(bytes/1024).toFixed(1)}KB`);
  
  if (!hasMockPool) {
    console.log(`   ⚠️  Missing: mock-pool import`);
    allValid = false;
  }
  if (!hasGetOrCreate) {
    console.log(`   ⚠️  Missing: getOrCreateSupabaseClient usage`);
    allValid = false;
  }
  if (!hasClearAllMocks) {
    console.log(`   ⚠️  Missing: clearAllMocks() call`);
    allValid = false;
  }
  
  console.log('');
});

// Check mock-pool.ts exists
const mockPoolPath = path.join(__dirname, 'src/__tests__/utils/mock-pool.ts');
const mockPoolExists = fs.existsSync(mockPoolPath);

console.log(`${mockPoolExists ? '✅' : '❌'} Mock Pool Utility (mock-pool.ts)`);
if (mockPoolExists) {
  const mockPoolContent = fs.readFileSync(mockPoolPath, 'utf-8');
  const poolLines = mockPoolContent.split('\n').length;
  const poolSize = Buffer.byteLength(mockPoolContent, 'utf8');
  console.log(`   Lines: ${poolLines} | Size: ${(poolSize/1024).toFixed(1)}KB`);
  console.log(`   Exports: getOrCreateSupabaseClient, getOrCreateVapiClient, clearAllMocks`);
}

console.log(`\n📊 Summary:`);
console.log(`   Total Test Files: ${requiredTestFiles.length}`);
console.log(`   Total Tests: ${totalTests}`);
console.log(`   All Files Valid: ${allValid ? '✅ YES' : '❌ NO'}`);

console.log(`\n🚀 Next Steps:`);
console.log(`   1. Run single test: npm test -- src/__tests__/stress/cross-channel-booking.stress.test.ts`);
console.log(`   2. If OOM: Implement lightweight mock approach (see JEST_MEMORY_FIX_IMPLEMENTATION.md)`);
console.log(`   3. If success: Run all tests in parallel`);

process.exit(allValid ? 0 : 1);
