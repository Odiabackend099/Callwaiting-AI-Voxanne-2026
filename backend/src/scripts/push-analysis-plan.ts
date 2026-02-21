/**
 * push-analysis-plan.ts
 *
 * Pushes the analysisPlan configuration to both inbound and outbound
 * Vapi assistants, then verifies it was applied by reading back.
 *
 * Usage: npx ts-node src/scripts/push-analysis-plan.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ANALYSIS_PLAN = {
  summaryPrompt: 'You are a clinical call analyst for a healthcare AI receptionist. Summarize this call in 2-3 sentences, focusing on: what the caller wanted, what actions were taken (appointment booked, information provided, etc.), and the outcome. Be specific about services discussed and any scheduling details.',
  structuredDataPrompt: 'Extract the following from the call transcript. For sentiment, consider the caller\'s tone, satisfaction level, and emotional state throughout the conversation.',
  structuredDataSchema: {
    type: 'object',
    properties: {
      sentimentScore: { type: 'number', description: 'Caller sentiment score from 0.0 (very negative) to 1.0 (very positive)' },
      sentimentUrgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Call urgency: critical if urgent medical need, high if time-sensitive, medium for standard, low for informational' },
      shortOutcome: { type: 'string', description: 'Brief 1-3 word outcome like: Booking Confirmed, Information Provided, Follow-up Scheduled, Caller Frustrated, Call Dropped' },
      appointmentBooked: { type: 'boolean', description: 'Whether an appointment was successfully booked during this call' },
      serviceDiscussed: { type: 'string', description: 'The main service or topic discussed (e.g., Botox, consultation, teeth cleaning)' }
    },
    required: ['sentimentScore', 'sentimentUrgency', 'shortOutcome', 'appointmentBooked']
  },
  successEvaluationPrompt: 'Evaluate if this call achieved its goal. A call is successful if: the caller got the information they needed, OR an appointment was booked, OR they were properly directed to the right resource. A call fails if: the caller was frustrated, the AI could not help, tools failed, or the caller hung up without resolution.',
  successEvaluationRubric: 'PassFail'
};

async function pushAnalysisPlan() {
  console.log('=== Push analysisPlan to Vapi Assistants ===\n');

  // 1. Get all agents with Vapi assistant IDs
  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('id, role, vapi_assistant_id, org_id')
    .not('vapi_assistant_id', 'is', null);

  if (agentsError) {
    console.error('Failed to fetch agents:', agentsError.message);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.error('No agents found with Vapi assistant IDs');
    process.exit(1);
  }

  console.log(`Found ${agents.length} agent(s) with Vapi assistant IDs:\n`);

  // 2. Get Vapi API key - try integrations table, fall back to env var
  const orgIds = [...new Set(agents.map(a => a.org_id))];
  const orgApiKeyMap: Record<string, string> = {};

  // Try to get from integrations table (encrypted Vapi credentials)
  for (const orgId of orgIds) {
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'vapi')
      .maybeSingle();

    if (integration?.config?.vapi_api_key) {
      orgApiKeyMap[orgId] = integration.config.vapi_api_key;
    } else if (integration?.config?.vapi_secret_key) {
      orgApiKeyMap[orgId] = integration.config.vapi_secret_key;
    }
  }

  // Fallback to VAPI_PRIVATE_KEY from env
  const fallbackApiKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;

  for (const agent of agents) {
    const vapiApiKey = orgApiKeyMap[agent.org_id] || fallbackApiKey;
    if (!vapiApiKey) {
      console.error(`  [SKIP] No Vapi API key for agent ${agent.role} (org: ${agent.org_id})`);
      continue;
    }

    console.log(`  Agent: ${agent.role}`);
    console.log(`  Assistant ID: ${agent.vapi_assistant_id}`);
    console.log(`  Org ID: ${agent.org_id}`);

    // 3. Push analysisPlan via Vapi REST API (PATCH)
    try {
      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${agent.vapi_assistant_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          analysisPlan: ANALYSIS_PLAN
        })
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        console.error(`  [FAIL] PATCH failed (${updateResponse.status}): ${errorBody}`);
        continue;
      }

      const updateResult = await updateResponse.json();
      console.log(`  [OK] PATCH succeeded`);

      // 4. Verify by reading back
      const getResponse = await fetch(`https://api.vapi.ai/assistant/${agent.vapi_assistant_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`
        }
      });

      if (!getResponse.ok) {
        console.error(`  [WARN] GET verification failed (${getResponse.status})`);
        continue;
      }

      const assistant = await getResponse.json();
      const ap = assistant.analysisPlan;

      console.log(`\n  --- Verification for ${agent.role} assistant ---`);
      console.log(`  analysisPlan present: ${!!ap}`);
      if (ap) {
        console.log(`  summaryPrompt: "${(ap.summaryPrompt || '').substring(0, 60)}..."`);
        console.log(`  structuredDataSchema: ${ap.structuredDataSchema ? 'PRESENT' : 'MISSING'}`);
        if (ap.structuredDataSchema?.properties) {
          const props = Object.keys(ap.structuredDataSchema.properties);
          console.log(`  schema properties: [${props.join(', ')}]`);
        }
        console.log(`  successEvaluationPrompt: "${(ap.successEvaluationPrompt || '').substring(0, 60)}..."`);
        console.log(`  successEvaluationRubric: ${ap.successEvaluationRubric}`);
      }
      console.log(`  --- End verification ---\n`);

    } catch (err: any) {
      console.error(`  [ERROR] ${err.message}`);
    }
  }

  console.log('\n=== Done ===');
}

pushAnalysisPlan().catch(console.error);
