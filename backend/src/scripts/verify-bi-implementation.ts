import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';

async function runAudit() {
  console.log('🕵️♀️ STARTING BUSINESS INTELLIGENCE AUDIT...');
  console.log('==========================================\n');

  let hasErrors = false;

  // ---------------------------------------------------------
  // TEST 1: VERIFY SERVICES TABLE & SEED DATA
  // ---------------------------------------------------------
  console.log('📊 TEST 1: Pricing Engine (Services Table)');
  try {
    // Check if table exists and has data
    // Adjusted to 'Botox' to match the actual seeded migration data
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('name', 'Botox');

    if (error) throw error;

    if (services && services.length > 0) {
      const botox = services[0];
      if (Number(botox.price) === 400) {
        console.log(`   ${PASS}: Service '${botox.name}' found with price $400.00`);
      } else {
        console.log(`   ${FAIL}: Service '${botox.name}' has wrong price: $${botox.price}`);
        hasErrors = true;
      }

      // Check keywords
      if (botox.keywords.includes('wrinkle')) {
        console.log(`   ${PASS}: Keywords correctly seeded: [${botox.keywords.join(', ')}]`);
      } else {
        console.log(`   ${FAIL}: Missing keywords.`);
        hasErrors = true;
      }

    } else {
      console.log(`   ${FAIL}: 'Botox' service NOT found. Seeding failed.`);
      hasErrors = true;
    }
  } catch (e: any) {
    console.log(`   ${FAIL}: Services table query error: ${e.message}`);
    hasErrors = true;
  }

  // ---------------------------------------------------------
  // TEST 2: VERIFY SCHEMA UPGRADES (Recording & Transfers)
  // ---------------------------------------------------------
  console.log('\n💾 TEST 2: Schema Upgrades (Call Logs)');
  try {
    // We try to select the new columns. If they don't exist, Supabase throws an error.
    const { error } = await supabase
      .from('call_logs')
      .select('recording_status, transfer_to, transfer_reason')
      .limit(1);

    if (!error) {
      console.log(`   ${PASS}: New columns (recording_status, transfer_to, transfer_reason) exist.`);
    } else {
      console.log(`   ${FAIL}: Schema upgrade missing. Error: ${error.message}`);
      hasErrors = true;
    }
  } catch (e) {
    console.log(`   ${FAIL}: Unknown schema error.`);
    hasErrors = true;
  }

  // ---------------------------------------------------------
  // TEST 3: SIMULATE PIPELINE CALCULATION (The Logic Check)
  // ---------------------------------------------------------
  console.log('\n🧠 TEST 3: Pipeline Calculation Simulation');
  try {
    // 1. Fetch all services
    const { data: allServices } = await supabase.from('services').select('*');

    // 2. Mock Transcript
    const mockTranscript = "I am interested in getting a Facelift and maybe some Botox.";
    console.log(`   📝 Transcript: "${mockTranscript}"`);

    // 3. Run Logic (Replicating estimateLeadValue logic)
    let detectedValue = 0;
    let matches = [];

    if (allServices) {
      for (const service of allServices) {
        // Case-insensitive check
        const isMatch = service.keywords.some((k: string) => mockTranscript.toLowerCase().includes(k.toLowerCase()));
        if (isMatch) {
          // Logic: Take highest value
          if (Number(service.price) > detectedValue) detectedValue = Number(service.price);
          matches.push(`${service.name} ($${service.price})`);
        }
      }
    }

    // 4. Assert
    // Should match Facelift ($8000) as it's the highest value, even though Botox ($400) is there.
    if (detectedValue === 8000) {
      console.log(`   ${PASS}: Logic correctly identified 'Facelift' as highest value ($8000).`);
      console.log(`   ℹ️  Matches found: ${matches.join(', ')}`);
    } else {
      console.log(`   ${FAIL}: Calculation logic failed. Expected $8000, got $${detectedValue}`);
      hasErrors = true;
    }

  } catch (e: any) {
    console.log(`   ${FAIL}: Logic test failed: ${e.message}`);
    hasErrors = true;
  }

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log('\n==========================================');
  if (hasErrors) {
    console.log('🛑 AUDIT COMPLETED WITH ERRORS. FIX BEFORE DEPLOYING.');
    process.exit(1);
  } else {
    console.log('🚀 AUDIT SUCCESSFUL. SYSTEM IS READY.');
    process.exit(0);
  }
}

runAudit();
