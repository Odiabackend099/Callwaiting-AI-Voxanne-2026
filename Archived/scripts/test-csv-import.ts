/**
 * Test script for CSV Import functionality
 * Run: npx ts-node scripts/test-csv-import.ts
 */

import { validateCsv, importCsvLeads } from '../src/services/csv-import-service';

const testCsv = `phone,name,company_name,email,country,city,notes,source
+2348012345678,John Doe,Acme Clinic,john@acme.com,Nigeria,Lagos,Interested in demo,google_maps
+2348098765432,Jane Smith,Best Health,jane@besthealth.ng,Nigeria,Abuja,Follow up next week,referral
08033445566,Bob Local,Local Clinic,,Nigeria,Ibadan,Local format phone,manual
invalid-phone,Bad Data,Test Corp,,USA,NYC,Should fail validation,test`;

async function main() {
  console.log('=== CSV Import Test ===\n');

  // Test 1: Validate CSV
  console.log('1. Testing CSV Validation...');
  const validation = await validateCsv(testCsv);
  
  console.log('   Valid:', validation.valid);
  console.log('   Headers:', validation.headers);
  console.log('   Total Rows:', validation.totalRows);
  console.log('   Suggested Mapping:', validation.suggestedMapping);
  
  if (validation.errors.length > 0) {
    console.log('   Errors:', validation.errors);
  }

  console.log('\n   Sample Rows:');
  validation.sampleRows.forEach((row, i) => {
    console.log(`   Row ${i + 1}:`, row);
  });

  console.log('\n✅ Validation test complete\n');

  // Test 2: Phone normalization (dry run - don't actually import)
  console.log('2. Phone Normalization Examples:');
  const phones = [
    '+2348012345678',  // Already E.164
    '08012345678',     // Nigerian local format
    '2348012345678',   // Without +
    '8012345678',      // Short Nigerian
    '+14155551234',    // US number
    '4155551234',      // US without country code
  ];

  phones.forEach(phone => {
    const normalized = normalizePhone(phone);
    console.log(`   ${phone} → ${normalized}`);
  });

  console.log('\n✅ All tests complete!');
}

// Copy of normalizePhone for testing
function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  
  let cleaned = phone.trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');
  
  if (cleaned.length < 7 || cleaned.length > 15) {
    return null;
  }
  
  if (!hasPlus && cleaned.length >= 10) {
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    }
    else if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
  }
  
  return '+' + cleaned;
}

main().catch(console.error);
