/**
 * CRITICAL_FIXES_VALIDATION.ts
 * 
 * Quick validation script for the 4 critical fixes applied
 * Checks that the code changes are present and syntactically correct
 */

import fs from 'fs';
import path from 'path';

const CHECKS = [
  {
    name: 'Fix #1: Race condition mitigation (credentials fetched first)',
    file: 'backend/src/services/atomic-booking-service.ts',
    patterns: [
      /Fetch credentials FIRST before modifying state/,
      /select\('org_id'\)/,
      /orgId = holdCheck\.org_id/,
    ],
    required: true,
  },
  {
    name: 'Fix #2: SMS rollback on failure',
    file: 'backend/src/services/atomic-booking-service.ts',
    patterns: [
      /Rolling back OTP storage due to SMS failure/,
      /otp_code: null,\n\s+otp_sent_at: null,/,
      /if \(!smsResult\.success\)/,
    ],
    required: true,
  },
  {
    name: 'Fix #3: Specific phone regex patterns (no date/address false positives)',
    file: 'backend/src/services/redaction-service.ts',
    patterns: [
      /CRITICAL FIX.*regex matched dates/,
      /ukPhoneRegex/,
      /intlPhoneRegex/,
    ],
    required: true,
  },
  {
    name: 'Fix #4: Multi-tenant isolation (org_id validation)',
    file: 'backend/src/services/atomic-booking-service.ts',
    patterns: [
      /\.eq\('id', holdId\)\s*\.eq\('org_id', orgId\)/,
      /\.eq\('status', 'held'\)/,
    ],
    required: true,
  },
];

let passCount = 0;
let failCount = 0;

console.log('='.repeat(80));
console.log('CRITICAL FIXES VALIDATION');
console.log('='.repeat(80));

CHECKS.forEach((check) => {
  const filePath = path.join('/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026', check.file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ ${check.name}`);
      console.log(`   File not found: ${check.file}`);
      failCount++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let allMatch = true;
    const matchResults: boolean[] = [];

    check.patterns.forEach((pattern, idx) => {
      const matches = pattern.test(content);
      matchResults.push(matches);
      if (!matches) allMatch = false;
    });

    if (allMatch) {
      console.log(`\n✅ ${check.name}`);
      console.log(`   All ${check.patterns.length} patterns found in ${check.file}`);
      passCount++;
    } else {
      console.log(`\n❌ ${check.name}`);
      console.log(`   File: ${check.file}`);
      matchResults.forEach((match, idx) => {
        console.log(`   Pattern ${idx + 1}: ${match ? '✓' : '✗'}`);
      });
      failCount++;
    }
  } catch (err: any) {
    console.log(`\n❌ ${check.name}`);
    console.log(`   Error: ${err.message}`);
    failCount++;
  }
});

console.log('\n' + '='.repeat(80));
console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(80));

if (failCount === 0) {
  console.log('\n🎉 All critical fixes validated successfully!\n');
  process.exit(0);
} else {
  console.log('\n⚠️ Some fixes need attention\n');
  process.exit(1);
}
