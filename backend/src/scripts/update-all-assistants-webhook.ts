/**
 * Update All Vapi Assistants Webhook URL Script
 *
 * Purpose: Update all active assistants with new production webhook URL
 * Usage: Run after deploying to production or when BACKEND_URL changes
 *
 * Command: npx ts-node backend/src/scripts/update-all-assistants-webhook.ts
 *
 * CRITICAL: This script must be run after deployment to ensure live calls work
 */

import { createClient } from '@supabase/supabase-js';
import { VapiClient } from '../services/vapi-client';
import { log } from '../services/logger';

// Load environment variables
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });

const BACKEND_URL = process.env.BACKEND_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

async function updateAllWebhooks() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ Update All Vapi Assistants Webhook URL                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Validate environment variables
  if (!BACKEND_URL) {
    console.error('❌ ERROR: BACKEND_URL not configured in .env');
    console.error('   Please set BACKEND_URL to your production URL (e.g., https://voxanne-backend.onrender.com)');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: Supabase credentials not configured');
    process.exit(1);
  }

  if (!VAPI_PRIVATE_KEY) {
    console.error('❌ ERROR: VAPI_PRIVATE_KEY not configured');
    process.exit(1);
  }

  // Warn if using ngrok
  if (BACKEND_URL.includes('ngrok')) {
    console.warn('⚠️  WARNING: BACKEND_URL is using ngrok');
    console.warn('   This is an ephemeral URL that will expire on restart');
    console.warn('   For production, deploy to Render/Vercel with a static URL');
    console.warn('   Current URL: ' + BACKEND_URL + '\n');
  }

  console.log(`📍 Backend URL: ${BACKEND_URL}`);
  console.log(`🎯 Webhook endpoint: ${BACKEND_URL}/api/vapi/webhook\n`);

  // Initialize clients
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const vapi = new VapiClient(VAPI_PRIVATE_KEY!);

  try {
    // 1. Get all active assistants from database
    console.log('📊 Fetching active assistants from database...');
    const { data: agents, error } = await supabase
      .from('agents')
      .select('vapi_assistant_id, org_id, role')
      .eq('active', true);

    if (error) {
      console.error('❌ Database query failed:', error.message);
      process.exit(1);
    }

    if (!agents || agents.length === 0) {
      console.log('ℹ️  No active assistants found');
      process.exit(0);
    }

    console.log(`✅ Found ${agents.length} active assistant(s)\n`);

    // 2. Update each assistant's serverUrl
    let successCount = 0;
    let failureCount = 0;

    for (const agent of agents) {
      const { vapi_assistant_id, org_id, role } = agent;

      try {
        console.log(`🔄 Updating ${vapi_assistant_id} (${role})...`);

        // Update assistant with new webhook URL
        await vapi.updateAssistant(vapi_assistant_id, {
          serverUrl: `${BACKEND_URL}/api/vapi/webhook`
        });

        console.log(`   ✅ Updated successfully`);
        successCount++;

      } catch (err: any) {
        console.error(`   ❌ Failed: ${err.message}`);
        failureCount++;

        // Log detailed error for debugging
        if (err.response?.data) {
          console.error(`   Details: ${JSON.stringify(err.response.data)}`);
        }
      }
    }

    // 3. Summary
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║ Update Summary                                                       ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
    console.log(`✅ Successful: ${successCount}/${agents.length}`);
    console.log(`❌ Failed: ${failureCount}/${agents.length}`);

    if (successCount === agents.length) {
      console.log('\n🎉 All assistants updated successfully!');
      console.log('   Live calls will now use the new webhook URL');
    } else {
      console.log('\n⚠️  Some updates failed - manual intervention may be required');
      console.log('   Check Vapi dashboard: https://dashboard.vapi.ai');
    }

    console.log('\n📋 Next Steps:');
    console.log('   1. Verify webhook health: curl ' + BACKEND_URL + '/api/webhook/health');
    console.log('   2. Run full-scope test: npm run test:full-scope');
    console.log('   3. Make a test call to verify live call functionality');

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
updateAllWebhooks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
